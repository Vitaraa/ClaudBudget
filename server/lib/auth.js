'use strict';
/* ============================================================
   Auth — password hashing (scrypt) + JWT (HMAC-SHA256).
   All built on node:crypto. No external dependencies.
   ============================================================ */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db');
const { HttpError, newId } = require('./http');
const nowISO = () => new Date().toISOString();

/* ---- stable signing secret (persisted so tokens survive restarts) ---- */
const SECRET = (() => {
  if (process.env.CLAUD_SECRET) return process.env.CLAUD_SECRET;
  const file = path.join(__dirname, '..', '..', 'data', '.secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const s = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(file, s, { mode: 0o600 }); } catch {}
    return s;
  }
})();

const TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

/* ---------------------------------------------------------------- passwords */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

/* -------------------------------------------------------------------- JWT */
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeToken(userId, tokenVersion = 0) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ sub: userId, tv: tokenVersion, iat: now, exp: now + TOKEN_TTL });
  const sig = sign(header + '.' + payload);
  return `${header}.${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = sign(header + '.' + payload);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

/* ----------------------------------------------- single-use email tokens */
/* Powers email verification, password reset (and, later, magic-link). We store
   only sha256(rawToken); the raw token lives only in the emailed link, so a DB
   leak can't be replayed. Tokens are single-use (used_at) and time-boxed. */
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Returns the RAW token (for the link); persists only its hash.
function issueToken(userId, purpose, ttlSeconds) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare(
    'INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(newId('at_'), userId, purpose, sha256(raw),
        new Date(now + ttlSeconds * 1000).toISOString(), null, new Date(now).toISOString());
  return raw;
}

// Validate + consume. Throws HttpError(400) if missing/expired/used; otherwise
// marks the token used and returns its user_id.
function consumeToken(rawToken, purpose) {
  if (!rawToken || typeof rawToken !== 'string') throw new HttpError(400, 'Invalid or expired link');
  const row = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = ?').get(sha256(rawToken), purpose);
  if (!row) throw new HttpError(400, 'Invalid or expired link');
  if (row.used_at) throw new HttpError(400, 'This link has already been used');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(400, 'This link has expired');
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(nowISO(), row.id);
  return row.user_id;
}

// Burn any outstanding (unused) tokens of a purpose for a user.
function invalidateTokens(userId, purpose) {
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL')
    .run(nowISO(), userId, purpose);
}

// Bump token_version so every existing JWT session for the user stops validating.
function bumpTokenVersion(userId) {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
}

/* ----------------------------------------------------------- user helpers */
const publicUser = (row) =>
  row ? { id: row.id, email: row.email, name: row.name, plan: row.plan,
          email_verified: !!row.email_verified, created_at: row.created_at } : null;

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Extracts and validates the bearer token; returns the user row or throws 401.
function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const claims = verifyToken(token);
  if (!claims) throw new HttpError(401, 'Not authenticated');
  const user = getUserById(claims.sub);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  // token_version invalidates all existing sessions when bumped (e.g. password
  // reset). Pre-feature tokens carry no tv claim -> treated as 0, matching the
  // column default, so existing logins survive this upgrade.
  if ((claims.tv || 0) !== (user.token_version || 0)) throw new HttpError(401, 'Session expired, please sign in again');
  return user;
}

// Wrap a handler so it only runs for authenticated requests.
// Handler signature: (req, res, ctx) where ctx.user and ctx.params are set.
function requireAuth(handler) {
  return async (req, res, ctx) => {
    ctx.user = authUser(req);
    return handler(req, res, ctx);
  };
}

module.exports = {
  hashPassword, verifyPassword,
  makeToken, verifyToken,
  issueToken, consumeToken, invalidateTokens, bumpTokenVersion, sha256,
  publicUser, getUserById, authUser, requireAuth,
  SECRET
};
