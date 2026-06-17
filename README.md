# Claud — personal finance dashboard

A full-stack version of the Claud dashboard: the original React frontend, now backed by
a real server, database, and per-user authentication. New accounts start **empty** — you
add your own accounts, transactions, budgets, goals, investments and life-event plans, and
everything persists.

## Requirements

- **Node.js 22.5 or newer** (it uses Node's built-in SQLite). Check with `node -v`.
- That's it. **No `npm install` needed** — the server uses only Node built-ins.

## Run it

```bash
cd "this folder"
npm start            # or: node server/index.js
```

Then open **http://localhost:4317** and create an account.

(To use a different port: `PORT=8080 npm start`.)

## First run

1. The landing page (`/`) lets you **register** or **sign in**. Registration creates your
   account; you're taken straight to the dashboard.
2. The dashboard starts blank. Use the **+ Add** button on each tab (Accounts, Transactions,
   Budget, Goals, Investments) and the **+ New plan** button on Foresight to add data.
3. As you add transactions, the derived figures fill in automatically: net worth, cash flow,
   budget "spent", savings rate, and insights are all computed on the server from your data.

## What's where

```
server/                 Node backend (no external dependencies)
  index.js              HTTP server: serves the frontend + the /api routes
  routes.js             every API endpoint (auth + CRUD + computed), auth-scoped per user
  lib/db.js             SQLite schema (auto-created on first run)
  lib/auth.js           password hashing (scrypt) + JWT (HMAC-SHA256)
  lib/compute.js        derived figures: net worth, cash flow, budget spent, insights
  lib/http.js           tiny router + static file serving
public/                 the React frontend (Babel-in-browser), served by the server
  boot.js               API client + auth guard + instant theme
  store.js              hydrates server data into the app
  actions.js            create/update/delete actions that persist + refresh
  *.jsx                 the pages (wired to the API)
data/                   SQLite database + signing secret (auto-created; safe to delete to reset)
```

The original design exports (`Finance Dashboard.html`, the root-level `*.jsx`, etc.) are left
untouched at the project root for reference. The **running app is served from `public/`**.

## Accounts & plans

- Authentication is real: passwords are scrypt-hashed, sessions are JWTs (30-day), and every
  API request is scoped to the signed-in user — users can only see and change their own data.
- **Free vs Pro:** the Upgrade page / in-app modal flips your account to Pro. Pro unlocks
  **Foresight** and **Insights** (there is no real payment step — see NOTES.md).

## Reset

Stop the server and delete the `data/` folder (or just `data/claud.db*`) to wipe all accounts
and start fresh.

## API (quick reference)

All under `/api`, JSON, `Authorization: Bearer <token>` except register/login.

`POST /auth/register|login`, `GET /auth/me`, `POST /auth/plan`, `PUT /auth/profile`,
`GET /bootstrap` (everything for the signed-in user in one call),
`accounts`, `transactions` (+`/bulk`, `/import`), `rules`, `budget` (+`/groups`,`/categories`,`/cover`),
`recurring`, `goals` (+`/:id/funds`), `holdings`, `foresight` (+`/plans`,`/overrides`),
`settings`, and computed `GET /dashboard|insights|cashflow|networth`.
