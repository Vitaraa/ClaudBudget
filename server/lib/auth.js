'use strict';
/* ============================================================
   Auth — password hashing (scrypt) + JWT (HMAC-SHA256).
   All built on node:crypto. No external dependencies.
   ============================================================ */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db');
const { HttpError } = require('./http');

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

function makeToken(userId) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ sub: userId, iat: now, exp: now + TOKEN_TTL });
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

/* ----------------------------------------------------------- user helpers */
const publicUser = (row) =>
  row ? { id: row.id, email: row.email, name: row.name, plan: row.plan, created_at: row.created_at } : null;

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
  publicUser, getUserById, authUser, requireAuth,
  SECRET
};
