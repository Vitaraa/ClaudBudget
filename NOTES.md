# Build notes — decisions, assumptions, and things to know

This documents choices I made and anything I left intentionally incomplete, so nothing is a
surprise.

## Architecture decisions

- **Zero-dependency backend.** I built the server on Node's built-in modules only
  (`node:http`, `node:crypto`, `node:sqlite`) instead of Express + better-sqlite3 + bcrypt +
  jsonwebtoken. Reasons: it runs with no `npm install`, and it could be fully tested in this
  environment. It's still a real server with a real SQLite database. Trade-off: it needs
  **Node ≥ 22.5** (for built-in SQLite, which prints a one-line "experimental" notice that the
  start script suppresses). If you'd prefer the Express/better-sqlite3 stack, say so and I can
  port it.
- **The server serves the frontend.** One process, one port. The original static files are
  unchanged at the repo root; the wired-up copies live in `public/`. I did **not** delete or
  modify your originals.
- **Blank slate.** Per your choice, a new user starts with no data and sees empty states. I
  removed the demo seed arrays (they're now sourced from the live API).

## Things left client-side / not fully real (by necessity)

1. **Google sign-in** — the "Continue with Google" button can't do real OAuth without Google
   client credentials, so it shows a message telling you to use email + password. Email/password
   auth is fully real. Wire-up needed if you want Google.
2. **Payments** — "Upgrade to Pro" instantly sets your account's plan to `pro`; there is no
   Stripe/billing integration. Hook a payment provider in before the `POST /api/auth/plan` call
   if you want real billing.
3. **Receipt scanning & statement import** — the OCR/parse step is a simulated guesser on the
   client (it was in the original demo and there's no real OCR/bank-feed available here). The
   transactions it produces are real and persist. Note: receipt scanning is described as a Pro
   feature in the marketing copy, but I did **not** hard-gate the import UI behind Pro — only
   Foresight and Insights are gated. Tell me if you want receipt-scan gated too.
4. **Investment prices — now live.** Holdings are priced from a real quotes feed
   (**Yahoo Finance** by default — keyless; `server/lib/quotes.js`). Live price + day change drive
   value, return, portfolio value and the KPIs; the detail-page price chart and key stats
   (open, day/52-week range, volume) and the portfolio-vs-S&P 500 benchmark are built from real
   market data. Everything degrades gracefully — if the feed is unreachable the app falls back to
   your entered prices and the prior seeded charts, so a hiccup never breaks the page. Set
   `FINNHUB_API_KEY` or `TWELVEDATA_API_KEY` to route through an official provider instead.
5. **Goal auto-transfer** — the auto-transfer toggle is stored and feeds projections, but there
   is **no scheduler** moving money every month. "Add funds" *does* move money immediately: it
   debits the chosen account and logs a contribution.
6. **Currency selector** — changes the displayed currency label/symbol on pricing; amounts are
   stored as entered (no FX conversion).

## How derived numbers work (so they make sense)

- **Net worth = sum of account balances + market value of holdings.** Caveat: if you create a
  brokerage *account* with a balance **and** also enter the same positions as *holdings*, they'll
  both count — track investments one way or the other to avoid double-counting.
- **Net-worth history** is derived backward from your current net worth using recorded monthly
  cash flow, so the trend line is internally consistent. With no transactions yet, it's flat at
  the current value.
- **Budget "spent", cash flow, savings rate, and insights** are computed server-side from your
  transactions for the current reporting cycle (the cycle start day is in Settings and persists).

## Verification I ran

- Backend: a 48-check integration suite (register/login, validation, every CRUD endpoint,
  per-user ownership isolation, money movement, and all computed figures) — all pass.
- Frontend: every `.jsx` is syntax-checked (TypeScript parser), and a headless React render
  harness exercises **every page and modal** in both empty and populated states with no errors.
- HTTP: page routes, static assets, and the auth gate (401 when unauthenticated) verified.
- I could **not** run it in a real browser from my environment (no browser / CDN access here),
  so a quick click-through on your machine is worth doing. React/Babel are loaded from a CDN at
  runtime (unpkg.com), so the first load needs internet; after that the API is all local.

## Housekeeping

- `data/` is auto-created. It currently contains an empty database file from my testing
  (no user accounts in it). Delete `data/claud.db*` for a pristine start if you like.
- Security posture: parameterized SQL everywhere (no injection), scrypt password hashing,
  signed JWTs, per-user authorization on every route, a path-traversal guard on static files, and
  AES-256-GCM at-rest encryption of all sensitive columns (key from `CLAUD_ENC_KEY`, held outside
  the database).
- Set fixed `CLAUD_SECRET` (signs sessions) and `CLAUD_ENC_KEY` (`openssl rand -hex 32`; encrypts
  data at rest) env vars in production — see `SETUP.md`. Otherwise the app auto-generates fallbacks
  in the app root (`.claud-secret`, `.claud-enc.key`), both outside `data/` and gitignored. The
  encryption key must stay outside `data/` and out of DB backups, or the at-rest protection is moot.

## Security posture & email-auth roadmap (recap — full detail in `EMAIL_AUTH_PLAN.md`)

**What encryption we do for user data today:** passwords are scrypt-**hashed** (one-way, not
decryptable); sessions are HMAC-SHA256 **signed** JWTs (tamper-evident, but the payload is readable
base64 — signing isn't encryption); **all sensitive user data** (account names/balances,
transactions, holdings, goals, budgets, foresight, settings) is now **encrypted at rest** with
AES-256-GCM, per value, via a wrapper around the SQLite layer (`server/lib/crypto.js` +
`server/lib/model.js`). The key (`CLAUD_ENC_KEY`) is held **outside** `data/claud.db`, so a stolen
database file or backup is unreadable without it. Deliberately left plaintext so the DB stays
queryable: ids, foreign keys, dates, flags, `plan`, and the **email** (needed to log in / send
mail). In transit the app still speaks **plain HTTP** (TLS comes from the Cloudflare tunnel in
front). Bottom line: credentials, sessions, and at-rest data are all protected; the remaining gaps
are app-level TLS and a fully compromised *running* server (which holds the key in memory). Next
hardening: keep TLS at the edge; optionally move `CLAUD_ENC_KEY` into a secrets manager.

**Email-auth plan — 4 flows** (chosen scope; full plan + endpoints/schema in `EMAIL_AUTH_PLAN.md`):
email verification on signup, password reset, passwordless magic-link login, and finishing the
Google OAuth stub. The existing email/password core (scrypt + JWT, per-user scoping) is already
real — only email *delivery* + these flows are missing. Build foundation first: an email sender
(`server/lib/mailer.js`, a transactional-email HTTP API via `fetch`, keep zero-dep), a single-use
**hashed** `auth_tokens` table, and `users` columns `email_verified` / `token_version` /
`google_sub`. Suggested order: foundation → password reset → verification → magic-link → Google
OAuth last.
