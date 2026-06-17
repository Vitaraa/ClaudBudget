/* ============================================================
   Claud — Account detail page
   Loaded AFTER pages.jsx (reuses global pgSpline) and BEFORE
   app.jsx (which mounts <AccountDetailPage/>). Self-contained:
   ac*-prefixed identifiers, reuses the global Icon component,
   CAT_COLORS and hexA (defined in app.jsx, referenced only at
   render time). Exposes AccountDetailPage on window.
   ============================================================ */
const AC = window.ClaudDesignSystem_de602a || {};
const { useState: acUseState } = React;

const AC_MINUS = "\u2212";
const acMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? AC_MINUS : "") + "$" + s;
};
const acSigned = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : AC_MINUS + "$") + s;
};
const acPct = (n, dec = 1) => (n >= 0 ? "+" : AC_MINUS) + Math.abs(n).toFixed(dec) + "%";
const acKfmt = (v) => {
  const neg = v < 0, a = Math.abs(v);
  const s = a >= 1000 ? "$" + (a / 1000).toFixed(a % 1000 ? 1 : 0) + "k" : "$" + Math.round(a);
  return (neg ? AC_MINUS : "") + s;
};

/* 24 month labels ending this month (matches the dashboard) */
const AC_LABELS = (() => {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out = []; let m = 6, y = 24;
  for (let i = 0; i < 24; i++) { out.push(names[m % 12] + " '" + String(y).padStart(2, "0")); m++; if (m % 12 === 0) y++; }
  return out;
})();
const AC_PERIODS = { "3M": 4, "6M": 7, "1Y": 13, "All": 24 };

/* deterministic 24-pt monthly balance series, pinned to the real end balance */
const acRng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const acGen = (end, growth, vol, seed) => {
  const rnd = acRng(seed), start = end - growth, out = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const ease = t * t * (3 - 2 * t); // smoothstep so the trend curves, not a ruler-straight line
    out.push(Math.round(start + growth * ease + (rnd() - 0.5) * vol));
  }
  out[0] = Math.round(start);
  out[23] = Math.round(end);
  return out;
};

/* ============================================================
   Per-account extended data, keyed by account name.
   history: 24 monthly closing balances. txns: recent activity.
   meta:    fields rendered in the "Account details" card.
   ============================================================ */
const ACCT_EXTRA = {
  "Everyday Checking": {
    kind: "checking",
    history: acGen(4280.55, 520, 760, 11),
    opened: "Mar 2019",
    stat: { label: "Avg. monthly spend", value: acMoney(3940), sub: "last 6 months" },
    meta: [["Available balance", acMoney(4280.55, 2)], ["Routing", "021000021"], ["Opened", "Mar 2019"]],
    txns: [
      { name: "Monthly paycheck", cat: "Income", amt: 3210.00, day: "Today", icon: "income" },
      { name: "Whole Foods Market", cat: "Groceries", amt: -84.20, day: "Today", icon: "cart" },
      { name: "Transfer → Emergency Savings", cat: "Transfer", amt: -800.00, day: "Yesterday", icon: "piggy" },
      { name: "Con Edison", cat: "Utilities", amt: -128.40, day: "Jun 7", icon: "bag" },
      { name: "Costco", cat: "Groceries", amt: -212.84, day: "Jun 7", icon: "cart" },
      { name: "Freelance project", cat: "Income", amt: 850.00, day: "Jun 5", icon: "income" },
      { name: "Rent — Park Ave", cat: "Housing", amt: -1650.00, day: "Jun 1", icon: "bank" },
      { name: "Verizon", cat: "Utilities", amt: -80.00, day: "Jun 1", icon: "bag" },
      { name: "Monthly paycheck", cat: "Income", amt: 3210.00, day: "May 30", icon: "income" }]
  },
  "Emergency Savings": {
    kind: "savings",
    history: acGen(28640.00, 4200, 240, 22),
    opened: "Jan 2021",
    stat: { label: "Interest earned · YTD", value: acMoney(486, 2), sub: "4.20% APY", tone: "pos" },
    meta: [["Interest rate", "4.20% APY"], ["Interest · YTD", acMoney(486, 2)], ["Opened", "Jan 2021"]],
    txns: [
      { name: "Interest payment", cat: "Income", amt: 96.10, day: "Today", icon: "income" },
      { name: "Transfer ← Everyday Checking", cat: "Transfer", amt: 800.00, day: "Yesterday", icon: "bank" },
      { name: "Transfer ← Everyday Checking", cat: "Transfer", amt: 685.00, day: "Jun 1", icon: "bank" },
      { name: "Interest payment", cat: "Income", amt: 94.80, day: "May 31", icon: "income" },
      { name: "Transfer ← Everyday Checking", cat: "Transfer", amt: 700.00, day: "May 1", icon: "bank" }]
  },
  "Joint Checking": {
    kind: "checking",
    history: acGen(2150.20, -880, 320, 33),
    opened: "Aug 2022",
    stat: { label: "Avg. monthly spend", value: acMoney(2310), sub: "last 6 months" },
    meta: [["Available balance", acMoney(2150.20, 2)], ["Holders", "Avery · Sam"], ["Opened", "Aug 2022"]],
    txns: [
      { name: "Shared groceries", cat: "Groceries", amt: -142.60, day: "Yesterday", icon: "cart" },
      { name: "Dinner — Maialino", cat: "Dining", amt: -96.40, day: "Jun 9", icon: "coffee" },
      { name: "Transfer ← Everyday Checking", cat: "Transfer", amt: 500.00, day: "Jun 5", icon: "bank" },
      { name: "Utilities split", cat: "Utilities", amt: -104.50, day: "Jun 2", icon: "bag" },
      { name: "Household supplies", cat: "Shopping", amt: -58.20, day: "May 29", icon: "bag" }]
  },
  "Brokerage": {
    kind: "investment",
    history: acGen(61300.40, 12100, 1700, 44),
    opened: "Jun 2020",
    stat: { label: "Total return · 1Y", value: acPct(16.8), sub: acSigned(8820, 0) + " gain", tone: "pos" },
    meta: [["Cost basis", acMoney(52480, 2)], ["Unrealized gain", acMoney(8820, 2)], ["Opened", "Jun 2020"]],
    txns: [
      { name: "Dividend — VTI", cat: "Income", amt: 184.30, day: "Today", icon: "income" },
      { name: "Buy 4 VTI @ $262.00", cat: "Investment", amt: -1048.00, day: "Jun 3", icon: "chart" },
      { name: "Deposit ← Everyday Checking", cat: "Transfer", amt: 1500.00, day: "Jun 1", icon: "bank" },
      { name: "Dividend — VXUS", cat: "Income", amt: 71.40, day: "May 28", icon: "income" },
      { name: "Buy 2 QQQ @ $531.20", cat: "Investment", amt: -1062.40, day: "May 20", icon: "chart" }]
  },
  "401(k)": {
    kind: "investment",
    history: acGen(92400.00, 18200, 2100, 55),
    opened: "Sep 2018",
    stat: { label: "Contributions · YTD", value: acMoney(11250), sub: "incl. employer match", tone: "pos" },
    meta: [["Employer match", "5% of salary"], ["Contributions · YTD", acMoney(11250, 2)], ["Opened", "Sep 2018"]],
    txns: [
      { name: "Employee contribution", cat: "Income", amt: 950.00, day: "Jun 1", icon: "income" },
      { name: "Employer match", cat: "Income", amt: 475.00, day: "Jun 1", icon: "income" },
      { name: "Dividend reinvestment", cat: "Income", amt: 312.80, day: "May 31", icon: "chart" },
      { name: "Employee contribution", cat: "Income", amt: 950.00, day: "May 15", icon: "income" },
      { name: "Employer match", cat: "Income", amt: 475.00, day: "May 15", icon: "income" }]
  },
  "Roth IRA": {
    kind: "investment",
    history: acGen(18250.75, 3500, 560, 66),
    opened: "Apr 2021",
    stat: { label: "Total return · 1Y", value: acPct(13.4), sub: acSigned(2160, 0) + " gain", tone: "pos" },
    meta: [["Contributions · YTD", acMoney(4200, 2)], ["Annual limit", acMoney(7000)], ["Opened", "Apr 2021"]],
    txns: [
      { name: "Annual contribution", cat: "Transfer", amt: 1000.00, day: "Jun 4", icon: "bank" },
      { name: "Buy 16 VXUS @ $61.50", cat: "Investment", amt: -984.00, day: "Jun 4", icon: "chart" },
      { name: "Dividend — VTI", cat: "Income", amt: 42.10, day: "May 28", icon: "income" },
      { name: "Annual contribution", cat: "Transfer", amt: 1000.00, day: "May 2", icon: "bank" }]
  },
  "Sapphire Visa": {
    kind: "credit",
    history: acGen(-1240.30, -900, 360, 77),
    opened: "Nov 2020",
    stat: { label: "Available credit", value: acMoney(13759.70), sub: "of " + acMoney(15000) + " limit" },
    meta: [["Credit limit", acMoney(15000)], ["Statement due", "Jun 28"], ["Opened", "Nov 2020"]],
    txns: [
      { name: "Spotify", cat: "Subscriptions", amt: -11.99, day: "Yesterday", icon: "music" },
      { name: "Shell", cat: "Transport", amt: -52.40, day: "Jun 10", icon: "fuel" },
      { name: "Amazon", cat: "Shopping", amt: -129.30, day: "Jun 10", icon: "bag" },
      { name: "Uber", cat: "Transport", amt: -18.65, day: "Jun 9", icon: "fuel" },
      { name: "Payment — thank you", cat: "Income", amt: 600.00, day: "Jun 6", icon: "income" },
      { name: "Netflix", cat: "Subscriptions", amt: -15.49, day: "Jun 5", icon: "music" },
      { name: "Zara", cat: "Shopping", amt: -96.00, day: "Jun 4", icon: "bag" }]
  }
};

/* category colors specific to detail-page tags (falls back to global CAT_COLORS) */
const AC_CAT_COLORS = { Transfer: "#5a93a8", Investment: "#7e7a3c" };
const acCatColor = (c) => {
  if (typeof CAT_COLORS !== "undefined" && CAT_COLORS[c]) return CAT_COLORS[c];
  return AC_CAT_COLORS[c] || "#9a8048";
};
const acHexA = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ============================================================
   BALANCE CHART — large area + line, period-sliced, hover tip
   ============================================================ */
function AcctBalanceChart({ data, labels, negative }) {
  const W = 940, H = 250, padL = 54, padR = 18, padT = 18, padB = 28;
  const [hov, setHov] = acUseState(null);

  let lo = Math.min(...data), hi = Math.max(...data);
  const pad = (hi - lo) * 0.14 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xOf = (i) => padL + (data.length === 1 ? innerW / 2 : i / (data.length - 1) * innerW);
  const yOf = (v) => padT + innerH - (v - lo) / (hi - lo) * innerH;
  const pts = data.map((v, i) => [xOf(i), yOf(v)]);
  const line = window.pgSpline ? window.pgSpline(pts) : pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  const baseY = padT + innerH;
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${baseY} L ${pts[0][0].toFixed(1)} ${baseY} Z`;
  const stroke = negative ? "var(--red)" : "var(--accent)";

  const ticks = [hi, (hi + lo) / 2, lo];
  const step = Math.max(1, Math.round((labels.length - 1) / 4));
  const xTicks = [];
  for (let i = 0; i < labels.length; i += step) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== labels.length - 1) xTicks.push(labels.length - 1);

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = i; } });
    setHov(best);
  }
  const hp = hov != null ? pts[hov] : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHov(null)} role="img" aria-label="Account balance over time">
        <defs>
          <linearGradient id="acctFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) =>
          <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{acKfmt(t)}</text>
          </g>
        )}
        <path d={area} fill="url(#acctFill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {xTicks.map((i) =>
          <text key={i} x={xOf(i)} y={H - 7} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{labels[i]}</text>
        )}
        {hp && <line x1={hp[0]} y1={padT - 4} x2={hp[0]} y2={padT + innerH} stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />}
        {hp && <circle cx={hp[0]} cy={hp[1]} r="4.5" fill="var(--card)" stroke={stroke} strokeWidth="2.4" />}
        {!hp && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={stroke} />}
      </svg>
      {hp &&
        <div className="chart-tip" style={{ left: `${hp[0] / W * 100}%`, top: `${hp[1] / H * 100}%` }}>
          <div className="tip-date">{labels[hov]}</div>
          <div className="tip-val">{acMoney(data[hov], 2)}</div>
        </div>
      }
    </div>);
}

/* ============================================================
   DELETE CONFIRM MODAL
   ============================================================ */
function AcctDeleteModal({ acct, onCancel, onConfirm }) {
  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const { Button } = AC;
  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-label={"Delete " + acct.name}>
        <div className="confirm-body">
          <div className="confirm-ico"><Icon name="alert" /></div>
          <h2>Delete this account?</h2>
          <p><b>{acct.name}</b> and its full transaction history will be removed from Claud. Your net worth and cash-flow totals will recalculate. This can't be undone.</p>
          <div className="confirm-acct">
            <span className="acct-ico"><Icon name={acct.icon} /></span>
            <div className="acct-row-body">
              <span className="acct-row-name">{acct.name}</span>
              <span className="acct-row-meta">{acct.inst} {"\u00B7\u00B7\u00B7\u00B7"} {acct.mask}</span>
            </div>
            <span className={"acct-row-bal " + (acct.bal < 0 ? "neg" : "")}>{acMoney(acct.bal, 2)}</span>
          </div>
        </div>
        <div className="confirm-foot">
          {Button && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
          <button className="btn-danger-solid" onClick={onConfirm}>
            <Icon name="trash" style={{ width: 15, height: 15 }} />Delete account
          </button>
        </div>
      </div>
    </div>);
}

/* ============================================================
   ACCOUNT DETAIL PAGE
   ============================================================ */
function AccountDetailPage({ acct, onDelete }) {
  const { Card, Badge, Segmented } = AC;
  const [period, setPeriod] = acUseState("1Y");
  const [confirm, setConfirm] = acUseState(false);

  const extra = ACCT_EXTRA[acct.name] || { kind: "checking", history: acct.trend || [acct.bal], txns: [], meta: [], stat: null };
  const isCredit = extra.kind === "credit";

  const n = AC_PERIODS[period];
  const hist = extra.history.slice(-n);
  const labels = AC_LABELS.slice(-n);

  // change over the visible window
  const winChg = hist[hist.length - 1] - hist[0];
  const winPct = hist[0] !== 0 ? winChg / Math.abs(hist[0]) * 100 : 0;
  const monthPct = (acct.bal - acct.chg) !== 0 ? acct.chg / Math.abs(acct.bal - acct.chg) * 100 : 0;

  // editable copy of this account's activity — recategorize, change icon, or remove a row,
  // exactly like the Transactions tab. Keyed by stable index id; resets when the account changes.
  const [catOv, setCatOv] = acUseState({});
  const [iconOv, setIconOv] = acUseState({});
  const [removed, setRemoved] = acUseState([]);
  React.useEffect(() => { setCatOv({}); setIconOv({}); setRemoved([]); }, [acct.name]);

  // categories offered when recategorizing here = built-in ∪ budgets ∪ account-specific (Transfer / Investment)
  const acCats = () => ({ ...((window.getCatColors && window.getCatColors()) || {}), ...AC_CAT_COLORS });

  const txns = extra.txns
    .map((x, i) => ({ ...x, id: "t" + i }))
    .filter((x) => !removed.includes(x.id))
    .map((x) => {
      let out = x;
      const oc = catOv[x.id];
      if (oc && oc !== x.cat) out = { ...out, cat: oc, icon: (window.CAT_ICON && window.CAT_ICON[oc]) || out.icon };
      const io = iconOv[x.id];
      if (io) out = { ...out, icon: io };
      return out;
    });

  // transactions grouped by day, preserving order
  const days = [];
  txns.forEach((x) => {
    let grp = days.find((d) => d.day === x.day);
    if (!grp) { grp = { day: x.day, items: [] }; days.push(grp); }
    grp.items.push(x);
  });
  const inflow = txns.filter((x) => x.amt > 0).reduce((s, x) => s + x.amt, 0);
  const outflow = txns.filter((x) => x.amt < 0).reduce((s, x) => s + Math.abs(x.amt), 0);

  return (
    <React.Fragment>
      {/* Hero — balance + chart */}
      <Card widget>
        <div className="widget-head">
          <div>
            <span className="widget-eyebrow">{isCredit ? "Current balance" : "Balance"}</span>
            <div className="nw-headline">
              <span className={"nw-value " + (acct.bal < 0 ? "neg" : "")}>{acMoney(acct.bal, 2)}</span>
              {Badge && <Badge tone={acct.chg >= 0 ? "pos" : "neg"}>{acct.chg >= 0 ? "\u2191" : "\u2193"} {acSigned(acct.chg, 0)} · {acPct(monthPct)}</Badge>}
            </div>
            <div className="acct-detail-sub">
              {acct.chg >= 0 ? "Up " : "Down "}{acMoney(Math.abs(winChg), 0)} over {period === "All" ? "2 years" : period === "1Y" ? "the past year" : "the past " + period}
            </div>
          </div>
          {Segmented && <Segmented options={Object.keys(AC_PERIODS)} value={period} onChange={setPeriod} />}
        </div>
        <AcctBalanceChart data={hist} labels={labels} negative={isCredit} />
      </Card>

      {/* KPI strip */}
      <div className="kpi-3">
        <Card widget><div className="kpi">
          <span className="kpi-label">{isCredit ? "Balance owed" : "Current balance"}</span>
          <span className={"kpi-val " + (acct.bal < 0 ? "neg" : "")}>{acMoney(acct.bal, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>synced 2h ago</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Change · 30 days</span>
          <span className="kpi-val" style={{ color: acct.chg >= 0 ? "var(--green)" : "var(--red)" }}>{acSigned(acct.chg, 0)}</span>
          <span className={"kpi-delta " + (acct.chg >= 0 ? "pos" : "neg")}>{acct.chg >= 0 ? "\u2191" : "\u2193"} {acPct(monthPct)} this month</span>
        </div></Card>
        {extra.stat &&
          <Card widget><div className="kpi">
            <span className="kpi-label">{extra.stat.label}</span>
            <span className={"kpi-val " + (extra.stat.tone === "pos" ? "pos" : "")}>{extra.stat.value}</span>
            <span className="kpi-delta" style={{ color: "var(--muted)" }}>{extra.stat.sub}</span>
          </div></Card>
        }
      </div>

      {/* Transactions + account details */}
      <div className="dash-grid">
        <Card widget className="span4">
          <div className="widget-head">
            <span className="widget-title">Recent activity</span>
            <div className="acct-act-sum">
              <span className="pos">{acSigned(inflow, 0)} in</span>
              <span className="neg">{AC_MINUS}{acMoney(outflow, 0).replace(AC_MINUS, "")} out</span>
            </div>
          </div>
          {days.length === 0 ?
            <div className="txn-empty">No activity recorded for this account.</div> :
            <div className="txn-table">
              {days.map((d) => {
                const dayTot = d.items.reduce((s, x) => s + x.amt, 0);
                return (
                  <React.Fragment key={d.day}>
                    <div className="txn-day"><span>{d.day}</span><span className="day-tot" style={{ color: dayTot >= 0 ? "var(--green)" : "var(--muted)" }}>{acSigned(dayTot, 0)}</span></div>
                    {d.items.map((x) =>
                      <div className="trow" key={x.id}>
                        <IconPicker value={x.icon} onPick={(n) => setIconOv((p) => ({ ...p, [x.id]: n }))} />
                        <div className="trow-main">
                          <span className="trow-name">{x.name}</span>
                          <div className="trow-tags">
                            <CatPicker value={x.cat} categories={acCats()} onPick={(c) => setCatOv((p) => ({ ...p, [x.id]: c }))} />
                          </div>
                        </div>
                        <span className={"trow-amt " + (x.amt >= 0 ? "pos" : "")}>{acSigned(x.amt)}</span>
                        <button className="trow-del" onClick={() => setRemoved((p) => p.includes(x.id) ? p : [...p, x.id])} aria-label={"Remove " + x.name} title="Remove transaction"><Icon name="trash" /></button>
                      </div>
                    )}
                  </React.Fragment>);
              })}
            </div>
          }
        </Card>

        <Card widget className="span2">
          <div className="widget-head"><span className="widget-title">Account details</span></div>
          <div className="ainfo-list">
            <div className="ainfo-row"><span className="ainfo-k">Institution</span><span className="ainfo-v">{acct.inst}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Account number</span><span className="ainfo-v">{"\u00B7\u00B7\u00B7\u00B7"} {acct.mask}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Type</span><span className="ainfo-v">{acct.group}</span></div>
            {extra.meta.map(([k, v]) =>
              <div className="ainfo-row" key={k}><span className="ainfo-k">{k}</span><span className="ainfo-v">{v}</span></div>
            )}
            <div className="ainfo-row"><span className="ainfo-k">Status</span><span className="ainfo-v" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span className="conn-dot" />Connected</span></div>
          </div>

          <div className="danger-zone">
            <span className="dz-title">Danger zone</span>
            <span className="dz-desc">Remove this account and its history from Claud. You can reconnect it later from your institution.</span>
            <button className="btn-danger-out" onClick={() => setConfirm(true)}>
              <Icon name="trash" />Delete account
            </button>
          </div>
        </Card>
      </div>

      {confirm && <AcctDeleteModal acct={acct} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete(); }} />}
    </React.Fragment>);
}

Object.assign(window, { AccountDetailPage, ACCT_EXTRA, acGen });

/* ============================================================
   ADD ACCOUNT — Canada-focused new-account flow
   Reuses the .fs-* modal vocabulary (shared with Foresight).
   Defaults: Canadian institutions, chequing/TFSA/RRSP types,
   CAD balances. On submit, builds an account object + registers
   its detail-page data into ACCT_EXTRA, then calls onAdd.
   ============================================================ */
const CA_BANKS = [
  "RBC Royal Bank", "TD Canada Trust", "Scotiabank", "BMO", "CIBC",
  "National Bank", "Desjardins", "Tangerine", "EQ Bank", "Simplii Financial",
  "American Express", "Wealthsimple", "Questrade", "Other"];

const AC_ADD_TYPES = {
  "Chequing": { group: "Cash", icon: "bank", kind: "checking", ph: "Everyday Chequing" },
  "Savings": { group: "Cash", icon: "piggy", kind: "savings", ph: "Emergency Savings" },
  "TFSA": { group: "Investments", icon: "chart", kind: "investment", ph: "TFSA" },
  "RRSP": { group: "Investments", icon: "shield", kind: "investment", ph: "RRSP" },
  "Investment": { group: "Investments", icon: "chart", kind: "investment", ph: "Non-registered" },
  "Credit card": { group: "Credit", icon: "card", kind: "credit", ph: "Visa" }
};

function AddAccountModal({ onClose, onAdd }) {
  const { Button } = AC;
  const [inst, setInst] = acUseState(CA_BANKS[0]);
  const [type, setType] = acUseState("Chequing");
  const [name, setName] = acUseState("");
  const [bal, setBal] = acUseState("");
  const [mask, setMask] = acUseState("");
  const [apy, setApy] = acUseState("4.00");
  const [touched, setTouched] = acUseState(false);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cfg = AC_ADD_TYPES[type];
  const isSavings = type === "Savings";
  const isCredit = type === "Credit card";
  const balNum = parseFloat(String(bal).replace(/[^0-9.\-]/g, ""));
  const validName = name.trim().length > 0;
  const validBal = bal !== "" && !Number.isNaN(balNum);
  const valid = validName && validBal;

  function submit() {
    setTouched(true);
    if (!valid) return;
    const signedBal = isCredit ? -Math.abs(balNum) : balNum;
    const m = (mask.replace(/\D/g, "") || String(Math.floor(1000 + Math.random() * 9000))).slice(-4);
    const seed = Math.floor(Math.random() * 90000) + 10000;
    const mag = Math.abs(signedBal) || 1000;
    const growth = (isCredit ? -1 : 1) * mag * 0.03;
    const vol = Math.max(40, mag * 0.018);
    const history = acGen(signedBal, growth, vol, seed);
    const chg = Math.round(history[23] - history[22]);

    const meta = [["Opened", "Just now"]];
    let stat = null;
    if (isSavings) {
      meta.unshift(["Interest rate", apy + "% APY"]);
      stat = { label: "Interest rate", value: apy + "%", sub: "annual", tone: "pos" };
    }
    ACCT_EXTRA[name.trim()] = { kind: cfg.kind, history, txns: [], meta, stat };

    onAdd({
      name: name.trim(), inst, mask: m, bal: signedBal, icon: cfg.icon, chg,
      apy: isSavings ? apy + "% APY" : undefined,
      trend: history.slice(-8), group: cfg.group
    });
  }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label="Add account">
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name={cfg.icon} /></span>Add account</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="fs-grid">
          <label className="fs-field">
            <span>Institution</span>
            <select value={inst} onChange={(e) => setInst(e.target.value)}>
              {CA_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="fs-field">
            <span>Account type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.keys(AC_ADD_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="fs-field full">
            <span>Account name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={cfg.ph}
              style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
          </label>

          <label className="fs-field">
            <span>{isCredit ? "Amount owed (CAD)" : "Current balance (CAD)"}</span>
            <input type="number" inputMode="decimal" step="0.01" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="0.00"
              style={touched && !validBal ? { borderColor: "var(--red)" } : undefined} />
          </label>
          <label className="fs-field">
            <span>Last 4 digits</span>
            <input value={mask} onChange={(e) => setMask(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="optional" />
          </label>

          {isSavings &&
            <label className="fs-field full">
              <span>Interest rate (% APY)</span>
              <input type="number" inputMode="decimal" step="0.01" value={apy} onChange={(e) => setApy(e.target.value)} placeholder="4.00" />
            </label>
          }
        </div>

        <div className="fs-modal-foot">
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>Add account</Button>}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { AddAccountModal });
