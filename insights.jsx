/* ============================================================
   Claud — Insights & Monthly review
   Loaded BEFORE app.jsx (which mounts these).
   Self-contained: ins*-prefixed identifiers, reuses the global
   Icon component + the DS bundle + the warm token CSS.

   Exposes on window:
     • InsightsFeed       — proactive notifications dropdown (header bell)
     • MonthlyReviewModal — end-of-month recap window + month archive
     • INS_NOTIF_NEW      — count of unread insights (for the bell dot)
     • insCycleLabel      — format a reporting cycle range
   ============================================================ */
const INS = window.ClaudDesignSystem_de602a || {};
const { useState: insState, useEffect: insEffect, useRef: insRef } = React;

/* ---- format helpers (own names) ---- */
const INS_MINUS = "\u2212";
const insMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? INS_MINUS : "") + "$" + s;
};
const insSigned = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : INS_MINUS + "$") + s;
};
const INS_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const INS_MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* days in a month (year, monthIdx 0-11) */
function insDIM(y, m) { return new Date(y, m + 1, 0).getDate(); }

/* A reporting cycle that may not start on the 1st.
   startDay 1  →  "May 1 – 31, 2026"
   startDay 13 →  "May 13 – Jun 12, 2026"  (the cycle LABELLED "May" begins May 13) */
function insCycleLabel(y, m, startDay) {
  if (!startDay || startDay <= 1) {
    return INS_MON3[m] + " 1 \u2013 " + insDIM(y, m) + ", " + y;
  }
  const sd = Math.min(startDay, insDIM(y, m));
  // end = day before startDay of the following month
  const em = (m + 1) % 12;
  const ey = m === 11 ? y + 1 : y;
  const endDay = Math.min(startDay, insDIM(ey, em)) - 1;
  const left = INS_MON3[m] + " " + sd;
  const right = (em === m ? "" : INS_MON3[em] + " ") + endDay + ", " + ey;
  return left + " \u2013 " + right;
}

/* ============================================================
   PROACTIVE INSIGHTS — the notifications feed (current month)
   tone: pos | over | warn | neutral
   ============================================================ */
const INS_NOTIFS = [
  { id: "n1", tone: "over", icon: "coffee", title: "Dining is 28% over budget", meta: "June \u00B7 $385 of $300 planned", when: "2d", knip: "Dining" },
  { id: "n2", tone: "warn", icon: "bag", title: "Shopping is pacing 15% above your 3-month average", meta: "June \u00B7 $421 spent so far", when: "3d", knip: "Shopping" },
  { id: "n3", tone: "pos", icon: "trendUp", title: "Net worth crossed $185,000", meta: "Up $1,481 since May", when: "4d" },
  { id: "n4", tone: "pos", icon: "piggy", title: "On track to save $2,235 this month", meta: "A 35% savings rate \u2014 your best in 4 months", when: "5d" },
  { id: "n5", tone: "neutral", icon: "repeat", title: "Spotify renewed \u2014 $11.99", meta: "Subscriptions \u00B7 charged yesterday", when: "6d" },
  { id: "n6", tone: "neutral", icon: "alert", title: "Large charge flagged: Amazon $129.30", meta: "Above your $100 review threshold", when: "1w" }
];
const INS_NOTIF_NEW = 3; // first three are unread

const INS_TONE_ICON = { pos: "trendUp", over: "trendUp", warn: "alert", neutral: "repeat" };

function InsightsFeed({ onClose, onOpenReview, placement }) {
  const ref = insRef(null);
  insEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target) && !e.target.closest(".notif-trigger")) onClose(); }
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div className={"notif-pop" + (placement ? " notif-pop--" + placement : "")} ref={ref} role="dialog" aria-label="Insights">
      <div className="notif-head">
        <span className="notif-title">Insights</span>
        <span className="notif-sub">{INS_NOTIF_NEW} new this week</span>
        <button className="notif-close" onClick={onClose} aria-label="Close insights"><Icon name="x" /></button>
      </div>
      <div className="notif-list">
        {INS_NOTIFS.map((n, i) =>
          <div className={"notif-item" + (i < INS_NOTIF_NEW ? " unread" : "")} key={n.id}>
            <span className={"notif-ico tone-" + n.tone}><Icon name={n.icon} /></span>
            <div className="notif-body">
              <div className="notif-it-title">{n.title}</div>
              <div className="notif-it-meta">{n.meta}</div>
            </div>
            <span className="notif-when">{n.when}</span>
          </div>
        )}
      </div>
      <button className="notif-foot" onClick={() => { onClose(); onOpenReview && onOpenReview(); }}>
        <Icon name="calendar" /> View monthly summary
      </button>
    </div>);
}

/* ============================================================
   MONTHLY RECAP DATA — completed months, newest first.
   Hero = the most recent completed month (May 2026).
   ============================================================ */
const INS_CAT_COLOR = {
  Housing: "#c0763e", Groceries: "#7a9a52", Dining: "#cf6b3f",
  Transport: "#5a93a8", Shopping: "#b06a8c", Utilities: "#9a8048"
};
const INS_CAT_ICON = {
  Housing: "home", Groceries: "cart", Dining: "coffee",
  Transport: "fuel", Shopping: "bag", Utilities: "bank"
};
function insCats(arr) {
  return arr.map(([name, spent, budget]) => ({ name, spent, budget, color: INS_CAT_COLOR[name], icon: INS_CAT_ICON[name] }));
}

const INS_MONTHS = [
  {
    key: "2026-05", y: 2026, m: 4, label: "May 2026",
    income: 6300, spending: 4410, nwEnd: 183900, nwChange: 2500,
    cats: insCats([["Housing",1650,1700],["Groceries",705,700],["Dining",412,300],["Transport",268,300],["Shopping",540,400],["Utilities",251,260]]),
    insights: [
      { tone: "over", text: "Dining ran 37% over plan \u2014 $412 against a $300 budget." },
      { tone: "over", text: "Shopping was the biggest overage at +$140 versus April." },
      { tone: "pos", text: "Even so, you kept $1,890 \u2014 a healthy 30% savings rate." }
    ]
  },
  {
    key: "2026-04", y: 2026, m: 3, label: "April 2026",
    income: 6420, spending: 4185, nwEnd: 181400, nwChange: -700,
    cats: insCats([["Housing",1650,1700],["Groceries",612,700],["Dining",295,300],["Transport",208,300],["Shopping",388,400],["Utilities",244,260]]),
    insights: [
      { tone: "pos", text: "Your best savings month this year \u2014 $2,235 kept (35%)." },
      { tone: "neutral", text: "Net worth dipped $700, driven by market moves, not spending." },
      { tone: "pos", text: "Every budget category finished in the green." }
    ]
  },
  {
    key: "2026-03", y: 2026, m: 2, label: "March 2026",
    income: 6200, spending: 4520, nwEnd: 182100, nwChange: 1200,
    cats: insCats([["Housing",1650,1700],["Groceries",740,700],["Dining",360,300],["Transport",312,300],["Shopping",455,400],["Utilities",258,260]]),
    insights: [
      { tone: "over", text: "Four categories slipped over budget \u2014 your highest spend in 6 months." },
      { tone: "warn", text: "Groceries climbed 21% versus February." },
      { tone: "neutral", text: "Still positive: $1,680 saved at a 27% rate." }
    ]
  },
  {
    key: "2026-02", y: 2026, m: 1, label: "February 2026",
    income: 6250, spending: 3980, nwEnd: 180900, nwChange: 2600,
    cats: insCats([["Housing",1650,1700],["Groceries",588,700],["Dining",240,300],["Transport",196,300],["Shopping",330,400],["Utilities",236,260]]),
    insights: [
      { tone: "pos", text: "Leanest spending in 6 months \u2014 just $3,980 out the door." },
      { tone: "pos", text: "Dining landed 20% below your usual." },
      { tone: "pos", text: "$2,270 saved \u2014 a 36% savings rate." }
    ]
  },
  {
    key: "2026-01", y: 2026, m: 0, label: "January 2026",
    income: 6100, spending: 4300, nwEnd: 178300, nwChange: 3700,
    cats: insCats([["Housing",1650,1700],["Groceries",668,700],["Dining",318,300],["Transport",240,300],["Shopping",470,400],["Utilities",249,260]]),
    insights: [
      { tone: "neutral", text: "Net worth jumped $3,700 to open the year." },
      { tone: "over", text: "Shopping ran $70 over after the holidays." },
      { tone: "pos", text: "$1,800 saved at a 30% rate \u2014 a solid start." }
    ]
  }
];

/* mini sparkline of net-worth over recent months (for the hero card) */
function InsNWSpark({ idx }) {
  // build a little series ending at this month's nwEnd
  const series = INS_MONTHS.slice(idx, idx + 6).map((mo) => mo.nwEnd).reverse();
  if (series.length < 2) return null;
  const W = 132, H = 38, p = 4;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = p + i / (series.length - 1) * (W - 2 * p);
    const y = p + (H - 2 * p) - (v - min) / span * (H - 2 * p);
    return [x, y];
  });
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const up = series[series.length - 1] >= series[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block" }} aria-hidden="true">
      <path d={d} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={up ? "var(--green)" : "var(--red)"} />
    </svg>);
}

function MonthlyReviewModal({ onClose, cycleStartDay = 1 }) {
  const { Badge, ProgressBar } = INS;
  const [sel, setSel] = insState(0); // index into INS_MONTHS
  insEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mo = INS_MONTHS[sel];
  const saved = mo.income - mo.spending;
  const rate = Math.round(saved / mo.income * 100);
  const overCats = mo.cats.filter((c) => c.spent > c.budget).length;
  const cycle = insCycleLabel(mo.y, mo.m, cycleStartDay);

  const Stat = ({ label, value, tone, sub }) =>
    <div className="rev-stat">
      <span className="rev-stat-label">{label}</span>
      <span className={"rev-stat-val" + (tone ? " " + tone : "")}>{value}</span>
      {sub && <span className="rev-stat-sub">{sub}</span>}
    </div>;

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rev-modal" role="dialog" aria-modal="true" aria-label="Monthly summary">
        <div className="rev-head">
          <div>
            <span className="rev-eyebrow">Monthly summary</span>
            <h2>{sel === 0 ? "Last month" : mo.label}</h2>
          </div>
          <button className="set-close" onClick={onClose} aria-label="Close summary">{"\u00D7"}</button>
        </div>

        <div className="rev-main">
          {/* archive rail */}
          <nav className="rev-rail">
            <span className="rev-rail-label">Archive</span>
            {INS_MONTHS.map((m, i) =>
              <button key={m.key} className={"rev-rail-item" + (i === sel ? " on" : "")} onClick={() => setSel(i)}>
                <span className="rrm-month">{INS_MON3[m.m]} {String(m.y).slice(2)}</span>
                <span className={"rrm-saved " + (m.income - m.spending >= 0 ? "pos" : "neg")}>{insSigned(m.income - m.spending)}</span>
              </button>
            )}
          </nav>

          {/* selected month recap */}
          <div className="rev-body">
            <div className="rev-cycle"><Icon name="calendar" /> {cycle}</div>

            {/* headline stats */}
            <div className="rev-stats">
              <Stat label="Net saved" value={insSigned(saved)} tone={saved >= 0 ? "pos" : "neg"} sub={rate + "% of income"} />
              <Stat label="Income" value={insMoney(mo.income)} sub="across all accounts" />
              <Stat label="Spending" value={insMoney(mo.spending)} sub={overCats ? overCats + " over budget" : "all within budget"} />
              <Stat label="Net worth" value={insMoney(mo.nwEnd)} tone={mo.nwChange >= 0 ? "pos" : "neg"} sub={insSigned(mo.nwChange) + " in the month"} />
            </div>

            <div className="rev-cols">
              {/* category breakdown */}
              <section className="rev-block">
                <div className="rev-block-head">
                  <span className="rev-block-title">Top categories</span>
                  <span className="muted">spent / budget</span>
                </div>
                <div className="rev-cats">
                  {mo.cats.map((c) => {
                    const over = c.spent > c.budget;
                    return (
                      <div className="rev-cat" key={c.name}>
                        <div className="rev-cat-top">
                          <span className="rev-cat-name"><span className="rev-cat-dot" style={{ background: c.color }} />{c.name}</span>
                          <span className={"rev-cat-fig" + (over ? " over" : "")}><b>{insMoney(c.spent)}</b> <span className="muted">/ {insMoney(c.budget)}</span></span>
                        </div>
                        {ProgressBar && <ProgressBar value={c.spent} max={c.budget} tone={over ? "over" : "accent"} />}
                      </div>);
                  })}
                </div>
              </section>

              {/* insights */}
              <section className="rev-block">
                <div className="rev-block-head">
                  <span className="rev-block-title">What stood out</span>
                </div>
                <div className="rev-insights">
                  {mo.insights.map((ins, i) =>
                    <div className={"rev-insight tone-" + ins.tone} key={i}>
                      <span className="rev-insight-ico"><Icon name={INS_TONE_ICON[ins.tone]} /></span>
                      <span className="rev-insight-text">{ins.text}</span>
                    </div>
                  )}
                </div>
                <div className="rev-net-card">
                  <div>
                    <span className="rev-net-label">Net worth trend</span>
                    <span className="rev-net-val">{insMoney(mo.nwEnd)}</span>
                  </div>
                  <InsNWSpark idx={sel} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { InsightsFeed, MonthlyReviewModal, INS_NOTIF_NEW, insCycleLabel });
