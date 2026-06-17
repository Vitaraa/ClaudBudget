/* ============================================================
   Claud — Foresight tab
   A "what-if" canvas for your financial future. Add life events
   as plans; the projection bends your net-worth line (green in
   the black, red underwater). A year-by-year budget table shows
   the same story as numbers — plan-driven rows locked, the rest
   editable. The two stay in sync, and any plan's dot can be
   dragged earlier/later in time to feel the trade-off.

   Self-contained: fs*-prefixed identifiers, uses the DS bundle
   directly, exposes ForesightPage on window for app.jsx.
   ============================================================ */
const FS = window.ClaudDesignSystem_de602a || {};
const { useState: fsUseState, useMemo: fsUseMemo, useRef: fsUseRef, useEffect: fsUseEffect } = React;

/* ---------------------------------- format ---- */
const FS_MINUS = "\u2212";
const fsMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? FS_MINUS : "") + "$" + s;
};
const fsK = (v) => {
  const a = Math.abs(v);
  const sign = v < 0 ? FS_MINUS : "";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(a % 1e6 === 0 ? 0 : 1) + "M";
  if (a >= 1e3) return sign + "$" + Math.round(a / 1e3) + "k";
  return sign + "$" + Math.round(a);
};

/* ---------------------------------- plan kinds ---- */
/* Bespoke line icons in Claud's iconography (Lucide-style: 24x24, currentColor,
   1.8 stroke, round caps/joins) — replaces the old emoji markers. */
const FS_ICON_PATHS = {
  retirement: (<React.Fragment>
    <path d="M22 12a10.06 10.06 0 0 0-20 0Z" />
    <path d="M12 12v8a2 2 0 0 0 4 0" />
    <path d="M12 2v1" />
  </React.Fragment>),
  house: (<React.Fragment>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </React.Fragment>),
  job: (<React.Fragment>
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </React.Fragment>),
  kids: (<React.Fragment>
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
    <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
  </React.Fragment>),
  pension: (<React.Fragment>
    <line x1="3" x2="21" y1="22" y2="22" />
    <line x1="6" x2="6" y1="18" y2="11" />
    <line x1="10" x2="10" y1="18" y2="11" />
    <line x1="14" x2="14" y1="18" y2="11" />
    <line x1="18" x2="18" y1="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </React.Fragment>),
  income: (<React.Fragment>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </React.Fragment>),
  expense: (<React.Fragment>
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
    <polyline points="16 17 22 17 22 11" />
  </React.Fragment>)
};
function FsIcon({ kind, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block" }} aria-hidden="true">
      {FS_ICON_PATHS[kind] || FS_ICON_PATHS.income}
    </svg>
  );
}
const FS_KINDS = [
  { key: "retirement", label: "Retirement" },
  { key: "house", label: "House purchase" },
  { key: "job", label: "New job / income change" },
  { key: "kids", label: "Having kids" },
  { key: "pension", label: "Pension" },
  { key: "income", label: "Extra income" },
  { key: "expense", label: "Extra expense" }
];

/* ---------------------------------- the persona's today ---- */
const FS_NOW = 2026;
const FS_AGE = 32;
const FS_LIFE = 90;
const FS_HORIZON = FS_NOW + (FS_LIFE - FS_AGE);     // 2084
const FS_TABLE_END = FS_NOW + 24;                   // editable window → 2050
// Budget figures are held in today's dollars (flat, not inflated), so the line
// compounds at a REAL return — growth after inflation — keeping every figure
// on the page in today's purchasing power.
const FS_RETURN = 4.5;                              // real % / yr on invested balances

const FS_START_NW = 185381;

// Base annual budget (what hits the accounts today). Income rows are take-home.
const FS_INCOME_BASE = [
  { cat: "Salary", amt: 72000 },
  { cat: "Side income", amt: 6000 }
];
const FS_EXPENSE_BASE = [
  { cat: "Housing", amt: 19800 },
  { cat: "Food & dining", amt: 12000 },
  { cat: "Transport", amt: 3000 },
  { cat: "Lifestyle", amt: 8400 },
  { cat: "Utilities", amt: 3700 },
  { cat: "Health & insurance", amt: 4200 }
];

/* The projected-budget table's expense rows are derived from the live Budget tab.
   Each monthly budget category maps onto one of Foresight's annual expense rows
   (× 12). Savings-goal categories are excluded — money set aside stays in net
   worth, so it isn't a projection expense. Unmapped (custom) categories fall
   into Lifestyle. If the Budget tab has never been opened, the static base above
   is used as a sensible default. */
const FS_EXPENSE_ORDER = ["Housing", "Food & dining", "Transport", "Lifestyle", "Utilities", "Health & insurance"];
const FS_BUDGET_MAP = {
  "Housing": "Housing",
  "Groceries": "Food & dining",
  "Dining": "Food & dining",
  "Transport": "Transport",
  "Utilities": "Utilities",
  "Insurance": "Health & insurance",
  "Health & fitness": "Health & insurance",
  "Shopping": "Lifestyle",
  "Entertainment": "Lifestyle",
  "Subscriptions": "Lifestyle",
  "Misc": "Lifestyle"
};
function fsExpenseBaseFromBudgets(groups) {
  if (!groups || !groups.length) return FS_EXPENSE_BASE;
  const totals = {};
  FS_EXPENSE_ORDER.forEach((c) => { totals[c] = 0; });
  groups.forEach((g) => {
    if (g.label === "Savings goals") return; // saved, not spent
    g.cats.forEach((c) => {
      const target = FS_BUDGET_MAP[c.name] || "Lifestyle";
      totals[target] = (totals[target] || 0) + (Number(c.budget) || 0) * 12;
    });
  });
  return FS_EXPENSE_ORDER.map((cat) => ({ cat, amt: Math.round(totals[cat] || 0) }));
}

const FS_DEFAULT_PLANS = [
  { id: "p1", kind: "job", name: "Senior role", year: 2028, amount: 96000 },
  { id: "p2", kind: "house", name: "First home", year: 2031, amount: 540000, down: 108000, rate: 5.8, term: 25 },
  { id: "p3", kind: "kids", name: "Child", year: 2032, amount: 14000, end: 2051 },
  { id: "p4", kind: "pension", name: "Social Security", year: 2057, amount: 21000 },
  { id: "p5", kind: "retirement", name: "Retire", year: 2057, amount: 0, ret: 4.5 }
];

/* ---------------------------------- math ---- */
const fsMortgage = (principal, ratePct, termYears) => {
  const P = Math.max(0, principal);
  const r = (ratePct || 0) / 100 / 12;
  const n = Math.max(1, Math.round((termYears || 25) * 12));
  if (r === 0) return P / n;
  return P * r / (1 - Math.pow(1 + r, -n));
};

/* Build the projected-budget rows. Plans map onto rows automatically and lock
   the cells they drive; everything else takes a manual override or the base. */
function fsBuildModel(plans, overrides, years, expenseBase) {
  const expBase = expenseBase || FS_EXPENSE_BASE;
  const retire = plans.find((p) => p.kind === "retirement") || null;
  const retireY = retire ? retire.year : null;
  const job = plans.find((p) => p.kind === "job") || null;
  const house = plans.find((p) => p.kind === "house") || null;

  const ov = (cat, y) => {
    let best = -Infinity, val = null;
    for (const o of overrides) if (o.cat === cat && o.year <= y && o.year > best) { best = o.year; val = o.amt; }
    return val;
  };

  // ---- income rows ----
  const incomeRows = [];
  FS_INCOME_BASE.forEach((b) => {
    const cells = years.map((y) => {
      if (b.cat === "Salary") {
        if (retireY && y >= retireY) return { year: y, value: 0, locked: true };
        if (job && y >= job.year) return { year: y, value: job.amount, locked: true };
      }
      const o = ov(b.cat, y);
      return { year: y, value: o != null ? o : b.amt, locked: false, edited: o != null };
    });
    incomeRows.push({ cat: b.cat, cells });
  });
  plans.filter((p) => p.kind === "pension").forEach((p) => {
    incomeRows.push({ cat: p.name || "Pension", cells: years.map((y) => ({ year: y, value: y >= p.year ? p.amount : 0, locked: true })) });
  });
  plans.filter((p) => p.kind === "income").forEach((p) => {
    const eY = p.end || p.year;
    incomeRows.push({ cat: p.name || "Income", cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
  });

  // ---- expense rows ----
  const houseAnnual = (y) => {
    if (!house || y < house.year) return null;
    const loan = house.amount - (house.down != null ? house.down : house.amount * 0.2);
    return y < house.year + (house.term || 25) ? Math.round(fsMortgage(loan, house.rate || 5.8, house.term || 25) * 12) : 0;
  };
  const expenseRows = [];
  expBase.forEach((b) => {
    const cells = years.map((y) => {
      if (b.cat === "Housing") {
        const h = houseAnnual(y);
        if (h != null) return { year: y, value: h, locked: true };
      }
      const o = ov(b.cat, y);
      return { year: y, value: o != null ? o : b.amt, locked: false, edited: o != null };
    });
    expenseRows.push({ cat: b.cat, cells });
  });
  plans.filter((p) => p.kind === "kids").forEach((p) => {
    const eY = p.end || p.year;
    expenseRows.push({ cat: p.name || "Child", cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
  });
  plans.filter((p) => p.kind === "expense").forEach((p) => {
    const eY = p.end || p.year;
    expenseRows.push({ cat: p.name || "Expense", cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
  });

  const totals = years.map((y, i) => {
    const income = incomeRows.reduce((s, r) => s + r.cells[i].value, 0);
    const expense = expenseRows.reduce((s, r) => s + r.cells[i].value, 0);
    return { year: y, income, expense, net: income - expense };
  });
  return { incomeRows, expenseRows, totals, retireY };
}

/* Walk the net-worth line month by month. Cash flow = each year's budget net.
   Houses: down payment leaves liquid; the home appreciates and its equity is
   added back; the mortgage already lives in the budget's Housing row. Positive
   balances compound at FS_RETURN; debt does not. */
function fsSimulate(model, plans, years) {
  const retire = plans.find((p) => p.kind === "retirement");
  const rInv = ((retire && retire.ret != null && retire.ret !== "" ? Number(retire.ret) : FS_RETURN)) / 100 / 12;
  let liquid = FS_START_NW;
  const homes = [];
  const byYear = {};
  years.forEach((y, i) => { byYear[y] = model.totals[i]; });
  const housesAt = {};
  plans.filter((p) => p.kind === "house").forEach((p) => { (housesAt[p.year] ||= []).push(p); });

  const series = [{ year: years[0], value: Math.round(liquid) }];
  for (let k = 1; k < years.length; k++) {
    const y = years[k];
    (housesAt[y] || []).forEach((h) => {
      const down = h.down != null ? h.down : h.amount * 0.2;
      liquid -= down;
      const loan = Math.max(0, h.amount - down);
      homes.push({ value: h.amount, mortgage: loan, payment: fsMortgage(loan, h.rate || 5.8, h.term || 25), rate: (h.rate || 5.8) / 100, apprM: 0.03 / 12 });
    });
    const net = byYear[y] ? byYear[y].net : 0;
    for (let m = 0; m < 12; m++) {
      if (liquid > 0) liquid += liquid * rInv;
      liquid += net / 12;
      homes.forEach((h) => {
        h.value *= (1 + h.apprM);
        const interest = h.mortgage * (h.rate / 12);
        h.mortgage = Math.max(0, h.mortgage - Math.max(0, h.payment - interest));
      });
    }
    const equity = homes.reduce((s, h) => s + (h.value - h.mortgage), 0);
    series.push({ year: y, value: Math.round(liquid + equity) });
  }
  return series;
}

/* ============================================================
   PROJECTION CHART — single line, green above 0 / red below,
   with draggable plan markers.
   ============================================================ */
function FsChart({ series, markers, onDragYear, onCommit, onClickMarker }) {
  const W = 940, H = 320, padL = 60, padR = 22, padT = 22, padB = 30;
  const wrapRef = fsUseRef(null);
  const dragRef = fsUseRef(null);
  const [hover, setHover] = fsUseState(null);

  const yMin = series[0].year, yMax = series[series.length - 1].year;
  const vals = series.map((p) => p.value);
  let vMax = Math.max(...vals, 0), vMin = Math.min(...vals, 0);
  const vpad = (vMax - vMin) * 0.08 || 1;
  vMax += vpad; vMin -= vpad;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xOf = (yr) => padL + (yr - yMin) / (yMax - yMin) * innerW;
  const yOf = (v) => padT + innerH - (v - vMin) / (vMax - vMin) * innerH;
  const yearAtX = (px) => Math.round(yMin + (px - padL) / innerW * (yMax - yMin));

  const pts = series.map((p) => [xOf(p.year), yOf(p.value)]);
  const path = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const zeroPx = yOf(0);
  const splitOff = Math.max(0, Math.min(1, (zeroPx - padT) / innerH));

  // y gridlines
  const yTicks = [vMax, (vMax + vMin) / 2 > vMin && (vMax + vMin) / 2 < vMax ? (vMax + vMin) / 2 : 0, vMin];
  const tickSet = Array.from(new Set([vMax, vMin, 0, (vMax + vMin) / 2])).filter((t) => t >= vMin && t <= vMax).sort((a, b) => b - a);

  // x labels — ~6 across
  const xStep = Math.max(1, Math.round((yMax - yMin) / 6));
  const xLabels = [];
  for (let y = yMin; y <= yMax; y += xStep) xLabels.push(y);
  if (xLabels[xLabels.length - 1] !== yMax) xLabels.push(yMax);

  const valueAt = (yr) => {
    let v = series[0].value;
    for (const p of series) { if (p.year <= yr) v = p.value; else break; }
    return v;
  };

  function pointerYear(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    return { px, year: Math.max(yMin, Math.min(yMax, yearAtX(px))) };
  }
  function onMove(e) {
    const { px, year } = pointerYear(e);
    if (dragRef.current) {
      if (year !== dragRef.current.year) { dragRef.current = { ...dragRef.current, year, moved: true }; onDragYear(dragRef.current.id, year); }
      return;
    }
    // nearest series index for hover tooltip
    let best = 0, bd = Infinity;
    series.forEach((p, i) => { const d = Math.abs(xOf(p.year) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }
  function endDrag() {
    if (dragRef.current) {
      const d = dragRef.current; dragRef.current = null;
      if (d.moved) onCommit(); else onClickMarker(d.id);
    }
  }
  const hp = hover != null ? series[hover] : null;

  return (
    <div className="fs-chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net-worth projection"
        onMouseMove={onMove} onMouseLeave={() => { setHover(null); endDrag(); }} onMouseUp={endDrag}>
        <defs>
          <linearGradient id="fsLineGrad" x1="0" y1={padT} x2="0" y2={padT + innerH} gradientUnits="userSpaceOnUse">
            <stop offset={splitOff} stopColor="var(--accent)" />
            <stop offset={splitOff} stopColor="var(--red)" />
          </linearGradient>
        </defs>
        {tickSet.map((t, i) =>
          <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.4 : 1} strokeDasharray={t === 0 ? "none" : "2 5"} />
            <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{fsK(t)}</text>
          </g>
        )}
        {xLabels.map((y, i) =>
          <text key={i} x={xOf(y)} y={H - 8} textAnchor={i === 0 ? "start" : y === yMax ? "end" : "middle"} fontSize="11" fill="var(--muted)">{y}</text>
        )}
        <path d={path} fill="none" stroke="url(#fsLineGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {hp &&
          <g>
            <line x1={xOf(hp.year)} y1={padT - 4} x2={xOf(hp.year)} y2={padT + innerH} stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={xOf(hp.year)} cy={yOf(hp.value)} r="4" fill="var(--card)" stroke={hp.value < 0 ? "var(--red)" : "var(--accent)"} strokeWidth="2.4" />
          </g>
        }
        {markers.map((m) => {
          const cx = xOf(m.year), cy = yOf(valueAt(m.year));
          return (
            <g key={m.id} className="fs-marker"
              onMouseDown={() => { dragRef.current = { id: m.id, year: m.year, moved: false }; }}>
              <circle cx={cx} cy={cy} r="13" fill="var(--card)" stroke={m.color} strokeWidth="2.4" />
              <g transform={`translate(${cx - 6.5} ${cy - 6.5}) scale(0.5417)`}
                fill="none" stroke={m.color} strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
                {FS_ICON_PATHS[m.kind] || FS_ICON_PATHS.income}
              </g>
            </g>);
        })}
      </svg>
      {hp &&
        <div className="fs-tip" style={{ left: `${xOf(hp.year) / W * 100}%`, top: `${yOf(hp.value) / H * 100}%` }}>
          <div className="fst-d">{hp.year} · age {FS_AGE + (hp.year - FS_NOW)}</div>
          <div className="fst-v" style={{ color: hp.value < 0 ? "var(--red)" : "var(--text)" }}>{fsMoney(hp.value)}</div>
        </div>
      }
    </div>);
}

/* ============================================================
   PLAN MODAL — create / edit one life event
   ============================================================ */
const FS_BLANK = (kind) => ({
  retirement: { name: "Retirement", year: FS_NOW + 30, amount: 0, ret: 4.5 },
  house: { name: "Home", year: FS_NOW + 5, amount: 500000, down: 100000, rate: 5.8, term: 25 },
  job: { name: "New job", year: FS_NOW + 1, amount: 90000 },
  kids: { name: "Child", year: FS_NOW + 1, amount: 14000, end: FS_NOW + 19 },
  pension: { name: "Pension", year: FS_NOW + 30, amount: 18000 },
  income: { name: "Extra income", year: FS_NOW + 1, amount: 10000, end: FS_NOW + 5 },
  expense: { name: "Extra expense", year: FS_NOW + 1, amount: 8000, end: FS_NOW + 3 }
}[kind]);

function FsModal({ draft, isNew, onField, onSave, onDelete, onClose }) {
  const { Button } = FS;
  const k = draft.kind;
  const num = (field) => (e) => onField(field, e.target.value === "" ? "" : Number(e.target.value));
  const Field = ({ label, field, full, step }) => (
    <label className={"fs-field" + (full ? " full" : "")}>
      <span>{label}</span>
      <input type="number" step={step || "1"} value={draft[field] ?? ""} onChange={num(field)} />
    </label>
  );

  return (
    <div className="fs-overlay" onMouseDown={onClose}>
      <section className="fs-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><FsIcon kind={k} size={20} /></span>{isNew ? "New " : "Edit "}{FS_KINDS.find((x) => x.key === k)?.label.toLowerCase()}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>
        <div className="fs-grid">
          <label className="fs-field full"><span>Name</span><input value={draft.name || ""} onChange={(e) => onField("name", e.target.value)} /></label>

          {k === "retirement" && <React.Fragment>
            <Field label="Retirement year" field="year" />
            <Field label="Real return % / yr" field="ret" step="0.1" />
          </React.Fragment>}

          {k === "house" && <React.Fragment>
            <Field label="Home price" field="amount" />
            <Field label="Purchase year" field="year" />
            <Field label="Down payment" field="down" />
            <Field label="Mortgage rate %" field="rate" step="0.1" />
            <Field label="Term (years)" field="term" />
          </React.Fragment>}

          {k === "job" && <React.Fragment>
            <Field label="Take-home / yr" field="amount" />
            <Field label="Start year" field="year" />
          </React.Fragment>}

          {k === "kids" && <React.Fragment>
            <Field label="Cost / yr" field="amount" />
            <Field label="Start year" field="year" />
            <Field label="Support until" field="end" />
          </React.Fragment>}

          {k === "pension" && <React.Fragment>
            <Field label="Income / yr" field="amount" />
            <Field label="Starts in year" field="year" />
          </React.Fragment>}

          {(k === "income" || k === "expense") && <React.Fragment>
            <Field label="Amount / yr" field="amount" />
            <Field label="Start year" field="year" />
            <Field label="End year" field="end" />
          </React.Fragment>}
        </div>
        <div className="fs-modal-foot">
          {!isNew && Button && <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>}
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={onSave}>{isNew ? "Create plan" : "Save"}</Button>}
          </div>
        </div>
      </section>
    </div>);
}

/* ============================================================
   FORESIGHT PAGE
   ============================================================ */
function ForesightPage() {
  const { Card, Button } = FS;
  const [plans, setPlans] = fsUseState(FS_DEFAULT_PLANS);
  const [overrides, setOverrides] = fsUseState([]);
  const [drag, setDrag] = fsUseState(null);     // { id, year } live override while dragging
  const [modal, setModal] = fsUseState(null);   // { draft, isNew }
  const [menu, setMenu] = fsUseState(false);

  // live budget categories from the Budget tab → drives the expense rows below.
  const [budgetGroups, setBudgetGroups] = fsUseState(
    () => (window.__claudBudgetStore ? window.__claudBudgetStore.get() : null));
  fsUseEffect(() => {
    const store = window.__claudBudgetStore;
    if (!store) return;
    const update = () => setBudgetGroups(store.get());
    update();
    return store.subscribe(update);
  }, []);
  const expenseBase = fsUseMemo(() => fsExpenseBaseFromBudgets(budgetGroups), [budgetGroups]);
  const budgetLinked = !!(budgetGroups && budgetGroups.length);

  // plans with the live drag year applied, so the whole projection moves with the dot
  const livePlans = fsUseMemo(
    () => drag ? plans.map((p) => (p.id === drag.id ? { ...p, year: drag.year } : p)) : plans,
    [plans, drag]);

  const horizonYears = fsUseMemo(() => {
    const end = Math.max(FS_HORIZON, ...livePlans.map((p) => p.year || 0));
    const out = []; for (let y = FS_NOW; y <= end; y++) out.push(y); return out;
  }, [livePlans]);
  const tableYears = fsUseMemo(() => horizonYears.filter((y) => y <= FS_TABLE_END), [horizonYears]);

  const model = fsUseMemo(() => fsBuildModel(livePlans, overrides, horizonYears, expenseBase), [livePlans, overrides, horizonYears, expenseBase]);
  const tableModel = fsUseMemo(() => fsBuildModel(livePlans, overrides, tableYears, expenseBase), [livePlans, overrides, tableYears, expenseBase]);
  const series = fsUseMemo(() => fsSimulate(model, livePlans, horizonYears), [model, livePlans, horizonYears]);

  const valueAt = (yr) => { let v = series[0].value; for (const p of series) { if (p.year <= yr) v = p.value; else break; } return v; };
  const markers = livePlans.map((p) => {
    // All plan markers share the brand accent — retirement included, so it
    // reads as one consistent set rather than a green/red outlier.
    return { id: p.id, kind: p.kind, year: p.year, color: "var(--accent)" };
  });

  const latest = series[series.length - 1].value;
  const peak = Math.max(...series.map((s) => s.value));
  const retire = plans.find((p) => p.kind === "retirement");
  const runOut = retire ? (series.find((d) => d.year > retire.year && d.value < 0)?.year ?? null) : null;
  const retireValue = retire ? valueAt(retire.year) : null;

  // ---- plan edit/create helpers ----
  function openNew(kind) { setMenu(false); setModal({ draft: { id: "p" + Date.now(), kind, ...FS_BLANK(kind) }, isNew: true }); }
  function openEdit(id) { const p = plans.find((x) => x.id === id); if (p) setModal({ draft: { ...p }, isNew: false }); }
  function modalField(field, value) { setModal((m) => ({ ...m, draft: { ...m.draft, [field]: value } })); }
  function saveModal() {
    const d = modal.draft;
    setPlans((ps) => modal.isNew ? [...ps, d] : ps.map((p) => (p.id === d.id ? d : p)));
    setModal(null);
  }
  function deleteModal() { setPlans((ps) => ps.filter((p) => p.id !== modal.draft.id)); setModal(null); }

  // ---- drag wiring ----
  function dragYear(id, year) { setDrag({ id, year }); }
  function commitDrag() { if (drag) { setPlans((ps) => ps.map((p) => (p.id === drag.id ? { ...p, year: drag.year } : p))); setDrag(null); } }

  // ---- budget cell override ----
  function setCell(cat, year, raw) {
    const amt = Math.max(0, Math.round(Number(raw) || 0));
    setOverrides((os) => [...os.filter((o) => !(o.cat === cat && o.year === year)), { cat, year, amt }]);
  }

  const sortedMarkers = [...livePlans].sort((a, b) => a.year - b.year);
  const planSub = (p) => {
    if (p.kind === "retirement") return `stop working in ${p.year}, age ${FS_AGE + (p.year - FS_NOW)}`;
    if (p.kind === "house") return `${fsMoney(p.amount)} home in ${p.year}`;
    if (p.kind === "job") return `${fsMoney(p.amount)}/yr take-home from ${p.year}`;
    if (p.kind === "kids") return `${fsMoney(p.amount)}/yr, ${p.year}\u2013${p.end || p.year}`;
    if (p.kind === "pension") return `${fsMoney(p.amount)}/yr from ${p.year}`;
    return `${fsMoney(p.amount)}/yr, ${p.year}\u2013${p.end || p.year}`;
  };

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Net worth today</span>
          <span className="kpi-val">{fsMoney(FS_START_NW)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>age {FS_AGE} · {plans.length} plans active</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Projected · {FS_HORIZON}</span>
          <span className="kpi-val" style={{ color: latest < 0 ? "var(--red)" : "var(--text)" }}>{fsMoney(latest)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>at age {FS_LIFE}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">At retirement{retire ? ` · ${retire.year}` : ""}</span>
          <span className="kpi-val">{retire ? fsMoney(retireValue) : fsMoney(peak)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{retire ? `the pot you stop working with` : "no retirement plan yet"}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Retirement</span>
          <span className="kpi-val" style={{ color: runOut ? "var(--red)" : "var(--green)" }}>{runOut ? `Runs dry ${runOut}` : "On track"}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{retire ? (runOut ? "savings dip below zero" : `lasts through ${FS_HORIZON}`) : "add a retirement plan"}</span>
        </div></Card>
      </div>

      {/* Chart */}
      <Card widget>
        <div className="cf-hero-head">
          <div>
            <span className="widget-eyebrow">Net worth · all plans</span>
            <div className="fs-chart-headline">
              <span className="fs-chart-val" style={{ color: latest < 0 ? "var(--red)" : "var(--text)" }}>{fsMoney(latest)}</span>
              <span className="fs-chart-unit">projected by {FS_HORIZON}</span>
            </div>
            <div className="fs-hint">{"\u2195\uFE0E"} Drag any dot left or right to change its year · click it to edit</div>
          </div>
          <div className="cf-hero-right">
            <div className="fs-dd">
              {Button && <Button variant="primary" size="sm" onClick={() => setMenu((v) => !v)}>+ New plan {"\u25BE"}</Button>}
              {menu &&
                <div className="fs-dd-menu" onMouseLeave={() => setMenu(false)}>
                  {FS_KINDS.map((x) =>
                    <button key={x.key} className="fs-dd-item" onClick={() => openNew(x.key)}>
                      <span className="fs-ico"><FsIcon kind={x.key} size={17} /></span>{x.label}
                    </button>
                  )}
                </div>
              }
            </div>
          </div>
        </div>

        <FsChart series={series} markers={markers}
          onDragYear={dragYear} onCommit={commitDrag} onClickMarker={openEdit} />

        <ul className="fs-legend">
          {sortedMarkers.map((p) =>
            <li key={p.id} className="fs-leg" onClick={() => openEdit(p.id)} title="Edit plan">
              <span className="fs-ico"><FsIcon kind={p.kind} size={16} /></span>
              <b>{p.name}</b>
              <span className="fs-leg-sub">{"\u2014"} {planSub(p)}</span>
              <span className="fs-leg-edit">Edit {"\u203A"}</span>
            </li>
          )}
          {runOut &&
            <li className="fs-runout">
              <span className="fs-ico">{"\u26A0"}</span>
              <span><b className="neg" style={{ color: "var(--red)" }}>Savings run out in {runOut}</b><span className="muted"> {"\u2014"} after retirement, spending draws the balance below zero. Try retiring later or trimming a category.</span></span>
            </li>
          }
        </ul>
      </Card>

      {/* Projected budget table */}
      <Card widget>
        <div className="widget-head">
          <div>
            <span className="widget-title">Projected budget by year</span>
            <div className="fs-hint" style={{ marginTop: 4 }}>Annual $. {budgetLinked ? <React.Fragment>Expense rows follow your <b style={{ color: "var(--text)", fontWeight: 600 }}>Budget tab</b> (×12) {"\u00B7"} </React.Fragment> : null}tweak any cell to rebalance the line {"\u00B7"} {"\uD83D\uDD12"} cells are set by a plan {"\u2014"} edit the plan to change those.</div>
          </div>
        </div>
        <div className="fs-table-wrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th className="fs-row-head">Category</th>
                {tableYears.map((y, i) =>
                  <th key={y} className={tableModel.totals[i].net < 0 ? "neg" : ""}>{y}</th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="fs-section"><td className="fs-row-head">Income</td>{tableYears.map((y) => <td key={y} />)}</tr>
              {tableModel.incomeRows.map((row) =>
                <tr key={"i-" + row.cat}>
                  <td className="fs-row-head">{row.cat}</td>
                  {row.cells.map((c) =>
                    <td key={c.year}>
                      {c.locked
                        ? <span className="fs-cell-locked">{fsMoney(c.value)}<span className="lk">{"\uD83D\uDD12"}</span></span>
                        : <input type="number" className={"fs-cell-input" + (c.edited ? " edited" : "")} defaultValue={c.value} key={row.cat + c.year + c.value} onBlur={(e) => setCell(row.cat, c.year, e.target.value)} />}
                    </td>
                  )}
                </tr>
              )}
              <tr className="fs-subtotal"><td className="fs-row-head">Total income</td>{tableModel.totals.map((t) => <td key={t.year}>{fsMoney(t.income)}</td>)}</tr>

              <tr className="fs-section"><td className="fs-row-head">Expense</td>{tableYears.map((y) => <td key={y} />)}</tr>
              {tableModel.expenseRows.map((row) =>
                <tr key={"e-" + row.cat}>
                  <td className="fs-row-head">{row.cat}</td>
                  {row.cells.map((c) =>
                    <td key={c.year}>
                      {c.locked
                        ? <span className="fs-cell-locked">{fsMoney(c.value)}<span className="lk">{"\uD83D\uDD12"}</span></span>
                        : <input type="number" className={"fs-cell-input" + (c.edited ? " edited" : "")} defaultValue={c.value} key={row.cat + c.year + c.value} onBlur={(e) => setCell(row.cat, c.year, e.target.value)} />}
                    </td>
                  )}
                </tr>
              )}
              <tr className="fs-subtotal"><td className="fs-row-head">Total expense</td>{tableModel.totals.map((t) => <td key={t.year}>{fsMoney(t.expense)}</td>)}</tr>

              <tr className="fs-net"><td className="fs-row-head">Net / yr</td>{tableModel.totals.map((t) => <td key={t.year} className={t.net < 0 ? "neg" : "pos"}>{(t.net >= 0 ? "+" : FS_MINUS) + "$" + Math.abs(t.net).toLocaleString("en-CA")}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Card>

      {modal && <FsModal draft={modal.draft} isNew={modal.isNew} onField={modalField} onSave={saveModal} onDelete={deleteModal} onClose={() => setModal(null)} />}
    </React.Fragment>);
}

window.ForesightPage = ForesightPage;
