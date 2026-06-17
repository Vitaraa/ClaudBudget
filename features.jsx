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

/* ---- date model: a fixed "today" so the demo reads deterministically ----
   Tuesday, June 16, 2026. Every "you'll be charged …" label derives from this. */
const FT_REF = new Date(2026, 5, 16);
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

const FT_ACCOUNTS = ["Everyday Checking", "Emergency Savings", "Joint Checking", "Brokerage", "Roth IRA"];

/* ============================================================
   RECURRING & BILLS — data
   ============================================================ */
const FT_RECURRING = [
  { id: "rc1", name: "Rent — Park Ave", amount: 1650, cadence: "monthly", dom: 1, cat: "Housing", account: "Everyday Checking", icon: "home" },
  { id: "rc2", name: "Con Edison", amount: 128.40, cadence: "monthly", dom: 7, cat: "Utilities", account: "Everyday Checking", icon: "bag", variable: true },
  { id: "rc3", name: "Verizon", amount: 80, cadence: "monthly", dom: 1, cat: "Utilities", account: "Everyday Checking", icon: "phone" },
  { id: "rc4", name: "Equinox", amount: 38, cadence: "monthly", dom: 1, cat: "Health & fitness", account: "Sapphire Visa", icon: "dumbbell" },
  { id: "rc5", name: "Netflix", amount: 16.49, cadence: "monthly", dom: 5, cat: "Subscriptions", account: "Sapphire Visa", icon: "music", change: 2.50 },
  { id: "rc6", name: "The New York Times", amount: 17, cadence: "monthly", dom: 22, cat: "Subscriptions", account: "Sapphire Visa", icon: "book" },
  { id: "rc7", name: "Spotify", amount: 11.99, cadence: "monthly", dom: 17, cat: "Subscriptions", account: "Sapphire Visa", icon: "music" },
  { id: "rc8", name: "Renter's insurance", amount: 18, cadence: "monthly", dom: 12, cat: "Housing", account: "Everyday Checking", icon: "shield" },
  { id: "rc9", name: "iCloud+", amount: 2.99, cadence: "monthly", dom: 18, cat: "Subscriptions", account: "Sapphire Visa", icon: "wifi" },
  { id: "rc10", name: "Amazon Prime", amount: 139, cadence: "annual", month: 9, dom: 14, cat: "Shopping", account: "Sapphire Visa", icon: "bag" }
];
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
  const [pane, setPane] = ftState("Upcoming");
  const iconOv = ftUseRecIcons();

  const enriched = FT_RECURRING.map((it) => ({ ...it, icon: iconOv[it.id] || it.icon, next: ftNextDate(it, FT_REF) }))
    .sort((a, b) => a.next - b.next);

  const monthlyTotal = FT_RECURRING.reduce((s, it) => s + ftMonthlyCost(it), 0);
  const annualTotal = monthlyTotal * 12;
  const next = enriched[0];
  const nextDiff = Math.round((ftStrip(next.next) - ftStrip(FT_REF)) / ftDayMs);

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

  const leadCharge = next;
  const leadWhen = nextDiff === 0 ? "today" : nextDiff === 1 ? "tomorrow" : "on " + FT_WD[next.next.getDay()];

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Recurring · per month</span>
          <span className="kpi-val neg">{ftMoney(monthlyTotal, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{FT_RECURRING.length} active</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Projected · per year</span>
          <span className="kpi-val">{ftMoney(annualTotal)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>across all plans</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Next charge</span>
          <span className="kpi-val">{ftMoney(next.amount, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{next.name} {"\u00B7"} {ftDayLabel(next.next, FT_REF)}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Subscriptions</span>
          <span className="kpi-val">{FT_RECURRING.filter((x) => x.cat === "Subscriptions").length}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{ftMoney(FT_RECURRING.filter((x) => x.cat === "Subscriptions").reduce((s, x) => s + ftMonthlyCost(x), 0), 2)}/mo</span>
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
          <span className="muted">next 35 days</span>
        </div>
        <p className="rec-lead">
          <span className="rec-lead-ico"><Icon name="clock" /></span>
          You'll be charged <b>{ftMoney(leadCharge.amount, 2)}</b> by <b>{leadCharge.name}</b> {leadWhen}.
        </p>

        {view === "calendar"
          ? <RecCalendar items={enriched} />
          : <RecTimeline groups={groups} />}
      </Card>
      :
      /* Full roster */
      <Card widget>
        <div className="widget-head">
          <span className="widget-title">All recurring</span>
          {Button && <Button variant="ghost" size="sm" onClick={() => onImport && onImport("Statement")}><span className="btn-ico"><Icon name="upload" /></span>Detect from statement</Button>}
        </div>
        <div className="rec-roster">
          {enriched.slice().sort((a, b) => ftMonthlyCost(b) - ftMonthlyCost(a)).map((it) => {
            const color = "var(--accent)";
            const catColor = FT_CAT_COLOR[it.cat] || "var(--accent)";
            const Picker = window.IconPicker;
            return (
              <div className="rec-row" key={it.id}>
                {Picker
                  ? <Picker className="rec-ico" color={color} value={it.icon} onPick={(n) => FT_REC_ICON_STORE.set(it.id, n)} />
                  : <span className="rec-ico" style={{ color }}><Icon name={it.icon} /></span>}
                <div className="rec-main">
                  <span className="rec-name">{it.name}
                    {it.change && <span className="rec-flag" title={"Up " + ftMoney(it.change, 2) + " since last charge"}><Icon name="trendUp" /> {ftMoney(it.change, 2)}</span>}
                  </span>
                  <span className="rec-sub">
                    <span className="rec-chip" style={{ background: catColor + "22", color: catColor }}>{it.cat}</span>
                    {it.account} {"\u00B7"} next {ftDayLabel(it.next, FT_REF)}
                  </span>
                </div>
                <span className="rec-cad">{it.cadence === "annual" ? "yearly" : it.variable ? "~monthly" : "monthly"}</span>
                <span className="rec-amt">
                  <b>{ftMoney(it.amount, 2)}</b>
                  {it.cadence === "annual" && <span className="rec-permo">{ftMoney(ftMonthlyCost(it), 2)}/mo</span>}
                </span>
                <button className="rec-cancel" title={"Manage " + it.name} aria-label={"Manage " + it.name}><Icon name="settings" /></button>
              </div>);
          })}
        </div>
        <p className="rec-foot muted">Tip: detected charges are anchored to your real transactions — cancel one and Claud stops projecting it.</p>
      </Card>
      }
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
                      ? <Picker className="rec-ico sm" color={color} value={it.icon} onPick={(n) => FT_REC_ICON_STORE.set(it.id, n)} />
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

/* ---- month calendar ---- */
function RecCalendar({ items }) {
  const y = FT_REF.getFullYear(), m = FT_REF.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // charges that fall in this month, keyed by day-of-month
  const byDay = {};
  items.forEach((it) => {
    if (it.next.getFullYear() === y && it.next.getMonth() === m) {
      const d = it.next.getDate();
      (byDay[d] = byDay[d] || []).push(it);
    }
  });
  const today = FT_REF.getDate();

  return (
    <div className="rec-cal">
      <div className="rec-cal-head">{FT_WD3.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="rec-cal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div className="rec-cal-cell empty" key={"e" + i} />;
          const charges = byDay[d] || [];
          const tot = charges.reduce((s, x) => s + x.amount, 0);
          const past = d < today;
          return (
            <div className={"rec-cal-cell" + (d === today ? " today" : "") + (past ? " past" : "")} key={d}>
              <span className="rec-cal-num">{d}</span>
              {charges.length > 0 &&
                <div className="rec-cal-charges">
                  <span className="rec-cal-amt">{ftMoney(tot, 0)}</span>
                  <div className="rec-cal-dots">
                    {charges.slice(0, 4).map((c) => <span key={c.id} className="rec-cal-dot" style={{ background: "var(--accent)" }} title={c.name + " " + ftMoney(c.amount, 2)} />)}
                  </div>
                </div>}
            </div>);
        })}
      </div>
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
const FT_GOALS_SEED = [
  { id: "gl1", name: "Emergency fund", icon: "piggy", target: 30000, have: 28640, monthly: 800, linked: "Emergency Savings", auto: true, autoDay: 1, color: "#4f9a6a", history: [600, 800, 800, 800, 800, 800] },
  { id: "gl2", name: "Japan trip", icon: "plane", target: 5000, have: 2100, monthly: 250, linked: "Emergency Savings", auto: true, autoDay: 1, color: "#5a93a8", history: [250, 250, 200, 250, 250, 250] },
  { id: "gl3", name: "New laptop", icon: "laptop", target: 2200, have: 900, monthly: 150, linked: "Everyday Checking", auto: false, autoDay: 1, color: "#8a6fae", history: [150, 0, 150, 150, 150, 150] },
  { id: "gl4", name: "Home down payment", icon: "home", target: 50000, have: 14200, monthly: 1200, linked: "Brokerage", auto: true, autoDay: 1, color: "#c0763e", history: [1000, 1200, 1000, 1200, 1200, 1200] }
];
const FT_HIST_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const FT_GOAL_ICONS = ["piggy", "plane", "home", "laptop", "book", "gift", "heart", "dumbbell", "wallet", "target"];

const FT_GOALS_STORE = window.__claudGoalsStore || (window.__claudGoalsStore = (() => {
  let goals = FT_GOALS_SEED.map((g) => ({ ...g }));
  const subs = new Set();
  const emit = () => { subs.forEach((fn) => { try { fn(goals); } catch (e) {} }); window.dispatchEvent(new CustomEvent("claud:goals-changed")); };
  return {
    get: () => goals,
    addFunds: (id, amt) => { goals = goals.map((g) => g.id === id ? { ...g, have: g.have + amt } : g); emit(); },
    save: (data) => {
      if (data.id) goals = goals.map((g) => g.id === data.id ? { ...g, ...data } : g);
      else goals = [...goals, { ...data, id: "gl" + Date.now(), have: data.have || 0, history: [] }];
      emit();
    },
    remove: (id) => { goals = goals.filter((g) => g.id !== id); emit(); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
})());

function useFeatGoals() {
  const [, bump] = ftState(0);
  ftEffect(() => FT_GOALS_STORE.subscribe(() => bump((n) => n + 1)), []);
  return [FT_GOALS_STORE.get(), {
    addFunds: FT_GOALS_STORE.addFunds, save: FT_GOALS_STORE.save, remove: FT_GOALS_STORE.remove
  }];
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
          <span className="gm-val">{g.linked}</span>
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
    const max = Math.max(...g.history, 1);
    return (
      <div className="goalp-spark" title="Last 6 months of contributions">
        {g.history.map((v, i) =>
          <span key={i} className="gs-bar-wrap">
            <span className="gs-bar" style={{ height: Math.max(4, v / max * 28) + "px", background: v === 0 ? "var(--border)" : g.color }} />
            <span className="gs-mon">{FT_HIST_MONTHS[i]}</span>
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
            <span><Icon name="wallet" /> {g.linked}</span>
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

      {layout === "rows"
        ? <Card widget><div className="goalp-rows">{goals.map(renderRow)}</div></Card>
        : <div className="goalp-grid">{goals.map(renderCard)}</div>}

      <button className="goalp-add" onClick={() => setModal({ mode: "add" })}>
        <Icon name="plus" /> New savings goal
      </button>

      {modal && <GoalModal modal={modal} api={api} onClose={() => setModal(null)} />}
    </React.Fragment>);
}

/* ---- add funds / edit / new goal ---- */
function GoalModal({ modal, api, onClose }) {
  const { Button } = FT;
  const g = modal.goal;
  const mode = modal.mode;

  ftEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ---- Add funds ----
  const [fund, setFund] = ftState("");
  const [fromAcct, setFromAcct] = ftState(g ? g.linked : FT_ACCOUNTS[0]);
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
                <button type="button" className={"gf-acct" + (fromOpen ? " open" : "")} aria-haspopup="listbox" aria-expanded={fromOpen} onClick={() => setFromOpen((v) => !v)}>
                  {fromAcct}<span className="gf-acct-caret">{"\u25BE"}</span>
                </button>
                {fromOpen &&
                  <div className="gf-acct-menu" role="listbox">
                    {FT_ACCOUNTS.map((a) =>
                      <button key={a} type="button" role="option" aria-selected={a === fromAcct}
                        className={"gf-acct-opt" + (a === fromAcct ? " on" : "")}
                        onClick={() => { setFromAcct(a); setFromOpen(false); }}>
                        <span className="gf-acct-optname"><Icon name="bank" /> {a}</span>
                        {a === fromAcct && <span className="gf-acct-tick"><Icon name="check" /></span>}
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
            <span className="fs-foot-note">Moves money from {fromAcct} into this goal.</span>
            <div className="right">
              {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
              {Button && <Button variant="primary" size="sm" disabled={!valid} onClick={() => { api.addFunds(g.id, Math.round(amtNum * 100) / 100); onClose(); }}>Add {valid ? ftMoney(amtNum, 0) : "funds"}</Button>}
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
  const [linked, setLinked] = ftState(editing ? g.linked : FT_ACCOUNTS[0]);
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
      linked, auto, autoDay: editing ? g.autoDay : 1,
      have: editing ? g.have : 0,
      history: editing ? g.history : [0, 0, 0, 0, 0, 0]
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
            <select value={linked} onChange={(e) => setLinked(e.target.value)}>
              {FT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <div className="fs-field full">
            <label className="gf-auto">
              <span>
                <b>Auto-transfer on payday</b>
                <span className="muted">Move {monthlyNum > 0 ? ftMoney(monthlyNum, 0) : "the monthly amount"} from {linked} on the 1st.</span>
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

Object.assign(window, { CoverOverspendModal, RecurringSection, GoalsPage, GoalModal, useFeatGoals });
