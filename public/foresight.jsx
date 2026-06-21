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

/* Mobile fullscreen+rotate wrapper for the projection chart (loaded before this
   file on window). The fallback renders children bare if the global is missing. */
const ChartFullscreen = window.ChartFullscreen || (function (p) { return p.children; });

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

// Income now comes ENTIRELY from the user's Foresight profile (collected by the
// first-run popup) — never fabricated. A brand-new account therefore projects
// $0 income until the profile is filled in. The two income rows are take-home.
// fsIncomeRows turns a profile into the Salary / Side income base used by the
// projected-budget table and the simulation; with no profile it returns [],
// so both income rows render blank/0.
function fsIncomeRows(profile) {
  if (!profile) return [];
  const salary = Math.max(0, Math.round(Number(profile.salary) || 0));
  const side = Math.max(0, Math.round(Number(profile.sideIncome) || 0));
  return [
    { cat: "Salary", amt: salary },
    { cat: "Side income", amt: side }
  ];
}
const FS_EXPENSE_BASE = [
  { cat: "Housing", amt: 19800 },
  { cat: "Food & dining", amt: 12000 },
  { cat: "Transport", amt: 3000 },
  { cat: "Lifestyle", amt: 8400 },
  { cat: "Utilities", amt: 3700 },
  { cat: "Health & insurance", amt: 4200 }
];

/* The projected-budget table's expense rows mirror the live Budget categories
   one-for-one, by name (annual = the monthly budget × 12). So if you only budget
   for Food and Housing, the projection shows exactly those two expense rows.
   The user can hide rows they don't want to project and add custom ones; both
   live in settings (fsHiddenRows / fsExtraRows) so they persist. A brand-new
   user with no categories at all falls back to a sensible static base. */
function fsExpenseRows(cats, hidden, extra) {
  const hide = new Set(hidden || []);
  const rows = [];
  const seen = new Set();
  (cats || []).forEach((c) => {
    if (!c || !c.name || hide.has(c.name) || seen.has(c.name)) return;
    seen.add(c.name);
    rows.push({ cat: c.name, amt: Math.round((Number(c.budget) || 0) * 12) });
  });
  (extra || []).forEach((e) => {
    if (!e || !e.name || hide.has(e.name) || seen.has(e.name)) return;
    seen.add(e.name);
    rows.push({ cat: e.name, amt: Math.round(Number(e.amt) || 0) });
  });
  if (!rows.length) {
    // genuinely nothing yet → static default. If the user hid everything they
    // had, respect that and show an empty expense section.
    if ((!cats || !cats.length) && (!extra || !extra.length)) return FS_EXPENSE_BASE.slice();
    return [];
  }
  return rows;
}

/* Example plans — kept for reference only. The page now starts from the live
   store (ClaudData.foresightPlans), so a new user begins with NO plans. */
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
function fsBuildModel(plans, overrides, years, expenseBase, incomeBase, profileRetireY) {
  const expBase = expenseBase || FS_EXPENSE_BASE;
  // Income rows come from the profile (passed in); no profile → empty income.
  const incBase = incomeBase || [];
  const retire = plans.find((p) => p.kind === "retirement") || null;
  // A retirement PLAN wins; otherwise fall back to the profile's retirement age
  // (translated to a calendar year) so salary still stops at the planned age.
  const retireY = retire ? retire.year : (profileRetireY != null ? profileRetireY : null);
  const job = plans.find((p) => p.kind === "job") || null;
  const house = plans.find((p) => p.kind === "house") || null;

  const ov = (cat, y) => {
    let best = -Infinity, val = null;
    for (const o of overrides) if (o.cat === cat && o.year <= y && o.year > best) { best = o.year; val = (o.amount != null ? o.amount : o.amt); }
    return val;
  };

  // ---- income rows ----
  const incomeRows = [];
  incBase.forEach((b) => {
    const cells = years.map((y) => {
      if (b.cat === "Salary") {
        if (retireY && y >= retireY) return { year: y, value: 0, locked: true };
        if (job && y >= job.year) return { year: y, value: job.amount, locked: true };
      }
      const o = ov(b.cat, y);
      return { year: y, value: o != null ? o : b.amt, locked: false, edited: o != null };
    });
    incomeRows.push({ cat: b.cat, cells, fillable: true, removable: false });
  });
  plans.filter((p) => p.kind === "pension").forEach((p) => {
    incomeRows.push({ cat: p.name || "Pension", planDriven: true, cells: years.map((y) => ({ year: y, value: y >= p.year ? p.amount : 0, locked: true })) });
  });
  plans.filter((p) => p.kind === "income").forEach((p) => {
    const eY = p.end || p.year;
    incomeRows.push({ cat: p.name || "Income", planDriven: true, cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
  });

  // ---- expense rows ----
  const houseAnnual = (y) => {
    if (!house || y < house.year) return null;
    const loan = house.amount - (house.down != null ? house.down : house.amount * 0.2);
    return y < house.year + (house.term || 25) ? Math.round(fsMortgage(loan, house.rate || 5.8, house.term || 25) * 12) : 0;
  };
  const expenseRows = [];
  let hasHousing = false;
  expBase.forEach((b) => {
    if (b.cat === "Housing") hasHousing = true;
    const cells = years.map((y) => {
      if (b.cat === "Housing") {
        const h = houseAnnual(y);
        if (h != null) return { year: y, value: h, locked: true };
      }
      const o = ov(b.cat, y);
      return { year: y, value: o != null ? o : b.amt, locked: false, edited: o != null };
    });
    // Budget-derived (and custom) rows can be edited, range-filled, and removed.
    expenseRows.push({ cat: b.cat, cells, fillable: true, removable: true });
  });
  // A house plan with no "Housing" budget category still needs its mortgage to
  // show up — add a dedicated, plan-driven Housing row in that case.
  if (house && !hasHousing) {
    expenseRows.push({ cat: "Housing", planDriven: true, cells: years.map((y) => {
      const h = houseAnnual(y);
      return h != null ? { year: y, value: h, locked: true } : { year: y, value: 0, locked: true };
    }) });
  }
  plans.filter((p) => p.kind === "kids").forEach((p) => {
    const eY = p.end || p.year;
    expenseRows.push({ cat: p.name || "Child", planDriven: true, cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
  });
  plans.filter((p) => p.kind === "expense").forEach((p) => {
    const eY = p.end || p.year;
    expenseRows.push({ cat: p.name || "Expense", planDriven: true, cells: years.map((y) => ({ year: y, value: y >= p.year && y <= eY ? p.amount : 0, locked: true })) });
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
function fsSimulate(model, plans, years, startNW) {
  const retire = plans.find((p) => p.kind === "retirement");
  const rInv = ((retire && retire.ret != null && retire.ret !== "" ? Number(retire.ret) : FS_RETURN)) / 100 / 12;
  let liquid = (startNW != null ? startNW : FS_START_NW);
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
function FsChart({ series, markers, onDragYear, onCommit, onClickMarker, age }) {
  const fsAge = age != null ? age : FS_AGE;
  const W = 940, H = 320, padL = 60, padR = 22, padT = 22, padB = 30;
  const wrapRef = fsUseRef(null);
  const svgRef = fsUseRef(null);
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

  // clientX (viewport px) -> nearest year, clamped to the chart's domain.
  function clientToYear(clientX) {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (!r.width) return null;
    const px = (clientX - r.left) / r.width * W;
    return Math.max(yMin, Math.min(yMax, yearAtX(px)));
  }

  // Hover crosshair only — the drag itself is handled by document-level pointer
  // listeners (see startDrag) so it keeps working when the pointer leaves the SVG.
  function onHover(e) {
    if (dragRef.current) return;            // mid-drag: ignore hover
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    series.forEach((p, i) => { const d = Math.abs(xOf(p.year) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  // Begin dragging a plan marker. Pointer events + capture make this robust:
  // it survives the pointer leaving the SVG, never starts a native element/text
  // drag (which is what surfaced the "<host> not found" navigation error), and
  // always commits or clears on release.
  function startDrag(e, m) {
    if (e.button != null && e.button !== 0) return;   // left button / touch only
    e.preventDefault();
    e.stopPropagation();
    setHover(null);
    dragRef.current = { id: m.id, year: m.year, moved: false };

    const move = (ev) => {
      if (!dragRef.current) return;
      const cx = ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
      if (cx == null) return;
      const year = clientToYear(cx);
      if (year != null && year !== dragRef.current.year) {
        dragRef.current.year = year;
        dragRef.current.moved = true;
        onDragYear(dragRef.current.id, year);
      }
      if (ev.cancelable) ev.preventDefault();
    };
    const end = () => {
      const d = dragRef.current;
      dragRef.current = null;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      if (!d) return;
      if (d.moved) onCommit(d.id, d.year); else onClickMarker(d.id);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  }
  const hp = hover != null ? series[hover] : null;

  return (
    <div className="fs-chart-wrap" ref={wrapRef}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net-worth projection"
        onMouseMove={onHover} onMouseLeave={() => setHover(null)}
        onDragStart={(e) => e.preventDefault()} style={{ touchAction: "none" }}>
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
            <g key={m.id} className="fs-marker" draggable={false}
              onPointerDown={(e) => startDrag(e, m)} onDragStart={(e) => e.preventDefault()}>
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
          <div className="fst-d">{hp.year} · age {fsAge + (hp.year - FS_NOW)}</div>
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
  const num = (name) => (e) => onField(name, e.target.value === "" ? "" : Number(e.target.value));
  // `field` is a plain render helper, invoked as {field(...)} — deliberately NOT
  // a component used as <Field/>. A component defined inside render gets a brand
  // new identity on every render, so React unmounts and remounts its <input> on
  // each keystroke; that dropped focus after a single character and made the
  // year (and every numeric field) impossible to type. Inlining the elements via
  // a function call keeps the same <input> mounted across re-renders.
  const field = (label, name, opts) => {
    opts = opts || {};
    return (
      <label key={name} className={"fs-field" + (opts.full ? " full" : "")}>
        <span>{label}</span>
        <input type="number" step={opts.step || "1"} value={draft[name] ?? ""} onChange={num(name)} />
      </label>
    );
  };

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
            {field("Retirement year", "year")}
            {field("Real return % / yr", "ret", { step: "0.1" })}
          </React.Fragment>}

          {k === "house" && <React.Fragment>
            {field("Home price", "amount")}
            {field("Purchase year", "year")}
            {field("Down payment", "down")}
            {field("Mortgage rate %", "rate", { step: "0.1" })}
            {field("Term (years)", "term")}
          </React.Fragment>}

          {k === "job" && <React.Fragment>
            {field("Take-home / yr", "amount")}
            {field("Start year", "year")}
          </React.Fragment>}

          {k === "kids" && <React.Fragment>
            {field("Cost / yr", "amount")}
            {field("Start year", "year")}
            {field("Support until", "end")}
          </React.Fragment>}

          {k === "pension" && <React.Fragment>
            {field("Income / yr", "amount")}
            {field("Starts in year", "year")}
          </React.Fragment>}

          {(k === "income" || k === "expense") && <React.Fragment>
            {field("Amount / yr", "amount")}
            {field("Start year", "year")}
            {field("End year", "end")}
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
   GET-STARTED PANEL — shown when the user has NO plans yet.
   Replaces the demo projection (KPIs + chart + budget table) with a
   friendly intro and a CTA that opens this page's OWN add-plan flow
   (the same FS_KINDS picker the toolbar "+ New plan" button uses).
   Income comes from the profile popup (empty until set); expenses
   come from the live Budget. So nothing here is fabricated.
   ============================================================ */
function FsGetStarted({ onPick }) {
  const { Card, Button } = FS;
  const [menu, setMenu] = fsUseState(false);
  return (
    <Card widget>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        gap: 16, padding: "44px 24px", maxWidth: 480, margin: "0 auto" }}>
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, borderRadius: "var(--radius)", background: "var(--accent-soft)", color: "var(--accent)" }}>
          <FsIcon kind="retirement" size={26} />
        </span>
        <div>
          <div style={{ fontSize: "var(--text-h2)", fontWeight: 700, letterSpacing: "var(--tracking-tight)" }}>Map out your financial future</div>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", lineHeight: 1.55, margin: "10px 0 0" }}>
            Add life events — a house, a new job, kids, retirement — and watch each one
            bend your projected net worth. Drag any event in time to feel the trade-off.
          </p>
        </div>
        <div className="fs-dd" style={{ position: "relative" }}>
          {Button && <Button variant="primary" onClick={() => setMenu((v) => !v)}>Add your first life event {"▾"}</Button>}
          {menu &&
            <div className="fs-dd-menu" onMouseLeave={() => setMenu(false)}>
              {FS_KINDS.map((x) =>
                <button key={x.key} className="fs-dd-item" onClick={() => { setMenu(false); onPick(x.key); }}>
                  <span className="fs-ico"><FsIcon kind={x.key} size={17} /></span>{x.label}
                </button>
              )}
            </div>
          }
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   FORESIGHT PAGE
   ============================================================ */
function ForesightPage() {
  const { Card, Button } = FS;
  const data = useClaudData();                  // re-render when the live store changes
  // Plans + overrides + starting net worth all come from the live store. A
  // brand-new user has NO plans (blank slate) — the chart then just projects
  // the base trajectory. ClaudData arrays are stable references mutated in
  // place on refresh, so reading them directly here is safe.
  const plans = data.foresightPlans || [];
  const overrides = data.foresightOverrides || [];
  const startNW = Number(data.foresightStartNetWorth) || 0;

  const [drag, setDrag] = fsUseState(null);     // { id, year } live override while dragging
  const [modal, setModal] = fsUseState(null);   // { draft, isNew }
  const [menu, setMenu] = fsUseState(false);
  const [rangeRow, setRangeRow] = fsUseState(null);   // { cat } → range-fill modal
  const [addRowOpen, setAddRowOpen] = fsUseState(false);
  // First-run onboarding popup (collects age / income / retirement / lifespan).
  const [fsOnboard, setFsOnboard] = fsUseState(false);

  // Expense rows mirror the live Budget categories one-for-one (monthly × 12).
  // dashCategories is the server-derived, blank-slate-correct source. Per-user
  // customizations (rows hidden from / added to the projection) live in settings.
  const budgetCats = data.dashCategories || [];
  const settings = data.settings || {};
  const hiddenRows = Array.isArray(settings.fsHiddenRows) ? settings.fsHiddenRows : [];
  const extraRows = Array.isArray(settings.fsExtraRows) ? settings.fsExtraRows : [];
  const expenseBase = fsUseMemo(() => fsExpenseRows(budgetCats, hiddenRows, extraRows), [budgetCats, hiddenRows, extraRows]);
  const budgetLinked = !!(budgetCats && budgetCats.length);

  // ---- Foresight profile (the first-run popup writes this) ----
  // settings.foresightProfile = { age, salary, sideIncome, retireAge, lifeExpectancy }.
  // No profile yet → income rows are EMPTY (no fabricated Salary/Side income) and
  // age/lifespan fall back to the page defaults so the chart still has an axis.
  const fsProfile = (settings.foresightProfile && typeof settings.foresightProfile === "object") ? settings.foresightProfile : null;
  const fsOnboarded = !!settings.foresightOnboarded;
  const fsAge = fsProfile && Number(fsProfile.age) > 0 ? Math.round(Number(fsProfile.age)) : FS_AGE;
  const fsLife = fsProfile && Number(fsProfile.lifeExpectancy) > 0 ? Math.round(Number(fsProfile.lifeExpectancy)) : FS_LIFE;
  // Horizon = the year the user reaches their life expectancy (min one year out).
  const fsHorizon = FS_NOW + Math.max(1, fsLife - fsAge);
  // Profile retirement age → calendar year salary should stop (used only when
  // there's no explicit retirement PLAN; a plan always wins inside fsBuildModel).
  const fsRetireY = fsProfile && Number(fsProfile.retireAge) > 0 ? FS_NOW + Math.max(0, Math.round(Number(fsProfile.retireAge)) - fsAge) : null;
  // Income base for the projection — derived from the profile, never hardcoded.
  const incomeBase = fsUseMemo(() => fsIncomeRows(fsProfile), [fsProfile]);

  // Show the first-run popup the FIRST time Foresight mounts for a user who
  // hasn't been onboarded. Gated on the settings flag so it appears exactly once.
  fsUseEffect(() => {
    if (data.ready && !fsOnboarded) setFsOnboard(true);
  }, [data.ready, fsOnboarded]);

  // plans with the live drag year applied, so the whole projection moves with the dot
  const livePlans = fsUseMemo(
    () => drag ? plans.map((p) => (p.id === drag.id ? { ...p, year: drag.year } : p)) : plans,
    [plans, drag]);

  const horizonYears = fsUseMemo(() => {
    const end = Math.max(fsHorizon, ...livePlans.map((p) => p.year || 0));
    const out = []; for (let y = FS_NOW; y <= end; y++) out.push(y); return out;
  }, [livePlans, fsHorizon]);
  const tableYears = fsUseMemo(() => horizonYears.filter((y) => y <= FS_TABLE_END), [horizonYears]);

  const model = fsUseMemo(() => fsBuildModel(livePlans, overrides, horizonYears, expenseBase, incomeBase, fsRetireY), [livePlans, overrides, horizonYears, expenseBase, incomeBase, fsRetireY]);
  const tableModel = fsUseMemo(() => fsBuildModel(livePlans, overrides, tableYears, expenseBase, incomeBase, fsRetireY), [livePlans, overrides, tableYears, expenseBase, incomeBase, fsRetireY]);
  const series = fsUseMemo(() => fsSimulate(model, livePlans, horizonYears, startNW), [model, livePlans, horizonYears, startNW]);

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
  // Create/edit persist through ClaudActions; the store refresh re-renders us.
  function saveModal() {
    const d = modal.draft;
    if (modal.isNew) {
      const { id, ...fields } = d;           // server assigns the real id
      ClaudActions.addPlan(fields);
    } else {
      const { id, ...patch } = d;
      ClaudActions.updatePlan(id, patch);
    }
    setModal(null);
  }
  function deleteModal() { ClaudActions.deletePlan(modal.draft.id); setModal(null); }

  // ---- drag wiring ----
  // Live drag stays local for a smooth feel; the new year is persisted on drop.
  function dragYear(id, year) { setDrag({ id, year }); }
  // Called on drop with the final id/year straight from the chart (not via the
  // possibly-stale `drag` closure). Keep the dragged year applied until the save
  // round-trips, so the line doesn't snap back to the old position first.
  function commitDrag(id, year) {
    if (id == null || year == null) { setDrag(null); return; }
    Promise.resolve(ClaudActions.updatePlan(id, { year })).then(() => setDrag(null), () => setDrag(null));
  }

  // ---- budget cell override (optimistic = instant) ----
  // Update the local store first so the table reflects the edit immediately, then
  // persist. The override forward-fills: a value at year Y applies to Y and every
  // later year until the next override — so editing one cell updates the whole row.
  function applyOverrideLocal(cat, year, amount) {
    const ovs = ClaudData.foresightOverrides;
    const i = ovs.findIndex((o) => o.cat === cat && o.year === year);
    if (amount === "" || amount == null) { if (i >= 0) ovs.splice(i, 1); }
    else if (i >= 0) ovs[i] = { cat, year, amount };
    else ovs.push({ cat, year, amount });
  }
  function setCell(cat, year, raw) {
    const amount = (raw === "" || raw == null) ? "" : Math.max(0, Math.round(Number(raw) || 0));
    applyOverrideLocal(cat, year, amount === "" ? null : amount);
    ClaudStore.emit();                               // instant re-render
    ClaudActions.setOverride(cat, year, amount);     // persist in the background
  }

  // base (un-edited) annual value for a row — used when reverting after a range
  function baseAmtFor(cat) {
    const inc = incomeBase.find((b) => b.cat === cat); if (inc) return inc.amt;
    const exp = expenseBase.find((b) => b.cat === cat); if (exp) return exp.amt;
    return 0;
  }
  // effective value of a row at year y given current overrides (else its base)
  function effectiveAt(cat, y) {
    let best = -Infinity, val = null;
    overrides.forEach((o) => { if (o.cat === cat && o.year <= y && o.year > best) { best = o.year; val = (o.amount != null ? o.amount : o.amt); } });
    return val != null ? val : baseAmtFor(cat);
  }
  // Set one value across a year range [from..to]; reverts to the prior value after.
  function fillRange(cat, fromY, toY, rawVal) {
    const a = Math.max(FS_NOW, Math.min(fromY, toY));
    const b = Math.min(FS_HORIZON, Math.max(fromY, toY));
    const v = Math.max(0, Math.round(Number(rawVal) || 0));
    const revert = Math.round(effectiveAt(cat, a));   // restore this after the range ends
    const ops = [];
    // make the range authoritative: clear any overrides strictly inside it
    overrides.filter((o) => o.cat === cat && o.year > a && o.year <= b).forEach((o) => ops.push({ year: o.year, amount: "" }));
    ops.push({ year: a, amount: v });
    if (b + 1 <= FS_HORIZON) ops.push({ year: b + 1, amount: revert });
    ops.forEach((op) => applyOverrideLocal(cat, op.year, op.amount === "" ? null : op.amount));
    ClaudStore.emit();
    ops.forEach((op) => ClaudActions.setOverride(cat, op.year, op.amount));
    setRangeRow(null);
  }

  // ---- settings patch helper (follows the in-place patch + persist pattern) ----
  // Mirrors ClaudData.settings locally for an instant re-render, then PUTs the
  // merged keys to /api/settings (saveSettings → ClaudAPI.put). The server merges
  // arbitrary keys, so foresightProfile / foresightOnboarded round-trip fine.
  function patchSettingsLocal(patch) {
    ClaudData.settings = Object.assign({}, ClaudData.settings, patch);
    ClaudStore.emit();
    ClaudActions.saveSettings(patch);
  }
  // First-run popup: persist the profile + flip the onboarded flag so it never
  // shows again. Income now flows from this profile into the projection.
  function saveOnboard(profile) {
    patchSettingsLocal({ foresightProfile: profile, foresightOnboarded: true });
    setFsOnboard(false);
  }
  // Skip: leave income empty but still mark onboarded so the popup is one-time.
  function skipOnboard() {
    patchSettingsLocal({ foresightOnboarded: true });
    setFsOnboard(false);
  }
  function removeRow(cat) {
    if (extraRows.some((e) => e.name === cat)) {            // custom row → delete it
      patchSettingsLocal({ fsExtraRows: extraRows.filter((e) => e.name !== cat) });
    } else if (!hiddenRows.includes(cat)) {                 // budget row → hide it
      patchSettingsLocal({ fsHiddenRows: hiddenRows.concat([cat]) });
    }
  }
  function addRow(name, amt) {
    const nm = String(name || "").trim();
    if (!nm) return;
    const next = extraRows.filter((e) => e.name !== nm).concat([{ name: nm, amt: Math.max(0, Math.round(Number(amt) || 0)) }]);
    patchSettingsLocal({ fsExtraRows: next, fsHiddenRows: hiddenRows.filter((h) => h !== nm) });
    setAddRowOpen(false);
  }
  function restoreHidden() { patchSettingsLocal({ fsHiddenRows: [] }); }

  const sortedMarkers = [...livePlans].sort((a, b) => a.year - b.year);
  const planSub = (p) => {
    if (p.kind === "retirement") return `stop working in ${p.year}, age ${fsAge + (p.year - FS_NOW)}`;
    if (p.kind === "house") return `${fsMoney(p.amount)} home in ${p.year}`;
    if (p.kind === "job") return `${fsMoney(p.amount)}/yr take-home from ${p.year}`;
    if (p.kind === "kids") return `${fsMoney(p.amount)}/yr, ${p.year}\u2013${p.end || p.year}`;
    if (p.kind === "pension") return `${fsMoney(p.amount)}/yr from ${p.year}`;
    return `${fsMoney(p.amount)}/yr, ${p.year}\u2013${p.end || p.year}`;
  };

  // Brand-new account with NO plans: show the get-started panel instead of a
  // demo projection (the chart + KPIs + budget table only fill in once a plan
  // and/or income profile exist). The plan modal still mounts so the CTA can
  // open this page's own add-plan flow, and the first-run profile popup mounts
  // here too (it's the primary first-run step). All hooks above run
  // unconditionally, so this early return keeps hook order stable.
  if (!plans.length) {
    return (
      <React.Fragment>
        <FsGetStarted onPick={openNew} />
        {modal && <FsModal draft={modal.draft} isNew={modal.isNew} onField={modalField} onSave={saveModal} onDelete={deleteModal} onClose={() => setModal(null)} />}
        {fsOnboard && <FsOnboardModal profile={fsProfile} startNW={startNW} onSave={saveOnboard} onSkip={skipOnboard} />}
      </React.Fragment>);
  }

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Net worth today</span>
          <span className="kpi-val">{fsMoney(startNW)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>age {fsAge} · {plans.length} plans active</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Projected · {fsHorizon}</span>
          <span className="kpi-val" style={{ color: latest < 0 ? "var(--red)" : "var(--text)" }}>{fsMoney(latest)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>at age {fsLife}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">At retirement{retire ? ` · ${retire.year}` : ""}</span>
          <span className="kpi-val">{retire ? fsMoney(retireValue) : fsMoney(peak)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{retire ? `the pot you stop working with` : "no retirement plan yet"}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Retirement</span>
          <span className="kpi-val" style={{ color: runOut ? "var(--red)" : "var(--green)" }}>{runOut ? `Runs dry ${runOut}` : "On track"}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{retire ? (runOut ? "savings dip below zero" : `lasts through ${fsHorizon}`) : "add a retirement plan"}</span>
        </div></Card>
      </div>

      {/* Chart */}
      <Card widget>
        <div className="cf-hero-head">
          <div>
            <span className="widget-eyebrow">Net worth · all plans</span>
            <div className="fs-chart-headline">
              <span className="fs-chart-val" style={{ color: latest < 0 ? "var(--red)" : "var(--text)" }}>{fsMoney(latest)}</span>
              <span className="fs-chart-unit">projected by {fsHorizon}</span>
            </div>
            <div className="fs-hint">{plans.length ? <React.Fragment>{"\u2195\uFE0E"} Drag any dot left or right to change its year · click it to edit</React.Fragment> : <React.Fragment>This is your base trajectory · add a life event with <b style={{ color: "var(--text)", fontWeight: 600 }}>+ New plan</b> to see it bend the line</React.Fragment>}{!fsProfile && <React.Fragment>{" · "}<button className="fs-addrow-link" style={{ padding: 0 }} onClick={() => setFsOnboard(true)} title="Add your income to project net worth">Add your income {"›"}</button></React.Fragment>}</div>
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

        <ChartFullscreen title="Foresight projection">
          <FsChart series={series} markers={markers} age={fsAge}
            onDragYear={dragYear} onCommit={commitDrag} onClickMarker={openEdit} />
        </ChartFullscreen>

        <ul className="fs-legend">
          {!sortedMarkers.length &&
            <li className="fs-leg fs-leg-empty" onClick={() => setMenu(true)} title="Add your first plan">
              <span className="fs-ico"><FsIcon kind="house" size={16} /></span>
              <b>No plans yet</b>
              <span className="fs-leg-sub">{"\u2014"} a house, a new job, kids, retirement… each one reshapes your future net worth</span>
              <span className="fs-leg-edit">Add {"\u203A"}</span>
            </li>
          }
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
            <div className="fs-hint" style={{ marginTop: 4 }}>Annual $. {budgetLinked ? <React.Fragment>One row per <b style={{ color: "var(--text)", fontWeight: 600 }}>Budget</b> category (×12) {"\u00B7"} </React.Fragment> : null}edit a cell to fill that year onward {"\u00B7"} {"\u2194"} sets a year range {"\u00B7"} {"\u00D7"} removes a row {"\u00B7"} {"\uD83D\uDD12"} cells come from a plan.</div>
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
                  <td className="fs-row-head">
                    <span className="fs-rh">
                      <span className="fs-rh-name" title={row.cat}>{row.cat}</span>
                      {row.fillable &&
                        <button className="fs-rh-btn" title="Set a value across a year range" aria-label={"Set a range for " + row.cat} onClick={() => setRangeRow({ cat: row.cat })}>{"\u2194"}</button>}
                    </span>
                  </td>
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
                  <td className="fs-row-head">
                    <span className="fs-rh">
                      <span className="fs-rh-name" title={row.cat}>{row.cat}</span>
                      {row.fillable &&
                        <button className="fs-rh-btn" title="Set a value across a year range" aria-label={"Set a range for " + row.cat} onClick={() => setRangeRow({ cat: row.cat })}>{"\u2194"}</button>}
                      {row.removable &&
                        <button className="fs-rh-btn danger" title="Remove this row from the projection" aria-label={"Remove " + row.cat} onClick={() => removeRow(row.cat)}>{"\u00D7"}</button>}
                    </span>
                  </td>
                  {row.cells.map((c) =>
                    <td key={c.year}>
                      {c.locked
                        ? <span className="fs-cell-locked">{fsMoney(c.value)}<span className="lk">{"\uD83D\uDD12"}</span></span>
                        : <input type="number" className={"fs-cell-input" + (c.edited ? " edited" : "")} defaultValue={c.value} key={row.cat + c.year + c.value} onBlur={(e) => setCell(row.cat, c.year, e.target.value)} />}
                    </td>
                  )}
                </tr>
              )}
              <tr className="fs-addrow">
                <td colSpan={tableYears.length + 1}>
                  <button className="fs-addrow-btn" onClick={() => setAddRowOpen(true)}>+ Add expense row</button>
                  {hiddenRows.length > 0 &&
                    <button className="fs-addrow-link" onClick={restoreHidden} title="Show rows you've removed">Restore {hiddenRows.length} hidden</button>}
                </td>
              </tr>
              <tr className="fs-subtotal"><td className="fs-row-head">Total expense</td>{tableModel.totals.map((t) => <td key={t.year}>{fsMoney(t.expense)}</td>)}</tr>

              <tr className="fs-net"><td className="fs-row-head">Net / yr</td>{tableModel.totals.map((t) => <td key={t.year} className={t.net < 0 ? "neg" : "pos"}>{(t.net >= 0 ? "+" : FS_MINUS) + "$" + Math.abs(t.net).toLocaleString("en-CA")}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Card>

      {modal && <FsModal draft={modal.draft} isNew={modal.isNew} onField={modalField} onSave={saveModal} onDelete={deleteModal} onClose={() => setModal(null)} />}
      {rangeRow && <FsRangeModal cat={rangeRow.cat} base={baseAmtFor(rangeRow.cat)} onApply={fillRange} onClose={() => setRangeRow(null)} />}
      {addRowOpen && <FsAddRowModal onAdd={addRow} onClose={() => setAddRowOpen(false)} />}
      {fsOnboard && <FsOnboardModal profile={fsProfile} startNW={startNW} onSave={saveOnboard} onSkip={skipOnboard} />}
    </React.Fragment>);
}

/* ---- Range fill: set one row's value across a span of years ---- */
function FsRangeModal({ cat, base, onApply, onClose }) {
  const { Button } = FS;
  const [from, setFrom] = fsUseState(FS_NOW);
  const [to, setTo] = fsUseState(Math.min(FS_NOW + 10, FS_TABLE_END));
  const [val, setVal] = fsUseState(base != null ? base : 0);
  fsUseEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const numF = (set) => (e) => set(e.target.value === "" ? "" : Number(e.target.value));
  return (
    <div className="fs-overlay" onMouseDown={onClose}>
      <section className="fs-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="fs-modal-head">
          <span className="fs-modal-title">Set {cat} across a range</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>
        <div className="fs-grid">
          <label className="fs-field"><span>From year</span><input type="number" value={from} onChange={numF(setFrom)} /></label>
          <label className="fs-field"><span>To year</span><input type="number" value={to} onChange={numF(setTo)} /></label>
          <label className="fs-field full"><span>Amount / yr ($)</span><input type="number" value={val} onChange={numF(setVal)} autoFocus /></label>
        </div>
        <div className="fs-modal-foot">
          <span className="fs-foot-note">Applies to {cat} for {from || FS_NOW}{"–"}{to || FS_NOW}; reverts after.</span>
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={() => onApply(cat, Number(from) || FS_NOW, Number(to) || FS_NOW, val)}>Apply</Button>}
          </div>
        </div>
      </section>
    </div>);
}

/* ---- Add a custom projected-expense row ---- */
function FsAddRowModal({ onAdd, onClose }) {
  const { Button } = FS;
  const [name, setName] = fsUseState("");
  const [amt, setAmt] = fsUseState("");
  fsUseEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const valid = name.trim().length > 0;
  return (
    <div className="fs-overlay" onMouseDown={onClose}>
      <section className="fs-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="fs-modal-head">
          <span className="fs-modal-title">Add an expense row</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>
        <div className="fs-grid">
          <label className="fs-field full"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travel" autoFocus /></label>
          <label className="fs-field full"><span>Amount / yr ($)</span><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0" /></label>
        </div>
        <div className="fs-modal-foot">
          <span className="fs-foot-note">A custom projection row {"—"} edit any year afterward.</span>
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={() => valid && onAdd(name, amt)}>Add row</Button>}
          </div>
        </div>
      </section>
    </div>);
}

/* ============================================================
   FIRST-RUN PROFILE POPUP — shown the first time Foresight opens.
   Collects the numbers the projection needs: current age, annual
   salary, annual side income, retirement age, life expectancy.
   Starting net worth is shown read-only (it comes from the user's
   real accounts, not entered here). Saving stores the profile and
   flips the onboarded flag; Skip leaves income empty but still
   flips the flag, so the popup is strictly one-time.
   Reuses the foresight modal styling (fs-overlay / fs-modal / fs-grid).
   ============================================================ */
function FsOnboardModal({ profile, startNW, onSave, onSkip }) {
  const { Button } = FS;
  const p = profile || {};
  // Pre-fill from any existing profile; otherwise start with blank income (so we
  // never fabricate it) and gentle age/retirement/lifespan defaults.
  const [fsAgeV, setFsAgeV] = fsUseState(p.age != null && p.age !== "" ? String(p.age) : String(FS_AGE));
  const [fsSalaryV, setFsSalaryV] = fsUseState(p.salary != null && p.salary !== "" ? String(p.salary) : "");
  const [fsSideV, setFsSideV] = fsUseState(p.sideIncome != null && p.sideIncome !== "" ? String(p.sideIncome) : "");
  const [fsRetireV, setFsRetireV] = fsUseState(p.retireAge != null && p.retireAge !== "" ? String(p.retireAge) : "65");
  const [fsLifeV, setFsLifeV] = fsUseState(p.lifeExpectancy != null && p.lifeExpectancy !== "" ? String(p.lifeExpectancy) : String(FS_LIFE));

  // Escape / backdrop = Skip (still flips the onboarded flag, so one-time).
  fsUseEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onSkip(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const numField = (label, value, set, opts) => {
    opts = opts || {};
    return (
      <label className={"fs-field" + (opts.full ? " full" : "")}>
        <span>{label}</span>
        <input type="number" min="0" step={opts.step || "1"} value={value}
          placeholder={opts.placeholder || ""}
          onChange={(e) => set(e.target.value)} autoFocus={opts.autoFocus} />
      </label>
    );
  };

  function handleSave() {
    const toNum = (v) => (v === "" || v == null ? 0 : Math.max(0, Math.round(Number(v) || 0)));
    onSave({
      age: toNum(fsAgeV),
      salary: toNum(fsSalaryV),
      sideIncome: toNum(fsSideV),
      retireAge: toNum(fsRetireV),
      lifeExpectancy: toNum(fsLifeV)
    });
  }

  return (
    <div className="fs-overlay" onMouseDown={onSkip}>
      <section className="fs-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="fs-modal-head">
          <span className="fs-modal-title">
            <span className="fs-ico"><FsIcon kind="income" size={20} /></span>
            Set up your Foresight
          </span>
          <button className="fs-modal-close" onClick={onSkip} aria-label="Close">{"×"}</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", lineHeight: 1.5, margin: "0 0 14px" }}>
          Tell us a little about your income and timeline so we can project your net worth.
          Your expenses come from your Budget, and today{"’"}s net worth from your real accounts.
        </p>
        <div className="fs-grid">
          {numField("Current age", fsAgeV, setFsAgeV, { autoFocus: true })}
          {numField("Retirement age", fsRetireV, setFsRetireV)}
          {numField("Annual salary (take-home)", fsSalaryV, setFsSalaryV, { full: true, placeholder: "e.g. 60000" })}
          {numField("Annual side income", fsSideV, setFsSideV, { full: true, placeholder: "0" })}
          {numField("Life expectancy (age)", fsLifeV, setFsLifeV)}
          <label className="fs-field">
            <span>Starting net worth</span>
            <input type="text" value={fsMoney(Number(startNW) || 0)} readOnly disabled
              title="Calculated from your real accounts" />
          </label>
        </div>
        <div className="fs-modal-foot">
          <span className="fs-foot-note">Skip to leave income blank {"—"} you can add it any time.</span>
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>}
            {Button && <Button variant="primary" size="sm" onClick={handleSave}>Save & project</Button>}
          </div>
        </div>
      </section>
    </div>);
}

window.ForesightPage = ForesightPage;
