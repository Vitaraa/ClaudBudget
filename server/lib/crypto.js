'use strict';
/* ============================================================
   Claud — at-rest encryption key + primitives (AES-256-GCM).
   Built on node:crypto. No external dependencies.

   THE KEY NEVER LIVES INSIDE THE DATABASE IT PROTECTS. That is the
   whole point of "stolen-DB-only" protection: a leaked claud.db (or a
   DB-only backup) is useless without the key, which is held
   separately. Resolution order:

     1. CLAUD_ENC_KEY       — 32-byte key as hex (64 chars) or base64.
                              Preferred in production (e.g. a systemd
                              EnvironmentFile), so it never sits next
                              to the database or in its backups.
     2. CLAUD_ENC_KEY_FILE  — path to a file holding such a key.
     3. A generated key persisted OUTSIDE data/ (project root,
        gitignored) — a dev convenience, with a loud warning.

   What this protects: a stolen database file / backup / volume
   snapshot that does NOT also carry the key.
   What it does NOT protect: a fully compromised running server
   (the key is in memory) — by design.
   ============================================================ */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PREFIX = 'enc:v1:';        // marks our ciphertext; plaintext never starts with this
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;               // GCM standard nonce
const TAG_LEN = 16;

function parseKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');     // hex
  try {
    const b = Buffer.from(s, 'base64');
    if (b.length === 32) return b;                                   // base64 / base64url
  } catch { /* fall through */ }
  throw new Error('CLAUD_ENC_KEY must be a 32-byte key as hex (64 chars) or base64.');
}

const KEY = (() => {
  // 1) explicit key from the environment
  const fromEnv = parseKey(process.env.CLAUD_ENC_KEY);
  if (fromEnv) return fromEnv;

  // 2) a key file — explicit path, or a default at the project root (NOT in data/)
  const file = process.env.CLAUD_ENC_KEY_FILE
    || path.join(__dirname, '..', '..', '.claud-enc.key');
  try {
    const k = parseKey(fs.readFileSync(file, 'utf8'));
    if (k) return k;
  } catch { /* missing -> generate below */ }

  // 3) generate + persist (dev fallback)
  const k = crypto.randomBytes(32);
  try {
    fs.writeFileSync(file, k.toString('hex'), { mode: 0o600 });
    console.warn(
      '\n  [Claud] No CLAUD_ENC_KEY set — generated a data-encryption key at\n' +
      `          ${file}\n` +
      '          This works for local use, but for real at-rest protection set\n' +
      '          CLAUD_ENC_KEY (e.g. via a systemd EnvironmentFile) and keep it\n' +
      '          OUT of your database backups.\n'
    );
  } catch (e) {
    console.warn('[Claud] Could not persist the generated encryption key file:', e && e.message);
  }
  return k;
})();

function isEnc(v) {
  return typeof v === 'string' && v.startsWith(PREFIX);
}

/* Encrypt a scalar (string or number). null/undefined pass through unchanged.
   Numbers are stringified; callers coerce numeric columns back on decrypt. */
function enc(value) {
  if (value == null) return value;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/* Decrypt a value produced by enc(). Anything that isn't our ciphertext
   (null, plaintext, already-decrypted) is returned unchanged — which keeps
   reads safe during/after migration and makes decryption idempotent. */
function dec(value) {
  if (!isEnc(value)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  // Throws on a bad tag (wrong key / tampered data). We let it throw rather
  // than silently hand back ciphertext — a loud failure is the safe default.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { enc, dec, isEnc, PREFIX };
