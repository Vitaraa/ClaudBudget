'use strict';
/* ============================================================
   One-time migration — link existing (unassigned) holdings to an
   investment account, so stocks added before the accounts⇄investments
   linking shipped now show up under the right account.

   It only ever touches holdings whose account_id IS NULL, and it's
   idempotent: re-running does nothing once everything is linked.

   Usage (run on the server that owns the live claud.db):

     node migrate-holdings.js --email you@example.com               # auto-pick the only investment account
     node migrate-holdings.js --email you@example.com --account TFSA # pick by account name (case-insensitive)
     node migrate-holdings.js --email you@example.com --dry          # preview, write nothing
     node migrate-holdings.js --list                                 # list users + their investment accounts

   Honors the CLAUD_DB env var (same as the server) if your DB lives
   outside ./data.
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');

// Preflight: the server encrypts sensitive columns (names, tickers, …) at rest.
// If we let the crypto module fall through to GENERATING a key, we'd write a
// throwaway .claud-enc.key and then fail to read your real data ("unable to
// authenticate data"). So refuse to run unless the SAME key the app uses is
// available — either CLAUD_ENC_KEY / CLAUD_ENC_KEY_FILE in the env, or an
// existing key file at the project root.
(function requireEncKey() {
  const hasEnv = !!(process.env.CLAUD_ENC_KEY || process.env.CLAUD_ENC_KEY_FILE);
  const keyFile = path.join(__dirname, '.claud-enc.key');
  if (hasEnv || fs.existsSync(keyFile)) return;
  console.error(
    '\nRefusing to run — no at-rest encryption key found.\n' +
    'This migration must use the SAME key your server uses, or it cannot read your\n' +
    '(encrypted) holdings.\n\n' +
    '  1) Find the key:  sudo systemctl cat claud-budget\n' +
    '                    (look for CLAUD_ENC_KEY=… or an EnvironmentFile= path,\n' +
    '                     then: sudo grep CLAUD_ENC_KEY <that-file>)\n' +
    '  2) Run with it:   CLAUD_ENC_KEY=<key> node migrate-holdings.js --email <addr> --account "TFSA"\n\n' +
    'If an earlier failed run left a stray (wrong) ' + keyFile + ', delete it first:\n' +
    '  rm ' + keyFile + '\n'
  );
  process.exit(1);
})();

// Reuse the app's wrapped DB so encrypted columns (names, tickers) decrypt and
// the holdings.account_id column is guaranteed to exist (db.js adds it on load).
const { db, DB_PATH } = require('./server/lib/db');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return (next && !next.startsWith('--')) ? next : true;   // `true` for bare flags
}

const wantList = arg('list') === true;
const dry = arg('dry') === true;
const email = typeof arg('email') === 'string' ? arg('email').toLowerCase() : null;
const userArg = typeof arg('user') === 'string' ? arg('user') : null;
const acctArg = typeof arg('account') === 'string' ? arg('account') : null;

function investmentAccounts(uid) {
  return db.prepare('SELECT id, name, group_label, balance FROM accounts WHERE user_id = ? ORDER BY sort, created_at')
    .all(uid)
    .filter((a) => a.group_label === 'Investments');
}

function listUsers() {
  const users = db.prepare('SELECT id, email FROM users ORDER BY id').all();
  console.log(`\nDatabase: ${DB_PATH}\n`);
  if (!users.length) { console.log('No users found.'); return; }
  for (const u of users) {
    const inv = investmentAccounts(u.id);
    const held = db.prepare('SELECT COUNT(*) c FROM holdings WHERE user_id = ?').get(u.id).c;
    const unl = db.prepare('SELECT COUNT(*) c FROM holdings WHERE user_id = ? AND account_id IS NULL').get(u.id).c;
    console.log(`#${u.id}  ${u.email}`);
    console.log(`     holdings: ${held} total, ${unl} unassigned`);
    console.log(`     investment accounts: ${inv.length ? inv.map((a) => `"${a.name}"`).join(', ') : '(none)'}`);
  }
  console.log('');
}

function resolveUser() {
  if (userArg) {
    const u = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userArg);
    if (!u) throw new Error(`No user with id ${userArg}`);
    return u;
  }
  if (email) {
    const u = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!u) throw new Error(`No user with email ${email}`);
    return u;
  }
  const all = db.prepare('SELECT id, email FROM users').all();
  if (all.length === 1) { console.log(`(only one user — using ${all[0].email})`); return all[0]; }
  throw new Error('Specify --email <addr> or --user <id> (or run with --list). Multiple users exist.');
}

function run() {
  if (wantList) return listUsers();

  const user = resolveUser();
  const uid = user.id;

  const unassigned = db.prepare('SELECT id, ticker, name, account_id FROM holdings WHERE user_id = ? AND account_id IS NULL').all(uid);
  if (!unassigned.length) {
    console.log(`Nothing to do — ${user.email} has no unassigned holdings.`);
    return;
  }

  const inv = investmentAccounts(uid);
  if (!inv.length) throw new Error(`${user.email} has no investment accounts. Create one (e.g. a TFSA / brokerage) first, then re-run.`);

  let target;
  if (acctArg) {
    target = inv.find((a) => a.name.toLowerCase() === acctArg.toLowerCase())
          || inv.find((a) => a.name.toLowerCase().includes(acctArg.toLowerCase()));
    if (!target) throw new Error(`No investment account matching "${acctArg}". Options: ${inv.map((a) => `"${a.name}"`).join(', ')}`);
  } else if (inv.length === 1) {
    target = inv[0];
  } else {
    throw new Error(`Multiple investment accounts — pass --account "<name>". Options: ${inv.map((a) => `"${a.name}"`).join(', ')}`);
  }

  console.log(`\nDatabase: ${DB_PATH}`);
  console.log(`User: ${user.email}`);
  console.log(`Target account: "${target.name}"`);
  console.log(`Linking ${unassigned.length} holding(s):`);
  for (const h of unassigned) console.log(`   • ${h.ticker || '(cash)'} — ${h.name}`);

  if (dry) { console.log('\n--dry: no changes written.\n'); return; }

  const stmt = db.prepare('UPDATE holdings SET account_id = ? WHERE id = ? AND user_id = ?');
  let n = 0;
  for (const h of unassigned) { stmt.run(target.id, h.id, uid); n++; }
  console.log(`\nDone — linked ${n} holding(s) to "${target.name}".\n`);
}

try { run(); }
catch (e) {
  const m = (e && e.message) ? e.message : String(e);
  console.error('\nMigration failed:', m, '\n');
  if (/authenticate|unsupported state|bad decrypt|wrong final block|unable to/i.test(m)) {
    console.error(
      'This looks like an ENCRYPTION-KEY MISMATCH — the key in use does not match the\n' +
      'one your data was encrypted with. Re-run with the server\'s CLAUD_ENC_KEY (see\n' +
      'the instructions printed when running without a key), and delete any stray\n' +
      '.claud-enc.key a failed run may have created (it holds the wrong key).\n'
    );
  }
  process.exit(1);
}
