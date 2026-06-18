# In-app email auth — implementation plan

Scope: the four flows you picked — **email verification on signup**, **password reset**,
**passwordless magic-link login**, and **finishing the Google OAuth stub** — plus the shared
plumbing they all need. Written against the current code (`server/lib/auth.js`,
`server/routes.js`, `server/lib/db.js`).

---

## Where things stand today

- **Email + password already works and is real**: scrypt-hashed passwords, HMAC-SHA256 JWTs
  (30-day), every API route scoped to the token's user (`auth.requireAuth`).
- **What's missing for "email auth"** is everything that requires actually *sending an email*:
  there is no email transport, no email-verification state, no reset flow, no magic link. The
  "Continue with Google" button is a stub (see `NOTES.md` §1).

So this plan is mostly about (a) adding an email sender, (b) a single-use token table, and
(c) the four flows on top of them. The existing scrypt/JWT core doesn't change.

---

## 0. Shared prerequisites (build these first)

### 0a. An email sender
The backend is deliberately zero-dependency, so adding SMTP libraries cuts against the grain.
Cleanest fit: call a transactional-email **HTTP API via the built-in `fetch`** (same pattern the
new quotes module uses). Resend, Postmark, SendGrid, or AWS SES all expose a simple JSON endpoint.

- New file `server/lib/mailer.js` exposing `sendEmail({to, subject, html, text})`.
- Config via env: `EMAIL_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` (for absolute https links).
- In dev with no key set, fall back to logging the link to the console so flows are testable
  without a provider — mirrors how the app already degrades gracefully.

### 0b. A single-use token table
One generic table powers verification, reset, and magic-link. **Store only a hash of the token**,
never the token itself, so a DB leak can't be replayed.

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL,              -- 'verify' | 'reset' | 'magic'
  token_hash  TEXT NOT NULL,             -- sha256(rawToken), hex
  expires_at  TEXT NOT NULL,
  used_at     TEXT,                      -- set on first use -> single-use
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_authtok_hash ON auth_tokens(token_hash);
```

Helpers in `auth.js`:
- `issueToken(userId, purpose, ttlSeconds)` → returns the **raw** token (sent in the link),
  stores `sha256(raw)`. Raw token = `crypto.randomBytes(32).toString('base64url')`.
- `consumeToken(rawToken, purpose)` → looks up by hash, checks `purpose`, not expired, not used;
  marks `used_at`; returns the `user_id` or throws. Use `crypto.timingSafeEqual` on the hash.

### 0c. Schema additions to `users`
```sql
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN token_version  INTEGER NOT NULL DEFAULT 0;  -- for global logout
ALTER TABLE users ADD COLUMN google_sub     TEXT;                        -- Google account id
```
`token_version` goes into the JWT payload and is checked in `verifyToken`/`authUser`; bumping it
invalidates all existing sessions (used on password reset).

---

## 1. Email verification on signup

**Goal:** confirm the user owns the address before (or shortly after) they start using the app.

- **Register** (`POST /api/auth/register`, modify): create the user with `email_verified = 0`,
  issue a `verify` token (24h TTL), email a link to `APP_BASE_URL/verify?token=…`. Still return a
  session so the user isn't blocked — a **soft gate** (banner + restricted actions) is friendlier
  than a hard wall and is reversible later.
- **Verify** (`GET /api/auth/verify?token=` → page, `POST /api/auth/verify` → action): consume the
  token, set `email_verified = 1`.
- **Resend** (`POST /api/auth/resend-verification`, authed): rate-limited; re-issues a token.
- **Frontend:** a dismissible "Confirm your email" banner in `app.jsx` when
  `user.email_verified === 0`; a `/verify` landing page that calls the endpoint and shows success.

**Decision to make:** which actions (if any) are gated until verified. Recommend gating only
outbound/irreversible things later; keep signup-to-dashboard instant for now.

---

## 2. Password reset via email

- **Forgot** (`POST /api/auth/forgot`): look up by email; if found, issue a `reset` token (1h TTL)
  and email `APP_BASE_URL/reset?token=…`. **Always return 200** with a generic message even when
  the email isn't registered — avoids account enumeration.
- **Reset** (`POST /api/auth/reset`): consume token, validate the new password (reuse the existing
  ≥8-char rule), scrypt-hash it, **bump `token_version`** to log out all other sessions, and
  invalidate any other outstanding `reset` tokens for that user.
- **Frontend:** "Forgot password?" link on the sign-in card; a `/reset` page with the new-password
  form.

---

## 3. Passwordless magic-link login

- **Request** (`POST /api/auth/magic/request`): by email; if the account exists, issue a `magic`
  token (10–15 min TTL) and email `APP_BASE_URL/magic?token=…`. Generic 200 response (enumeration).
- **Consume** (`GET/POST /api/auth/magic/consume`): consume token → mint a normal session JWT.
  Treat a successful magic login as proof of email ownership (set `email_verified = 1`).
- **Security:** short TTL, single-use, and rate-limit requests per email/IP. Optionally bind the
  link to the requesting session to mitigate link-forwarding.
- **Frontend:** an "Email me a sign-in link" option on the login card.

---

## 4. Finish Google OAuth

Replace the stub with the **OAuth 2.0 Authorization Code** flow.

- **Config:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect `APP_BASE_URL/api/auth/google/callback`.
- **Start** (`GET /api/auth/google/start`): redirect to Google's consent screen with a `state`
  value (CSRF protection, stored short-term) and scope `openid email profile`.
- **Callback** (`GET /api/auth/google/callback?code=&state=`): validate `state`; exchange `code`
  for tokens via `fetch` to `https://oauth2.googleapis.com/token`; **verify the returned
  `id_token`** (an RS256 JWT) — either the robust way (fetch Google's JWKS and verify the
  signature with `node:crypto`, checking `aud === GOOGLE_CLIENT_ID` and `exp`), or, for low volume,
  the simpler `https://oauth2.googleapis.com/tokeninfo?id_token=…` lookup.
- **Account mapping:** find a user by `google_sub`; else by **verified** email (link the accounts);
  else create one with `email_verified = 1` and `google_sub` stored. Then mint our own session JWT —
  Google's token is only used at sign-in.

**Decision to make:** whether to auto-link a Google login to an existing email/password account
with the same address. Linking on a Google-verified email is the usual choice; flag it to the user.

---

## Cross-cutting security

- **Tokens:** single-use, hashed at rest, short-lived, constant-time compared. Never log raw tokens.
- **Enumeration:** `forgot`, `magic/request`, and `resend` always return the same generic 200.
- **Rate limiting:** per-IP and per-email on every email-sending endpoint (a small in-memory
  sliding window is enough at this scale; Cloudflare can add a layer in front).
- **Transport:** all links must be **absolute https** (`APP_BASE_URL`). The Node server itself
  speaks plain HTTP today — terminate TLS at a proxy (your `going-public-cloudflare.md` setup) and
  never email an `http://` link.
- **Session invalidation:** include `token_version` in the JWT and check it in `authUser`; bump on
  password reset so a stolen/old session dies.
- **Session storage (worth revisiting):** the JWT currently lives in `localStorage`, which is
  readable by any injected script (XSS). An `HttpOnly; Secure; SameSite` cookie removes that class
  of theft, at the cost of adding CSRF protection. Optional but recommended before a public launch.

---

## What encryption we're doing for user data (today)

Straight answer, because hashing and signing are easy to mistake for encryption:

- **Passwords — hashed, not encrypted.** scrypt with a per-user 16-byte random salt, 64-byte
  derived key, constant-time compare (`server/lib/auth.js`). One-way and appropriate; you can't
  decrypt them, which is correct.
- **Sessions — signed, not encrypted.** JWTs are HMAC-SHA256 **signed**, so the payload (user id,
  issued/expiry) is tamper-evident but **not secret** — it's base64, anyone holding the token can
  read it. The signing secret is `CLAUD_SECRET` or a random value persisted to `data/.secret`.
- **All other user data — not encrypted at rest.** Accounts, balances, transactions, holdings,
  goals, and the email address itself are stored as **plaintext** in the SQLite file
  (`data/claud.db`). There is no field-level encryption and no encrypted-database layer
  (Node's built-in `node:sqlite` has no SQLCipher support).
- **In transit — no TLS in the app itself.** The server is plain HTTP; any encryption in transit
  has to come from a reverse proxy / Cloudflare in front of it.

So: **we protect credentials (hashing) and detect session tampering (signing), but we do not
encrypt the actual financial data at rest or, by itself, in transit.**

### If you want to raise that bar
- **In transit:** put HTTPS in front (Cloudflare origin cert or a TLS-terminating proxy) — the
  single highest-value step, and it pairs with the email-link requirement above.
- **At rest:** options, roughly in order of effort — full-disk/volume encryption on the host
  (cheap, coarse); encrypt selected sensitive columns with an app-held key (`node:crypto` AES-GCM,
  key from env/KMS); or move to a DB/driver that supports transparent encryption (SQLCipher via a
  native driver, which would mean dropping the zero-dependency `node:sqlite` approach).
- **Secret management:** set a fixed `CLAUD_SECRET` from a secrets store rather than the on-disk
  `data/.secret`, and keep `data/` off any backup that isn't itself encrypted.

---

## Suggested build order

1. **Foundation** — `mailer.js` + `auth_tokens` table + `users` columns (§0).
2. **Password reset** (§2) — highest user value, lowest risk, exercises the whole token path.
3. **Email verification** (§1).
4. **Magic-link login** (§3) — reuses everything from 2–3.
5. **Google OAuth** (§4) — most moving parts; do it last.

Each step is independently shippable.
