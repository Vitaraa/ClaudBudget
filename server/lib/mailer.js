'use strict';
/* ============================================================
   Claud — transactional email.
   Zero external dependencies: sends through a transactional-email
   HTTP API using Node's global fetch (same approach as quotes.js).
   Default provider is Resend; the JSON shape is trivial to swap.

   Design rules (mirrors the rest of the backend):
     • No SMTP libraries, no SDKs — one HTTPS POST.
     • Graceful dev fallback: with no EMAIL_API_KEY set, we DON'T
       fail — we log the message (and the action link) to the
       console so every flow is testable without a provider.
     • All links are absolute and built from APP_BASE_URL, so they
       point at https in production (never email an http:// link).

   Env:
     EMAIL_API_KEY   provider API key (Resend). Unset -> console fallback.
     EMAIL_FROM      e.g. "Claud <noreply@claudapps.ca>"
     EMAIL_PROVIDER  "resend" (default). Reserved for future providers.
     APP_BASE_URL    e.g. "https://budget.claudapps.ca" (no trailing slash)
   ============================================================ */

const FETCH_TIMEOUT_MS = 10000;

function provider() { return (process.env.EMAIL_PROVIDER || 'resend').toLowerCase(); }
function configured() { return !!process.env.EMAIL_API_KEY; }

const FROM = () => process.env.EMAIL_FROM || 'Claud <onboarding@resend.dev>';

/* Absolute base URL for links in emails. Falls back to localhost in dev so
   console-logged links are still clickable while developing. */
function baseUrl() {
  const raw = process.env.APP_BASE_URL || ('http://localhost:' + (process.env.PORT || 4317));
  return raw.replace(/\/+$/, '');
}

/* Build an absolute link to a frontend page, e.g. link('/reset', { token }). */
function link(pathname, params) {
  const u = new URL(baseUrl() + pathname);
  if (params) for (const k of Object.keys(params)) if (params[k] != null) u.searchParams.set(k, params[k]);
  return u.toString();
}

/* ---------------------------------------------------------------- provider */
async function sendViaResend({ to, subject, html, text }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': 'Bearer ' + process.env.EMAIL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM(), to: [to], subject, html, text })
    });
    const body = await res.text();
    if (!res.ok) throw new Error('Resend HTTP ' + res.status + ': ' + body.slice(0, 300));
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ public */
/* sendEmail({ to, subject, html, text }) -> { ok, dev? }
   Never throws for the "no provider configured" case (logs instead); does
   surface real provider errors so callers can decide how loud to be. */
async function sendEmail({ to, subject, html, text }) {
  if (!configured()) {
    // Dev fallback — surface the action link prominently so flows are testable.
    const urlMatch = String(text || html || '').match(/https?:\/\/\S+/);
    console.log('\n  ✉  [email:dev-fallback] EMAIL_API_KEY not set — not actually sending.');
    console.log('     to:      ' + to);
    console.log('     subject: ' + subject);
    if (urlMatch) console.log('     link:    ' + urlMatch[0]);
    console.log('');
    return { ok: true, dev: true };
  }
  if (provider() === 'resend') return sendViaResend({ to, subject, html, text });
  throw new Error('Unknown EMAIL_PROVIDER: ' + provider());
}

/* ---------------------------------------------------------------- templates */
const ESC = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Shared shell: a calm, warm, single-column message that renders in any client. */
function shell({ heading, intro, buttonLabel, buttonHref, footnote }) {
  const accent = '#7e7a3c';
  const html = `<!doctype html><html><body style="margin:0;background:#ece3d4;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2520;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="background:#fbf5ec;border:1px solid #ddcfb8;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px;">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">Clau<span style="color:${accent};">d</span></div>
      </td></tr>
      <tr><td style="padding:8px 32px 4px;">
        <h1 style="margin:0 0 10px;font-size:21px;font-weight:700;letter-spacing:-0.02em;">${ESC(heading)}</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#5e554c;">${intro}</p>
      </td></tr>
      <tr><td style="padding:0 32px 26px;">
        <a href="${ESC(buttonHref)}" style="display:inline-block;background:${accent};color:#fbf7ec;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${ESC(buttonLabel)}</a>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8c8074;">${footnote}</p>
        <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#8c8074;word-break:break-all;">If the button doesn't work, paste this link into your browser:<br><span style="color:${accent};">${ESC(buttonHref)}</span></p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#8c8074;">© ${new Date().getFullYear()} Claud · Personal finance</p>
  </td></tr></table>
</body></html>`;
  return html;
}

const templates = {
  verify({ name, href }) {
    const hi = name ? `Hi ${ESC(name)},` : 'Hi,';
    return {
      subject: 'Confirm your email for Claud',
      html: shell({
        heading: 'Confirm your email',
        intro: `${hi} thanks for signing up for Claud. Please confirm this is your email address to secure your account.`,
        buttonLabel: 'Confirm email',
        buttonHref: href,
        footnote: 'This link expires in 24 hours. If you didn’t create a Claud account, you can ignore this email.'
      }),
      text: `${name ? 'Hi ' + name + ',' : 'Hi,'}\n\nConfirm your email for Claud by opening this link (expires in 24 hours):\n${href}\n\nIf you didn’t create a Claud account, you can ignore this email.`
    };
  },
  reset({ name, href }) {
    const hi = name ? `Hi ${ESC(name)},` : 'Hi,';
    return {
      subject: 'Reset your Claud password',
      html: shell({
        heading: 'Reset your password',
        intro: `${hi} we received a request to reset your Claud password. Click below to choose a new one.`,
        buttonLabel: 'Reset password',
        buttonHref: href,
        footnote: 'This link expires in 1 hour and can be used once. If you didn’t request this, you can safely ignore this email — your password won’t change.'
      }),
      text: `${name ? 'Hi ' + name + ',' : 'Hi,'}\n\nReset your Claud password by opening this link (expires in 1 hour, single use):\n${href}\n\nIf you didn’t request this, ignore this email — your password won’t change.`
    };
  }
};

module.exports = { sendEmail, templates, baseUrl, link, configured, provider };
