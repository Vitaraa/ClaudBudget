'use strict';
/* ============================================================
   Claud — duplicate / recurring matching.

   Pure logic, CommonJS, depends ONLY on node:crypto. This module
   must NOT require db.js: it receives the (already-wrapped, so
   decrypting) db as a parameter to its lookup functions, which keeps
   the dependency one-directional (db.js -> dedup.js) and avoids a
   circular require. db.js calls computeMatchKey from here during its
   one-time match_key backfill; routes.js uses the lookups.

   A "match key" is a cheap, indexable fingerprint of (account, signed
   cents, date) used to narrow candidates; the real duplicate decision
   is made by isDuplicateOf, which also fuzzes the date window and the
   merchant name. Amounts are SIGN-PRESERVING throughout: a +15.99
   refund and a −15.99 charge never collapse together.
   ============================================================ */
const crypto = require('node:crypto');

/* ---- stable fingerprint ----------------------------------------------------
   sha256( accountId | signedCents | date ), first 16 hex chars. Sign-preserving:
   Math.round(amount*100) keeps the minus for an outflow, so a charge and its
   refund get different keys. accountId may be empty (unassigned txn). */
function computeMatchKey(accountId, amount, date) {
  const cents = Math.round(Number(amount) * 100);   // signed
  const basis = (accountId || '') + '|' + String(cents) + '|' + (date || '');
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

/* ---- name normalisation ----------------------------------------------------
   Lowercase, punctuation -> spaces, drop payment-rail noise tokens, collapse.
   Deliberately small + deterministic so server and client can agree. */
const NOISE_TOKENS = new Set([
  'pos', 'purchase', 'payment', 'debit', 'credit',
  'visa', 'mastercard', 'amex',
  'recurring', 'interac', 'eft', 'ach',
  'preauth', 'pre-auth', 'preauthorized', 'pre-authorized', 'preauthorised', 'pre-authorised'
]);
function normName(raw) {
  let s = String(raw == null ? '' : raw).toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, ' ');                 // punctuation -> spaces
  const toks = s.split(' ').filter((t) => t && !NOISE_TOKENS.has(t));
  return toks.join(' ').replace(/\s+/g, ' ').trim();
}

/* ---- fuzzy name match ------------------------------------------------------
   Equal after normalisation, OR one normalised name contains the other
   (length >= 3 so tiny fragments don't over-match), OR the two token sets
   overlap by Jaccard >= 0.5. */
function nameSimilar(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true;
  const sa = new Set(na.split(' ').filter(Boolean));
  const sb = new Set(nb.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return false;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union > 0 && (inter / union) >= 0.5;
}

/* ---- scalar comparisons ---------------------------------------------------- */
function sameCents(a, b) {
  return Math.round(Math.abs(Number(a)) * 100) === Math.round(Math.abs(Number(b)) * 100);
}

// Parse a YYYY-MM-DD date at local midnight and shift it by whole days, back to
// YYYY-MM-DD. Used to derive the SQL date-window bounds for findDuplicate.
function isoShift(date, days) {
  const d = new Date(String(date) + 'T00:00:00');
  if (isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function withinDays(d1, d2, days = 3) {
  const t1 = Date.parse(String(d1) + 'T00:00:00');
  const t2 = Date.parse(String(d2) + 'T00:00:00');
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= days * 86400000;
}

// Account-aware, but tolerant: only constrain when BOTH sides name an account.
function accountOk(aId, bId) {
  if (aId && bId) return aId === bId;
  return true;
}

/* ---- the duplicate decision ------------------------------------------------
   `incoming` = the txn being added; `c` = an existing candidate row. opts.days
   widens/narrows the date window (default 3). opts.sameSign additionally
   requires the signs to match — used by import so a +refund never skips a
   −charge of the same magnitude. */
function isDuplicateOf(incoming, c, opts) {
  opts = opts || {};
  const days = opts.days != null ? opts.days : 3;
  if (!sameCents(incoming.amount, c.amount)) return false;
  if (!withinDays(incoming.date, c.date, days)) return false;
  if (!accountOk(incoming.account_id, c.account_id)) return false;
  if (opts.sameSign && Math.sign(Number(incoming.amount)) !== Math.sign(Number(c.amount))) return false;
  if (!nameSimilar(incoming.name, c.name)) return false;
  return true;
}

/* ---- DB lookups (db is the WRAPPED, decrypting handle) --------------------- */
// Find an existing transaction that `incoming` duplicates, within ±3 days.
// The date column is plaintext so the BETWEEN window runs in SQL; amount/name/
// account_name come back decrypted via the wrapper. sameSign:true so refunds
// (opposite sign) are never reported as duplicates.
function findDuplicate(db, uid, incoming) {
  const lo = isoShift(incoming.date, -3);
  const hi = isoShift(incoming.date, 3);
  const rows = db.prepare(
    'SELECT id, account_id, account_name, amount, name, date, recurring_id, origin FROM transactions WHERE user_id = ? AND date BETWEEN ? AND ?'
  ).all(uid, lo, hi);
  for (const c of rows) {
    if (isDuplicateOf(incoming, c, { sameSign: true })) return c;
  }
  return null;
}

/* ---- recurring matching ----------------------------------------------------
   Only outflows (amount < 0) can match a recurring rule. A rule matches when the
   name is similar, the magnitude is within 1% (min 1¢), the account is
   compatible, and the date is within ±5 days of the rule's next_date. Recurring
   rows arrive decrypted via the wrapped db. */
function matchRecurring(db, uid, incoming) {
  if (!(Number(incoming.amount) < 0)) return null;
  const rules = db.prepare('SELECT * FROM recurring WHERE user_id = ?').all(uid);
  const inAmt = Math.abs(Number(incoming.amount));
  for (const rule of rules) {
    if (!nameSimilar(incoming.name, rule.name)) continue;
    const rAmt = Math.abs(Number(rule.amount));
    const tol = Math.max(0.01, rAmt * 0.01);
    if (Math.abs(inAmt - rAmt) > tol) continue;
    if (!accountOk(incoming.account_id, rule.account_id)) continue;
    if (rule.next_date && !withinDays(incoming.date, rule.next_date, 5)) continue;
    return rule;
  }
  return null;
}

/* ---- advance a recurring rule's schedule (best-effort) ---------------------
   After logging a charge that matched a rule, roll its next_date forward one
   cadence step so the next statement's charge lines up with the new date.
   Only advances when the charge is on/after the current next_date. Never throws
   — a schedule that can't be advanced just stays put. */
function maybeAdvanceRecurring(db, uid, rule, date) {
  try {
    if (!rule || !rule.next_date) return;
    if (!(String(date) >= String(rule.next_date))) return;   // charge is before the due date
    const d = new Date(String(rule.next_date) + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const cadence = String(rule.cadence || 'monthly').toLowerCase();
    if (cadence === 'weekly') d.setDate(d.getDate() + 7);
    else if (cadence === 'biweekly' || cadence === 'bi-weekly' || cadence === 'fortnightly') d.setDate(d.getDate() + 14);
    else if (cadence === 'annual' || cadence === 'annually' || cadence === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);                       // monthly (default)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    db.prepare('UPDATE recurring SET next_date = ? WHERE id = ? AND user_id = ?').run(next, rule.id, uid);
  } catch (e) { /* never let a schedule nudge break an import */ }
}

module.exports = {
  computeMatchKey,
  normName,
  nameSimilar,
  sameCents,
  withinDays,
  accountOk,
  isDuplicateOf,
  findDuplicate,
  matchRecurring,
  maybeAdvanceRecurring,
  isoShift
};
