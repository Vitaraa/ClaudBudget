/* global React, ReactDOM */
// Claud — reset-password page. Reads ?token= from the emailed link and posts a
// new password to /api/auth/reset. Plain React (no design-system dependency).

const { useState } = React;

function token() {
  try { return new URLSearchParams(location.search).get("token") || ""; }
  catch (e) { return ""; }
}

const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
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
      <span className="wordmark">Budge<span className="wd-accent">t</span></span>
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

function ResetApp() {
  const tok = token();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [apiErr, setApiErr] = useState(null);
  const [done, setDone] = useState(false);

  if (!tok) {
    return (
      <Card>
        <div className="auth-head">
          <h1>Reset link incomplete</h1>
          <p>This password-reset link is missing its token. Open the most recent link from your email, or request a new one from the sign-in page.</p>
        </div>
        <a className="btn" href="/login">Back to sign in</a>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <div className="state-ico good">{CheckIcon}</div>
        <div className="auth-head center">
          <h1>Password updated</h1>
          <p>Your password has been reset and any other active sessions were signed out. Sign in with your new password.</p>
        </div>
        <a className="btn" href="/login">Sign in</a>
      </Card>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (pw.length < 8) er.pw = "At least 8 characters.";
    if (pw2 !== pw) er.pw2 = "Passwords don't match.";
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setApiErr(null);
    window.ClaudAPI.reset(tok, pw)
      .then(() => { setBusy(false); setDone(true); })
      .catch((err) => { setBusy(false); setApiErr(err && err.message ? err.message : "Something went wrong. Please try again."); });
  };

  const clearErr = () => { setErrs({}); setApiErr(null); };

  return (
    <Card>
      <div className="auth-head">
        <h1>Set a new password</h1>
        <p>Choose a new password for your ClaudBudget account.</p>
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="pw">New password</label>
          <div className="pw-wrap">
            <input id="pw" type={showPw ? "text" : "password"} autoComplete="new-password"
                   placeholder="At least 8 characters" className={errs.pw ? "invalid" : ""}
                   value={pw} onChange={(e) => { setPw(e.target.value); clearErr(); }} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(s => !s)}>{showPw ? "Hide" : "Show"}</button>
          </div>
          {errs.pw && <span className="field-err">{errs.pw}</span>}
        </div>
        <div className="field">
          <label htmlFor="pw2">Confirm password</label>
          <input id="pw2" type={showPw ? "text" : "password"} autoComplete="new-password"
                 placeholder="Re-enter your new password" className={errs.pw2 ? "invalid" : ""}
                 value={pw2} onChange={(e) => { setPw2(e.target.value); clearErr(); }} />
          {errs.pw2 && <span className="field-err">{errs.pw2}</span>}
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Reset password"}</button>
      </form>
      {apiErr && <div className="status bad toast">{apiErr}</div>}
      <div className="auth-foot"><a className="link" href="/login">Back to sign in</a></div>
    </Card>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ResetApp />);
