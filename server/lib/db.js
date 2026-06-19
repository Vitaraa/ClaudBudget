'use strict';
/* ============================================================
   Claud — database layer (Node built-in SQLite).
   Real SQLite, zero external dependencies. The DB file lives in
   /data and is created automatically on first run (blank slate —
   no seed data; each new user starts empty).
   ============================================================ */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.CLAUD_DB || path.join(DATA_DIR, 'claud.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const rawDb = new DatabaseSync(DB_PATH);
// WAL is an optimization; some network/virtual filesystems don't support the
// shared-memory file it needs. Try it, but never let it stop the app booting.
try { rawDb.exec('PRAGMA journal_mode = WAL;'); } catch { /* falls back to default journal */ }
try { rawDb.exec('PRAGMA foreign_keys = ON;'); } catch {}

/* ------------------------------------------------------------------ schema */
rawDb.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  pw_salt     TEXT NOT NULL,
  pw_hash     TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_label  TEXT NOT NULL DEFAULT 'Cash',
  type         TEXT,
  name         TEXT NOT NULL,
  institution  TEXT,
  mask         TEXT,
  balance      REAL NOT NULL DEFAULT 0,
  icon         TEXT,
  apy          TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  account_name  TEXT,
  name          TEXT NOT NULL,
  category      TEXT,
  amount        REAL NOT NULL,
  date          TEXT NOT NULL,
  icon          TEXT,
  review        INTEGER NOT NULL DEFAULT 0,
  reason        TEXT,
  excluded      INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  tags          TEXT,
  splits        TEXT,
  attachment    TEXT,
  history       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions(user_id, date);

CREATE TABLE IF NOT EXISTS rules (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match       TEXT NOT NULL,
  category    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_groups (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id     TEXT NOT NULL REFERENCES budget_groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  budget       REAL NOT NULL DEFAULT 0,
  color        TEXT,
  roll         REAL NOT NULL DEFAULT 0,
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recurring (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      REAL NOT NULL,
  cadence     TEXT NOT NULL DEFAULT 'monthly',
  next_date   TEXT,
  category    TEXT,
  account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  icon        TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  target      REAL NOT NULL DEFAULT 0,
  saved       REAL NOT NULL DEFAULT 0,
  monthly     REAL NOT NULL DEFAULT 0,
  auto        INTEGER NOT NULL DEFAULT 0,
  account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  color       TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id         TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount          REAL NOT NULL,
  date            TEXT NOT NULL,
  from_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS holdings (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker      TEXT,
  name        TEXT NOT NULL,
  cls         TEXT,
  kind        TEXT NOT NULL DEFAULT 'etf',
  shares      REAL NOT NULL DEFAULT 0,
  price       REAL NOT NULL DEFAULT 0,
  cost        REAL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foresight_plans (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  name      TEXT,
  data      TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS foresight_overrides (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cat       TEXT NOT NULL,
  year      INTEGER NOT NULL,
  amount    REAL NOT NULL,
  PRIMARY KEY (user_id, cat, year)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data      TEXT NOT NULL DEFAULT '{}'
);

-- Single-use tokens for email verification, password reset, and (future)
-- magic-link. Only the SHA-256 hash of the token is stored, never the raw
-- token, so a DB leak can't be replayed. One row is "consumed" by setting
-- used_at; expired/used rows are ignored and periodically swept.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL,              -- 'verify' | 'reset' | 'magic'
  token_hash  TEXT NOT NULL,             -- sha256(rawToken), hex
  expires_at  TEXT NOT NULL,
  used_at     TEXT,                       -- set on first use -> single-use
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_authtok_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_authtok_user ON auth_tokens(user_id, purpose);
`);

/* ------------------------------------------------------------- migrations */
/* Idempotent column adds for the email-auth feature. The app is live, so we
   never drop or rewrite the users table — we additively ALTER it. node:sqlite
   throws "duplicate column name" if a column already exists, which we swallow,
   making this safe to run on every boot for both fresh and existing databases.
   Existing rows get the DEFAULT (email_verified = 0, token_version = 0), and
   existing sessions stay valid because old JWTs simply carry no token_version
   claim (treated as 0 — see auth.js). */
function addColumn(sql) {
  try { rawDb.exec(sql); }
  catch (e) {
    const msg = String((e && e.message) || e);
    if (!/duplicate column name/i.test(msg)) throw e;   // re-throw anything unexpected
  }
}
addColumn("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
addColumn("ALTER TABLE users ADD COLUMN token_version  INTEGER NOT NULL DEFAULT 0");
addColumn("ALTER TABLE users ADD COLUMN google_sub     TEXT");

/* ---- At-rest encryption -------------------------------------------------
   Wrap the raw DB so sensitive columns are encrypted on write and decrypted
   on read (see lib/model.js + lib/crypto.js), then encrypt any pre-existing
   plaintext rows once. The key is held OUTSIDE the database, so a stolen
   claud.db (or a DB-only backup) is useless on its own. */
const { wrap, migrateEncryption } = require('./model');
const db = wrap(rawDb);

rawDb.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
(function ensureEncrypted() {
  const row = rawDb.prepare("SELECT value FROM meta WHERE key = 'enc_version'").get();
  if (row && row.value === '1') return;             // already migrated
  migrateEncryption(rawDb);
  rawDb.prepare("INSERT INTO meta (key, value) VALUES ('enc_version', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
})();

// Manual transaction helper. node:sqlite's DatabaseSync has no .transaction()
// (unlike better-sqlite3), so we wrap BEGIN / COMMIT / ROLLBACK ourselves.
function tx(fn) {
  rawDb.exec('BEGIN');
  try {
    const result = fn();
    rawDb.exec('COMMIT');
    return result;
  } catch (e) {
    try { rawDb.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

module.exports = { db, rawDb, DB_PATH, tx };
