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

const db = new DatabaseSync(DB_PATH);
// WAL is an optimization; some network/virtual filesystems don't support the
// shared-memory file it needs. Try it, but never let it stop the app booting.
try { db.exec('PRAGMA journal_mode = WAL;'); } catch { /* falls back to default journal */ }
try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}

/* ------------------------------------------------------------------ schema */
db.exec(`
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
`);

// Manual transaction helper. node:sqlite's DatabaseSync has no .transaction()
// (unlike better-sqlite3), so we wrap BEGIN / COMMIT / ROLLBACK ourselves.
function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

module.exports = { db, DB_PATH, tx };
