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
4. **Investment prices** — holdings' **value, cost basis, return, and contribution to net worth
   are real** (computed from the shares/price/cost you enter). The intraday "live quote" numbers
   and the portfolio-vs-S&P 500 benchmark line on the detail page are **deterministic
   simulations** (no market-data feed). A real build would plug in a quotes API.
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
  signed JWTs, per-user authorization on every route, and a path-traversal guard on static files.
- Set a fixed `CLAUD_SECRET` env var in production to keep sessions valid across restarts on
  multiple machines (otherwise a random secret is generated and saved to `data/.secret`).
