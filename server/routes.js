'use strict';
/* ============================================================
   Claud API — all routes. Every data route is auth-scoped to the
   token's user; ownership is enforced on every read and write.
   ============================================================ */
const { db, tx } = require('./lib/db');
const { newId, HttpError } = require('./lib/http');
const auth = require('./lib/auth');
const compute = require('./lib/compute');

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/* ----------------------------------------------------------- validators */
const str = (v, name, { required = false, max = 2000 } = {}) => {
  if (v == null || v === '') { if (required) throw new HttpError(400, `${name} is required`); return null; }
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `${name} is too long`);
  return s;
};
const num = (v, name, { required = false, def = 0 } = {}) => {
  if (v == null || v === '') { if (required) throw new HttpError(400, `${name} is required`); return def; }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `${name} must be a number`);
  return n;
};
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
const jparse = (s, fallback) => { try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; } };

/* ----------------------------------------------------- ownership helper */
function ownedRow(table, id, uid) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(id, uid);
  if (!row) throw new HttpError(404, 'Not found');
  return row;
}

/* --------------------------------------------------------- row mappers */
function txnRow(r) {
  if (!r) return r;
  return {
    id: r.id, account_id: r.account_id, account: r.account_name, account_name: r.account_name,
    name: r.name, cat: r.category, category: r.category, amount: r.amount, amt: r.amount,
    date: r.date, day: r.date, icon: r.icon,
    review: !!r.review, reason: r.reason, excluded: !!r.excluded,
    note: r.note || '', tags: jparse(r.tags, []), splits: jparse(r.splits, []),
    attachment: r.attachment || null, history: jparse(r.history, [])
  };
}
function goalRow(g) {
  const contributions = db.prepare(
    'SELECT id, amount, date, from_account_id FROM goal_contributions WHERE goal_id = ? ORDER BY date'
  ).all(g.id);
  return {
    id: g.id, name: g.name, icon: g.icon, target: g.target, saved: g.saved, have: g.saved,
    monthly: g.monthly, auto: !!g.auto, account_id: g.account_id, color: g.color,
    created_at: g.created_at, contributions,
    pct: g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0
  };
}
function holdingRow(h) {
  const value = (h.shares || 0) * (h.price || 0);
  const cost = h.cost != null ? h.cost : h.price;
  const ret = cost > 0 ? ((h.price / cost) - 1) * 100 : 0;
  return { ...h, value: Math.round(value * 100) / 100, ret: Math.round(ret * 100) / 100 };
}
function planRow(p) { return { id: p.id, kind: p.kind, name: p.name, ...jparse(p.data, {}) }; }

/* ----------------------------------------------------- default budget */
/* The starter budget a new account begins with (and that the Budget page can
   restore from its empty state). Monthly $ amounts in today's dollars. */
const DEFAULT_BUDGET = [
  { label: 'Essentials', cats: [
    { name: 'Housing', budget: 1700, color: '#c0763e' },
    { name: 'Groceries', budget: 700, color: '#7a9a52' },
    { name: 'Utilities', budget: 260, color: '#9a8048' },
    { name: 'Transport', budget: 300, color: '#5a93a8' },
    { name: 'Insurance', budget: 180, color: '#8a6fae' } ] },
  { label: 'Lifestyle', cats: [
    { name: 'Dining', budget: 300, color: '#cf6b3f' },
    { name: 'Shopping', budget: 400, color: '#b06a8c' },
    { name: 'Entertainment', budget: 150, color: '#5a8aa8' },
    { name: 'Subscriptions', budget: 120, color: '#7e7a3c' } ] },
  { label: 'Health & other', cats: [
    { name: 'Health & fitness', budget: 250, color: '#4f9a6a' },
    { name: 'Misc', budget: 240, color: '#a88a72' } ] },
  { label: 'Savings goals', cats: [
    { name: 'Emergency fund', budget: 800, color: '#4f9a6a' },
    { name: 'General savings', budget: 250, color: '#5a93a8' } ] }
];

/* Create the default groups/categories for a user. No-op (returns false) if the
   user already has any budget group, so it's safe to call on existing accounts. */
function seedDefaultBudget(uid) {
  const existing = db.prepare('SELECT COUNT(*) c FROM budget_groups WHERE user_id = ?').get(uid).c;
  if (existing > 0) return false;
  tx(() => {
    let gi = 0;
    for (const g of DEFAULT_BUDGET) {
      const gid = newId('bg_');
      db.prepare('INSERT INTO budget_groups (id,user_id,label,sort) VALUES (?,?,?,?)').run(gid, uid, g.label, gi++);
      let ci = 0;
      for (const c of g.cats) {
        db.prepare('INSERT INTO budget_categories (id,user_id,group_id,name,budget,color,roll,sort) VALUES (?,?,?,?,?,?,?,?)')
          .run(newId('bc_'), uid, gid, c.name, c.budget, c.color, 0, ci++);
      }
    }
  });
  return true;
}

/* --------------------------------------------------------- rule helper */
function applyRules(uid, name) {
  if (!name) return null;
  const rules = db.prepare('SELECT * FROM rules WHERE user_id = ?').all(uid);
  const lower = name.toLowerCase();
  for (const r of rules) if (r.match && lower.includes(r.match.toLowerCase())) return r.category;
  return null;
}

/* =====================================================================
   REGISTER ROUTES
   ===================================================================== */
function register(router) {
  /* ----------------------------------------------------------- AUTH */
  router.post('/api/auth/register', async (req, res, ctx) => {
    const email = (str(ctx.body.email, 'Email', { required: true }) || '').toLowerCase();
    const name = str(ctx.body.name, 'Name', { max: 120 });
    const password = String(ctx.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) throw new HttpError(409, 'An account with that email already exists');
    const { salt, hash } = auth.hashPassword(password);
    const info = db.prepare(
      'INSERT INTO users (email, name, pw_salt, pw_hash, plan, created_at) VALUES (?,?,?,?,?,?)'
    ).run(email, name, salt, hash, 'free', nowISO());
    db.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?)').run(info.lastInsertRowid, '{}');
    // New accounts start with the default budget groups/categories.
    try { seedDefaultBudget(info.lastInsertRowid); } catch (e) { console.error('seedDefaultBudget failed:', e); }
    const user = auth.getUserById(info.lastInsertRowid);
    ctx.json(200, { token: auth.makeToken(user.id), user: auth.publicUser(user) });
  });

  router.post('/api/auth/login', async (req, res, ctx) => {
    const email = (str(ctx.body.email, 'Email', { required: true }) || '').toLowerCase();
    const password = String(ctx.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !auth.verifyPassword(password, user.pw_salt, user.pw_hash))
      throw new HttpError(401, 'Email or password is incorrect');
    ctx.json(200, { token: auth.makeToken(user.id), user: auth.publicUser(user) });
  });

  router.get('/api/auth/me', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { user: auth.publicUser(ctx.user) });
  }));

  router.post('/api/auth/plan', auth.requireAuth(async (req, res, ctx) => {
    const plan = str(ctx.body.plan, 'plan', { required: true });
    if (!['free', 'pro'].includes(plan)) throw new HttpError(400, 'Unknown plan');
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, ctx.user.id);
    ctx.json(200, { user: auth.publicUser(auth.getUserById(ctx.user.id)) });
  }));

  router.put('/api/auth/profile', auth.requireAuth(async (req, res, ctx) => {
    const name = str(ctx.body.name, 'name', { max: 120 });
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, ctx.user.id);
    ctx.json(200, { user: auth.publicUser(auth.getUserById(ctx.user.id)) });
  }));

  /* ------------------------------------------------------- BOOTSTRAP */
  router.get('/api/bootstrap', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort, created_at').all(uid);
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC').all(uid).map(txnRow);
    const rules = db.prepare('SELECT * FROM rules WHERE user_id = ?').all(uid);
    const groups = db.prepare('SELECT * FROM budget_groups WHERE user_id = ? ORDER BY sort').all(uid);
    const categories = db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY sort').all(uid);
    const recurring = db.prepare('SELECT * FROM recurring WHERE user_id = ? ORDER BY next_date').all(uid);
    const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at').all(uid).map(goalRow);
    const holdings = db.prepare('SELECT * FROM holdings WHERE user_id = ?').all(uid).map(holdingRow);
    const plans = db.prepare('SELECT * FROM foresight_plans WHERE user_id = ?').all(uid).map(planRow);
    const overrides = db.prepare('SELECT cat, year, amount FROM foresight_overrides WHERE user_id = ?').all(uid);
    ctx.json(200, {
      user: auth.publicUser(ctx.user),
      accounts, transactions, rules,
      budget: { groups, categories },
      recurring, goals, holdings,
      foresight: { plans, overrides, startNetWorth: compute.netWorth(uid) },
      settings: compute.getSettings(uid),
      cashflow: { months: compute.cashflowMonths(uid, 12), sankey: compute.cashflowSankey(uid, 0) },
      dashboard: compute.dashboard(uid),
      insights: compute.insights(uid)
    });
  }));

  /* -------------------------------------------------------- ACCOUNTS */
  router.get('/api/accounts', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { accounts: db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort, created_at').all(ctx.user.id) });
  }));
  router.post('/api/accounts', auth.requireAuth(async (req, res, ctx) => {
    const b = ctx.body, uid = ctx.user.id, id = newId('ac_');
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) m FROM accounts WHERE user_id = ?').get(uid).m;
    db.prepare(`INSERT INTO accounts (id,user_id,group_label,type,name,institution,mask,balance,icon,apy,sort,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, str(b.group_label, 'group') || 'Cash', str(b.type, 'type'),
      str(b.name, 'Name', { required: true }), str(b.institution, 'institution'),
      str(b.mask, 'mask'), num(b.balance, 'balance'), str(b.icon, 'icon'),
      str(b.apy, 'apy'), maxSort + 1, nowISO());
    ctx.json(200, { account: ownedRow('accounts', id, uid) });
  }));
  router.put('/api/accounts/:id', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const row = ownedRow('accounts', ctx.params.id, uid); const b = ctx.body;
    db.prepare(`UPDATE accounts SET group_label=?,type=?,name=?,institution=?,mask=?,balance=?,icon=?,apy=?,sort=? WHERE id=? AND user_id=?`).run(
      b.group_label != null ? str(b.group_label, 'group') : row.group_label,
      b.type != null ? str(b.type, 'type') : row.type,
      b.name != null ? str(b.name, 'Name', { required: true }) : row.name,
      b.institution != null ? str(b.institution, 'institution') : row.institution,
      b.mask != null ? str(b.mask, 'mask') : row.mask,
      b.balance != null ? num(b.balance, 'balance') : row.balance,
      b.icon != null ? str(b.icon, 'icon') : row.icon,
      b.apy != null ? str(b.apy, 'apy') : row.apy,
      b.sort != null ? num(b.sort, 'sort') : row.sort,
      row.id, uid);
    ctx.json(200, { account: ownedRow('accounts', row.id, uid) });
  }));
  router.delete('/api/accounts/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('accounts', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));

  /* ---------------------------------------------------- TRANSACTIONS */
  router.get('/api/transactions', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { transactions: db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC').all(ctx.user.id).map(txnRow) });
  }));
  router.post('/api/transactions', auth.requireAuth(async (req, res, ctx) => {
    const b = ctx.body, uid = ctx.user.id, id = newId('tx_');
    let acctName = str(b.account || b.account_name, 'account');
    let acctId = str(b.account_id, 'account_id');
    if (acctId) { const a = db.prepare('SELECT name FROM accounts WHERE id=? AND user_id=?').get(acctId, uid); if (a) acctName = a.name; }
    else if (acctName) { const a = db.prepare('SELECT id FROM accounts WHERE name=? AND user_id=?').get(acctName, uid); if (a) acctId = a.id; }
    let cat = str(b.cat || b.category, 'category');
    const name = str(b.name, 'Name', { required: true });
    if (!cat) cat = applyRules(uid, name);     // auto-categorize from rules
    const amount = num(b.amt != null ? b.amt : b.amount, 'amount', { required: true });
    db.prepare(`INSERT INTO transactions (id,user_id,account_id,account_name,name,category,amount,date,icon,review,reason,excluded,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, acctId, acctName, name, cat, amount,
      str(b.date || b.day, 'date') || today(), str(b.icon, 'icon'),
      bool(b.review), str(b.reason, 'reason'), bool(b.excluded), nowISO());
    ctx.json(200, { transaction: txnRow(ownedRow('transactions', id, uid)) });
  }));
  router.put('/api/transactions/:id', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const row = ownedRow('transactions', ctx.params.id, uid); const b = ctx.body;
    // category change -> record history
    let history = jparse(row.history, []);
    const newCat = (b.cat != null || b.category != null) ? str(b.cat != null ? b.cat : b.category, 'category') : row.category;
    if (newCat !== row.category) history = [...history, { from: row.category, to: newCat, at: nowISO() }];
    // account change
    let acctId = row.account_id, acctName = row.account_name;
    if (b.account_id !== undefined) { acctId = str(b.account_id, 'account_id'); const a = acctId && db.prepare('SELECT name FROM accounts WHERE id=? AND user_id=?').get(acctId, uid); acctName = a ? a.name : acctName; }
    else if (b.account !== undefined || b.account_name !== undefined) { acctName = str(b.account || b.account_name, 'account'); const a = acctName && db.prepare('SELECT id FROM accounts WHERE name=? AND user_id=?').get(acctName, uid); acctId = a ? a.id : null; }
    db.prepare(`UPDATE transactions SET account_id=?,account_name=?,name=?,category=?,amount=?,date=?,icon=?,review=?,reason=?,excluded=?,note=?,tags=?,splits=?,attachment=?,history=? WHERE id=? AND user_id=?`).run(
      acctId, acctName,
      b.name != null ? str(b.name, 'Name', { required: true }) : row.name,
      newCat,
      (b.amt != null || b.amount != null) ? num(b.amt != null ? b.amt : b.amount, 'amount') : row.amount,
      (b.date != null || b.day != null) ? str(b.date || b.day, 'date') : row.date,
      b.icon != null ? str(b.icon, 'icon') : row.icon,
      b.review != null ? bool(b.review) : row.review,
      b.reason != null ? str(b.reason, 'reason') : row.reason,
      b.excluded != null ? bool(b.excluded) : row.excluded,
      b.note != null ? str(b.note, 'note', { max: 5000 }) : row.note,
      b.tags != null ? JSON.stringify(b.tags) : row.tags,
      b.splits != null ? JSON.stringify(b.splits) : row.splits,
      b.attachment !== undefined ? (b.attachment ? String(b.attachment) : null) : row.attachment,
      JSON.stringify(history),
      row.id, uid);
    ctx.json(200, { transaction: txnRow(ownedRow('transactions', row.id, uid)) });
  }));
  router.delete('/api/transactions/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('transactions', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));
  router.post('/api/transactions/bulk', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
    const action = str(ctx.body.action, 'action', { required: true });
    tx(() => {
      for (const id of ids) {
        const r = db.prepare('SELECT id FROM transactions WHERE id=? AND user_id=?').get(id, uid);
        if (!r) continue;
        if (action === 'recat') db.prepare('UPDATE transactions SET category=?, review=0 WHERE id=? AND user_id=?').run(str(ctx.body.category, 'category'), id, uid);
        else if (action === 'review') db.prepare('UPDATE transactions SET review=0 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'exclude') db.prepare('UPDATE transactions SET excluded=1 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'include') db.prepare('UPDATE transactions SET excluded=0 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'delete') db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(id, uid);
      }
    });
    ctx.json(200, { ok: true, count: ids.length });
  }));
  router.post('/api/transactions/import', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const items = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    const created = [];
    tx(() => {
      for (const b of items) {
        const id = newId('tx_');
        let acctName = str(b.account || b.account_name, 'account');
        let acctId = null;
        if (acctName) { const a = db.prepare('SELECT id FROM accounts WHERE name=? AND user_id=?').get(acctName, uid); if (a) acctId = a.id; }
        const name = str(b.name, 'Name', { required: true });
        let cat = str(b.cat || b.category, 'category') || applyRules(uid, name);
        db.prepare(`INSERT INTO transactions (id,user_id,account_id,account_name,name,category,amount,date,icon,review,reason,excluded,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          id, uid, acctId, acctName, name, cat,
          num(b.amt != null ? b.amt : b.amount, 'amount', { required: true }),
          str(b.date || b.day, 'date') || today(), str(b.icon, 'icon'),
          bool(b.review != null ? b.review : true), str(b.reason, 'reason') || 'Imported — confirm the category', 0, nowISO());
        created.push(id);
      }
    });
    ctx.json(200, { ok: true, count: created.length, transactions: created.map((id) => txnRow(db.prepare('SELECT * FROM transactions WHERE id=?').get(id))) });
  }));

  /* --------------------------------------------------------- RULES */
  router.get('/api/rules', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { rules: db.prepare('SELECT * FROM rules WHERE user_id = ?').all(ctx.user.id) });
  }));
  router.post('/api/rules', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('rl_');
    const match = str(ctx.body.match, 'match', { required: true });
    const category = str(ctx.body.category, 'category', { required: true });
    db.prepare('INSERT INTO rules (id,user_id,match,category,created_at) VALUES (?,?,?,?,?)').run(id, uid, match, category, nowISO());
    let applied = 0;
    if (bool(ctx.body.applyNow)) {
      const rows = db.prepare('SELECT id,name FROM transactions WHERE user_id=?').all(uid);
      tx(() => {
        for (const r of rows) if (r.name && r.name.toLowerCase().includes(match.toLowerCase())) { db.prepare('UPDATE transactions SET category=?, review=0 WHERE id=?').run(category, r.id); applied++; }
      });
    }
    ctx.json(200, { rule: ownedRow('rules', id, uid), applied });
  }));
  router.put('/api/rules/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('rules', ctx.params.id, ctx.user.id);
    db.prepare('UPDATE rules SET match=?, category=? WHERE id=? AND user_id=?').run(
      ctx.body.match != null ? str(ctx.body.match, 'match', { required: true }) : row.match,
      ctx.body.category != null ? str(ctx.body.category, 'category', { required: true }) : row.category,
      row.id, ctx.user.id);
    ctx.json(200, { rule: ownedRow('rules', row.id, ctx.user.id) });
  }));
  router.delete('/api/rules/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('rules', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM rules WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));

  /* --------------------------------------------------------- BUDGET */
  router.get('/api/budget', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, compute.budgetSummary(ctx.user.id, (compute.getSettings(ctx.user.id).cycleStart) || 1));
  }));
  router.post('/api/budget/groups', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('bg_');
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) m FROM budget_groups WHERE user_id=?').get(uid).m;
    db.prepare('INSERT INTO budget_groups (id,user_id,label,sort) VALUES (?,?,?,?)').run(id, uid, str(ctx.body.label, 'label', { required: true }), maxSort + 1);
    ctx.json(200, { group: ownedRow('budget_groups', id, uid) });
  }));
  router.put('/api/budget/groups/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('budget_groups', ctx.params.id, ctx.user.id);
    db.prepare('UPDATE budget_groups SET label=?, sort=? WHERE id=? AND user_id=?').run(
      ctx.body.label != null ? str(ctx.body.label, 'label') : row.label,
      ctx.body.sort != null ? num(ctx.body.sort, 'sort') : row.sort, row.id, ctx.user.id);
    ctx.json(200, { group: ownedRow('budget_groups', row.id, ctx.user.id) });
  }));
  router.delete('/api/budget/groups/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('budget_groups', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM budget_groups WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));
  router.post('/api/budget/categories', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('bc_'); const b = ctx.body;
    const group = ownedRow('budget_groups', str(b.group_id, 'group_id', { required: true }), uid);
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) m FROM budget_categories WHERE user_id=? AND group_id=?').get(uid, group.id).m;
    db.prepare('INSERT INTO budget_categories (id,user_id,group_id,name,budget,color,roll,sort) VALUES (?,?,?,?,?,?,?,?)').run(
      id, uid, group.id, str(b.name, 'Name', { required: true }), num(b.budget, 'budget'), str(b.color, 'color'), num(b.roll, 'roll'), maxSort + 1);
    ctx.json(200, { category: ownedRow('budget_categories', id, uid) });
  }));
  router.put('/api/budget/categories/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('budget_categories', ctx.params.id, ctx.user.id); const b = ctx.body;
    db.prepare('UPDATE budget_categories SET group_id=?,name=?,budget=?,color=?,roll=?,sort=? WHERE id=? AND user_id=?').run(
      b.group_id != null ? ownedRow('budget_groups', str(b.group_id), ctx.user.id).id : row.group_id,
      b.name != null ? str(b.name, 'Name') : row.name,
      b.budget != null ? num(b.budget, 'budget') : row.budget,
      b.color != null ? str(b.color, 'color') : row.color,
      b.roll != null ? num(b.roll, 'roll') : row.roll,
      b.sort != null ? num(b.sort, 'sort') : row.sort, row.id, ctx.user.id);
    ctx.json(200, { category: ownedRow('budget_categories', row.id, ctx.user.id) });
  }));
  router.delete('/api/budget/categories/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('budget_categories', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM budget_categories WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));
  router.post('/api/budget/seed', auth.requireAuth(async (req, res, ctx) => {
    // Restore the default starter budget. Only seeds when the user has no groups.
    const created = seedDefaultBudget(ctx.user.id);
    ctx.json(200, { ok: true, created });
  }));
  router.post('/api/budget/cover', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const moves = Array.isArray(ctx.body.moves) ? ctx.body.moves : [];
    tx(() => {
      for (const mv of moves) {
        const row = db.prepare('SELECT * FROM budget_categories WHERE id=? AND user_id=?').get(mv.id, uid);
        if (!row) continue;
        db.prepare('UPDATE budget_categories SET budget=? WHERE id=? AND user_id=?').run(num(mv.budget, 'budget'), mv.id, uid);
      }
    });
    ctx.json(200, compute.budgetSummary(uid, (compute.getSettings(uid).cycleStart) || 1));
  }));

  /* ------------------------------------------------------ RECURRING */
  router.get('/api/recurring', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { recurring: db.prepare('SELECT * FROM recurring WHERE user_id = ? ORDER BY next_date').all(ctx.user.id) });
  }));
  router.post('/api/recurring', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('rc_'); const b = ctx.body;
    db.prepare(`INSERT INTO recurring (id,user_id,name,amount,cadence,next_date,category,account_id,icon,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, str(b.name, 'Name', { required: true }), num(b.amount, 'amount', { required: true }),
      str(b.cadence, 'cadence') || 'monthly', str(b.next_date || b.nextDate, 'next_date'),
      str(b.category, 'category'), str(b.account_id, 'account_id'), str(b.icon, 'icon'), nowISO());
    ctx.json(200, { recurring: ownedRow('recurring', id, uid) });
  }));
  router.put('/api/recurring/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('recurring', ctx.params.id, ctx.user.id); const b = ctx.body;
    db.prepare('UPDATE recurring SET name=?,amount=?,cadence=?,next_date=?,category=?,account_id=?,icon=? WHERE id=? AND user_id=?').run(
      b.name != null ? str(b.name, 'Name') : row.name,
      b.amount != null ? num(b.amount, 'amount') : row.amount,
      b.cadence != null ? str(b.cadence, 'cadence') : row.cadence,
      (b.next_date != null || b.nextDate != null) ? str(b.next_date || b.nextDate, 'next_date') : row.next_date,
      b.category != null ? str(b.category, 'category') : row.category,
      b.account_id != null ? str(b.account_id, 'account_id') : row.account_id,
      b.icon != null ? str(b.icon, 'icon') : row.icon, row.id, ctx.user.id);
    ctx.json(200, { recurring: ownedRow('recurring', row.id, ctx.user.id) });
  }));
  router.delete('/api/recurring/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('recurring', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM recurring WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));

  /* ---------------------------------------------------------- GOALS */
  router.get('/api/goals', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { goals: db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at').all(ctx.user.id).map(goalRow) });
  }));
  router.post('/api/goals', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('gl_'); const b = ctx.body;
    db.prepare(`INSERT INTO goals (id,user_id,name,icon,target,saved,monthly,auto,account_id,color,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, str(b.name, 'Name', { required: true }), str(b.icon, 'icon'),
      num(b.target, 'target'), num(b.saved != null ? b.saved : b.have, 'saved'),
      num(b.monthly, 'monthly'), bool(b.auto), str(b.account_id, 'account_id'), str(b.color, 'color'), nowISO());
    ctx.json(200, { goal: goalRow(ownedRow('goals', id, uid)) });
  }));
  router.put('/api/goals/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('goals', ctx.params.id, ctx.user.id); const b = ctx.body;
    db.prepare('UPDATE goals SET name=?,icon=?,target=?,saved=?,monthly=?,auto=?,account_id=?,color=? WHERE id=? AND user_id=?').run(
      b.name != null ? str(b.name, 'Name') : row.name,
      b.icon != null ? str(b.icon, 'icon') : row.icon,
      b.target != null ? num(b.target, 'target') : row.target,
      (b.saved != null || b.have != null) ? num(b.saved != null ? b.saved : b.have, 'saved') : row.saved,
      b.monthly != null ? num(b.monthly, 'monthly') : row.monthly,
      b.auto != null ? bool(b.auto) : row.auto,
      b.account_id !== undefined ? str(b.account_id, 'account_id') : row.account_id,
      b.color != null ? str(b.color, 'color') : row.color, row.id, ctx.user.id);
    ctx.json(200, { goal: goalRow(ownedRow('goals', row.id, ctx.user.id)) });
  }));
  router.delete('/api/goals/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('goals', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));
  // Move money into a goal: bumps goal.saved, debits the source account, logs a contribution.
  router.post('/api/goals/:id/funds', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const goal = ownedRow('goals', ctx.params.id, uid);
    const amount = num(ctx.body.amount, 'amount', { required: true });
    if (amount <= 0) throw new HttpError(400, 'Amount must be positive');
    const fromId = str(ctx.body.fromAccountId || ctx.body.account_id, 'fromAccountId');
    let account = null;
    tx(() => {
      if (fromId) {
        account = db.prepare('SELECT * FROM accounts WHERE id=? AND user_id=?').get(fromId, uid);
        if (!account) throw new HttpError(404, 'Source account not found');
        db.prepare('UPDATE accounts SET balance = balance - ? WHERE id=? AND user_id=?').run(amount, fromId, uid);
      }
      db.prepare('UPDATE goals SET saved = saved + ? WHERE id=? AND user_id=?').run(amount, goal.id, uid);
      db.prepare('INSERT INTO goal_contributions (id,user_id,goal_id,amount,date,from_account_id) VALUES (?,?,?,?,?,?)')
        .run(newId('gc_'), uid, goal.id, amount, today(), fromId || null);
    });
    ctx.json(200, {
      goal: goalRow(ownedRow('goals', goal.id, uid)),
      account: account ? db.prepare('SELECT * FROM accounts WHERE id=?').get(fromId) : null
    });
  }));

  /* ------------------------------------------------------- HOLDINGS */
  router.get('/api/holdings', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { holdings: db.prepare('SELECT * FROM holdings WHERE user_id = ?').all(ctx.user.id).map(holdingRow) });
  }));
  router.post('/api/holdings', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('hd_'); const b = ctx.body;
    db.prepare(`INSERT INTO holdings (id,user_id,ticker,name,cls,kind,shares,price,cost,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, str(b.ticker, 'ticker'), str(b.name, 'Name', { required: true }), str(b.cls, 'cls'),
      str(b.kind, 'kind') || 'etf', num(b.shares, 'shares'), num(b.price, 'price'),
      b.cost != null ? num(b.cost, 'cost') : null, nowISO());
    ctx.json(200, { holding: holdingRow(ownedRow('holdings', id, uid)) });
  }));
  router.put('/api/holdings/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('holdings', ctx.params.id, ctx.user.id); const b = ctx.body;
    db.prepare('UPDATE holdings SET ticker=?,name=?,cls=?,kind=?,shares=?,price=?,cost=? WHERE id=? AND user_id=?').run(
      b.ticker != null ? str(b.ticker, 'ticker') : row.ticker,
      b.name != null ? str(b.name, 'Name') : row.name,
      b.cls != null ? str(b.cls, 'cls') : row.cls,
      b.kind != null ? str(b.kind, 'kind') : row.kind,
      b.shares != null ? num(b.shares, 'shares') : row.shares,
      b.price != null ? num(b.price, 'price') : row.price,
      b.cost != null ? num(b.cost, 'cost') : row.cost, row.id, ctx.user.id);
    ctx.json(200, { holding: holdingRow(ownedRow('holdings', row.id, ctx.user.id)) });
  }));
  router.delete('/api/holdings/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('holdings', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM holdings WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));

  /* ------------------------------------------------------ FORESIGHT */
  router.get('/api/foresight', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    ctx.json(200, {
      plans: db.prepare('SELECT * FROM foresight_plans WHERE user_id=?').all(uid).map(planRow),
      overrides: db.prepare('SELECT cat,year,amount FROM foresight_overrides WHERE user_id=?').all(uid),
      startNetWorth: compute.netWorth(uid)
    });
  }));
  router.post('/api/foresight/plans', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id, id = newId('fp_'); const b = ctx.body;
    const { kind, name, ...data } = b;
    db.prepare('INSERT INTO foresight_plans (id,user_id,kind,name,data) VALUES (?,?,?,?,?)').run(
      id, uid, str(kind, 'kind', { required: true }), str(name, 'name'), JSON.stringify(data || {}));
    ctx.json(200, { plan: planRow(ownedRow('foresight_plans', id, uid)) });
  }));
  router.put('/api/foresight/plans/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('foresight_plans', ctx.params.id, ctx.user.id); const b = ctx.body;
    const { kind, name, ...data } = b;
    const merged = Object.assign(jparse(row.data, {}), data);
    db.prepare('UPDATE foresight_plans SET kind=?,name=?,data=? WHERE id=? AND user_id=?').run(
      kind != null ? str(kind, 'kind') : row.kind, name != null ? str(name, 'name') : row.name,
      JSON.stringify(merged), row.id, ctx.user.id);
    ctx.json(200, { plan: planRow(ownedRow('foresight_plans', row.id, ctx.user.id)) });
  }));
  router.delete('/api/foresight/plans/:id', auth.requireAuth(async (req, res, ctx) => {
    ownedRow('foresight_plans', ctx.params.id, ctx.user.id);
    db.prepare('DELETE FROM foresight_plans WHERE id=? AND user_id=?').run(ctx.params.id, ctx.user.id);
    ctx.json(200, { ok: true });
  }));
  router.put('/api/foresight/overrides', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const b = ctx.body;
    const cat = str(b.cat, 'cat', { required: true }); const year = num(b.year, 'year', { required: true });
    if (b.amount == null || b.amount === '') {
      db.prepare('DELETE FROM foresight_overrides WHERE user_id=? AND cat=? AND year=?').run(uid, cat, year);
    } else {
      db.prepare(`INSERT INTO foresight_overrides (user_id,cat,year,amount) VALUES (?,?,?,?)
                  ON CONFLICT(user_id,cat,year) DO UPDATE SET amount=excluded.amount`).run(uid, cat, year, num(b.amount, 'amount'));
    }
    ctx.json(200, { overrides: db.prepare('SELECT cat,year,amount FROM foresight_overrides WHERE user_id=?').all(uid) });
  }));

  /* ------------------------------------------------------- SETTINGS */
  router.get('/api/settings', auth.requireAuth(async (req, res, ctx) => {
    ctx.json(200, { settings: compute.getSettings(ctx.user.id) });
  }));
  router.put('/api/settings', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const cur = compute.getSettings(uid);
    const next = Object.assign({}, cur, ctx.body && typeof ctx.body === 'object' ? (ctx.body.settings || ctx.body) : {});
    db.prepare(`INSERT INTO settings (user_id,data) VALUES (?,?)
                ON CONFLICT(user_id) DO UPDATE SET data=excluded.data`).run(uid, JSON.stringify(next));
    ctx.json(200, { settings: next });
  }));

  /* ------------------------------------------------------- COMPUTED */
  router.get('/api/dashboard', auth.requireAuth(async (req, res, ctx) => ctx.json(200, compute.dashboard(ctx.user.id))));
  router.get('/api/insights', auth.requireAuth(async (req, res, ctx) => ctx.json(200, compute.insights(ctx.user.id))));
  router.get('/api/cashflow', auth.requireAuth(async (req, res, ctx) => {
    const months = Math.min(Math.max(parseInt(ctx.query.get('months') || '12', 10) || 12, 1), 36);
    ctx.json(200, { months: compute.cashflowMonths(ctx.user.id, months), sankey: compute.cashflowSankey(ctx.user.id, 0) });
  }));
  router.get('/api/networth', auth.requireAuth(async (req, res, ctx) => {
    const n = Math.min(Math.max(parseInt(ctx.query.get('n') || '24', 10) || 24, 1), 60);
    ctx.json(200, { current: compute.netWorth(ctx.user.id), series: compute.netWorthSeries(ctx.user.id, n) });
  }));
}

module.exports = { register };
