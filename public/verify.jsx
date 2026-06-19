/* global React, ReactDOM */
// Claud — email-verification landing. Reads ?token= from the emailed link and
// posts it to /api/auth/verify on load. Plain React (no design-system dep).

const { useState, useEffect } = React;

function token() {
  try { return new URLSearchParams(location.search).get("token") || ""; }
  catch (e) { return ""; }
}

const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const SpinIcon = (
  <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

function Brand() {
  return (
    <div className="brandrow">
      <svg className="mark" viewBox="0 0 256 256" fill="none" aria-hidden="true">
        <path d="M80 176C53 176 32 156 32 130C32 106 49 86 72 82C80 55 104 36 132 36C166 36 194 60 200 92C221 97 236 115 236 136C236 158 218 176 196 176H80Z" fill="var(--accent)" />
        <polyline points="94,134 120,117 139,127 170,105" fill="none" stroke="var(--mark-line, #f6f1e4)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="156,105 170,105 170,121" fill="none" stroke="var(--mark-line, #f6f1e4)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="wordmark">Clau<span className="wd-accent">d</span></span>
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="authwrap">
      <Brand />
      <div className="authcard">{children}</div>
    </div>
  );
}

function VerifyApp() {
  const tok = token();
  const [state, setState] = useState(tok ? "loading" : "notoken"); // loading | ok | error | notoken
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!tok) return;
    window.ClaudAPI.verifyEmail(tok)
      .then(() => setState("ok"))
      .catch((err) => { setMsg(err && err.message ? err.message : "This link is invalid or has expired."); setState("error"); });
  }, []);

  if (state === "loading") {
    return (
      <Card>
        <div className="state-ico wait">{SpinIcon}</div>
        <div className="auth-head center"><h1>Confirming your email…</h1><p>Just a moment.</p></div>
      </Card>
    );
  }
  if (state === "ok") {
    return (
      <Card>
        <div className="state-ico good">{CheckIcon}</div>
        <div className="auth-head center">
          <h1>Email confirmed</h1>
          <p>Thanks — your email address is verified. You're all set.</p>
        </div>
        <a className="btn" href="/app">Continue to ClaudBudget</a>
      </Card>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <div className="state-ico bad">{XIcon}</div>
        <div className="auth-head center">
          <h1>Couldn't confirm your email</h1>
          <p>{msg}</p>
        </div>
        <a className="btn" href="/app">Go to ClaudBudget</a>
        <div className="auth-foot">You can resend the confirmation email from the banner inside the app.</div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="auth-head">
        <h1>Confirmation link incomplete</h1>
        <p>This link is missing its token. Open the most recent link from your verification email.</p>
      </div>
      <a className="btn" href="/app">Go to ClaudBudget</a>
    </Card>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<VerifyApp />);
