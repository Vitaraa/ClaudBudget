/* global React, ReactDOM */
// Claud — Landing + login. Built on the Claud design system vocabulary,
// warm-repointed to match the dashboard. Foresight net-worth projection as hero.

const { useState, useRef, useEffect } = React;
const DS = window.ClaudDesignSystem_de602a || {};
const Button = DS.Button || (({ variant = "primary", className = "", ...p }) =>
  <button className={`btn ${variant} ${className}`} {...p} />);

/* ----------------------------------------------------------------- helpers */
function fmtMoney(n) {
  const abs = Math.abs(n);
  let s;
  if (abs >= 1e6) s = "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  else if (abs >= 1e3) s = "$" + Math.round(n / 1e3) + "k";
  else s = "$" + n;
  return s;
}

/* Catmull-Rom → cubic bezier smoothing for a calm, finance-grade curve. */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.5;
    const c1x = p1.x + (p2.x - p0.x) / 6 * t * 2;
    const c1y = p1.y + (p2.y - p0.y) / 6 * t * 2;
    const c2x = p2.x - (p3.x - p1.x) / 6 * t * 2;
    const c2y = p2.y - (p3.y - p1.y) / 6 * t * 2;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/* ----------------------------------------------------------- Foresight chart */
const NW_DATA = [
  [2026, -22000], [2028, -6000], [2030, 16000], [2032, 46000],
  [2034, 86000], [2036, 138000], [2038, 202000], [2040, 280000],
  [2043, 416000], [2046, 568000], [2049, 728000], [2052, 902000], [2056, 1120000]
];
const PLANS = [
  { year: 2032, label: "House", kind: "house" },
  { year: 2053, label: "Retire", kind: "retirement" }
];
const PLAN_ICON = {
  house: <React.Fragment><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></React.Fragment>,
  retirement: <React.Fragment><path d="M22 12a10.06 10.06 0 0 0-20 0Z" /><path d="M12 12v8a2 2 0 0 0 4 0" /><path d="M12 2v1" /></React.Fragment>
};

function ForesightChart() {
  const W = 620, H = 286;
  const padL = 46, padR = 16, padT = 16, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const yMin = -160000, yMax = 1200000;
  const xMin = NW_DATA[0][0], xMax = NW_DATA[NW_DATA.length - 1][0];

  const xOf = (yr) => padL + ((yr - xMin) / (xMax - xMin)) * innerW;
  const yOf = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const pts = NW_DATA.map(([yr, v]) => ({ x: xOf(yr), y: yOf(v), yr, v }));
  const linePath = smoothPath(pts);
  const areaPath = linePath + ` L ${pts[pts.length - 1].x.toFixed(1)} ${yOf(0).toFixed(1)} L ${pts[0].x.toFixed(1)} ${yOf(0).toFixed(1)} Z`;

  const splitOff = (yOf(0) - padT) / innerH; // fraction where line crosses zero
  const ticks = [0, 250000, 500000, 750000, 1000000];
  const yearTicks = [2026, 2034, 2042, 2050, 2056];

  // approximate value at a plan year by linear interpolation between data points
  const valAt = (yr) => {
    for (let i = 0; i < NW_DATA.length - 1; i++) {
      const [y0, v0] = NW_DATA[i], [y1, v1] = NW_DATA[i + 1];
      if (yr >= y0 && yr <= y1) return v0 + (v1 - v0) * (yr - y0) / (y1 - y0);
    }
    return NW_DATA[NW_DATA.length - 1][1];
  };

  return (
    <svg className="lp-fchart" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label="Projected net worth rising from below zero to 1.12 million dollars by 2056">
      <defs>
        <linearGradient id="nwLine" x1="0" y1={padT} x2="0" y2={padT + innerH} gradientUnits="userSpaceOnUse">
          <stop offset={splitOff} stopColor="var(--green)" />
          <stop offset={splitOff} stopColor="var(--red)" />
        </linearGradient>
        <linearGradient id="nwFill" x1="0" y1={padT} x2="0" y2={yOf(0)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--green)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + y labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)}
                stroke="var(--border)" strokeWidth={t === 0 ? 1.4 : 1}
                strokeDasharray={t === 0 ? "none" : "2 5"} />
          <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11"
                fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(t)}</text>
        </g>
      ))}

      {/* soft area above baseline */}
      <path d={areaPath} fill="url(#nwFill)" />

      {/* the projection line */}
      <path d={linePath} fill="none" stroke="url(#nwLine)" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" />

      {/* year ticks */}
      {yearTicks.map((yr, i) => (
        <text key={i} x={xOf(yr)} y={H - 8}
              textAnchor={i === 0 ? "start" : yr === xMax ? "end" : "middle"}
              fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{yr}</text>
      ))}

      {/* plan markers */}
      {PLANS.map((p, i) => {
        const cx = xOf(p.year), cy = yOf(valAt(p.year));
        return (
          <g key={i}>
            <line x1={cx} y1={padT + 2} x2={cx} y2={cy - 15}
                  stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r="13" fill="var(--card)" stroke="var(--accent)" strokeWidth="2.2" />
            <g transform={`translate(${cx - 6.5} ${cy - 6.5}) scale(0.5417)`}
               fill="none" stroke="var(--accent)" strokeWidth="3.3"
               strokeLinecap="round" strokeLinejoin="round">
              {PLAN_ICON[p.kind]}
            </g>
            <text x={cx} y={padT - 1} textAnchor="middle" fontSize="10.5"
                  fontWeight="600" fill="var(--muted)">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ icons */
const Ico = {
  accounts: <React.Fragment><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></React.Fragment>,
  flow: <React.Fragment><path d="M3 17l5-5 4 3 8-8" /><path d="M16 7h5v5" /></React.Fragment>,
  budget: <React.Fragment><path d="M12 3v18" /><path d="M5 8h7a3 3 0 0 1 0 6H5" /></React.Fragment>,
  foresight: <React.Fragment><path d="M21 12a9 9 0 1 1-9-9" /><path d="M12 12l4-2" /><path d="M12 7v5" /></React.Fragment>
};
function FeatIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Ico[name]}</svg>
  );
}

const FEATURES = [
  { name: "accounts", h: "Every account", p: "Chequing, savings, cards and loans in one honest balance." },
  { name: "flow", h: "Cash flow", p: "See what comes in and goes out, period by period." },
  { name: "budget", h: "Budget rollover", p: "Carry each category's leftover into the next month." },
  { name: "foresight", h: "Foresight", p: "Project net worth decades out, anchored to real balances." }
];

/* -------------------------------------------------------------- brand mark */
/* B · Foresight — solid olive cloud carrying a rising projection line. */
function Mark() {
  return (
    <svg className="mark" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path d="M80 176C53 176 32 156 32 130C32 106 49 86 72 82C80 55 104 36 132 36C166 36 194 60 200 92C221 97 236 115 236 136C236 158 218 176 196 176H80Z"
            fill="var(--accent)" />
      <polyline points="94,134 120,117 139,127 170,105"
                fill="none" stroke="var(--mark-line)" strokeWidth="13"
                strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="156,105 170,105 170,121"
                fill="none" stroke="var(--mark-line)" strokeWidth="13"
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.8 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.8-3.8-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/* ------------------------------------------------------------- login panel */
function AuthPanel({ headline }) {
  const [view, setView] = useState("login"); // login | register | forgot
  const [showPw, setShowPw] = useState(false);
  const [vals, setVals] = useState({ name: "", email: "", pw: "" });
  const [errs, setErrs] = useState({});
  const [done, setDone] = useState(null);
  const [apiErr, setApiErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Surface any OAuth error handed back via the URL fragment (see boot.js).
  useEffect(() => {
    const e = window.ClaudAPI && window.ClaudAPI.consumeAuthError && window.ClaudAPI.consumeAuthError();
    if (e) setApiErr(e);
  }, []);

  const set = (k) => (e) => { setVals(v => ({ ...v, [k]: e.target.value })); setErrs(er => ({ ...er, [k]: null })); setDone(null); setApiErr(null); };
  const isReg = view === "register";
  const isForgot = view === "forgot";
  const go = (v) => { setView(v); setErrs({}); setDone(null); setApiErr(null); setBusy(false); };
  const startGoogle = () => { setApiErr(null); window.location.assign(window.ClaudAPI.googleStartUrl()); };

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (isReg && !vals.name.trim()) er.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(vals.email)) er.email = "Enter a valid email.";
    if (!isForgot && vals.pw.length < 8) er.pw = "At least 8 characters.";
    setErrs(er);
    if (Object.keys(er).length) return;

    setBusy(true); setApiErr(null);

    // Forgot password — always a generic confirmation (no account enumeration).
    if (isForgot) {
      setDone("Sending reset link…");
      window.ClaudAPI.forgot(vals.email)
        .then((res) => { setBusy(false); setDone((res && res.message) || "If that email has an account, a reset link is on its way."); })
        .catch((err) => { setBusy(false); setDone(null); setApiErr(err && err.message ? err.message : "Something went wrong. Please try again."); });
      return;
    }

    setDone(isReg ? "Creating your account…" : "Signing you in…");
    const req = isReg
      ? window.ClaudAPI.register(vals.email, vals.pw, vals.name)
      : window.ClaudAPI.login(vals.email, vals.pw);
    req.then((res) => { window.ClaudAPI.setToken(res.token); window.location.assign("/app"); })
      .catch((err) => { setBusy(false); setDone(null); setApiErr(err && err.message ? err.message : "Something went wrong. Please try again."); });
  };

  /* ---- Forgot-password view ---- */
  if (isForgot) {
    return (
      <div className="auth">
        <div className="auth-head">
          <h2>Reset your password</h2>
          <p>Enter your account email and we'll send you a link to set a new password.</p>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@email.com"
                   className={errs.email ? "invalid" : ""} value={vals.email} onChange={set("email")} />
            {errs.email && <span className="field-err">{errs.email}</span>}
          </div>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </form>

        {done && <div className="status good toast">{done}</div>}
        {apiErr && <div className="status bad toast" style={{ color: "var(--red)" }}>{apiErr}</div>}

        <div className="auth-foot">
          Remembered it?{" "}
          <button type="button" className="link" onClick={() => go("login")}>Back to sign in</button>
        </div>
      </div>
    );
  }

  /* ---- Login / register view ---- */
  return (
    <div className="auth">
      <div className="auth-head">
        <h2>{isReg ? "Create your account" : headline}</h2>
        <p>{isReg ? "Start tracking in a couple of minutes." : "Sign in to pick up where you left off."}</p>
      </div>

      <button type="button" className="gbtn" onClick={startGoogle}>
        <GoogleG /> Continue with Google
      </button>

      <div className="divider">or {isReg ? "sign up" : "sign in"} with email</div>

      <form className="form" onSubmit={submit} noValidate>
        {isReg && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" type="text" autoComplete="name" placeholder="Alex Rivera"
                   className={errs.name ? "invalid" : ""} value={vals.name} onChange={set("name")} />
            {errs.name && <span className="field-err">{errs.name}</span>}
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@email.com"
                 className={errs.email ? "invalid" : ""} value={vals.email} onChange={set("email")} />
          {errs.email && <span className="field-err">{errs.email}</span>}
        </div>

        <div className="field">
          <div className="field-row">
            <label htmlFor="pw">Password</label>
            {!isReg && <button type="button" className="link sm" onClick={() => go("forgot")}>Forgot?</button>}
          </div>
          <div className="pw-wrap">
            <input id="pw" type={showPw ? "text" : "password"} autoComplete={isReg ? "new-password" : "current-password"}
                   placeholder={isReg ? "At least 8 characters" : "••••••••"}
                   className={errs.pw ? "invalid" : ""} value={vals.pw} onChange={set("pw")} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(s => !s)}>{showPw ? "Hide" : "Show"}</button>
          </div>
          {errs.pw && <span className="field-err">{errs.pw}</span>}
        </div>

        <Button variant="primary" type="submit" disabled={busy}>{busy ? (isReg ? "Creating\u2026" : "Signing in\u2026") : (isReg ? "Create account" : "Sign in")}</Button>
      </form>

      {done && <div className="status good toast">{done}</div>}
      {apiErr && <div className="status bad toast" style={{ color: "var(--red)" }}>{apiErr}</div>}

      <div className="auth-foot">
        {isReg ? "Already have an account? " : "New to Claud? "}
        <button type="button" className="link" onClick={() => go(isReg ? "login" : "register")}>
          {isReg ? "Sign in" : "Create one"}
        </button>
      </div>

      <p className="auth-legal">
        By continuing you agree to Claud's <a href="/legal#terms">Terms</a> and <a href="/legal#privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- App */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7e7a3c",
  "dark": false,
  "surface": "linen",
  "layout": "split",
  "headline": "Welcome back"
}/*EDITMODE-END*/;

const ACCENTS = [
  { v: "#7e7a3c", label: "Olive" },
  { v: "#c05f2e", label: "Terracotta" },
  { v: "#4f9a6a", label: "Sage" },
  { v: "#8a5cc0", label: "Plum" }
];

function App() {
  const useTweaks = window.useTweaks;
  const [t, setTweak] = useTweaks ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", t.dark ? "dark" : "light");
    r.setAttribute("data-surface", t.surface);
    // accent override cascades to soft/line via color-mix in CSS
    if (t.accent) r.style.setProperty("--accent", t.accent);
    else r.style.removeProperty("--accent");
  }, [t.dark, t.surface, t.accent]);

  const TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection,
        TweakColor = window.TweakColor, TweakToggle = window.TweakToggle,
        TweakRadio = window.TweakRadio, TweakText = window.TweakText;

  return (
    <React.Fragment>
      <div className={`lp ${t.layout === "stacked" ? "stacked" : ""}`}>
        {/* LEFT — marketing */}
        <section className="lp-left">
          <div className="brandrow">
            <Mark />
            <span className="wordmark">Clau<span className="wd-accent">d</span></span>
            <span className="pill">Personal finance</span>
          </div>

          <div className="hero">
            <span className="eyebrow">Budgeting for people new to budgeting</span>
            <h1>See your whole financial future on one <span className="em">calm</span> screen.</h1>
            <p className="sub">
              Claud connects your accounts, tracks every dollar, and projects your net worth
              decades ahead — no streaks, no confetti, just honest numbers.
            </p>
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <div>
                <div className="ch-label">Projected net worth · 2056</div>
                <div className="ch-value">$1.12M</div>
              </div>
              <div className="ch-meta">
                <span className="badge accent">Foresight</span>
                <span className="ch-delta pos">+$1.14M over 30 yrs</span>
              </div>
            </div>
            <ForesightChart />
            <div className="chart-foot">
              <span className="dot" style={{ background: "var(--green)" }}></span> Above zero
              <span className="dot" style={{ background: "var(--red)", marginLeft: 6 }}></span> Below zero
              <span style={{ marginLeft: "auto" }}>Anchored to your real balances</span>
            </div>
          </div>

          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.name}>
                <div className="fi"><FeatIcon name={f.name} /></div>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
              </div>
            ))}
          </div>

          <div className="lp-left-foot">
            <span>© 2026 Claud</span>
            <a href="/legal#privacy">Privacy</a>
            <a href="/legal#terms">Terms</a>
            <a href="/legal#security">Security</a>
          </div>
        </section>

        {/* RIGHT — auth */}
        <aside className="lp-right">
          <AuthPanel headline={t.headline || "Welcome back"} />
        </aside>
      </div>

      {TweaksPanel && (
        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent} options={ACCENTS.map(a => a.v)}
                      onChange={(v) => setTweak("accent", v)} />
          <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
          <TweakRadio label="Surface" value={t.surface} options={["linen", "sand", "cream"]}
                      onChange={(v) => setTweak("surface", v)} />
          <TweakSection label="Layout" />
          <TweakRadio label="Arrangement" value={t.layout} options={["split", "stacked"]}
                      onChange={(v) => setTweak("layout", v)} />
          <TweakSection label="Copy" />
          <TweakText label="Sign-in headline" value={t.headline}
                     onChange={(v) => setTweak("headline", v)} />
        </TweaksPanel>
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
