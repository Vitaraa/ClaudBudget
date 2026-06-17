/* global React, ReactDOM */
// Claud — Upgrade to Pro. Two layout directions for the in-app upgrade modal,
// laid side-by-side on a design canvas over the live dashboard.
// Free = everything in the app today. Pro = receipt scanning, Foresight, insights.

const { useEffect } = React;
const DS = window.ClaudDesignSystem_de602a || {};
const Button = DS.Button || (({ variant = "primary", size, className = "", ...p }) =>
  <button className={`btn ${variant} ${size || ""} ${className}`} {...p} />);

/* --------------------------------------------------------------- icons */
function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* --------------------------------------------------------------- data */
// Everything already in the app — included free.
const FREE_FEATURES = [
  { t: "All your accounts", d: "Chequing, savings, cards and loans in one balance." },
  { t: "Unlimited transactions", d: "Search, categorise and import statements by hand." },
  { t: "Cash flow & budgets", d: "Sankey view, budgets with rollover." },
  { t: "Investments & net worth", d: "Holdings, allocation and full history." },
  { t: "Dark & light themes", d: "On every device, no account limits." }
];

// The reasoning features — Pro only. Described by what they do (never labelled "AI").
const PRO_FEATURES = [
  { t: "Receipt scanning", d: "Photograph a receipt; the payee, date and amount fill themselves in." },
  { t: "Foresight", d: "Project your net worth decades ahead, anchored to your real balances." },
  { t: "Insights", d: "A quiet note when your spending or saving meaningfully shifts." }
];

/* --------------------------------------------------------------- pricing */
function pricing(monthly) {
  const m = Math.max(1, Math.round(monthly));
  const annualTotal = m * 9;            // ~25% off — 12 months for the price of 9
  const annualPerMo = annualTotal / 12; // shown as the headline /mo on annual
  const save = m * 12 - annualTotal;
  return { m, annualTotal, annualPerMo, save };
}

/* --------------------------------------------------------------- billing toggle */
function BillingToggle({ billing, setBilling, save }) {
  return (
    <div className="up-billing">
      <div className="up-seg" role="tablist" aria-label="Billing period">
        <button className={billing === "monthly" ? "on" : ""} onClick={() => setBilling("monthly")}>Monthly</button>
        <button className={billing === "annual" ? "on" : ""} onClick={() => setBilling("annual")}>Annual</button>
      </div>
      {billing === "annual" && <span className="up-save">Save ${save} a year</span>}
    </div>
  );
}

/* =============================================================== VARIANT A — cards */
function CardsModal({ t, setTweak }) {
  const p = pricing(t.price);
  const billing = t.billing;
  const proAmt = billing === "annual" ? p.annualPerMo : p.m;
  const proSub = billing === "annual"
    ? `$${p.annualTotal} billed yearly`
    : "billed monthly";

  return (
    <div className="up cards" role="dialog" aria-label="Choose your plan">
      <div className="up-head">
        <div className="up-head-text">
          <h2>Choose your plan</h2>
          <p>Free keeps everything you track today. Pro adds receipt scanning, Foresight and insights.</p>
        </div>
        <button className="up-close" aria-label="Close" onClick={() => window.location.assign("/app")}>×</button>
      </div>

      <BillingToggle billing={billing} setBilling={(v) => setTweak("billing", v)} save={p.save} />

      <div className="up-cards-grid">
        {/* FREE */}
        <div className="plan free">
          <div>
            <div className="plan-eyebrow">Free</div>
            <div className="plan-price" style={{ marginTop: 10 }}>
              <span className="pp-amt">$0</span>
            </div>
            <div className="plan-sub">free forever</div>
          </div>
          <p className="plan-line">The essentials, tracked honestly.</p>
          <Button variant="ghost" disabled>Your current plan</Button>
          <ul className="plan-feats">
            {FREE_FEATURES.map((f) => (
              <li className="feat" key={f.t}>
                <span className="feat-check"><Check /></span>
                <div className="feat-body"><div className="feat-t">{f.t}</div></div>
              </li>
            ))}
          </ul>
        </div>

        {/* PRO */}
        <div className="plan pro">
          {t.recommend && <span className="plan-rec">Recommended</span>}
          <div>
            <div className="plan-eyebrow">Pro</div>
            <div className="plan-price" style={{ marginTop: 10 }}>
              <span className="pp-amt">${proAmt}</span>
              <span className="pp-per">/ month</span>
            </div>
            <div className="plan-sub">{proSub}</div>
          </div>
          <p className="plan-line">Everything in Free, plus the features that do the reading for you.</p>
          <Button variant="primary" onClick={() => { window.ClaudAPI.setPlan("pro").then(() => window.location.assign("/app")).catch((e) => alert(e.message)); }}>Upgrade to Pro</Button>
          <ul className="plan-feats">
            <li className="feat">
              <span className="feat-check"><Check /></span>
              <div className="feat-body"><div className="feat-t feat-more">Everything in Free</div></div>
            </li>
            {PRO_FEATURES.map((f) => (
              <li className="feat key" key={f.t}>
                <span className="feat-check"><Check /></span>
                <div className="feat-body">
                  <div className="feat-t">{f.t}</div>
                  <div className="feat-d">{f.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="up-foot-note">Switch or cancel anytime · prices in USD</div>
    </div>
  );
}

/* --------------------------------------------------------------- scene */
function Scene({ dark, children }) {
  return (
    <div className="scene">
      <img className="scene-bg" alt=""
           src={dark ? "screenshots/backdrop-dark.png" : "screenshots/backdrop-light.png"} />
      <div className="scene-scrim"></div>
      <div className="scene-modal-wrap">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- app */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7e7a3c",
  "dark": false,
  "surface": "linen",
  "price": 8,
  "billing": "annual",
  "recommend": true
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
    if (t.accent) r.style.setProperty("--accent", t.accent);
    else r.style.removeProperty("--accent");
  }, [t.dark, t.surface, t.accent]);

  const TweaksPanel = window.TweaksPanel, TweakSection = window.TweakSection,
        TweakColor = window.TweakColor, TweakToggle = window.TweakToggle,
        TweakRadio = window.TweakRadio, TweakNumber = window.TweakNumber;

  return (
    <React.Fragment>
      <Scene dark={t.dark}><CardsModal t={t} setTweak={setTweak} /></Scene>

      {TweaksPanel && (
        <TweaksPanel>
          <TweakSection label="Pricing" />
          <TweakNumber label="Pro price / mo" value={t.price} min={3} max={30} step={1}
                       onChange={(v) => setTweak("price", v)} />
          <TweakRadio label="Billing" value={t.billing} options={["monthly", "annual"]}
                      onChange={(v) => setTweak("billing", v)} />
          <TweakToggle label="‘Recommended’ on Pro" value={t.recommend}
                       onChange={(v) => setTweak("recommend", v)} />
          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent} options={ACCENTS.map(a => a.v)}
                      onChange={(v) => setTweak("accent", v)} />
          <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
          <TweakRadio label="Surface" value={t.surface} options={["linen", "sand", "cream"]}
                      onChange={(v) => setTweak("surface", v)} />
        </TweaksPanel>
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
