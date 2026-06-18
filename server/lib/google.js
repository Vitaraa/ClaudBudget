'use strict';
/* ============================================================
   Claud — Google Sign-In (OAuth 2.0 Authorization Code flow).
   Zero external dependencies: two HTTPS calls via global fetch.

   Why we don't verify the id_token signature here: we receive the
   id_token directly from Google's token endpoint over our own TLS
   connection (not via the browser), so the channel already
   authenticates Google. Per Google's docs that makes signature
   verification optional; we still validate aud / iss / exp. (If
   you ever accept an id_token from the client instead, switch to
   full JWKS signature verification.)

   Env:
     GOOGLE_CLIENT_ID
     GOOGLE_CLIENT_SECRET
     APP_BASE_URL        used to derive the redirect URI
   ============================================================ */

const crypto = require('node:crypto');
const { baseUrl } = require('./mailer');

const FETCH_TIMEOUT_MS = 10000;
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function configured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function clientId() { return process.env.GOOGLE_CLIENT_ID; }
function redirectUri() { return baseUrl() + '/api/auth/google/callback'; }

/* ---- CSRF state: short-lived, single-use, in-memory ---- */
const states = new Map();   // state -> expiresAt
function issueState() {
  const s = crypto.randomBytes(16).toString('base64url');
  states.set(s, Date.now() + 10 * 60 * 1000);   // 10 min
  return s;
}
function checkState(s) {
  if (!s) return false;
  const exp = states.get(s);
  states.delete(s);                              // single use
  return !!exp && Date.now() < exp;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of states) if (now >= exp) states.delete(k);
}, 10 * 60 * 1000).unref();

/* ---- Step 1: the consent-screen URL to redirect the user to ---- */
function authUrl(state) {
  const u = new URL(AUTH_ENDPOINT);
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

/* ---- Step 2: exchange the authorization code for tokens ---- */
async function exchangeCode(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code'
      }).toString()
    });
    const body = await res.text();
    if (!res.ok) throw new Error('Google token HTTP ' + res.status + ': ' + body.slice(0, 300));
    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

/* ---- Decode + validate the id_token payload (see header note) ---- */
function decodeIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('No id_token returned');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed id_token');
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
  catch { throw new Error('Unreadable id_token'); }

  const validIss = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIss.includes(claims.iss)) throw new Error('Bad id_token issuer');
  if (claims.aud !== clientId()) throw new Error('id_token audience mismatch');
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('id_token expired');
  if (!claims.sub) throw new Error('id_token missing subject');
  return claims;   // { sub, email, email_verified, name, picture, ... }
}

/* One-shot helper: code -> validated profile { sub, email, emailVerified, name }. */
async function profileFromCode(code) {
  const tokens = await exchangeCode(code);
  const c = decodeIdToken(tokens.id_token);
  return {
    sub: c.sub,
    email: (c.email || '').toLowerCase(),
    emailVerified: c.email_verified === true || c.email_verified === 'true',
    name: c.name || ''
  };
}

module.exports = {
  configured, clientId, redirectUri,
  issueState, checkState, authUrl,
  exchangeCode, decodeIdToken, profileFromCode
};
