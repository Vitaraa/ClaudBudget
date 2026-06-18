# Claud — Go-Live Runbook (claudapps.ca)

End-to-end steps to put the home server online behind Cloudflare: multiple apps on
subdomains of **claudapps.ca**, with **claudapp.ca** redirecting to it. No ports opened on
your router.

This builds on two files already in the repo:
- `going-public-cloudflare.md` — the *why* (tunnel vs. port-forward) and the Cloudflare
  Access identity-gate details. Read it once; this runbook is the operational version with
  the real domains, multi-app routing, and the redirect domain added.
- `deploy/claud-budget.service` — the systemd unit used in Phase 1.

## Architecture

```
                claudapp.ca  ──(301 redirect)──┐
                                               ▼
  Internet ──▶ Cloudflare edge (TLS, WAF) ──▶ claudapps.ca
                       │
                       │  one outbound tunnel (port 7844), no inbound ports
                       ▼
              cloudflared (systemd) on 192.168.1.254
                       ├─ budget.claudapps.ca  ─▶ localhost:4317   (Claud Budget)
                       ├─ app2.claudapps.ca    ─▶ localhost:PORT
                       └─ …add more anytime
```

One tunnel carries every app. Each app is a local process on its own port; you map a
subdomain to it in the Cloudflare dashboard. Adding an app later = run it + add one hostname
(Phase 7). **Subdomains, not paths** — clean isolation, no per-app URL rewriting.

---

## Phase 0 — Cloudflare zone check (5 min)

1. In the Cloudflare dashboard, confirm **both** `claudapps.ca` and `claudapp.ca` show
   status **Active** (nameservers pointed at Cloudflare). If either says "Pending," finish
   the nameserver step at your registrar first.
2. Decide the apex (`claudapps.ca` with no subdomain). Options, pick later in Phase 2:
   - Serve a landing page (you already have `Claud - Landing.html`) via **Cloudflare Pages**
     (free, no server) — cleanest.
   - Or 301 the apex to `budget.claudapps.ca` for now.
   - Or route it to the app like any other hostname.

---

## Phase 1 — Run each app as a service (survives reboots & crashes)

`npm start &` dies on reboot. Use the systemd unit already in the repo.

1. **Node version** — the app needs Node ≥ 22.5 (it uses the built-in `node:sqlite`).
   ```bash
   node -v   # must be v22.5.0 or newer
   # If missing/old (installs to /usr/bin/node, matching the service file):
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Secrets / env** — the unit reads `/etc/claud-budget.env`. Create it:
   ```bash
   sudo tee /etc/claud-budget.env >/dev/null <<EOF
   CLAUD_SECRET=$(openssl rand -base64 48)
   APP_BASE_URL=https://budget.claudapps.ca
   # Email auth (verification + password reset). Resend by default.
   EMAIL_API_KEY=
   EMAIL_FROM=Claud <noreply@claudapps.ca>
   # Google Sign-In (optional).
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   # Live investment quotes (optional).
   FINNHUB_API_KEY=
   TWELVEDATA_API_KEY=
   EOF
   sudo chmod 600 /etc/claud-budget.env
   ```
   - `CLAUD_SECRET` signs login tokens. The app otherwise auto-generates `data/.secret`;
     setting it here is the production-safe way. **Don't change it once real users exist —
     it logs everyone out.**
   - `APP_BASE_URL` is the public origin used to build the **absolute https links** in
     verification/reset emails and the Google redirect URI. Set it to your real URL
     (`https://budget.claudapps.ca`) — never leave it as localhost in production, or emailed
     links won't work.
   - **Email auth** (`EMAIL_API_KEY`, `EMAIL_FROM`): power signup verification and password
     reset. With no key set the app **degrades gracefully** — it logs the action link to the
     server console instead of sending (so you can test before wiring email). To send for
     real: create a [Resend](https://resend.com) account, verify your sending domain, paste
     the API key, set `EMAIL_FROM` to an address on that domain, then
     `sudo systemctl restart claud-budget`. (Other providers: set `EMAIL_PROVIDER`; only
     `resend` ships today.)
   - **Google Sign-In** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`): optional. The
     "Continue with Google" button stays inert (shows a friendly message) until both are set.
     In Google Cloud Console → *APIs & Services → Credentials*, create an **OAuth 2.0 Client
     ID** (type *Web application*) and add the redirect URI
     **`https://budget.claudapps.ca/api/auth/google/callback`** (must match `APP_BASE_URL`).
   - `FINNHUB_API_KEY` / `TWELVEDATA_API_KEY` power live investment quotes. Leave blank if
     you don't need quotes yet; fill in later and `sudo systemctl restart claud-budget`.

3. **Install & start the service:**
   ```bash
   # Verify the path case first — Linux is case-sensitive (unit says /home/conrad/ClaudBudget):
   ls -d /home/conrad/ClaudBudget   # fix the WorkingDirectory in the unit if this errors
   which node                       # confirm it's /usr/bin/node (nvm users: path differs — edit ExecStart)

   sudo cp deploy/claud-budget.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now claud-budget
   sudo systemctl status claud-budget        # should be active (running)
   curl -I http://localhost:4317             # should return HTTP headers
   ```
   Your deploy flow changes from `npm start &` to: `git pull && sudo systemctl restart claud-budget`.

4. *(Optional hardening)* Bind the app to loopback only. Either change `server.listen(PORT)`
   to `server.listen(PORT, '127.0.0.1')` in `server/index.js`, **or** just rely on the
   firewall in Phase 5 (the tunnel reaches the app over loopback, which the firewall allows).

---

## Phase 2 — Cloudflare Tunnel (one tunnel, many apps)

1. Open the **Zero Trust dashboard** (`one.dash.cloudflare.com`) → **Networks → Tunnels →
   Create a tunnel** → **Cloudflared** → name it `home-claudapps`.
2. Choose **Debian / 64-bit**. The dashboard shows a copy-paste command **containing your
   tunnel token**. Run it on `192.168.1.254`:
   ```bash
   sudo cloudflared service install <LONG_TOKEN_FROM_DASHBOARD>
   ```
   This installs `cloudflared` as its own systemd service (auto-starts on boot, outbound
   only). The tunnel should flip to **HEALTHY** in the dashboard.
3. **Add the app** — in the tunnel's **Public Hostname** tab → **Add a public hostname**:
   - Subdomain `budget` · Domain `claudapps.ca` · Type **HTTP** · URL `localhost:4317`
   - Save. Cloudflare auto-creates the (proxied) DNS record. Test: open
     `https://budget.claudapps.ca`.
4. *(Apex, optional)* Add the landing page now or later — Pages site on `claudapps.ca`, or a
   public hostname for the apex, per your Phase 0 choice.
5. Under `claudapps.ca` → **SSL/TLS**, set the mode to **Full**. The tunnel already encrypts
   server→Cloudflare, so the local app can stay plain HTTP on localhost.

> **Config-as-code alternative:** instead of the dashboard UI you can run a *locally-managed*
> tunnel with `/etc/cloudflared/config.yml` (ingress list) under version control. The
> dashboard approach above is recommended here — fewer footguns and adding apps is one click.

---

## Phase 3 — Redirect claudapp.ca → claudapps.ca

A redirect needs traffic to reach Cloudflare's edge, so point the domain at a dummy proxied
record, then add the rule. All in the dashboard, free tier.

1. Select the **claudapp.ca** zone → **DNS → Add record**:
   - Type `A` · Name `@` · IPv4 `192.0.2.1` · **Proxied** (orange cloud) · Save
   - Type `A` · Name `www` · IPv4 `192.0.2.1` · **Proxied** · Save
   `192.0.2.1` is an unroutable placeholder; traffic never goes there — the edge redirects
   first.
2. **Rules → Redirect Rules → Create rule** (name: `claudapp → claudapps`):
   - When incoming requests match: **All incoming requests**
   - Then → **Dynamic redirect** · Type **301** ·
     Expression: `concat("https://claudapps.ca", http.request.uri.path)` ·
     **Preserve query string: on** · Deploy.
3. Test (each should land on the matching claudapps.ca URL):
   ```bash
   curl -I https://claudapp.ca
   curl -I https://www.claudapp.ca/budget
   ```

> Simpler alternative if you prefer Page Rules (free tier includes 3): one rule,
> `*claudapp.ca/*` → **Forwarding URL (301)** → `https://claudapps.ca/$2`.

---

## Phase 4 — Who can get in

Pick based on how public you're going:

- **Private soft-launch (recommended first):** Zero Trust → **Access → Applications → Add →
  Self-hosted**, domain `budget.claudapps.ca`. Add a policy **Allow** → Include **Emails** →
  your address + any invitees. Enable **One-time PIN** or **Google** login. Now nobody
  reaches the app without an approved login — defense in front of your own auth.
- **Fully public:** skip/relax Access and rely on the app's email auth (see
  `EMAIL_AUTH_PLAN.md`), then turn on Cloudflare **WAF** (managed rules), **Rate Limiting**,
  and **Turnstile** to blunt bots. You can start private and flip to public by editing the
  Access policy.

---

## Phase 5 — Harden the box

With the tunnel, **no inbound ports are needed** — don't port-forward anything on the router.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp   # SSH from LAN only
sudo ufw enable
sudo ufw status verbose

sudo apt install -y unattended-upgrades        # auto security patches
sudo dpkg-reconfigure -plow unattended-upgrades
```

- Loopback stays open, so `cloudflared → localhost:4317` keeps working; outbound 7844/443
  for the tunnel is allowed by "allow outgoing."
- Keep SSH **off** the internet. If you need remote SSH, route it through Cloudflare
  (Access for Infrastructure / WARP), don't open a port.
- *(Optional)* `sudo apt install -y fail2ban` for SSH brute-force protection.

---

## Phase 6 — Backups (do this before real users)

All state lives in `data/` — the **SQLite DB and the signing secret** — and it's gitignored,
so it exists in exactly one place on a single SSD. Back it up off the box.

```bash
sudo apt install -y sqlite3
mkdir -p /home/conrad/backups
# Nightly hot backup at 02:00, keep 14 days:
( crontab -l 2>/dev/null; \
  echo '0 2 * * * sqlite3 /home/conrad/ClaudBudget/data/claud.db ".backup /home/conrad/backups/claud-$(date +\%F).db" && find /home/conrad/backups -name "claud-*.db" -mtime +14 -delete' \
) | crontab -
```

- Also keep a copy of `/etc/claud-budget.env` and `data/.secret` somewhere safe — without
  the secret, restored sessions/tokens won't validate.
- **Push backups offsite** (another machine, or `rclone`/`restic` to cloud). One SSD = one
  failure away from total loss.

---

## Phase 7 — Recipe: add another app later

1. Run it on a new localhost port under its own systemd unit (copy `claud-budget.service`,
   change `Description`, `WorkingDirectory`, `ExecStart`, `PORT`).
2. Tunnel → **Public Hostname → Add**: `app2` · `claudapps.ca` · HTTP · `localhost:<port>`.
3. If using Access, add an Access application + policy for `app2.claudapps.ca`.
4. Done — no DNS edits, no router changes, same tunnel.

---

## Caveats / gotchas

- **100 MB upload cap.** Cloudflare's free plan limits each request body to 100 MB (applies
  to tunneled traffic too). Fine for the budget app. If a future app needs big uploads, do
  direct-to-storage or chunked uploads rather than posting through the proxy.
- **SQLite is single-writer.** Great for personal / light multi-user use. If an app gets
  write-heavy with many concurrent users, plan a move to Postgres.
- **Path/case & node path.** `/home/conrad/ClaudBudget` capitalization and `/usr/bin/node`
  must match reality on the box (nvm installs node elsewhere) — verify in Phase 1.
- **Keep DNS records Proxied** (orange cloud) so your home IP stays hidden and WAF/redirects apply.

---

## Pre-launch checklist

- [ ] Both zones **Active** on Cloudflare
- [ ] `claud-budget` systemd service enabled, `curl localhost:4317` works
- [ ] `/etc/claud-budget.env` created, `chmod 600`, secret set
- [ ] `APP_BASE_URL` set to the public https URL; `EMAIL_API_KEY`/`EMAIL_FROM` set and a test
      reset email actually arrives (or you're knowingly running on the console fallback)
- [ ] *(if using Google)* OAuth client created, redirect URI matches `APP_BASE_URL/api/auth/google/callback`
- [ ] Tunnel **HEALTHY**, `https://budget.claudapps.ca` loads
- [ ] `claudapp.ca` + `www` redirect to `claudapps.ca` (with path preserved)
- [ ] Access policy (private) **or** WAF + rate limit + Turnstile (public) configured
- [ ] `ufw` enabled, router has **no** port-forwards
- [ ] Nightly backup cron in place + one copy offsite
- [ ] SSL/TLS mode = Full

---

## Confirm / still needed from you

- Server CPU arch — **amd64** assumed (matters only if you ever install binaries manually; ARM/Pi differs).
- Exact app directory case: `/home/conrad/ClaudBudget`?
- Launch mode: **private** (Access gate) or **public** (in-app auth + WAF)?
- Market-data API keys (Finnhub / TwelveData) if you want live quotes at launch.
- Any other apps + ports to wire up now.
