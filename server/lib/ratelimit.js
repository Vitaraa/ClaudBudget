'use strict';
/* ============================================================
   Claud — tiny in-memory rate limiter.
   A fixed-window counter keyed by an arbitrary string (e.g. an IP
   or an email). Enough to blunt abuse of the email-sending
   endpoints at this scale; Cloudflare Rate Limiting can sit in
   front for a second layer. Single-process only (state is a Map),
   which matches the app's single-process deployment.
   ============================================================ */

const buckets = new Map();   // key -> { count, resetAt }

/* allow(key, max, windowMs) -> true if under the limit (and counts the hit),
   false if the limit is exceeded for the current window. */
function allow(key, max = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

/* Pull a best-effort client IP from the request, trusting Cloudflare's header
   first (the app runs behind a Cloudflare Tunnel), then standard proxies. */
function clientIp(req) {
  const h = req.headers || {};
  return (
    h['cf-connecting-ip'] ||
    (h['x-forwarded-for'] ? String(h['x-forwarded-for']).split(',')[0].trim() : null) ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown'
  );
}

/* Occasional sweep so the Map can't grow unbounded over a long uptime. */
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
}, 10 * 60 * 1000).unref();

module.exports = { allow, clientIp };
