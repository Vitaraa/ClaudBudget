# Taking Claud Budget public — Cloudflare Tunnel + Access

**Goal:** reach the app at `https://budget.<yourdomain>` from anywhere, gated to your
email + people you invite, **without opening any ports** on your home network.

**Your current setup:** Node app on the home server `192.168.1.254`, listening on port
`4317`, started with `npm start`. None of that changes — the tunnel just sits in front of it.

---

## Why this design (vs. the "open a port" approach)

| | Cloudflare Tunnel (this plan) | Port-forward + DNS to home IP |
|---|---|---|
| Open ports on router | **None** (outbound only) | 80/443 exposed to the internet |
| Works behind CGNAT / dynamic home IP | **Yes** | No (needs static IP or dynamic DNS) |
| Exposes your home IP address | **No** | Yes |
| TLS / HTTPS certs | **Automatic** | You manage (Let's Encrypt) |
| DDoS protection / WAF | **Included** | None by default |
| Cost | **Free** | Free, but more attack surface |

For a personal-finance app on a home box, the tunnel is the clear winner. A cloud VPS
would give better uptime, but you chose to keep the home server — the tunnel makes that
perfectly viable.

---

## Step 1 — Register the domain (Cloudflare Registrar)

1. Go to **domains.cloudflare.com**, search a name, register it.
   - At-cost pricing, e.g. `.com` ≈ **$10.46/yr** (same on renewal, $0 markup), free
     WHOIS privacy + DNSSEC included.
2. Registering it here automatically puts it on Cloudflare DNS — no nameserver changes needed.

## Step 2 — Create the Tunnel

1. Open the **Zero Trust dashboard** (`one.dash.cloudflare.com`) → **Networks → Connectors**
   (also mirrored under the main dashboard's **Networking → Tunnels**).
2. **Create a tunnel** → choose **Cloudflared** → name it e.g. `home-budget`.
3. Pick your server's OS (e.g. Debian/Ubuntu 64-bit). The dashboard shows a **copy-paste
   install command that already contains your tunnel token.** Run it on `192.168.1.254`.
   It installs `cloudflared` as a **systemd service** (auto-starts on boot) and connects
   outbound to Cloudflare. Example shape (use the exact one the dashboard gives you):

   ```bash
   # Add Cloudflare's package repo, install, then register the service with your token:
   sudo cloudflared service install <LONG_TOKEN_FROM_DASHBOARD>
   ```
4. Back in the dashboard, the tunnel should flip to **HEALTHY**.

## Step 3 — Route a hostname to the app

1. In the tunnel's **Public Hostname** tab → **Add a public hostname**:
   - **Subdomain:** `budget`
   - **Domain:** `<yourdomain>`
   - **Service type:** `HTTP`
   - **URL:** `localhost:4317`
2. Save. Cloudflare auto-creates the DNS record. `https://budget.<yourdomain>` now serves
   your app over HTTPS.

> At this point the URL is **public to anyone**. Don't stop here for a budget app — do Step 4.

## Step 4 — Put an identity gate in front (Cloudflare Access)

This is the important one: it forces a login before the app even loads. Free for up to 50 users.

1. Zero Trust dashboard → **Access → Applications → Add an application → Self-hosted**.
2. **Application domain:** `budget.<yourdomain>`.
3. Add a **policy**: Action **Allow**, Include → **Emails** → list your email + each invited
   person's email (or "Emails ending in" a domain you control).
4. Under **Settings → Authentication**, enable a login method:
   - **One-time PIN** (emails a code) works with zero extra setup, or
   - **Google** login for a seamless sign-in with your Gmail.
5. Save. Now every visitor must authenticate as an allowed email before reaching the app.

---

## Hardening / housekeeping

- **Bind the app to localhost.** Make the Node app listen on `127.0.0.1:4317` instead of
  `0.0.0.0`, so the *only* path in is the tunnel (not the LAN/WAN).
- **Outbound port 7844** must be open on your home firewall (it usually is) — that's the
  only connectivity `cloudflared` needs.
- **Keep the app running across reboots.** `npm start &` dies on reboot. Run the app under
  `pm2` or a systemd unit so it (like cloudflared) comes back automatically.
- **App-level login still matters** — Access is the outer gate; your own auth is defense in depth.

## When you want to go fully public later

- Remove or broaden the Access policy (or switch it to a sign-up flow).
- Lean on your in-app authentication, and add Cloudflare **Rate Limiting**, **WAF**, and
  **Turnstile** (free) to fend off bots/abuse.

## Cost summary

- Domain: ~$10/yr (varies by TLD).
- Tunnel + Access (≤50 users) + DNS + TLS + basic DDoS: **$0**.
