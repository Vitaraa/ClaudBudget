/* ============================================================
   Claud — Next batch of features
   Loaded AFTER pages.jsx, BEFORE app.jsx (which mounts these).
   Self-contained: ft*-prefixed identifiers, reuses the global
   Icon component, the DS bundle, and the warm token CSS.

   Exposes on window:
     • CoverOverspendModal  — pull budget from surplus categories (Budget)
     • RecurringSection     — bills & subscriptions view (inside Transactions)
     • GoalsPage            — full savings-goals surface
     • useFeatGoals         — shared goals store hook (also feeds the dashboard widget)
   ============================================================ */
const FT = window.ClaudDesignSystem_de602a || {};
const { useState: ftState, useEffect: ftEffect } = React;

/* ---- format helpers (own names) ---- */
const FT_MINUS = "\u2212";
const ftMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? FT_MINUS : "") + "$" + s;
};
const ftSigned = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : FT_MINUS + "$") + s;
};

/* ---- date model: "today", stripped to local midnight. Drives every
   "you'll be charged …" label, the calendar month, and goal projections. ---- */
const FT_REF = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
const FT_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FT_WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FT_MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FT_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ftDayMs = 86400000;
const ftStrip = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* next occurrence of a recurring item on/after the reference date */
function ftNextDate(item, ref) {
  const base = ftStrip(ref);
  if (item.cadence === "annual") {
    let d = new Date(base.getFullYear(), item.month, item.dom);
    if (d < base) d = new Date(base.getFullYear() + 1, item.month, item.dom);
    return d;
  }
  // monthly
  let d = new Date(base.getFullYear(), base.getMonth(), item.dom);
  if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, item.dom);
  return d;
}
function ftDayLabel(date, ref) {
  const diff = Math.round((ftStrip(date) - ftStrip(ref)) / ftDayMs);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return FT_WD[date.getDay()];
  return FT_MON3[date.getMonth()] + " " + date.getDate();
}
const ftMonthlyCost = (it) => it.cadence === "annual" ? it.amount / 12 : it.amount;

/* ---- live recurring helpers (server shape: {cadence, next_date, account_id}) ---- */
const ftParseISO = (iso) => { const d = new Date(String(iso || "") + "T00:00:00"); return isNaN(d) ? null : d; };
/* yearly multiplier per cadence: how many charges land in a year */
const FT_CAD_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, yearly: 1, annual: 1 };
const ftPerYear = (it) => (Number(it.amount) || 0) * (FT_CAD_PER_YEAR[it.cadence] != null ? FT_CAD_PER_YEAR[it.cadence] : 12);
const ftPerMonth = (it) => ftPerYear(it) / 12;
const ftCadLabel = (c) => ({ weekly: "weekly", biweekly: "biweekly", monthly: "monthly", quarterly: "quarterly", yearly: "yearly", annual: "yearly" }[c] || "monthly");
/* advance a date by one cadence step, in place (mirrors server maybeAdvanceRecurring) */
const FT_CAD_STEP = {
  weekly:    (d) => d.setDate(d.getDate() + 7),
  biweekly:  (d) => d.setDate(d.getDate() + 14),
  fortnightly: (d) => d.setDate(d.getDate() + 14),
  quarterly: (d) => d.setMonth(d.getMonth() + 3),
  yearly:    (d) => d.setFullYear(d.getFullYear() + 1),
  annual:    (d) => d.setFullYear(d.getFullYear() + 1),
  monthly:   (d) => d.setMonth(d.getMonth() + 1),
};
/* next charge date for a live item: start from its stored next_date (fall back to
   today), then roll forward by cadence until it lands on/after today. A schedule
   whose due date has already passed (no matching charge imported yet) otherwise
   shows a stale PAST date and mislabels it as "today". */
const ftLiveNext = (it) => {
  const ref = ftStrip(FT_REF);
  const parsed = ftParseISO(it.next_date);
  if (!parsed) return ref;
  let d = ftStrip(parsed);
  if (d >= ref) return d;
  const step = FT_CAD_STEP[String(it.cadence || "monthly").toLowerCase()] || FT_CAD_STEP.monthly;
  for (let guard = 0; d < ref && guard < 600; guard++) step(d);
  return ftStrip(d);
};

const FT_ACCOUNTS = ["Everyday Checking", "Emergency Savings", "Joint Checking", "Brokerage", "Roth IRA"];

/* ============================================================
   RECURRING & BILLS — data now comes from ClaudData.recurring
   (blank slate for new users). FT_CAT_COLOR tints the category chips.
   ============================================================ */
const FT_CAT_COLOR = {
  Housing: "#c0763e", Utilities: "#9a8048", Subscriptions: "#8a6fae",
  "Health & fitness": "#4f9a6a", Shopping: "#b06a8c", Transport: "#5a93a8", Dining: "#cf6b3f"
};

/* Budget group colors (mirror of pages.jsx BUDGET_GROUP_COLOR).
   A recurring item's color now tracks the BUDGET GROUP its category lives in,
   so e.g. a house icon reads orange under Essentials but pink under Lifestyle. */
const FT_BUDGET_GROUP_COLOR = { Essentials: "#c0763e", Lifestyle: "#b06a8c", "Health & other": "#4f9a6a", "Savings goals": "#3f8f7a" };
/* static category->group fallback (mirrors pages.jsx BUDGET_GROUPS) for first paint,
   before the live budget store has been populated by visiting the Budget tab */
const FT_CAT_GROUP = {
  Housing: "Essentials", Groceries: "Essentials", Utilities: "Essentials", Transport: "Essentials", Insurance: "Essentials",
  Dining: "Lifestyle", Shopping: "Lifestyle", Entertainment: "Lifestyle", Subscriptions: "Lifestyle",
  "Health & fitness": "Health & other", Misc: "Health & other",
  "Emergency fund": "Savings goals", "Japan trip": "Savings goals", "New laptop": "Savings goals"
};
function ftCatGroupColor(cat) {
  const store = window.__claudBudgetStore;
  const groups = store && store.get && store.get();
  if (groups) {
    for (const g of groups) {
      if (g.cats && g.cats.some((c) => c.name === cat))
        return FT_BUDGET_GROUP_COLOR[g.label] || (g.cats[0] && g.cats[0].color) || "var(--accent)";
    }
  }
  if (FT_CAT_GROUP[cat]) return FT_BUDGET_GROUP_COLOR[FT_CAT_GROUP[cat]];
  return FT_CAT_COLOR[cat] || "var(--accent)";
}

/* per-item icon overrides so a click-to-change icon survives re-renders */
const FT_REC_ICON_STORE = window.__claudRecIconStore || (window.__claudRecIconStore = (() => {
  let ov = {}; const subs = new Set();
  const emit = () => subs.forEach((fn) => { try { fn(ov); } catch (e) {} });
  return {
    get: () => ov,
    set: (id, icon) => { ov = { ...ov, [id]: icon }; emit(); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
})());
function ftUseRecIcons() {
  const [, bump] = ftState(0);
  ftEffect(() => FT_REC_ICON_STORE.subscribe(() => bump((n) => n + 1)), []);
  return FT_REC_ICON_STORE.get();
}

/* ============================================================
   RECURRING SECTION  (mounted inside the Transactions page)
   view: "timeline" | "calendar"
   ============================================================ */
function RecurringSection({ view = "timeline", onImport }) {
  const { Card, Button, Segmented } = FT;
  const data = window.useClaudData();
  const [pane, setPane] = ftState("Upcoming");
  const [recModal, setRecModal] = ftState(null); // { mode:"add"|"edit", item? }

  // live recurring items from the server snapshot, with a derived next-charge date
  const items = (data.recurring || []);
  const enriched = items.map((it) => ({ ...it, next: ftLiveNext(it) }))
    .sort((a, b) => a.next - b.next);

  // open the add modal on the shared event (in case a + action is wired to it)
  ftEffect(() => {
    const open = () => setRecModal({ mode: "add" });
    window.addEventListener("claud:add-recurring", open);
    return () => window.removeEventListener("claud:add-recurring", open);
  }, []);

  const monthlyTotal = items.reduce((s, it) => s + ftPerMonth(it), 0);
  const annualTotal = items.reduce((s, it) => s + ftPerYear(it), 0);
  const next = enriched[0];
  const nextDiff = next ? Math.round((ftStrip(next.next) - ftStrip(FT_REF)) / ftDayMs) : 0;
  const subs = items.filter((x) => x.category === "Subscriptions");

  // upcoming in the next 35 days, grouped by date
  const horizon = ftStrip(new Date(FT_REF.getFullYear(), FT_REF.getMonth(), FT_REF.getDate() + 35));
  const upcoming = enriched.filter((it) => it.next <= horizon);
  const groups = [];
  upcoming.forEach((it) => {
    const key = it.next.toISOString().slice(0, 10);
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, date: it.next, items: [] }; groups.push(g); }
    g.items.push(it);
  });

  const leadWhen = next ? (nextDiff <= 0 ? "today" : nextDiff === 1 ? "tomorrow" : "on " + FT_WD[next.next.getDay()]) : "";

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Recurring · per month</span>
          <span className="kpi-val neg">{ftMoney(monthlyTotal, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{items.length} active</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Projected · per year</span>
          <span className="kpi-val">{ftMoney(annualTotal)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>across all plans</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Next charge</span>
          <span className="kpi-val">{next ? ftMoney(next.amount, 2) : ftMoney(0, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{next ? next.name + " \u00B7 " + ftDayLabel(next.next, FT_REF) : "nothing scheduled"}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Subscriptions</span>
          <span className="kpi-val">{subs.length}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{ftMoney(subs.reduce((s, x) => s + ftPerMonth(x), 0), 2)}/mo</span>
        </div></Card>
      </div>

      {/* one widget at a time — toggle between the upcoming schedule and the full roster */}
      <div className="rec-panenav">
        {Segmented && <Segmented options={["Upcoming", "All recurring"]} value={pane} onChange={setPane} />}
      </div>

      {pane === "Upcoming" ?
      /* Lead line + upcoming */
      <Card widget>
        <div className="widget-head">
          <span className="widget-title">Upcoming charges</span>
          <span className="muted">monthly view</span>
        </div>
        {items.length === 0
          ? <div className="rule-empty">
              <span className="re-ico"><Icon name="repeat" /></span>
              <b>No recurring charges yet</b><br />
              Add a bill or subscription to see it on your timeline and monthly calendar.
              <div style={{ marginTop: 14 }}>
                {Button && <Button variant="primary" size="sm" onClick={() => setRecModal({ mode: "add" })}><span className="btn-ico"><Icon name="plus" /></span>Add recurring</Button>}
              </div>
            </div>
          : <React.Fragment>
              {next &&
                <p className="rec-lead">
                  <span className="rec-lead-ico"><Icon name="clock" /></span>
                  You'll be charged <b>{ftMoney(next.amount, 2)}</b> by <b>{next.name}</b> {leadWhen}.
                </p>}
              <RecCalendar items={enriched} />
            </React.Fragment>}
      </Card>
      :
      /* Full roster */
      <Card widget>
        <div className="widget-head">
          <span className="widget-title">All recurring</span>
          <div className="right" style={{ display: "flex", gap: 8 }}>
            {Button && <Button variant="ghost" size="sm" onClick={() => onImport && onImport("Statement")}><span className="btn-ico"><Icon name="upload" /></span>Detect from statement</Button>}
            {Button && <Button variant="primary" size="sm" onClick={() => setRecModal({ mode: "add" })}><span className="btn-ico"><Icon name="plus" /></span>Add recurring</Button>}
          </div>
        </div>
        {items.length === 0
          ? <div className="rule-empty">
              <span className="re-ico"><Icon name="repeat" /></span>
              <b>No recurring charges yet</b><br />
              Track rent, utilities and subscriptions so Claud can project them each month.
              <div style={{ marginTop: 14 }}>
                {Button && <Button variant="primary" size="sm" onClick={() => setRecModal({ mode: "add" })}><span className="btn-ico"><Icon name="plus" /></span>Add recurring</Button>}
              </div>
            </div>
          : <React.Fragment>
        <div className="rec-roster">
          {enriched.slice().sort((a, b) => ftPerMonth(b) - ftPerMonth(a)).map((it) => {
            const color = "var(--accent)";
            const catColor = FT_CAT_COLOR[it.category] || "var(--accent)";
            const Picker = window.IconPicker;
            const annual = it.cadence === "annual" || it.cadence === "yearly";
            return (
              <div className="rec-row" key={it.id}>
                {Picker
                  ? <Picker className="rec-ico" color={color} value={it.icon} onPick={(n) => ClaudActions.updateRecurring(it.id, { icon: n })} />
                  : <span className="rec-ico" style={{ color }}><Icon name={it.icon} /></span>}
                <div className="rec-main">
                  <span className="rec-name">{it.name}</span>
                  <span className="rec-sub">
                    {it.category && <span className="rec-chip" style={{ background: catColor + "22", color: catColor }}>{it.category}</span>}
                    {ftAcctName(it.account_id)}{ftAcctName(it.account_id) ? " \u00B7 " : ""}next {ftDayLabel(it.next, FT_REF)}
                  </span>
                </div>
                <span className="rec-cad">{ftCadLabel(it.cadence)}</span>
                <span className="rec-amt">
                  <b>{ftMoney(it.amount, 2)}</b>
                  {annual && <span className="rec-permo">{ftMoney(ftPerMonth(it), 2)}/mo</span>}
                </span>
                <button className="rec-cancel" title={"Manage " + it.name} aria-label={"Manage " + it.name} onClick={() => setRecModal({ mode: "edit", item: it })}><Icon name="settings" /></button>
              </div>);
          })}
        </div>
        <p className="rec-foot muted">Tip: detected charges are anchored to your real transactions — cancel one and Claud stops projecting it.</p>
            </React.Fragment>}
      </Card>
      }

      {recModal && <RecurringModal modal={recModal} onClose={() => setRecModal(null)} />}
    </React.Fragment>);
}

/* ---- timeline list ---- */
function RecTimeline({ groups }) {
  return (
    <div className="rec-timeline">
      {groups.map((g) => {
        const tot = g.items.reduce((s, x) => s + x.amount, 0);
        return (
          <div className="rec-tl-group" key={g.key}>
            <div className="rec-tl-date">
              <span className="rec-tl-day">{ftDayLabel(g.date, FT_REF)}</span>
              <span className="rec-tl-sub">{FT_WD3[g.date.getDay()]} {FT_MON3[g.date.getMonth()]} {g.date.getDate()}</span>
              <span className="rec-tl-tot">{ftMoney(tot, 2)}</span>
            </div>
            <div className="rec-tl-items">
              {g.items.map((it) => {
                const color = "var(--accent)";
                const Picker = window.IconPicker;
                return (
                  <div className="rec-tl-item" key={it.id}>
                    {Picker
                      ? <Picker className="rec-ico sm" color={color} value={it.icon} onPick={(n) => ClaudActions.updateRecurring(it.id, { icon: n })} />
                      : <span className="rec-ico sm" style={{ color }}><Icon name={it.icon} /></span>}
                    <span className="rec-tl-name">{it.name}</span>
                    <span className="rec-tl-amt">{ftMoney(it.amount, 2)}</span>
                  </div>);
              })}
            </div>
          </div>);
      })}
    </div>);
}

/* ============================================================
   MONTH CALENDAR  (navigable; projects each recurring schedule)
   A charge's schedule PHASE comes from its live next_date — the day-of-month
   for monthly/quarterly/annual, the exact weekday cycle for weekly/biweekly —
   which the server only ever rolls FORWARD. Its earliest visible date is
   floored at the rule's start (created_at), so a bill begun in (say) April
   never paints onto Jan–Mar; it only projects forward from when it began.
   ============================================================ */
const ftDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const ftClampDom = (y, m, dom) => new Date(y, m, Math.min(dom, ftDaysInMonth(y, m)));

/* the floor date before which a rule must never be drawn (its start) */
function ftRecFloor(it) {
  const raw = it.start_date || it.created_at || it.next_date;
  const d = raw ? new Date(String(raw).slice(0, 10) + "T00:00:00") : null;
  return (d && !isNaN(d)) ? ftStrip(d) : ftStrip(FT_REF);
}

/* every date a rule lands on within [year, month], on/after its floor */
function ftRecOccurrencesInMonth(it, year, month) {
  const cad = String(it.cadence || "monthly").toLowerCase();
  const origin = ftParseISO(it.next_date) || ftStrip(FT_REF);
  const floor = ftRecFloor(it);
  const mStart = new Date(year, month, 1);
  const mEnd = new Date(year, month, ftDaysInMonth(year, month));
  const out = [];
  const keep = (d) => { if (d >= mStart && d <= mEnd && d >= floor) out.push(ftStrip(d)); };

  if (cad === "weekly" || cad === "biweekly" || cad === "bi-weekly" || cad === "fortnightly") {
    const stepDays = cad === "weekly" ? 7 : 14;
    // jump in-phase from the origin to the first candidate on/just before the
    // month start, then walk forward one step at a time across the month.
    let d = ftStrip(new Date(origin));
    const k = Math.floor((mStart - d) / ftDayMs / stepDays);
    d = ftStrip(new Date(d.getFullYear(), d.getMonth(), d.getDate() + k * stepDays));
    for (let g = 0; g < 200 && d <= mEnd; g++) {
      keep(d);
      d = ftStrip(new Date(d.getFullYear(), d.getMonth(), d.getDate() + stepDays));
    }
  } else if (cad === "quarterly") {
    const diff = (year * 12 + month) - (origin.getFullYear() * 12 + origin.getMonth());
    if ((((diff % 3) + 3) % 3) === 0) keep(ftClampDom(year, month, origin.getDate()));
  } else if (cad === "annual" || cad === "annually" || cad === "yearly") {
    if (month === origin.getMonth()) keep(ftClampDom(year, month, origin.getDate()));
  } else { // monthly (default)
    keep(ftClampDom(year, month, origin.getDate()));
  }
  return out;
}

/* Calendar + day-popup styles are injected once from here so the markup and its
   CSS travel together (the design-system stylesheet stays untouched). */
function ftEnsureCalCSS() {
  if (typeof document === "undefined" || document.getElementById("ftcal-css")) return;
  const el = document.createElement("style");
  el.id = "ftcal-css";
  el.textContent = `
  .ftcal { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--card); }
  .ftcal-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
  .ftcal-nav { display: flex; align-items: center; gap: 8px; }
  .ftcal-navbtn { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border);
    background: var(--input-bg); color: var(--text); border-radius: 10px; cursor: pointer; transition: background var(--dur-fast, .15s), color var(--dur-fast, .15s); }
  .ftcal-navbtn:hover { background: var(--accent-soft); color: var(--accent); }
  .ftcal-navbtn svg { width: 16px; height: 16px; }
  .ftcal-navbtn.prev svg { transform: rotate(180deg); }
  .ftcal-title { min-width: 132px; text-align: center; font-size: var(--text-body, 15px); font-weight: 700; letter-spacing: .01em; }
  .ftcal-today { margin-left: 4px; border: 1px solid var(--border); background: none; color: var(--accent); font-family: inherit;
    font-size: var(--text-xs); font-weight: 600; padding: 6px 11px; border-radius: 999px; cursor: pointer; transition: background var(--dur-fast, .15s); }
  .ftcal-today:hover { background: var(--accent-soft); }
  .ftcal-sum { display: flex; align-items: baseline; gap: 8px; font-size: var(--text-sm); color: var(--muted); }
  .ftcal-sum b { color: var(--red); font-weight: 700; font-size: var(--text-body, 15px); font-variant-numeric: tabular-nums; }
  .ftcal-head { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--input-bg); border-top: 1px solid var(--border); }
  .ftcal-head span { padding: 9px 0; text-align: center; font-size: var(--text-2xs); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .ftcal-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
  .ftcal-cell { position: relative; min-height: 96px; padding: 8px 9px; border-top: 1px solid var(--border); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 6px; }
  .ftcal-cell:nth-child(7n+1) { border-left: none; }
  .ftcal-cell.out { background: color-mix(in srgb, var(--input-bg) 35%, transparent); }
  .ftcal-cell.past { opacity: .5; }
  .ftcal-cell.today { background: var(--accent-soft); }
  .ftcal-cell.has { cursor: pointer; transition: background var(--dur-fast, .15s); }
  .ftcal-cell.has:hover { background: var(--accent-soft); }
  .ftcal-cell.has:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .ftcal-daytop { display: flex; align-items: center; min-height: 18px; }
  .ftcal-daynum { font-size: var(--text-xs); font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
  .ftcal-cell.today .ftcal-daynum { color: var(--accent); font-weight: 800; }
  .ftcal-today-pill { margin-left: 7px; font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
    color: var(--accent-contrast, #fff); background: var(--accent); padding: 2px 8px; border-radius: 999px; }
  .ftcal-charge { margin-top: auto; align-self: flex-start; max-width: 100%; display: inline-flex; align-items: center; gap: 7px;
    background: var(--input-bg); border: 1px solid var(--border); border-radius: 999px; padding: 4px 11px 4px 8px;
    transition: transform .12s, box-shadow .12s, background .12s; }
  .ftcal-cell.has:hover .ftcal-charge { background: var(--card); box-shadow: var(--shadow-pop, 0 2px 8px rgba(0,0,0,.08)); transform: translateY(-1px); }
  .ftcal-charge-ico { flex: none; width: 18px; height: 18px; display: grid; place-items: center; color: var(--accent); }
  .ftcal-charge-ico svg { width: 15px; height: 15px; }
  .ftcal-charge-amt { font-size: var(--text-sm); font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
  .ftcal-dots { flex: none; display: inline-flex; align-items: center; gap: 3px; }
  .ftcal-dots i { width: 5px; height: 5px; border-radius: 999px; background: var(--accent); display: block; }
  /* day popup */
  .ftcal-mico { flex: none; width: 36px; height: 36px; border-radius: 9px; background: var(--input-bg); color: var(--accent); display: grid; place-items: center; }
  .ftcal-mico svg { width: 18px; height: 18px; }
  .ftcal-dl { display: flex; flex-direction: column; padding: 0; }
  .ftcal-dl-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--border); }
  .ftcal-dl-row:first-child { border-top: none; }
  .ftcal-dl-ico { flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--input-bg); display: grid; place-items: center; color: var(--accent); }
  .ftcal-dl-ico svg { width: 18px; height: 18px; }
  .ftcal-dl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .ftcal-dl-name { font-size: var(--text-sm); font-weight: 600; }
  .ftcal-dl-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: var(--text-2xs); color: var(--muted); }
  .ftcal-dl-chip { padding: 2px 8px; border-radius: 999px; font-weight: 600; }
  .ftcal-dl-amt { font-weight: 700; font-variant-numeric: tabular-nums; }
  .ftcal-dl-tot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 14px 20px 18px;
    border-top: 2px solid var(--border); font-weight: 700; font-variant-numeric: tabular-nums; }
  @media (max-width: 640px) {
    .ftcal-cell { min-height: 62px; padding: 5px 5px; gap: 3px; }
    .ftcal-charge { padding: 3px 8px 3px 6px; gap: 5px; }
    .ftcal-charge-amt { font-size: var(--text-2xs); }
    .ftcal-sum { width: 100%; justify-content: flex-end; }
  }`;
  document.head.appendChild(el);
}

/* ---- day detail popup (opened by clicking a day with charges) ---- */
function RecDayModal({ date, items, onClose }) {
  ftEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const isToday = ftDayLabel(date, FT_REF) === "Today";
  const heading = FT_WD[date.getDay()] + ", " + FT_MON[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={"Charges on " + heading}>
        <div className="fs-modal-head">
          <span className="fs-modal-title">
            <span className="ftcal-mico"><Icon name="repeat" /></span>
            {isToday ? "Today · " : ""}{heading}
          </span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>
        <div className="ftcal-dl">
          {items.map((it) => {
            const catColor = FT_CAT_COLOR[it.category] || "var(--accent)";
            const acct = ftAcctName(it.account_id);
            return (
              <div className="ftcal-dl-row" key={it.id}>
                <span className="ftcal-dl-ico"><Icon name={it.icon || "repeat"} /></span>
                <div className="ftcal-dl-main">
                  <span className="ftcal-dl-name">{it.name}</span>
                  <span className="ftcal-dl-meta">
                    {it.category && <span className="ftcal-dl-chip" style={{ background: catColor + "22", color: catColor }}>{it.category}</span>}
                    <span>{ftCadLabel(it.cadence)}</span>
                    {acct && <span>{"· " + acct}</span>}
                  </span>
                </div>
                <span className="ftcal-dl-amt">{ftMoney(it.amount, 2)}</span>
              </div>);
          })}
        </div>
        <div className="ftcal-dl-tot">
          <span>{items.length} {items.length === 1 ? "charge" : "charges"}</span>
          <span>{ftMoney(total, 2)}</span>
        </div>
      </div>
    </div>);
}

/* ---- month calendar ---- */
function RecCalendar({ items }) {
  ftEnsureCalCSS();
  const [cursor, setCursor] = ftState(() => ({ y: FT_REF.getFullYear(), m: FT_REF.getMonth() }));
  const [dayModal, setDayModal] = ftState(null); // { date, items }
  const { y, m } = cursor;

  const step = (delta) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => setCursor({ y: FT_REF.getFullYear(), m: FT_REF.getMonth() });

  // every charge that lands in the viewed month, grouped by day-of-month
  const byDay = {};
  (items || []).forEach((it) => {
    ftRecOccurrencesInMonth(it, y, m).forEach((d) => {
      const k = d.getDate();
      (byDay[k] = byDay[k] || []).push(it);
    });
  });

  const daysInMonth = ftDaysInMonth(y, m);
  const startOffset = new Date(y, m, 1).getDay(); // 0 = Sunday
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isThisMonth = y === FT_REF.getFullYear() && m === FT_REF.getMonth();
  const today = FT_REF.getDate();
  const todayMs = ftStrip(FT_REF).getTime();
  const chargeDays = Object.keys(byDay).length;
  const monthTotal = Object.keys(byDay).reduce((s, k) => s + byDay[k].reduce((a, x) => a + (Number(x.amount) || 0), 0), 0);
  const open = (d, charges) => setDayModal({ date: new Date(y, m, d), items: charges });

  return (
    <div className="ftcal">
      <div className="ftcal-bar">
        <div className="ftcal-nav">
          <button className="ftcal-navbtn prev" onClick={() => step(-1)} aria-label="Previous month"><Icon name="chevR" /></button>
          <span className="ftcal-title">{FT_MON[m]} {y}</span>
          <button className="ftcal-navbtn" onClick={() => step(1)} aria-label="Next month"><Icon name="chevR" /></button>
          {!isThisMonth && <button className="ftcal-today" onClick={goToday}>Today</button>}
        </div>
        <div className="ftcal-sum">
          <span>{chargeDays} charge {chargeDays === 1 ? "day" : "days"}</span>
          <b>{ftMoney(monthTotal, 2)}</b>
        </div>
      </div>
      <div className="ftcal-head">{FT_WD3.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="ftcal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div className="ftcal-cell out" key={"e" + i} />;
          const charges = byDay[d] || [];
          const has = charges.length > 0;
          const tot = charges.reduce((s, x) => s + (Number(x.amount) || 0), 0);
          const past = new Date(y, m, d).getTime() < todayMs;
          const isToday = isThisMonth && d === today;
          const cls = "ftcal-cell" + (isToday ? " today" : "") + (past ? " past" : "") + (has ? " has" : "");
          return (
            <div className={cls} key={d}
              onClick={has ? () => open(d, charges) : undefined}
              role={has ? "button" : undefined}
              tabIndex={has ? 0 : undefined}
              onKeyDown={has ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(d, charges); } } : undefined}
              title={has ? (charges.length + " charge" + (charges.length > 1 ? "s" : "") + " · " + ftMoney(tot, 2)) : undefined}>
              <div className="ftcal-daytop">
                <span className="ftcal-daynum">{d}</span>
                {isToday && <span className="ftcal-today-pill">Today</span>}
              </div>
              {charges.length === 1 &&
                <span className="ftcal-charge">
                  <span className="ftcal-charge-ico"><Icon name={charges[0].icon || "repeat"} /></span>
                  <span className="ftcal-charge-amt">{ftMoney(Math.round(charges[0].amount), 0)}</span>
                </span>}
              {charges.length > 1 &&
                <span className="ftcal-charge">
                  <span className="ftcal-dots"><i /><i /><i /></span>
                  <span className="ftcal-charge-amt">{ftMoney(Math.round(tot), 0)}</span>
                </span>}
            </div>);
        })}
      </div>
      {dayModal && <RecDayModal date={dayModal.date} items={dayModal.items} onClose={() => setDayModal(null)} />}
    </div>);
}

/* ============================================================
   COVER OVERSPEND MODAL  (Budget)
   over   : { id, name, spent, color, avail }   (avail = budget + roll)
   sources: [{ id, name, color, slack, group }] under-budget categories
   style  : "suggested" | "manual"
   onApply(moves[]) where moves = [{ id, amt }]
   ============================================================ */
function CoverOverspendModal({ over, sources, style = "suggested", onApply, onClose }) {
  const { Button } = FT;
  const needed = Math.round((over.spent - over.avail) * 100) / 100;

  // greedy auto-fill from the largest sources, used as the "suggested" default
  const ranked = sources.slice().sort((a, b) => b.slack - a.slack);
  const autoFill = () => {
    let rem = needed; const a = {};
    for (const s of ranked) {
      if (rem <= 0) break;
      const take = Math.min(s.slack, rem);
      if (take > 0) { a[s.id] = Math.round(take * 100) / 100; rem -= take; }
    }
    return a;
  };
  const [alloc, setAlloc] = ftState(() => style === "suggested" ? autoFill() : {});

  ftEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalCovered = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = Math.round((needed - totalCovered) * 100) / 100;
  const covered = remaining <= 0.001;

  function setAmt(id, raw, max) {
    let v = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
    if (Number.isNaN(v)) v = 0;
    v = Math.max(0, Math.min(v, max));
    setAlloc((p) => ({ ...p, [id]: Math.round(v * 100) / 100 }));
  }

  function apply() {
    const moves = Object.entries(alloc).map(([id, amt]) => ({ id, amt: Number(amt) || 0 })).filter((m) => m.amt > 0);
    if (!moves.length) return;
    onApply(moves);
  }

  const totalSlack = sources.reduce((s, x) => s + x.slack, 0);

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal cov-modal" role="dialog" aria-modal="true" aria-label={"Cover " + over.name + " overspend"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="alert" /></span>Cover {over.name} overspend</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="cov-body">
          <div className="cov-summary">
            <div className="cov-sum-item">
              <span className="cov-sum-lbl">Over budget</span>
              <span className="cov-sum-val neg">{ftMoney(needed, 2)}</span>
            </div>
            <span className="cov-arrow"><Icon name="repeat" /></span>
            <div className="cov-sum-item">
              <span className="cov-sum-lbl">Still to cover</span>
              <span className="cov-sum-val" style={{ color: covered ? "var(--green)" : "var(--text)" }}>{covered ? ftMoney(0, 2) : ftMoney(remaining, 2)}</span>
            </div>
          </div>

          <p className="cov-hint">
            {style === "suggested"
              ? <React.Fragment>Claud pre-filled the categories with the most room this month. Adjust any amount, then move the budget.</React.Fragment>
              : <React.Fragment>Pull from categories with room this month. {ftMoney(totalSlack, 0)} is available across {sources.length} {sources.length === 1 ? "category" : "categories"}.</React.Fragment>}
          </p>

          <div className="cov-sources">
            {ranked.map((s) => {
              const val = alloc[s.id] || 0;
              const on = val > 0;
              return (
                <div className={"cov-src" + (on ? " on" : "")} key={s.id}>
                  <span className="cov-src-name"><span className="cat-dot" style={{ background: s.color }} />{s.name}</span>
                  <span className="cov-src-slack muted">{ftMoney(s.slack, 0)} left</span>
                  <div className="cov-src-input">
                    <span className="cov-cur">$</span>
                    <input type="number" inputMode="decimal" min="0" step="5" max={s.slack}
                      value={val ? String(val) : ""} placeholder="0"
                      onChange={(e) => setAmt(s.id, e.target.value, s.slack)} />
                    <button className="cov-max" onClick={() => setAmt(s.id, s.slack, s.slack)} title="Use all available">Max</button>
                  </div>
                </div>);
            })}
            {sources.length === 0 &&
              <div className="cov-empty">No categories have spare budget this month. Try trimming next month's plan instead.</div>}
          </div>
        </div>

        <div className="fs-modal-foot">
          <span className="fs-foot-note">{covered ? "Fully covered \u2014 June stays balanced." : ftMoney(remaining, 2) + " still uncovered"}</span>
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={apply} disabled={totalCovered <= 0}>
              Move {ftMoney(Math.min(totalCovered, needed) || 0, 2)}
            </Button>}
          </div>
        </div>
      </div>
    </div>);
}

/* ============================================================
   GOALS — shared store + data
   ============================================================ */
/* goal data now comes from ClaudData.goals (blank slate for new users). */
const FT_GOAL_ICONS = ["piggy", "plane", "home", "laptop", "book", "gift", "heart", "dumbbell", "wallet", "target"];

/* resolve a goal's funding-account display name from its account_id (server shape) */
function ftAcctName(id) {
  const a = window.ClaudStore && window.ClaudStore.accountById && window.ClaudStore.accountById(id);
  return a ? a.name : "";
}

/* Shared goals store, now backed by the live server snapshot (ClaudData.goals).
   get() reads the stable ClaudData array; mutators route through ClaudActions
   (persist + refresh); subscribe() re-fires on the global 'claud:data' event. */
const FT_GOALS_STORE = window.__claudGoalsStore || (window.__claudGoalsStore = (() => {
  const A = () => window.ClaudActions;
  const get = () => (window.ClaudData && window.ClaudData.goals) || [];
  /* map the modal's flat shape (incl. 'linked' account name) to the server's. */
  const toPatch = (data) => {
    const p = {};
    if (data.name != null) p.name = data.name;
    if (data.icon != null) p.icon = data.icon;
    if (data.color != null) p.color = data.color;
    if (data.target != null) p.target = data.target;
    if (data.monthly != null) p.monthly = data.monthly;
    if (data.auto != null) p.auto = data.auto;
    if (data.account_id != null) p.account_id = data.account_id;
    else if (data.linked != null) {
      const acc = (get(), (window.ClaudData.accounts || []).find((a) => a.name === data.linked));
      if (acc) p.account_id = acc.id;
    }
    return p;
  };
  return {
    get,
    addFunds: (id, amt, fromAccountId) => A().addFunds(id, amt, fromAccountId),
    save: (data) => {
      const patch = toPatch(data);
      return data.id ? A().updateGoal(data.id, patch) : A().addGoal(patch);
    },
    remove: (id) => A().deleteGoal(id),
    subscribe: (fn) => {
      const h = () => { try { fn(get()); } catch (e) {} };
      window.addEventListener("claud:data", h);
      return () => window.removeEventListener("claud:data", h);
    }
  };
})());

function useFeatGoals() {
  window.useClaudData();
  return [FT_GOALS_STORE.get(), {
    addFunds: FT_GOALS_STORE.addFunds, save: FT_GOALS_STORE.save, remove: FT_GOALS_STORE.remove
  }];
}

/* Build a 6-month contribution sparkline from goal.contributions (server shape:
   [{amount,date}]). Buckets by calendar month ending at the reference month.
   Returns { bars:[6 numbers], months:[6 short labels], any:bool }. */
function ftContribSeries(g) {
  const months = [], labels = [], buckets = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(FT_REF.getFullYear(), FT_REF.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push(key); labels.push(FT_MON3[d.getMonth()]); buckets[key] = 0;
  }
  (g.contributions || []).forEach((c) => {
    const key = String(c.date || "").slice(0, 7);
    if (key in buckets) buckets[key] += Math.abs(Number(c.amount) || 0);
  });
  const bars = months.map((k) => buckets[k]);
  return { bars, months: labels, any: bars.some((v) => v > 0) };
}

/* completion projection from the fixed reference month */
function ftProjection(g) {
  if (g.have >= g.target) return { done: true, label: "Goal reached", pct: 100 };
  const pct = Math.round(g.have / g.target * 100);
  if (!g.monthly || g.monthly <= 0) return { none: true, label: "Set a monthly amount", pct };
  const months = Math.ceil((g.target - g.have) / g.monthly);
  const d = new Date(FT_REF.getFullYear(), FT_REF.getMonth() + months, 1);
  return { months, label: FT_MON3[d.getMonth()] + " " + d.getFullYear(), pct };
}

/* ============================================================
   GOALS PAGE
   layout: "cards" | "rows"
   ============================================================ */
function GoalsPage({ layout = "cards" }) {
  const { Card, Button, ProgressBar } = FT;
  const [goals, api] = useFeatGoals();
  const [modal, setModal] = ftState(null); // { mode:"funds"|"edit"|"add", goal? }

  const totalHave = goals.reduce((s, g) => s + g.have, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalMonthly = goals.reduce((s, g) => s + (g.auto ? g.monthly : 0), 0);
  const onTrack = goals.filter((g) => g.have >= g.target || g.monthly > 0).length;

  ftEffect(() => {
    const open = () => setModal({ mode: "add" });
    window.addEventListener("claud:add-goal", open);
    return () => window.removeEventListener("claud:add-goal", open);
  }, []);

  function GoalMeta({ g }) {
    const proj = ftProjection(g);
    return (
      <div className="goalp-meta">
        <div className="goalp-meta-item">
          <span className="gm-lbl"><Icon name="wallet" /> Funding</span>
          <span className="gm-val">{ftAcctName(g.account_id) || g.linked || "\u2014"}</span>
        </div>
        <div className="goalp-meta-item">
          <span className="gm-lbl"><Icon name="repeat" /> Contribution</span>
          <span className="gm-val">{g.monthly > 0 ? ftMoney(g.monthly, 0) + "/mo" : "\u2014"}{g.auto && g.monthly > 0 && <span className="goalp-auto">auto</span>}</span>
        </div>
        <div className="goalp-meta-item">
          <span className="gm-lbl"><Icon name="target" /> {proj.done ? "Status" : "On track for"}</span>
          <span className={"gm-val" + (proj.done ? " pos" : "") + (proj.none ? " warn" : "")}>{proj.label}</span>
        </div>
      </div>);
  }

  function Spark({ g }) {
    const series = ftContribSeries(g);
    const max = Math.max(...series.bars, 1);
    return (
      <div className="goalp-spark" title={series.any ? "Last 6 months of contributions" : "No contributions yet"}>
        {series.bars.map((v, i) =>
          <span key={i} className="gs-bar-wrap">
            <span className="gs-bar" style={{ height: Math.max(4, v / max * 28) + "px", background: v === 0 ? "var(--border)" : g.color }} />
            <span className="gs-mon">{series.months[i]}</span>
          </span>)}
      </div>);
  }

  const renderCard = (g) => {
    const proj = ftProjection(g);
    const done = g.have >= g.target;
    return (
      <Card widget key={g.id} className="goalp-card">
        <div className="goalp-head">
          {window.IconPicker
            ? <window.IconPicker className="goalp-ico" value={g.icon} onPick={(n) => api.save({ id: g.id, icon: n })} />
            : <span className="goalp-ico"><Icon name={g.icon} /></span>}
          <div className="goalp-id">
            <span className="goalp-name">{g.name}</span>
            <span className="goalp-fig"><b>{ftMoney(g.have)}</b> of {ftMoney(g.target)}</span>
          </div>
          <span className={"goalp-pct" + (done ? " pos" : "")}>{proj.pct}%</span>
        </div>
        <ProgressBar value={g.have} max={g.target} tone={done ? "done" : "accent"} />
        <GoalMeta g={g} />
        <Spark g={g} />
        <div className="goalp-actions">
          {Button && <Button variant="primary" size="sm" onClick={() => setModal({ mode: "funds", goal: g })}><span className="btn-ico"><Icon name="plus" /></span>Add funds</Button>}
          {Button && <Button variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", goal: g })}>Edit</Button>}
        </div>
      </Card>);
  };

  const renderRow = (g) => {
    const proj = ftProjection(g);
    const done = g.have >= g.target;
    return (
      <div className="goalp-row" key={g.id}>
        {window.IconPicker
          ? <window.IconPicker className="goalp-ico sm" value={g.icon} onPick={(n) => api.save({ id: g.id, icon: n })} />
          : <span className="goalp-ico sm"><Icon name={g.icon} /></span>}
        <div className="goalp-row-main">
          <div className="goalp-row-top">
            <span className="goalp-name">{g.name}</span>
            <span className="goalp-fig"><b>{ftMoney(g.have)}</b> of {ftMoney(g.target)} {"\u00B7"} <span className={done ? "pos" : ""}>{proj.pct}%</span></span>
          </div>
          <ProgressBar value={g.have} max={g.target} tone={done ? "done" : "accent"} />
          <div className="goalp-row-meta">
            <span><Icon name="wallet" /> {ftAcctName(g.account_id) || g.linked || "\u2014"}</span>
            <span><Icon name="repeat" /> {g.monthly > 0 ? ftMoney(g.monthly, 0) + "/mo" : "no auto-save"}</span>
            <span className={proj.done ? "pos" : proj.none ? "warn" : ""}><Icon name="target" /> {proj.done ? "Goal reached" : "On track for " + proj.label}</span>
          </div>
        </div>
        <div className="goalp-row-actions">
          {Button && <Button variant="primary" size="sm" onClick={() => setModal({ mode: "funds", goal: g })}>Add funds</Button>}
          {Button && <Button variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", goal: g })}>Edit</Button>}
        </div>
      </div>);
  };

  return (
    <React.Fragment>
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Saved toward goals</span>
          <span className="kpi-val">{ftMoney(totalHave)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>of {ftMoney(totalTarget)} target</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Auto-saving · per month</span>
          <span className="kpi-val">{ftMoney(totalMonthly)}</span>
          <span className="kpi-delta pos">on payday</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Active goals</span>
          <span className="kpi-val">{goals.length}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{onTrack} on track</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Overall progress</span>
          <span className="kpi-val">{totalTarget ? Math.round(totalHave / totalTarget * 100) : 0}%</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{ftMoney(Math.max(0, totalTarget - totalHave))} to go</span>
        </div></Card>
      </div>

      {goals.length === 0
        ? <Card widget><div className="rule-empty">
            <span className="re-ico"><Icon name="target" /></span>
            <b>No savings goals yet</b><br />
            Create a goal to set a target, auto-save toward it, and project a finish date.
            <div style={{ marginTop: 14 }}>
              {Button && <Button variant="primary" size="sm" onClick={() => setModal({ mode: "add" })}><span className="btn-ico"><Icon name="plus" /></span>New savings goal</Button>}
            </div>
          </div></Card>
        : layout === "rows"
        ? <Card widget><div className="goalp-rows">{goals.map(renderRow)}</div></Card>
        : <div className="goalp-grid">{goals.map(renderCard)}</div>}

      {goals.length > 0 &&
        <button className="goalp-add" onClick={() => setModal({ mode: "add" })}>
          <Icon name="plus" /> New savings goal
        </button>}

      {modal && <GoalModal modal={modal} api={api} onClose={() => setModal(null)} />}
    </React.Fragment>);
}

/* ---- add funds / edit / new goal ---- */
function GoalModal({ modal, api, onClose }) {
  const { Button } = FT;
  const g = modal.goal;
  const mode = modal.mode;

  // real accounts from the live store; fall back gracefully if none yet
  const accts = (window.ClaudData && window.ClaudData.accounts) || [];
  const defaultAcctId = (g && g.account_id) || (accts[0] && accts[0].id) || "";
  const acctNameById = (id) => { const a = accts.find((x) => x.id === id); return a ? a.name : (accts[0] ? accts[0].name : "an account"); };

  ftEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- Add funds ----
  const [fund, setFund] = ftState("");
  const [fromAcctId, setFromAcctId] = ftState(defaultAcctId);
  const [fromOpen, setFromOpen] = ftState(false);
  if (mode === "funds") {
    const amtNum = parseFloat(String(fund).replace(/[^0-9.]/g, ""));
    const valid = !Number.isNaN(amtNum) && amtNum > 0;
    const after = g.have + (valid ? amtNum : 0);
    const chips = [50, 100, g.monthly].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
    return (
      <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fs-modal cov-modal" role="dialog" aria-modal="true" aria-label={"Add funds to " + g.name}>
          <div className="fs-modal-head">
            <span className="fs-modal-title gf-title">
              <span className="fs-ico goalp-ico sm"><Icon name={g.icon} /></span>
              <span className="gf-title-eyebrow">Add funds to</span>
              <span className="gf-title-name">{g.name}</span>
            </span>
            <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
          </div>
          <div className="cov-body">
            <div className="gf-amount">
              <span className="gf-cur">$</span>
              <input type="number" inputMode="decimal" step="10" min="0" autoFocus value={fund} placeholder="0" onChange={(e) => setFund(e.target.value)} />
            </div>
            <div className="gf-chips">
              {chips.map((c) => <button key={c} className="gf-chip" onClick={() => setFund(String(c))}>{ftMoney(c, 0)}</button>)}
            </div>
            <div className="gf-from gf-from-pick">
              <span className="muted"><Icon name="wallet" /> From</span>
              <div className="gf-acct-wrap">
                <button type="button" className={"gf-acct" + (fromOpen ? " open" : "")} aria-haspopup="listbox" aria-expanded={fromOpen} disabled={accts.length === 0} onClick={() => setFromOpen((v) => !v)}>
                  {accts.length ? acctNameById(fromAcctId) : "No accounts yet"}<span className="gf-acct-caret">{"\u25BE"}</span>
                </button>
                {fromOpen &&
                  <div className="gf-acct-menu" role="listbox">
                    {accts.map((a) =>
                      <button key={a.id} type="button" role="option" aria-selected={a.id === fromAcctId}
                        className={"gf-acct-opt" + (a.id === fromAcctId ? " on" : "")}
                        onClick={() => { setFromAcctId(a.id); setFromOpen(false); }}>
                        <span className="gf-acct-optname"><Icon name="bank" /> {a.name}</span>
                        {a.id === fromAcctId && <span className="gf-acct-tick"><Icon name="check" /></span>}
                      </button>)}
                  </div>}
              </div>
            </div>
            <div className="gf-after">
              <span className="muted">New balance</span>
              <span><b>{ftMoney(after)}</b> of {ftMoney(g.target)} {valid && after >= g.target && <span className="pos">{"\u00B7"} goal reached {"\uD83C\uDF89"}</span>}</span>
            </div>
          </div>
          <div className="fs-modal-foot">
            <span className="fs-foot-note">Moves money from {acctNameById(fromAcctId)} into this goal.</span>
            <div className="right">
              {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
              {Button && <Button variant="primary" size="sm" disabled={!valid} onClick={() => { api.addFunds(g.id, Math.round(amtNum * 100) / 100, fromAcctId || undefined); onClose(); }}>Add {valid ? ftMoney(amtNum, 0) : "funds"}</Button>}
            </div>
          </div>
        </div>
      </div>);
  }

  // ---- Add / edit goal ----
  const editing = mode === "edit";
  const [name, setName] = ftState(editing ? g.name : "");
  const [icon, setIcon] = ftState(editing ? g.icon : FT_GOAL_ICONS[0]);
  const [target, setTarget] = ftState(editing ? String(g.target) : "");
  const [monthly, setMonthly] = ftState(editing ? String(g.monthly) : "");
  const [linkedId, setLinkedId] = ftState(defaultAcctId);
  const [auto, setAuto] = ftState(editing ? g.auto : true);
  const [touched, setTouched] = ftState(false);

  const targetNum = parseFloat(String(target).replace(/[^0-9.]/g, ""));
  const monthlyNum = parseFloat(String(monthly).replace(/[^0-9.]/g, "")) || 0;
  const validName = name.trim().length > 0;
  const validTarget = !Number.isNaN(targetNum) && targetNum > 0;
  const valid = validName && validTarget;
  const color = editing ? g.color : "#c0763e";

  function submit() {
    setTouched(true);
    if (!valid) return;
    api.save({
      id: editing ? g.id : undefined,
      name: name.trim(), icon, color,
      target: Math.round(targetNum), monthly: Math.round(monthlyNum),
      account_id: linkedId || undefined, auto
    });
    onClose();
  }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit goal" : "New savings goal"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico goalp-ico sm"><Icon name={icon} /></span>{editing ? "Edit goal" : "New savings goal"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="fs-grid">
          <label className="fs-field full">
            <span>Goal name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New car" autoFocus
              style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
          </label>

          <div className="fs-field full">
            <span>Icon</span>
            <div className="gf-icon-row">
              {FT_GOAL_ICONS.map((nm) => <button key={nm} type="button" className={"gf-icon" + (icon === nm ? " on" : "")} onClick={() => setIcon(nm)} aria-label={nm}><Icon name={nm} /></button>)}
            </div>
          </div>

          <label className="fs-field">
            <span>Target amount</span>
            <input type="number" inputMode="decimal" step="100" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0"
              style={touched && !validTarget ? { borderColor: "var(--red)" } : undefined} />
          </label>
          <label className="fs-field">
            <span>Monthly contribution</span>
            <input type="number" inputMode="decimal" step="10" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="0" />
          </label>

          <label className="fs-field full">
            <span>Funding account</span>
            <select value={linkedId} onChange={(e) => setLinkedId(e.target.value)} disabled={accts.length === 0}>
              {accts.length === 0 && <option value="">No accounts yet</option>}
              {accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          <div className="fs-field full">
            <label className="gf-auto">
              <span>
                <b>Auto-transfer on payday</b>
                <span className="muted">Move {monthlyNum > 0 ? ftMoney(monthlyNum, 0) : "the monthly amount"} from {acctNameById(linkedId)} on the 1st.</span>
              </span>
              <button type="button" className={"roll-switch " + (auto ? "on" : "")} role="switch" aria-checked={auto} onClick={() => setAuto((v) => !v)}><span className="roll-knob" /></button>
            </label>
          </div>
        </div>

        <div className="fs-modal-foot">
          {editing
            ? <Button variant="danger" size="sm" onClick={() => { api.remove(g.id); onClose(); }}>Delete</Button>
            : <span className="fs-foot-note">Track progress and project a completion date.</span>}
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>{editing ? "Save changes" : "Create goal"}</Button>}
          </div>
        </div>
      </div>
    </div>);
}

/* ---- add / edit / delete a recurring item ---- */
const FT_REC_ICONS = ["home", "bag", "phone", "wifi", "music", "book", "shield", "dumbbell", "coffee", "fuel", "cart", "bank"];
const FT_REC_CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];
const ftTodayISO = () => { const d = FT_REF; return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

function RecurringModal({ modal, onClose }) {
  const { Button } = FT;
  const it = modal.item;
  const editing = modal.mode === "edit";

  const accts = (window.ClaudData && window.ClaudData.accounts) || [];
  // category options: live budget categories, else a sensible default set
  const liveCats = ((window.ClaudData && window.ClaudData.dashCategories) || []).map((c) => c.name);
  const fallbackCats = ["Housing", "Utilities", "Subscriptions", "Health & fitness", "Shopping", "Transport", "Dining", "Insurance"];
  const cats = (liveCats.length ? liveCats : fallbackCats).filter((c, i, a) => a.indexOf(c) === i);

  ftEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [name, setName] = ftState(editing ? it.name : "");
  const [amount, setAmount] = ftState(editing ? String(it.amount) : "");
  const [cadence, setCadence] = ftState(editing ? (it.cadence === "annual" ? "yearly" : it.cadence) : "monthly");
  const [nextDate, setNextDate] = ftState(editing && it.next_date ? it.next_date : ftTodayISO());
  const [category, setCategory] = ftState(editing ? (it.category || (cats[0] || "")) : (cats[0] || ""));
  const [acctId, setAcctId] = ftState(editing ? (it.account_id || (accts[0] && accts[0].id) || "") : (accts[0] && accts[0].id) || "");
  const [icon, setIcon] = ftState(editing ? (it.icon || FT_REC_ICONS[0]) : FT_REC_ICONS[0]);
  const [touched, setTouched] = ftState(false);

  const amtNum = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  const validName = name.trim().length > 0;
  const validAmt = !Number.isNaN(amtNum) && amtNum > 0;
  const valid = validName && validAmt;

  function submit() {
    setTouched(true);
    if (!valid) return;
    const body = {
      name: name.trim(),
      amount: Math.round(amtNum * 100) / 100,
      cadence, next_date: nextDate,
      category: category || undefined,
      account_id: acctId || undefined,
      icon
    };
    if (editing) ClaudActions.updateRecurring(it.id, body);
    else ClaudActions.addRecurring(body);
    onClose();
  }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit recurring" : "New recurring charge"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico goalp-ico sm"><Icon name={icon} /></span>{editing ? "Edit recurring" : "New recurring charge"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>

        <div className="fs-grid">
          <label className="fs-field full">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix" autoFocus
              style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
          </label>

          <div className="fs-field full">
            <span>Icon</span>
            <div className="gf-icon-row">
              {FT_REC_ICONS.map((nm) => <button key={nm} type="button" className={"gf-icon" + (icon === nm ? " on" : "")} onClick={() => setIcon(nm)} aria-label={nm}><Icon name={nm} /></button>)}
            </div>
          </div>

          <label className="fs-field">
            <span>Amount</span>
            <input type="number" inputMode="decimal" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
              style={touched && !validAmt ? { borderColor: "var(--red)" } : undefined} />
          </label>
          <label className="fs-field">
            <span>Cadence</span>
            <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
              {FT_REC_CADENCES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </label>

          <label className="fs-field">
            <span>Next charge</span>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </label>
          <label className="fs-field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="fs-field full">
            <span>Charged to</span>
            <select value={acctId} onChange={(e) => setAcctId(e.target.value)} disabled={accts.length === 0}>
              {accts.length === 0 && <option value="">No accounts yet</option>}
              {accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>

        <div className="fs-modal-foot">
          {editing
            ? <Button variant="danger" size="sm" onClick={() => { ClaudActions.deleteRecurring(it.id); onClose(); }}>Delete</Button>
            : <span className="fs-foot-note">Claud will project this on your timeline and calendar.</span>}
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>{editing ? "Save changes" : "Add recurring"}</Button>}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { CoverOverspendModal, RecurringSection, RecurringModal, GoalsPage, GoalModal, useFeatGoals });
