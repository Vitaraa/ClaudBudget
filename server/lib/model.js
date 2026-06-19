'use strict';
/* ============================================================
   Claud — at-rest field encryption, applied at the SQL boundary.

   wrap(rawDb) returns a drop-in for the node:sqlite database whose
   prepare() transparently:
     • encrypts sensitive columns on INSERT / UPDATE, and
     • decrypts (and numerically coerces) them on SELECT.

   It does this by parsing the (very regular) SQL this app uses to map
   positional `?` params to column names. Driven by ENCRYPTED_FIELDS
   below. Only statements that do arithmetic or equality ON a sensitive
   column need hand-rewriting (see routes.js / compute.js) — because you
   can't add to, or match against, ciphertext in SQL. Everything else is
   automatic, so the route handlers stay unchanged.

   Structural / temporal columns (ids, foreign keys, dates, sort, flags,
   created_at, email, plan) are deliberately left plaintext so they stay
   queryable and indexable, and so the server can still send email / log
   users in. The leak surface of a stolen DB is therefore: row counts,
   timestamps, and email addresses — never names, amounts, balances,
   categories, notes, tickers, or goals.
   ============================================================ */
const { enc, dec, isEnc } = require('./crypto');

// Sensitive columns per table (encrypted at rest).
const ENCRYPTED_FIELDS = {
  users:               ['name'],
  accounts:            ['name', 'institution', 'mask', 'balance'],
  transactions:        ['name', 'category', 'amount', 'account_name', 'note', 'tags', 'splits', 'attachment', 'history'],
  rules:               ['match', 'category'],
  budget_groups:       ['label'],
  budget_categories:   ['name', 'budget', 'roll'],
  recurring:           ['name', 'amount', 'category'],
  goals:               ['name', 'target', 'saved', 'monthly'],
  goal_contributions:  ['amount'],
  holdings:            ['ticker', 'name', 'shares', 'price', 'cost'],
  foresight_plans:     ['name', 'data'],
  foresight_overrides: ['amount'],
  settings:            ['data']
};

// Of those, the ones to coerce back to Number after decryption (the rest
// stay strings — including the JSON-text columns tags/splits/history/data).
const NUMERIC_FIELDS = {
  accounts:            ['balance'],
  transactions:        ['amount'],
  budget_categories:   ['budget', 'roll'],
  recurring:           ['amount'],
  goals:               ['target', 'saved', 'monthly'],
  goal_contributions:  ['amount'],
  holdings:            ['shares', 'price', 'cost'],
  foresight_overrides: ['amount']
};

// Primary keys, used only by the one-time migration to address rows.
const TABLE_PK = {
  users: ['id'], accounts: ['id'], transactions: ['id'], rules: ['id'],
  budget_groups: ['id'], budget_categories: ['id'], recurring: ['id'],
  goals: ['id'], goal_contributions: ['id'], holdings: ['id'],
  foresight_plans: ['id'], foresight_overrides: ['user_id', 'cat', 'year'],
  settings: ['user_id']
};

const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

/* Decrypt sensitive columns present in a row (mutates + returns it). */
function decodeRow(table, row) {
  if (!row || typeof row !== 'object') return row;
  const fields = ENCRYPTED_FIELDS[table];
  if (!fields) return row;
  const nums = NUMERIC_FIELDS[table] || [];
  for (const f of fields) {
    if (!(f in row)) continue;
    const v = row[f];
    if (v == null) continue;
    if (isEnc(v)) {
      const plain = dec(v);
      row[f] = nums.includes(f) ? Number(plain) : plain;
    } else if (nums.includes(f) && typeof v === 'string') {
      // tolerate a not-yet-migrated numeric value stored as text
      const n = Number(v);
      if (!Number.isNaN(n)) row[f] = n;
    }
  }
  return row;
}

/* Which positional params (0-based) of a write statement hold sensitive
   column values? Returns { idx } or null. */
function writePlan(sql) {
  const s = norm(sql);

  const ins = /^INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i.exec(s);
  if (ins) {
    const fields = ENCRYPTED_FIELDS[ins[1]];
    if (!fields) return null;
    const cols = ins[2].split(',').map((c) => c.trim());
    const vals = ins[3].split(',').map((v) => v.trim());
    const idx = [];
    let p = 0;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] !== '?') continue;          // literal in VALUES -> no param slot
      if (fields.includes(cols[i])) idx.push(p);
      p++;
    }
    return idx.length ? { idx } : null;
  }

  const upd = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s.*)?$/i.exec(s);
  if (upd) {
    const fields = ENCRYPTED_FIELDS[upd[1]];
    if (!fields) return null;
    const idx = [];
    let p = 0;
    for (const a of upd[2].split(',')) {        // SET list has no nested commas here
      const assign = a.trim();
      const q = (assign.match(/\?/g) || []).length;
      const m = /^(\w+)\s*=\s*\?$/.exec(assign);   // simple `col = ?` binding
      if (m && q === 1) { if (fields.includes(m[1])) idx.push(p); p += 1; }
      else p += q;                                 // arithmetic/literal -> advance, don't encrypt
    }
    return idx.length ? { idx } : null;
  }
  return null;
}

/* Table a SELECT reads from (so we know which columns to decrypt). */
function readTable(sql) {
  const s = norm(sql);
  if (!/^SELECT\b/i.test(s)) return null;
  const m = /\bFROM\s+(\w+)/i.exec(s);
  return m ? m[1] : null;
}

/* Drop-in wrapper around a node:sqlite DatabaseSync. */
function wrap(rawDb) {
  const plans = new Map();
  const planFor = (sql) => {
    let pl = plans.get(sql);
    if (!pl) { pl = { write: writePlan(sql), read: readTable(sql) }; plans.set(sql, pl); }
    return pl;
  };
  return {
    prepare(sql) {
      const stmt = rawDb.prepare(sql);
      const plan = planFor(sql);
      const encodeArgs = (args) => {
        if (!plan.write) return args;
        const out = args.slice();
        for (const i of plan.write.idx) if (i < out.length && out[i] != null) out[i] = enc(out[i]);
        return out;
      };
      return {
        run: (...args) => stmt.run(...encodeArgs(args)),
        get: (...args) => (plan.read ? decodeRow(plan.read, stmt.get(...args)) : stmt.get(...args)),
        all: (...args) => {
          const rows = stmt.all(...args);
          if (plan.read) for (const r of rows) decodeRow(plan.read, r);
          return rows;
        }
      };
    },
    exec: (sql) => rawDb.exec(sql)
  };
}

/* One-time, idempotent: encrypt any pre-existing plaintext rows. Uses rawDb
   directly (NOT the wrapper) so it writes ciphertext as-is. Safe to run on
   every boot — already-encrypted values (isEnc) and empty tables are skipped. */
function migrateEncryption(rawDb) {
  for (const table of Object.keys(ENCRYPTED_FIELDS)) {
    const fields = ENCRYPTED_FIELDS[table];
    const pk = TABLE_PK[table];
    let rows;
    try { rows = rawDb.prepare(`SELECT * FROM ${table}`).all(); }
    catch { continue; }                       // table doesn't exist yet
    for (const row of rows) {
      const sets = [], vals = [];
      for (const f of fields) {
        const v = row[f];
        if (v == null || isEnc(v)) continue;  // null or already encrypted
        sets.push(`${f} = ?`); vals.push(enc(v));
      }
      if (!sets.length) continue;
      const where = pk.map((k) => `${k} = ?`).join(' AND ');
      for (const k of pk) vals.push(row[k]);
      rawDb.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${where}`).run(...vals);
    }
  }
}

module.exports = { wrap, migrateEncryption, decodeRow, ENCRYPTED_FIELDS, NUMERIC_FIELDS, TABLE_PK };
