'use strict';
/* ============================================================
   Claud API — all routes. Every data route is auth-scoped to the
   token's user; ownership is enforced on every read and write.
   Sensitive columns are encrypted at rest via the wrapped db (lib/model.js);
   handlers see plaintext, the SQLite file holds ciphertext.
   ============================================================ */
const crypto = require('node:crypto');
const { db, tx } = require('./lib/db');
const { newId, HttpError } = require('./lib/http');
const auth = require('./lib/auth');
const compute = require('./lib/compute');
const quotes = require('./lib/quotes');
const mailer = require('./lib/mailer');
const ratelimit = require('./lib/ratelimit');
const google = require('./lib/google');
const { computeMatchKey, findDuplicate, isDuplicateOf, matchRecurring, maybeAdvanceRecurring, normName } = require('./lib/dedup');

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

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* Resolve an account by its (now-encrypted) name. Equality lookups in SQL no
   longer work against ciphertext, so scan the user's accounts and match the
   decrypted name in JS. */
function findAccountByName(uid, name) {
  if (!name) return null;
  const rows = db.prepare('SELECT id, name FROM accounts WHERE user_id = ?').all(uid);
  return rows.find((a) => a.name === name) || null;
}

/* Running-balance ledger: every transaction is a real money movement, so the
   owning account's balance moves with it. balance is encrypted at rest, so we
   can't do `SET balance = balance + ?` in SQL — read the decrypted value, add
   the delta, write it back (same pattern as the goals-funding route). No-ops on
   a null account (an unassigned transaction) or a zero delta. */
function adjustAccountBalance(uid, acctId, delta) {
  if (!acctId || !delta) return;
  const a = db.prepare('SELECT balance FROM accounts WHERE id = ? AND user_id = ?').get(acctId, uid);
  if (!a) return;
  db.prepare('UPDATE accounts SET balance = ? WHERE id = ? AND user_id = ?')
    .run(round2((a.balance || 0) + delta), acctId, uid);
}

/* Shared transaction INSERT. Writes every existing column PLUS the three dedup
   columns (origin, match_key, recurring_id) and returns the new id. The wrapped
   db encrypts the sensitive columns by name (model.js); origin/match_key/
   recurring_id aren't in ENCRYPTED_FIELDS so they pass through as plaintext.
   match_key is computed from the plaintext amount BEFORE this write. Callers
   pass a normalized `t` ({ account_id, account_name, name, category, amount,
   date, icon, review, reason, excluded }) and options for origin/recurringId.
   Does NOT touch balances — callers own balance adjustment. */
function insertTxn(uid, t, { origin = 'manual', recurringId = null, transferId = null } = {}) {
  const id = newId('tx_');
  const matchKey = computeMatchKey(t.account_id, t.amount, t.date);
  // `merchant` (the full raw descriptor) sits in ENCRYPTED_FIELDS so the wrapper
  // encrypts it by position; transfer_id is plaintext. Every VALUE is a `?` so
  // the encryption param-mapping in model.js stays positional and correct.
  db.prepare(`INSERT INTO transactions (id,user_id,account_id,account_name,name,merchant,category,amount,date,icon,review,reason,excluded,origin,match_key,recurring_id,transfer_id,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, uid, t.account_id || null, t.account_name || null, t.name, t.merchant || null, t.category || null, t.amount,
    t.date, t.icon || null, bool(t.review), t.reason || null, bool(t.excluded),
    origin, matchKey, recurringId, transferId, nowISO());
  return id;
}

/* --------------------------------------------------------- row mappers */
function txnRow(r) {
  if (!r) return r;
  return {
    id: r.id, account_id: r.account_id, account: r.account_name, account_name: r.account_name,
    name: r.name, merchant: r.merchant || null, cat: r.category, category: r.category, amount: r.amount, amt: r.amount,
    date: r.date, day: r.date, icon: r.icon,
    review: !!r.review, reason: r.reason, excluded: !!r.excluded,
    note: r.note || '', tags: jparse(r.tags, []), splits: jparse(r.splits, []),
    attachment: r.attachment || null, history: jparse(r.history, []),
    origin: r.origin, recurring_id: r.recurring_id, transfer_id: r.transfer_id || null
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
// Spread the stored `data` FIRST, then let the real columns win. Older clients
// saved the whole plan object — including its temporary "p<timestamp>" id — so a
// stale `id`/`kind`/`name` can live inside `data`; if it spreads last it shadows
// the real primary key and the id handed to the client matches no row on update
// (PUT/DELETE then 404). Real columns last = the true id always wins.
function planRow(p) { return { ...jparse(p.data, {}), id: p.id, kind: p.kind, name: p.name }; }

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

/* Create-or-update a categorisation rule for `match` → `category`. Used by the
   retroactive recategorise flow so picking "all going forward" / "everything"
   also teaches future imports. match is encrypted at rest, so we scan + compare
   the decrypted value (case-insensitive) rather than querying by ciphertext. */
function upsertRule(uid, match, category) {
  const m = String(match == null ? '' : match).trim();
  if (!m || !category) return;
  const rules = db.prepare('SELECT id, match FROM rules WHERE user_id = ?').all(uid);
  const existing = rules.find((r) => String(r.match || '').toLowerCase() === m.toLowerCase());
  if (existing) db.prepare('UPDATE rules SET category=? WHERE id=? AND user_id=?').run(category, existing.id, uid);
  else db.prepare('INSERT INTO rules (id,user_id,match,category,created_at) VALUES (?,?,?,?,?)').run(newId('rl_'), uid, m, category, nowISO());
}

/* ----------------------------------------------------- email verification */
/* Issue a 24h 'verify' token and email the confirmation link. Best-effort:
   returns the sendEmail promise so callers can .catch without blocking the
   response. */
function sendVerificationEmail(user) {
  const raw = auth.issueToken(user.id, 'verify', 60 * 60 * 24);
  const href = mailer.link('/verify', { token: raw });
  const tmpl = mailer.templates.verify({ name: user.name, href });
  return mailer.sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
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
    // Fire the verification email (non-blocking) — registration still returns a
    // session immediately, so the user lands in the app (soft gate via banner).
    sendVerificationEmail(user).catch((e) => console.error('verification email failed:', e));
    ctx.json(200, { token: auth.makeToken(user.id, user.token_version), user: auth.publicUser(user) });
  });

  router.post('/api/auth/login', async (req, res, ctx) => {
    const email = (str(ctx.body.email, 'Email', { required: true }) || '').toLowerCase();
    const password = String(ctx.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !auth.verifyPassword(password, user.pw_salt, user.pw_hash))
      throw new HttpError(401, 'Email or password is incorrect');
    ctx.json(200, { token: auth.makeToken(user.id, user.token_version), user: auth.publicUser(user) });
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

  /* --------------------------------------------- EMAIL VERIFICATION */
  // Confirm an email address from the link in the verification email. Public
  // (the link is the credential); idempotent-ish via single-use token.
  router.post('/api/auth/verify', async (req, res, ctx) => {
    const token = str(ctx.body.token, 'token', { required: true });
    const userId = auth.consumeToken(token, 'verify');     // throws 400 if bad/expired/used
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    auth.invalidateTokens(userId, 'verify');               // burn any sibling links
    ctx.json(200, { ok: true });
  });

  // Re-send the verification email to the signed-in user. Rate-limited.
  router.post('/api/auth/resend-verification', auth.requireAuth(async (req, res, ctx) => {
    const user = ctx.user;
    if (user.email_verified) return ctx.json(200, { ok: true, message: 'Your email is already verified.' });
    const ip = ratelimit.clientIp(req);
    if (!ratelimit.allow('resend:ip:' + ip, 10, 60 * 60 * 1000) ||
        !ratelimit.allow('resend:uid:' + user.id, 3, 60 * 60 * 1000))
      throw new HttpError(429, 'Too many requests — please try again in a bit');
    auth.invalidateTokens(user.id, 'verify');
    sendVerificationEmail(user).catch((e) => console.error('verification email failed:', e));
    ctx.json(200, { ok: true, message: 'Verification email sent.' });
  }));

  /* ------------------------------------------------- PASSWORD RESET */
  // Request a reset link. ALWAYS returns a generic 200 (no account
  // enumeration). Rate-limited per IP and per email.
  router.post('/api/auth/forgot', async (req, res, ctx) => {
    const email = (str(ctx.body.email, 'Email', { required: true }) || '').toLowerCase();
    const ip = ratelimit.clientIp(req);
    if (!ratelimit.allow('forgot:ip:' + ip, 10, 60 * 60 * 1000) ||
        !ratelimit.allow('forgot:em:' + email, 5, 60 * 60 * 1000))
      throw new HttpError(429, 'Too many requests — please try again later');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      const raw = auth.issueToken(user.id, 'reset', 60 * 60);   // 1h
      const href = mailer.link('/reset', { token: raw });
      const tmpl = mailer.templates.reset({ name: user.name, href });
      mailer.sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text })
        .catch((e) => console.error('reset email failed:', e));
    }
    ctx.json(200, { ok: true, message: 'If that email has an account, a reset link is on its way.' });
  });

  // Complete a reset: consume the token, set the new password, and bump
  // token_version so every other existing session is signed out.
  router.post('/api/auth/reset', async (req, res, ctx) => {
    const token = str(ctx.body.token, 'token', { required: true });
    const password = String(ctx.body.password || '');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    const userId = auth.consumeToken(token, 'reset');      // throws 400 if bad/expired/used
    const { salt, hash } = auth.hashPassword(password);
    tx(() => {
      db.prepare('UPDATE users SET pw_salt = ?, pw_hash = ?, email_verified = 1 WHERE id = ?').run(salt, hash, userId);
      auth.bumpTokenVersion(userId);                       // invalidate all sessions
      auth.invalidateTokens(userId, 'reset');              // burn sibling reset links
    });
    ctx.json(200, { ok: true, message: 'Your password has been reset. Please sign in.' });
  });

  /* ----------------------------------------------------------- FEEDBACK */
  // In-app bug reports & feature requests (the Help modal). Authenticated —
  // the modal lives behind sign-in — and rate-limited to deter abuse. Emails
  // the submission to FEEDBACK_TO via the shared mailer, with the submitter
  // set as reply-to so a reply reaches them. A real provider failure surfaces
  // as a retryable 502 (we won't claim "sent" when it wasn't); when no mail
  // provider is configured, sendEmail no-ops and we still return 200.
  router.post('/api/feedback', auth.requireAuth(async (req, res, ctx) => {
    const user = ctx.user;
    const kind = str(ctx.body.kind, 'kind', { required: true });
    if (kind !== 'bug' && kind !== 'feature') throw new HttpError(400, 'kind must be "bug" or "feature"');
    const message = str(ctx.body.message, 'message', { required: true, max: 4000 });
    const severity = kind === 'bug' ? (str(ctx.body.severity, 'severity', { max: 24 }) || 'Minor') : null;
    const email = str(ctx.body.email, 'email', { max: 200 }) || user.email || '';
    const cin = (ctx.body.context && typeof ctx.body.context === 'object') ? ctx.body.context : {};
    const context = {
      url: str(cin.url, 'url', { max: 500 }),
      screen: str(cin.screen, 'screen', { max: 40 }),
      ua: str(cin.ua, 'ua', { max: 400 }),
      userId: user.id
    };

    const ip = ratelimit.clientIp(req);
    if (!ratelimit.allow('feedback:ip:' + ip, 20, 60 * 60 * 1000) ||
        !ratelimit.allow('feedback:uid:' + user.id, 10, 60 * 60 * 1000))
      throw new HttpError(429, 'Too many submissions — please try again in a bit');

    const to = process.env.FEEDBACK_TO || 'feedback@claudapps.ca';
    const tmpl = mailer.templates.feedback({ kind, severity, message, email, context });
    try {
      await mailer.sendEmail({ to, subject: tmpl.subject, html: tmpl.html, text: tmpl.text, replyTo: email || undefined, from: process.env.FEEDBACK_FROM || undefined });
    } catch (e) {
      console.error('feedback email failed:', e);
      throw new HttpError(502, "Couldn't send your feedback right now — please try again in a moment.");
    }
    ctx.json(200, { ok: true, message: 'Thanks — your feedback has been sent.' });
  }));

  /* ---------------------------------------------------- GOOGLE OAUTH */
  // Step 1 — redirect to Google's consent screen (with CSRF state).
  router.get('/api/auth/google/start', async (req, res, ctx) => {
    if (!google.configured()) {
      res.writeHead(302, { Location: '/login#autherr=' + encodeURIComponent('Google sign-in isn’t configured yet.') });
      return res.end();
    }
    res.writeHead(302, { Location: google.authUrl(google.issueState()) });
    res.end();
  });

  // Step 2 — Google redirects back here with ?code & ?state. Validate, map to a
  // user, mint our own session JWT, then hand it to the frontend via the URL
  // fragment (#token=…) so it never hits the server logs.
  router.get('/api/auth/google/callback', async (req, res, ctx) => {
    const fail = (msg) => { res.writeHead(302, { Location: '/login#autherr=' + encodeURIComponent(msg) }); res.end(); };
    try {
      if (!google.configured()) return fail('Google sign-in isn’t configured yet.');
      if (ctx.query.get('error')) return fail('Google sign-in was cancelled.');
      const code = ctx.query.get('code');
      const state = ctx.query.get('state');
      if (!code || !google.checkState(state)) return fail('Google sign-in failed — please try again.');

      const profile = await google.profileFromCode(code);
      if (!profile.email || !profile.emailVerified) return fail('Your Google account email could not be verified.');

      // Map: by google_sub, else link a matching email, else create a new user.
      let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(profile.sub);
      if (!user) {
        const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
        if (byEmail) {
          db.prepare('UPDATE users SET google_sub = ?, email_verified = 1 WHERE id = ?').run(profile.sub, byEmail.id);
          user = auth.getUserById(byEmail.id);
        } else {
          // New Google user: store an unguessable random password so the NOT NULL
          // columns hold; they can set a real one later via password reset.
          const { salt, hash } = auth.hashPassword(crypto.randomBytes(24).toString('base64url'));
          const info = db.prepare(
            'INSERT INTO users (email, name, pw_salt, pw_hash, plan, created_at, email_verified, google_sub) VALUES (?,?,?,?,?,?,?,?)'
          ).run(profile.email, profile.name || null, salt, hash, 'free', nowISO(), 1, profile.sub);
          db.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?)').run(info.lastInsertRowid, '{}');
          try { seedDefaultBudget(info.lastInsertRowid); } catch (e) { console.error('seedDefaultBudget failed:', e); }
          user = auth.getUserById(info.lastInsertRowid);
        }
      }
      res.writeHead(302, { Location: '/login#token=' + encodeURIComponent(auth.makeToken(user.id, user.token_version)) });
      res.end();
    } catch (e) {
      console.error('google callback failed:', e);
      fail('Google sign-in failed — please try again.');
    }
  });

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
    const newName = b.name != null ? str(b.name, 'Name', { required: true }) : row.name;
    db.prepare(`UPDATE accounts SET group_label=?,type=?,name=?,institution=?,mask=?,balance=?,icon=?,apy=?,sort=? WHERE id=? AND user_id=?`).run(
      b.group_label != null ? str(b.group_label, 'group') : row.group_label,
      b.type != null ? str(b.type, 'type') : row.type,
      newName,
      b.institution != null ? str(b.institution, 'institution') : row.institution,
      b.mask != null ? str(b.mask, 'mask') : row.mask,
      b.balance != null ? num(b.balance, 'balance') : row.balance,
      b.icon != null ? str(b.icon, 'icon') : row.icon,
      b.apy != null ? str(b.apy, 'apy') : row.apy,
      b.sort != null ? num(b.sort, 'sort') : row.sort,
      row.id, uid);
    // a rename should follow the account onto its transactions (they store
    // account_name too, used for display and name-based matching elsewhere)
    if (newName !== row.name) {
      db.prepare('UPDATE transactions SET account_name=? WHERE account_id=? AND user_id=?').run(newName, row.id, uid);
    }
    ctx.json(200, { account: ownedRow('accounts', row.id, uid) });
  }));
  // Persist a new account order (drag-to-reorder). sort is a plaintext column,
  // so a straight positional UPDATE is fine; ids not owned by the user are skipped.
  router.post('/api/accounts/reorder', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const order = Array.isArray(ctx.body.order) ? ctx.body.order : [];
    tx(() => {
      order.forEach((id, i) => {
        db.prepare('UPDATE accounts SET sort=? WHERE id=? AND user_id=?').run(i, String(id), uid);
      });
    });
    ctx.json(200, { ok: true, accounts: db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort, created_at').all(uid) });
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
    const b = ctx.body, uid = ctx.user.id;
    let acctName = str(b.account || b.account_name, 'account');
    let acctId = str(b.account_id, 'account_id');
    if (acctId) { const a = db.prepare('SELECT name FROM accounts WHERE id=? AND user_id=?').get(acctId, uid); if (a) acctName = a.name; }
    else if (acctName) { const a = findAccountByName(uid, acctName); if (a) acctId = a.id; }
    let cat = str(b.cat || b.category, 'category');
    const name = str(b.name, 'Name', { required: true });
    if (!cat) cat = applyRules(uid, name);     // auto-categorize from rules
    const amount = num(b.amt != null ? b.amt : b.amount, 'amount', { required: true });
    const date = str(b.date || b.day, 'date') || today();
    let icon = str(b.icon, 'icon');
    let review = bool(b.review);
    let reason = str(b.reason, 'reason');
    const incoming = { account_id: acctId, amount, name, date };

    // Recurring: if this charge matches a saved recurring rule and the user gave
    // no category, inherit the rule's category/icon and link the row to it.
    let recurringId = null;
    const recur = matchRecurring(db, uid, incoming);
    if (recur) {
      recurringId = recur.id;
      if (!cat && recur.category) cat = recur.category;
      if (!icon && recur.icon) icon = recur.icon;
    }

    // Duplicate: a manual add is never silently dropped — we STILL insert it, but
    // flag it for review so the user can confirm or delete.
    const dup = findDuplicate(db, uid, incoming);
    if (dup) {
      review = 1;
      reason = 'Possible duplicate of an existing transaction';
    }

    const id = insertTxn(uid, { account_id: acctId, account_name: acctName, name, merchant: str(b.merchant, 'merchant'), category: cat, amount, date, icon, review, reason, excluded: bool(b.excluded) }, { origin: 'manual', recurringId });
    adjustAccountBalance(uid, acctId, amount);   // running balance follows the new transaction (always)
    ctx.json(200, { transaction: txnRow(ownedRow('transactions', id, uid)), duplicateOf: dup ? dup.id : null, recurringId });
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
    else if (b.account !== undefined || b.account_name !== undefined) { acctName = str(b.account || b.account_name, 'account'); const a = acctName && findAccountByName(uid, acctName); acctId = a ? a.id : null; }
    const newAmount = (b.amt != null || b.amount != null) ? num(b.amt != null ? b.amt : b.amount, 'amount') : row.amount;
    db.prepare(`UPDATE transactions SET account_id=?,account_name=?,name=?,category=?,amount=?,date=?,icon=?,review=?,reason=?,excluded=?,note=?,tags=?,splits=?,attachment=?,history=? WHERE id=? AND user_id=?`).run(
      acctId, acctName,
      b.name != null ? str(b.name, 'Name', { required: true }) : row.name,
      newCat,
      newAmount,
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
    // keep the running balance(s) in sync with the amount / account change
    if (row.account_id === acctId) {
      adjustAccountBalance(uid, acctId, round2(newAmount - row.amount));
    } else {
      adjustAccountBalance(uid, row.account_id, -row.amount);   // back out of the old account
      adjustAccountBalance(uid, acctId, newAmount);             // apply to the new one
    }
    ctx.json(200, { transaction: txnRow(ownedRow('transactions', row.id, uid)) });
  }));
  router.delete('/api/transactions/:id', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const row = ownedRow('transactions', ctx.params.id, uid);
    tx(() => {
      db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(row.id, uid);
      adjustAccountBalance(uid, row.account_id, -row.amount);   // removing the txn reverses its effect
      // A transfer is two linked legs — delete the partner too so the pair never
      // desyncs and the OTHER account's balance is restored as well. (transfer_id
      // is plaintext; amount comes back decrypted, so the reversal is exact.)
      if (row.transfer_id) {
        const sibs = db.prepare('SELECT id, account_id, amount FROM transactions WHERE user_id=? AND transfer_id=?').all(uid, row.transfer_id);
        for (const s of sibs) {
          db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(s.id, uid);
          adjustAccountBalance(uid, s.account_id, -s.amount);
        }
      }
    });
    ctx.json(200, { ok: true });
  }));
  router.post('/api/transactions/bulk', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids : [];
    const action = str(ctx.body.action, 'action', { required: true });
    tx(() => {
      for (const id of ids) {
        const r = db.prepare('SELECT id, account_id, amount FROM transactions WHERE id=? AND user_id=?').get(id, uid);
        if (!r) continue;
        if (action === 'recat') db.prepare('UPDATE transactions SET category=?, review=0 WHERE id=? AND user_id=?').run(str(ctx.body.category, 'category'), id, uid);
        else if (action === 'review') db.prepare('UPDATE transactions SET review=0 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'exclude') db.prepare('UPDATE transactions SET excluded=1 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'include') db.prepare('UPDATE transactions SET excluded=0 WHERE id=? AND user_id=?').run(id, uid);
        else if (action === 'delete') { db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(id, uid); adjustAccountBalance(uid, r.account_id, -r.amount); }
      }
    });
    ctx.json(200, { ok: true, count: ids.length });
  }));
  router.post('/api/transactions/import', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id; const items = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    const created = [];           // ids actually inserted
    const skipped = [];           // auto-skipped duplicates (not inserted)
    let linkedCount = 0;          // rows linked to a recurring rule
    const balDeltas = {};         // acctId -> net amount imported, applied after the loop
    const batch = [];             // this-import's accepted incomings, for in-batch dup detection
    tx(() => {
      for (const b of items) {
        let acctName = str(b.account || b.account_name, 'account');
        let acctId = null;
        if (acctName) { const a = findAccountByName(uid, acctName); if (a) acctId = a.id; }
        const name = str(b.name, 'Name', { required: true });
        const amount = num(b.amt != null ? b.amt : b.amount, 'amount', { required: true });
        const date = str(b.date || b.day, 'date') || today();
        const incoming = { account_id: acctId, amount, name, date };
        const forced = bool(b.forceInclude);

        // (1) Same statement imported twice, or two identical lines in one file:
        // check against rows we've already accepted in THIS batch (same sign).
        const inBatch = !forced && batch.some((p) => isDuplicateOf(incoming, p, { sameSign: true }));
        // (2) Already in the user's history? (skip the DB scan if already a batch dup)
        const dup = (!forced && !inBatch) ? findDuplicate(db, uid, incoming) : null;
        if (!forced && (inBatch || dup)) {
          // AUTO-SKIP: don't insert, don't move the balance. The user can re-run
          // with forceInclude for a row they actually want.
          skipped.push({ name, amount, date, duplicateOf: dup ? dup.id : null,
            reason: inBatch ? 'Duplicate of another row in this import' : 'Already in your transactions' });
          continue;
        }

        // (3) Recurring + categorisation. Recurring inherits category/icon and
        // clears the review flag (it's a known, expected charge).
        const recur = matchRecurring(db, uid, incoming);
        let cat = str(b.cat || b.category, 'category') || (recur && recur.category) || applyRules(uid, name);
        const icon = str(b.icon, 'icon') || (recur && recur.icon) || null;
        const review = recur ? 0 : bool(b.review != null ? b.review : true);
        const reason = recur ? `Linked to recurring: ${recur.name}`
                             : (str(b.reason, 'reason') || 'Imported — confirm the category');

        const id = insertTxn(uid, { account_id: acctId, account_name: acctName, name, merchant: str(b.merchant, 'merchant'), category: cat, amount, date, icon, review, reason, excluded: false },
          { origin: 'import', recurringId: recur ? recur.id : null });
        if (recur) { linkedCount++; maybeAdvanceRecurring(db, uid, recur, date); }
        if (acctId) balDeltas[acctId] = (balDeltas[acctId] || 0) + amount;   // imported money moves the balance
        batch.push(incoming);     // future rows in this batch dedupe against it
        created.push(id);
      }
      for (const aid in balDeltas) adjustAccountBalance(uid, aid, balDeltas[aid]);
    });
    ctx.json(200, {
      ok: true,
      count: created.length,
      skippedCount: skipped.length,
      linkedCount,
      skipped,
      transactions: created.map((id) => txnRow(db.prepare('SELECT * FROM transactions WHERE id=?').get(id)))
    });
  }));

  /* Account-to-account transfer. Records TWO linked legs — an outflow on the
     source and an inflow on the destination — both with category 'Transfer' and
     excluded=1 so they move the balances but never count as income or spending
     (a transfer doesn't change net worth). They share a transfer_id so the pair
     is recognisable. Mirrors the manual-add balance ledger: adjust both. */
  router.post('/api/transactions/transfer', auth.requireAuth(async (req, res, ctx) => {
    const b = ctx.body, uid = ctx.user.id;
    const resolveAcct = (idRaw, nameRaw) => {
      const id = str(idRaw, 'account_id');
      if (id) { const a = db.prepare('SELECT name FROM accounts WHERE id=? AND user_id=?').get(id, uid); if (!a) throw new HttpError(404, 'Account not found'); return { id, name: a.name }; }
      const name = str(nameRaw, 'account');
      if (name) { const a = findAccountByName(uid, name); if (!a) throw new HttpError(404, 'Account not found'); return { id: a.id, name: a.name }; }
      throw new HttpError(400, 'An account is required');
    };
    const from = resolveAcct(b.from_account_id, b.from_account || b.from);
    const to = resolveAcct(b.to_account_id, b.to_account || b.to);
    if (from.id === to.id) throw new HttpError(400, 'Choose two different accounts');
    const amount = round2(Math.abs(num(b.amt != null ? b.amt : b.amount, 'amount', { required: true })));
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be greater than zero');
    const date = str(b.date || b.day, 'date') || today();
    const note = str(b.note, 'note', { max: 5000 });
    const transferId = newId('tr_');
    let outId, inId;
    tx(() => {
      outId = insertTxn(uid, { account_id: from.id, account_name: from.name, name: `Transfer → ${to.name}`, category: 'Transfer', amount: -amount, date, icon: 'repeat', review: 0, reason: null, excluded: 1 }, { origin: 'manual', transferId });
      inId = insertTxn(uid, { account_id: to.id, account_name: to.name, name: `Transfer ← ${from.name}`, category: 'Transfer', amount: amount, date, icon: 'repeat', review: 0, reason: null, excluded: 1 }, { origin: 'manual', transferId });
      if (note) {
        db.prepare('UPDATE transactions SET note=? WHERE id=? AND user_id=?').run(note, outId, uid);
        db.prepare('UPDATE transactions SET note=? WHERE id=? AND user_id=?').run(note, inId, uid);
      }
      adjustAccountBalance(uid, from.id, -amount);   // money leaves the source…
      adjustAccountBalance(uid, to.id, amount);      // …and lands in the destination
    });
    ctx.json(200, { ok: true, transfer_id: transferId, transactions: [outId, inId].map((id) => txnRow(ownedRow('transactions', id, uid))) });
  }));

  /* Retroactive recategorisation. Changing one transaction's category can also
     update its siblings (other rows with the same cleaned merchant name) and
     teach a forward rule so future imports/adds match. scope:
       'one'     → just this transaction
       'forward' → this + siblings dated on/after it, plus a saved rule (future)
       'all'     → every sibling (any date), plus a saved rule (future)
     Grouping is by normalised display name (normName) so "Amazon" groups with
     "Amazon" but never with "Apple". Each changed row records category history,
     exactly like the PUT route. */
  router.post('/api/transactions/:id/recategorize', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const row = ownedRow('transactions', ctx.params.id, uid);
    const category = str(ctx.body.category, 'category', { required: true });
    const scope = (str(ctx.body.scope, 'scope') || 'one').toLowerCase();
    const key = normName(row.name);
    let count = 0;
    const recatOne = (r) => {
      if (r.category === category) return;                 // already there → nothing to do
      const history = jparse(r.history, []);
      history.push({ from: r.category, to: category, at: nowISO() });
      db.prepare('UPDATE transactions SET category=?, review=0, history=? WHERE id=? AND user_id=?').run(category, JSON.stringify(history), r.id, uid);
      count++;
    };
    tx(() => {
      if (scope === 'one' || !key) {
        recatOne(row);
      } else {
        const rows = db.prepare('SELECT id, name, category, date, history FROM transactions WHERE user_id=?').all(uid);
        for (const r of rows) {
          if (normName(r.name) !== key) continue;
          if (scope === 'forward' && String(r.date) < String(row.date)) continue;   // forward = this date onward
          recatOne(r);
        }
        upsertRule(uid, row.name, category);                // future imports/adds auto-tag this merchant
      }
    });
    ctx.json(200, { ok: true, count, scope });
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
        // balance is encrypted at rest -> read-modify-write instead of SQL arithmetic
        db.prepare('UPDATE accounts SET balance=? WHERE id=? AND user_id=?').run(round2((account.balance || 0) - amount), fromId, uid);
      }
      // saved is encrypted at rest -> read-modify-write (goal row fetched above is decrypted)
      db.prepare('UPDATE goals SET saved=? WHERE id=? AND user_id=?').run(round2((goal.saved || 0) + amount), goal.id, uid);
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
    // Optional link to an investment account; only honored if the account is the user's.
    const reqAcct = str(b.account_id, 'account_id');
    const acctId = reqAcct && db.prepare('SELECT id FROM accounts WHERE id=? AND user_id=?').get(reqAcct, uid) ? reqAcct : null;
    db.prepare(`INSERT INTO holdings (id,user_id,account_id,ticker,name,cls,kind,shares,price,cost,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, uid, acctId, str(b.ticker, 'ticker'), str(b.name, 'Name', { required: true }), str(b.cls, 'cls'),
      str(b.kind, 'kind') || 'etf', num(b.shares, 'shares'), num(b.price, 'price'),
      b.cost != null ? num(b.cost, 'cost') : null, nowISO());
    ctx.json(200, { holding: holdingRow(ownedRow('holdings', id, uid)) });
  }));
  router.put('/api/holdings/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('holdings', ctx.params.id, ctx.user.id); const b = ctx.body;
    // Reassign to a (validated, owned) investment account when account_id is sent;
    // an empty value clears the link. Absent key leaves the existing link as-is.
    let acctId = row.account_id;
    if (b.account_id !== undefined) {
      const reqAcct = str(b.account_id, 'account_id');
      acctId = reqAcct && db.prepare('SELECT id FROM accounts WHERE id=? AND user_id=?').get(reqAcct, ctx.user.id) ? reqAcct : null;
    }
    db.prepare('UPDATE holdings SET account_id=?,ticker=?,name=?,cls=?,kind=?,shares=?,price=?,cost=? WHERE id=? AND user_id=?').run(
      acctId,
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
  /* Sell some/all of a position. Proceeds (shares × sale price) settle into the
     linked investment account's cash balance; the holding is reduced, or removed
     when fully sold. A cash position can't be "sold" this way — delete it instead. */
  router.post('/api/holdings/:id/sell', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const row = ownedRow('holdings', ctx.params.id, uid);
    const b = ctx.body || {};
    if (row.kind === 'cash') throw new HttpError(400, 'A cash position cannot be sold; remove it instead');
    const have = Number(row.shares) || 0;
    if (have <= 0) throw new HttpError(400, 'This position has no shares to sell');
    let sell = b.shares != null ? num(b.shares, 'shares') : have;
    if (!(sell > 0)) throw new HttpError(400, 'Shares to sell must be greater than zero');
    if (sell > have) sell = have;                              // never sell more than held
    let price = b.price != null ? num(b.price, 'price') : (Number(row.price) || 0);
    if (!(price > 0)) price = Number(row.price) || 0;
    const proceeds = round2(sell * price);
    const remaining = round2(have - sell);
    if (remaining > 0) {
      db.prepare('UPDATE holdings SET shares=? WHERE id=? AND user_id=?').run(remaining, row.id, uid);
    } else {
      db.prepare('DELETE FROM holdings WHERE id=? AND user_id=?').run(row.id, uid);
    }
    if (row.account_id) adjustAccountBalance(uid, row.account_id, proceeds);   // proceeds settle as cash
    ctx.json(200, { ok: true, sold: sell, proceeds: proceeds, remaining: remaining > 0 ? remaining : 0 });
  }));

  /* -------------------------------------------------- MARKET QUOTES */
  /* Live market data. Auth-scoped (so the server isn't an open proxy).
     All three degrade gracefully: a feed outage yields nulls/empties,
     never a 5xx, and the frontend falls back to the user's entered
     prices and simulated charts. */

  // Live quotes. ?symbols=AAPL,RY.TO  (defaults to the user's holdings).
  router.get('/api/quotes', auth.requireAuth(async (req, res, ctx) => {
    const raw = (ctx.query.get('symbols') || '').trim();
    let syms;
    if (raw) {
      syms = raw.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      // ticker is encrypted at rest, so SQL DISTINCT / <> '' can't work — dedupe here.
      const seen = new Set();
      syms = [];
      for (const h of db.prepare('SELECT ticker, kind FROM holdings WHERE user_id = ?').all(ctx.user.id)) {
        if (!h.ticker || h.kind === 'cash') continue;
        const t = h.ticker.trim();
        if (!t || seen.has(t.toUpperCase())) continue;
        seen.add(t.toUpperCase());
        syms.push(t);
      }
    }
    syms = syms.filter((s) => s && s.toUpperCase() !== 'CASH').slice(0, 60);
    let data = {};
    try { data = await quotes.getQuotes(syms); } catch (e) { console.error('quotes failed:', e); }
    ctx.json(200, { quotes: data, provider: quotes.providerName(), asOf: Date.now() });
  }));

  // FX rates for converting holdings priced in a foreign currency into the
  // user's display currency. ?symbols=USD,EUR&base=CAD -> { rates:{CAD:1,USD:1.37,…} }
  router.get('/api/fx', auth.requireAuth(async (req, res, ctx) => {
    const base = (ctx.query.get('base') || 'CAD').trim().toUpperCase().slice(0, 3);
    const raw = (ctx.query.get('symbols') || '').trim();
    const curs = raw
      ? raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20)
      : [];
    let rates = { [base]: 1 };
    try { rates = await quotes.getFxRates(curs, base); } catch (e) { console.error('fx failed:', e); }
    ctx.json(200, { base, rates, asOf: Date.now() });
  }));

  // Single-symbol candle history for the detail-page price chart.
  router.get('/api/quotes/history', auth.requireAuth(async (req, res, ctx) => {
    const symbol = str(ctx.query.get('symbol'), 'symbol', { required: true });
    const period = str(ctx.query.get('period'), 'period') || '1Y';
    let data = null;
    try { data = await quotes.getHistory(symbol, period); } catch (e) { console.error('history failed:', e); }
    ctx.json(200, Object.assign({ symbol, period, timestamps: [], closes: [] }, data || {}));
  }));

  // Real portfolio-vs-S&P 500 series, weighted from the user's holdings.
  // Optional ?account=<id> scopes the series to a single account's holdings and
  // folds in that account's cash sleeve (its stored balance) so the resulting
  // `portfolio` curve is the account's TOTAL value over time — used by the
  // account detail page's live "Total value" chart.
  router.get('/api/portfolio/series', auth.requireAuth(async (req, res, ctx) => {
    const uid = ctx.user.id;
    const period = str(ctx.query.get('period'), 'period') || '1Y';
    const accountId = str(ctx.query.get('account'), 'account');   // optional
    let holdings;
    if (accountId) {
      holdings = db.prepare(
        `SELECT ticker, kind, shares, price FROM holdings WHERE user_id = ? AND account_id = ?`
      ).all(uid, accountId);
      // Fold the account's loose cash sleeve into the series as a flat cash holding
      // so the curve reflects the account's total value, not just its securities.
      const acct = db.prepare('SELECT balance FROM accounts WHERE id = ? AND user_id = ?').get(accountId, uid);
      const cash = acct && typeof acct.balance === 'number' ? acct.balance : 0;
      if (cash) holdings = holdings.concat([{ ticker: 'CASH', kind: 'cash', shares: 1, price: cash }]);
    } else {
      holdings = db.prepare(
        `SELECT ticker, kind, shares, price FROM holdings WHERE user_id = ?`
      ).all(uid);
    }
    let data = null;
    try { data = await quotes.getPortfolioSeries(holdings, period); } catch (e) { console.error('series failed:', e); }
    if (!data) return ctx.json(200, { period, available: false });
    ctx.json(200, Object.assign({ period, available: true }, data));
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
    const { id: _ignoredId, kind, name, ...data } = b;   // never let a client-sent id leak into `data`
    db.prepare('INSERT INTO foresight_plans (id,user_id,kind,name,data) VALUES (?,?,?,?,?)').run(
      id, uid, str(kind, 'kind', { required: true }), str(name, 'name'), JSON.stringify(data || {}));
    ctx.json(200, { plan: planRow(ownedRow('foresight_plans', id, uid)) });
  }));
  router.put('/api/foresight/plans/:id', auth.requireAuth(async (req, res, ctx) => {
    const row = ownedRow('foresight_plans', ctx.params.id, ctx.user.id); const b = ctx.body;
    const { id: _ignoredId, kind, name, ...data } = b;   // ignore any client id in the body
    const merged = Object.assign(jparse(row.data, {}), data);
    delete merged.id; delete merged.kind; delete merged.name;   // purge stale keys saved by older clients
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
/* Routes include live market quotes (default provider: Yahoo) — see lib/quotes.js. */
