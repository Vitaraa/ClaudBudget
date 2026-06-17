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
const INS_TONE_ICON = { pos: "trendUp", over: "trendUp", warn: "alert", neutral: "repeat" };

/* Live insights feed — read from the hydrated store. Each item is
   {tone,icon,title,meta,ts}; map an unknown/missing icon name to a
   tone-based fallback so the existing markup keeps rendering. */
function insFeedItems() {
  const d = window.ClaudData;
  const items = (d && d.insights && Array.isArray(d.insights.items)) ? d.insights.items : [];
  return items.map((n, i) => ({
    id: n.id || ("ins-" + i),
    tone: n.tone || "neutral",
    icon: n.icon || INS_TONE_ICON[n.tone] || "alert",
    title: n.title || "",
    meta: n.meta || "",
    when: n.ts || ""
  }));
}
function INS_NOTIF_NEW_COUNT() {
  return (window.ClaudData && window.ClaudData.insights && window.ClaudData.insights.newCount) || 0;
}
/* app.jsx references the bare identifier `INS_NOTIF_NEW`; keep it as a
   live-updated var so its value reflects the server's unread count. */
var INS_NOTIF_NEW = INS_NOTIF_NEW_COUNT();
window.addEventListener("claud:data", function () { INS_NOTIF_NEW = INS_NOTIF_NEW_COUNT(); });

function InsightsFeed({ onClose, onOpenReview, placement }) {
  if (window.useClaudData) window.useClaudData(); // re-render on live data change
  const ref = insRef(null);
  const items = insFeedItems();
  const newCount = INS_NOTIF_NEW_COUNT();
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
        <span className="notif-sub">{newCount > 0 ? newCount + " new this week" : "All caught up"}</span>
        <button className="notif-close" onClick={onClose} aria-label="Close insights"><Icon name="x" /></button>
      </div>
      <div className="notif-list">
        {items.length === 0 ?
          <div className="notif-empty">No insights yet. As you add accounts and transactions, Claud will surface trends and alerts here.</div> :
          items.map((n, i) =>
            <div className={"notif-item" + (i < newCount ? " unread" : "")} key={n.id}>
              <span className={"notif-ico tone-" + n.tone}><Icon name={n.icon} /></span>
              <div className="notif-body">
                <div className="notif-it-title">{n.title}</div>
                <div className="notif-it-meta">{n.meta}</div>
              </div>
              <span className="notif-when">{n.when}</span>
            </div>
          )
        }
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
/* Known-category colours; arbitrary category names fall back to a palette. */
const INS_CAT_COLOR = {
  Housing: "#c0763e", Groceries: "#7a9a52", Dining: "#cf6b3f",
  Transport: "#5a93a8", Shopping: "#b06a8c", Utilities: "#9a8048"
};
const INS_CAT_PALETTE = ["#c0763e", "#7a9a52", "#cf6b3f", "#5a93a8", "#b06a8c", "#9a8048", "#6a8caf", "#a86a6a"];
const insCatColor = (name, i) => INS_CAT_COLOR[name] || INS_CAT_PALETTE[i % INS_CAT_PALETTE.length];

/* Live completed-month review cards (newest first) from the store.
   Shape: {key,year,month,label,income,spending,saved,savingsRate,nwEnd,categories[{name,spent}]}. */
function insMonths() {
  const d = window.ClaudData;
  return (d && d.insights && Array.isArray(d.insights.months)) ? d.insights.months : [];
}
/* Net-worth change for the month at index `idx` (months are newest-first,
   so the previous month sits at idx+1). Returns null if it can't be derived. */
function insMonthNWChange(months, idx) {
  const cur = months[idx];
  if (!cur || cur.nwEnd == null) return null;
  const prev = months[idx + 1];
  if (!prev || prev.nwEnd == null) return null;
  return cur.nwEnd - prev.nwEnd;
}

/* mini sparkline of net-worth over recent months (for the hero card) */
function InsNWSpark({ months, idx }) {
  // build a little series ending at this month's nwEnd (skip months with no value)
  const series = (months || []).slice(idx, idx + 6)
    .map((mo) => mo.nwEnd).filter((v) => v != null).reverse();
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
  if (window.useClaudData) window.useClaudData(); // re-render on live data change
  const { Badge, ProgressBar } = INS;
  const months = insMonths();
  const [selRaw, setSel] = insState(0);
  insEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // No completed months yet — show a tasteful empty state in the modal shell.
  if (months.length === 0) {
    return (
      <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="rev-modal" role="dialog" aria-modal="true" aria-label="Monthly summary">
          <div className="rev-head">
            <div>
              <span className="rev-eyebrow">Monthly summary</span>
              <h2>No months to review yet</h2>
            </div>
            <button className="set-close" onClick={onClose} aria-label="Close summary">{"×"}</button>
          </div>
          <div className="rev-empty">
            <Icon name="calendar" />
            <p>Once you've completed a full month with some transactions, Claud will recap your income, spending, and savings here.</p>
          </div>
        </div>
      </div>);
  }

  const sel = Math.min(selRaw, months.length - 1);
  const mo = months[sel];
  const income = mo.income || 0;
  const spending = mo.spending || 0;
  const saved = mo.saved != null ? mo.saved : (income - spending);
  const rate = mo.savingsRate != null ? mo.savingsRate : (income > 0 ? Math.round(saved / income * 100) : 0);
  const nwChange = insMonthNWChange(months, sel);
  const cycle = insCycleLabel(mo.year, mo.month, cycleStartDay);

  // Top categories (server gives {name,spent}); bar is relative to the biggest slice.
  const cats = (mo.categories || []).slice(0, 6);
  const maxSpent = cats.reduce((m, c) => Math.max(m, c.spent), 0) || 1;

  // Derive a few "what stood out" notes from the numbers we have.
  const notes = [];
  if (cats.length) notes.push({ tone: cats[0].spent > 0 ? "over" : "neutral", text: cats[0].name + " was your biggest category at " + insMoney(cats[0].spent) + "." });
  notes.push({ tone: rate >= 20 ? "pos" : rate >= 0 ? "neutral" : "over", text: saved >= 0 ? ("You kept " + insMoney(saved) + " — a " + rate + "% savings rate.") : ("You spent " + insMoney(-saved) + " more than you earned.") });
  if (nwChange != null) notes.push({ tone: nwChange >= 0 ? "pos" : "over", text: "Net worth " + (nwChange >= 0 ? "rose " : "fell ") + insMoney(Math.abs(nwChange)) + " over the month." });

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
          <button className="set-close" onClick={onClose} aria-label="Close summary">{"×"}</button>
        </div>

        <div className="rev-main">
          {/* archive rail */}
          <nav className="rev-rail">
            <span className="rev-rail-label">Archive</span>
            {months.map((m, i) =>
              <button key={m.key} className={"rev-rail-item" + (i === sel ? " on" : "")} onClick={() => setSel(i)}>
                <span className="rrm-month">{INS_MON3[m.month]} {String(m.year).slice(2)}</span>
                <span className={"rrm-saved " + ((m.saved != null ? m.saved : m.income - m.spending) >= 0 ? "pos" : "neg")}>{insSigned(m.saved != null ? m.saved : m.income - m.spending)}</span>
              </button>
            )}
          </nav>

          {/* selected month recap */}
          <div className="rev-body">
            <div className="rev-cycle"><Icon name="calendar" /> {cycle}</div>

            {/* headline stats */}
            <div className="rev-stats">
              <Stat label="Net saved" value={insSigned(saved)} tone={saved >= 0 ? "pos" : "neg"} sub={rate + "% of income"} />
              <Stat label="Income" value={insMoney(income)} sub="across all accounts" />
              <Stat label="Spending" value={insMoney(spending)} sub={cats.length ? cats.length + (cats.length === 1 ? " category" : " categories") : "no spending"} />
              <Stat label="Net worth" value={mo.nwEnd != null ? insMoney(mo.nwEnd) : "—"} tone={nwChange == null ? undefined : nwChange >= 0 ? "pos" : "neg"} sub={nwChange != null ? insSigned(nwChange) + " in the month" : "end of month"} />
            </div>

            <div className="rev-cols">
              {/* category breakdown */}
              <section className="rev-block">
                <div className="rev-block-head">
                  <span className="rev-block-title">Top categories</span>
                  <span className="muted">spent</span>
                </div>
                {cats.length === 0 ?
                  <div className="rev-empty-sm">No spending recorded this month.</div> :
                  <div className="rev-cats">
                    {cats.map((c, ci) => {
                      const color = insCatColor(c.name, ci);
                      return (
                        <div className="rev-cat" key={c.name}>
                          <div className="rev-cat-top">
                            <span className="rev-cat-name"><span className="rev-cat-dot" style={{ background: color }} />{c.name}</span>
                            <span className="rev-cat-fig"><b>{insMoney(c.spent)}</b></span>
                          </div>
                          {ProgressBar && <ProgressBar value={c.spent} max={maxSpent} tone="accent" />}
                        </div>);
                    })}
                  </div>
                }
              </section>

              {/* what stood out — derived notes */}
              <section className="rev-block">
                <div className="rev-block-head">
                  <span className="rev-block-title">What stood out</span>
                </div>
                <div className="rev-insights">
                  {notes.map((ins, i) =>
                    <div className={"rev-insight tone-" + ins.tone} key={i}>
                      <span className="rev-insight-ico"><Icon name={INS_TONE_ICON[ins.tone]} /></span>
                      <span className="rev-insight-text">{ins.text}</span>
                    </div>
                  )}
                </div>
                <div className="rev-net-card">
                  <div>
                    <span className="rev-net-label">Net worth trend</span>
                    <span className="rev-net-val">{mo.nwEnd != null ? insMoney(mo.nwEnd) : "—"}</span>
                  </div>
                  <InsNWSpark months={months} idx={sel} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { InsightsFeed, MonthlyReviewModal, INS_NOTIF_NEW, insCycleLabel });
