/* ============================================================
   Claud — Investments page (list, add / edit / delete, detail)
   Loaded AFTER pages.jsx and BEFORE app.jsx. Self-contained:
   inv*-prefixed identifiers, reuses the global Icon component
   (defined in app.jsx, referenced only at render time). Holdings
   state + routing live in app.jsx, which passes them in as props.
   Exposes InvestmentsPage / InvestmentDetailPage / InvestmentModal
   / InvDeleteModal and the seed array INV_SEED on window.
   ============================================================ */
const IV = window.ClaudDesignSystem_de602a || {};
const { useState: ivUseState } = React;

/* ---- format helpers (own names, no collision) ---- */
const IV_MINUS = "\u2212";
const invMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? IV_MINUS : "") + "$" + s;
};
const invSigned = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : IV_MINUS + "$") + s;
};
const invPct = (n, dec = 1) => (n >= 0 ? "+" : IV_MINUS) + Math.abs(n).toFixed(dec) + "%";
const invKfmt = (v) => {
  const neg = v < 0, a = Math.abs(v);
  const s = a >= 1000 ? "$" + (a / 1000).toFixed(a % 1000 ? 1 : 0) + "k" : "$" + Math.round(a);
  return (neg ? IV_MINUS : "") + s;
};
const invVol = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n.toLocaleString("en-CA");

/* smooth cardinal-spline path through [x,y] points */
const invSpline = (pts) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

/* deterministic PRNG + seeded price-series generator */
const invRng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const invHash = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 4294967296; return h || 1; };
const invGen = (start, end, pts, vol, seed) => {
  const rnd = invRng(seed), out = [];
  for (let i = 0; i < pts; i++) {
    const t = pts === 1 ? 1 : i / (pts - 1);
    const ease = t * t * (3 - 2 * t);
    out.push(start + (end - start) * ease + (rnd() - 0.5) * vol);
  }
  out[0] = start; out[pts - 1] = end;
  return out;
};

/* ============================================================
   DATA — benchmark levels, holdings seed, allocation, meta
   ============================================================ */
const INV_LABELS = (() => {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out = []; let m = 6, y = 24;
  for (let i = 0; i < 24; i++) { out.push(names[m % 12] + " '" + String(y).padStart(2, "0")); m++; if (m % 12 === 0) y++; }
  return out;
})();
const INV_PERIODS = { "3M": 4, "6M": 7, "1Y": 13, "All": 24 };

const INV_SP500 = [
  100.0, 99.2, 101.4, 102.8, 102.0, 104.1, 103.3, 105.6, 106.8, 105.4, 107.9, 109.3,
  108.6, 110.7, 112.1, 113.8, 115.2, 114.3, 116.9, 118.5, 119.7, 118.6, 120.9, 122.4];
const INV_PORT = [
  100.0, 98.8, 101.9, 103.6, 102.4, 105.3, 104.2, 107.4, 109.1, 107.2, 110.6, 112.8,
  111.7, 114.6, 116.9, 119.4, 121.6, 120.1, 123.8, 126.4, 128.3, 126.5, 130.2, 132.7];

/* seed holdings — EMPTY so new users start with a blank portfolio.
   app.jsx reads ClaudData.holdings (live server data) for the actual list. */
const INV_SEED = [];

const INV_CLASSES = [
  { cls: "CAD stocks",  color: "#8e7cc3" },
  { cls: "US stocks",   color: "var(--accent)" },
  { cls: "Intl stocks", color: "#5a93a8" },
  { cls: "Bonds",       color: "#c0894c" },
  { cls: "Cash",        color: "var(--muted)" }
];
const invClassColor = (cls) => (INV_CLASSES.find((c) => c.cls === cls) || {}).color || "var(--accent)";

/* ============================================================
   SECURITY DIRECTORY — powers the ticker autocomplete.
   Each: { ticker, name, cls, kind, price }. Curated, not live.
   ============================================================ */
const INV_TICKERS = [
  /* ---- CAD stocks (TSX) ---- */
  { ticker: "RY.TO",   name: "Royal Bank of Canada",            cls: "CAD stocks", kind: "stock", price: 178.40 },
  { ticker: "TD.TO",   name: "Toronto-Dominion Bank",          cls: "CAD stocks", kind: "stock", price: 82.30 },
  { ticker: "ENB.TO",  name: "Enbridge Inc.",                  cls: "CAD stocks", kind: "stock", price: 58.10 },
  { ticker: "CNQ.TO",  name: "Canadian Natural Resources Ltd.", cls: "CAD stocks", kind: "stock", price: 47.85 },
  { ticker: "SHOP.TO", name: "Shopify Inc.",                   cls: "CAD stocks", kind: "stock", price: 146.20 },
  { ticker: "BNS.TO",  name: "Bank of Nova Scotia",            cls: "CAD stocks", kind: "stock", price: 72.05 },
  { ticker: "BMO.TO",  name: "Bank of Montreal",               cls: "CAD stocks", kind: "stock", price: 138.70 },
  { ticker: "CM.TO",   name: "Canadian Imperial Bank of Commerce", cls: "CAD stocks", kind: "stock", price: 92.40 },
  { ticker: "NA.TO",   name: "National Bank of Canada",         cls: "CAD stocks", kind: "stock", price: 138.10 },
  { ticker: "CNR.TO",  name: "Canadian National Railway Co.",   cls: "CAD stocks", kind: "stock", price: 152.60 },
  { ticker: "CP.TO",   name: "Canadian Pacific Kansas City Ltd.", cls: "CAD stocks", kind: "stock", price: 108.30 },
  { ticker: "SU.TO",   name: "Suncor Energy Inc.",             cls: "CAD stocks", kind: "stock", price: 56.20 },
  { ticker: "TRP.TO",  name: "TC Energy Corporation",          cls: "CAD stocks", kind: "stock", price: 67.10 },
  { ticker: "BCE.TO",  name: "BCE Inc.",                       cls: "CAD stocks", kind: "stock", price: 33.40 },
  { ticker: "MFC.TO",  name: "Manulife Financial Corp.",       cls: "CAD stocks", kind: "stock", price: 44.70 },
  { ticker: "ATD.TO",  name: "Alimentation Couche-Tard Inc.",  cls: "CAD stocks", kind: "stock", price: 78.50 },
  { ticker: "FTS.TO",  name: "Fortis Inc.",                    cls: "CAD stocks", kind: "stock", price: 61.30 },
  { ticker: "T.TO",    name: "TELUS Corporation",              cls: "CAD stocks", kind: "stock", price: 21.75 },
  { ticker: "L.TO",    name: "Loblaw Companies Ltd.",          cls: "CAD stocks", kind: "stock", price: 198.30 },
  { ticker: "DOL.TO",  name: "Dollarama Inc.",                 cls: "CAD stocks", kind: "stock", price: 152.80 },
  { ticker: "WCN.TO",  name: "Waste Connections Inc.",         cls: "CAD stocks", kind: "stock", price: 245.00 },
  { ticker: "GIB-A.TO", name: "CGI Inc.",                      cls: "CAD stocks", kind: "stock", price: 158.20 },
  { ticker: "XIC.TO",  name: "iShares Core S&P/TSX Capped Composite ETF", cls: "CAD stocks", kind: "etf", price: 38.40 },
  { ticker: "ZCN.TO",  name: "BMO S&P/TSX Capped Composite ETF", cls: "CAD stocks", kind: "etf", price: 36.20 },
  { ticker: "VCN.TO",  name: "Vanguard FTSE Canada All Cap ETF", cls: "CAD stocks", kind: "etf", price: 52.10 },
  { ticker: "XIU.TO",  name: "iShares S&P/TSX 60 ETF",         cls: "CAD stocks", kind: "etf", price: 38.90 },

  /* ---- US stocks ---- */
  { ticker: "AAPL", name: "Apple Inc.",                  cls: "US stocks", kind: "stock", price: 245.00 },
  { ticker: "MSFT", name: "Microsoft Corporation",       cls: "US stocks", kind: "stock", price: 450.00 },
  { ticker: "GOOGL", name: "Alphabet Inc. (Class A)",    cls: "US stocks", kind: "stock", price: 182.40 },
  { ticker: "AMZN", name: "Amazon.com, Inc.",            cls: "US stocks", kind: "stock", price: 218.60 },
  { ticker: "NVDA", name: "NVIDIA Corporation",          cls: "US stocks", kind: "stock", price: 138.20 },
  { ticker: "META", name: "Meta Platforms, Inc.",        cls: "US stocks", kind: "stock", price: 612.30 },
  { ticker: "TSLA", name: "Tesla, Inc.",                 cls: "US stocks", kind: "stock", price: 358.90 },
  { ticker: "JPM",  name: "JPMorgan Chase & Co.",        cls: "US stocks", kind: "stock", price: 248.10 },
  { ticker: "V",    name: "Visa Inc.",                   cls: "US stocks", kind: "stock", price: 312.50 },
  { ticker: "MA",   name: "Mastercard Incorporated",     cls: "US stocks", kind: "stock", price: 528.40 },
  { ticker: "WMT",  name: "Walmart Inc.",                cls: "US stocks", kind: "stock", price: 96.40 },
  { ticker: "JNJ",  name: "Johnson & Johnson",           cls: "US stocks", kind: "stock", price: 152.30 },
  { ticker: "UNH",  name: "UnitedHealth Group Inc.",     cls: "US stocks", kind: "stock", price: 512.80 },
  { ticker: "HD",   name: "The Home Depot, Inc.",        cls: "US stocks", kind: "stock", price: 412.60 },
  { ticker: "PG",   name: "The Procter & Gamble Company", cls: "US stocks", kind: "stock", price: 168.90 },
  { ticker: "XOM",  name: "Exxon Mobil Corporation",     cls: "US stocks", kind: "stock", price: 112.70 },
  { ticker: "BAC",  name: "Bank of America Corporation",  cls: "US stocks", kind: "stock", price: 46.20 },
  { ticker: "KO",   name: "The Coca-Cola Company",       cls: "US stocks", kind: "stock", price: 62.80 },
  { ticker: "DIS",  name: "The Walt Disney Company",     cls: "US stocks", kind: "stock", price: 112.40 },
  { ticker: "NFLX", name: "Netflix, Inc.",               cls: "US stocks", kind: "stock", price: 902.30 },
  { ticker: "AMD",  name: "Advanced Micro Devices, Inc.", cls: "US stocks", kind: "stock", price: 122.60 },
  { ticker: "INTC", name: "Intel Corporation",           cls: "US stocks", kind: "stock", price: 24.30 },
  { ticker: "BRK-B", name: "Berkshire Hathaway Inc. (Class B)", cls: "US stocks", kind: "stock", price: 468.20 },
  { ticker: "COST", name: "Costco Wholesale Corporation", cls: "US stocks", kind: "stock", price: 1042.30 },
  { ticker: "VTI",  name: "Vanguard Total Stock Market ETF", cls: "US stocks", kind: "etf", price: 262.00 },
  { ticker: "VOO",  name: "Vanguard S&P 500 ETF",        cls: "US stocks", kind: "etf", price: 486.25 },
  { ticker: "SPY",  name: "SPDR S&P 500 ETF Trust",      cls: "US stocks", kind: "etf", price: 528.40 },
  { ticker: "QQQ",  name: "Invesco QQQ Trust",           cls: "US stocks", kind: "etf", price: 532.50 },
  { ticker: "VFV.TO", name: "Vanguard S&P 500 Index ETF (CAD)", cls: "US stocks", kind: "etf", price: 142.30 },

  /* ---- Intl stocks ---- */
  { ticker: "TSM",  name: "Taiwan Semiconductor Mfg. Co.",  cls: "Intl stocks", kind: "stock", price: 198.40 },
  { ticker: "BABA", name: "Alibaba Group Holding Ltd.",     cls: "Intl stocks", kind: "stock", price: 88.60 },
  { ticker: "NVO",  name: "Novo Nordisk A/S",              cls: "Intl stocks", kind: "stock", price: 102.30 },
  { ticker: "ASML", name: "ASML Holding N.V.",             cls: "Intl stocks", kind: "stock", price: 712.40 },
  { ticker: "TM",   name: "Toyota Motor Corporation",      cls: "Intl stocks", kind: "stock", price: 182.60 },
  { ticker: "SONY", name: "Sony Group Corporation",        cls: "Intl stocks", kind: "stock", price: 88.20 },
  { ticker: "SAP",  name: "SAP SE",                        cls: "Intl stocks", kind: "stock", price: 248.30 },
  { ticker: "SHEL", name: "Shell plc",                     cls: "Intl stocks", kind: "stock", price: 68.40 },
  { ticker: "HSBC", name: "HSBC Holdings plc",            cls: "Intl stocks", kind: "stock", price: 48.20 },
  { ticker: "NSRGY", name: "Nestl\u00e9 S.A.",            cls: "Intl stocks", kind: "stock", price: 92.10 },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", cls: "Intl stocks", kind: "etf", price: 61.50 },
  { ticker: "VEA",  name: "Vanguard FTSE Developed Markets ETF", cls: "Intl stocks", kind: "etf", price: 52.80 },
  { ticker: "VWO",  name: "Vanguard FTSE Emerging Markets ETF", cls: "Intl stocks", kind: "etf", price: 46.30 },
  { ticker: "XEF.TO", name: "iShares Core MSCI EAFE IMI ETF", cls: "Intl stocks", kind: "etf", price: 38.90 },

  /* ---- Bonds ---- */
  { ticker: "BND",  name: "Vanguard Total Bond Market ETF", cls: "Bonds", kind: "etf", price: 73.60 },
  { ticker: "AGG",  name: "iShares Core U.S. Aggregate Bond ETF", cls: "Bonds", kind: "etf", price: 98.20 },
  { ticker: "TLT",  name: "iShares 20+ Year Treasury Bond ETF", cls: "Bonds", kind: "etf", price: 88.40 },
  { ticker: "BNDX", name: "Vanguard Total International Bond ETF", cls: "Bonds", kind: "etf", price: 49.10 },
  { ticker: "ZAG.TO", name: "BMO Aggregate Bond Index ETF", cls: "Bonds", kind: "etf", price: 13.80 },
  { ticker: "VAB.TO", name: "Vanguard Canadian Aggregate Bond ETF", cls: "Bonds", kind: "etf", price: 23.40 },
  { ticker: "XBB.TO", name: "iShares Core Canadian Universe Bond ETF", cls: "Bonds", kind: "etf", price: 27.30 }
];

/* match by ticker prefix first, then ticker/name substring */
const invSearchTickers = (raw) => {
  const q = raw.trim().toUpperCase();
  if (!q) return [];
  const starts = [], contains = [];
  for (const s of INV_TICKERS) {
    const tk = s.ticker.toUpperCase();
    if (tk.startsWith(q)) starts.push(s);
    else if (tk.includes(q) || s.name.toUpperCase().includes(q)) contains.push(s);
  }
  return starts.concat(contains).slice(0, 8);
};

/* per-ticker reference facts shown on the detail page */
const INV_META = {
  VTI:  { mktCap: "$1.78T AUM", pe: "26.4", yield: "1.28%", beta: "1.00", about: "Vanguard Total Stock Market ETF tracks the CRSP US Total Market Index, giving low-cost exposure to the entire U.S. equity market — large, mid, small, and micro-cap stocks." },
  VOO:  { mktCap: "$1.32T AUM", pe: "27.1", yield: "1.31%", beta: "1.00", about: "Vanguard S&P 500 ETF tracks the 500 largest U.S. companies — a core building block for broad large-cap exposure at a very low expense ratio." },
  VXUS: { mktCap: "$92.4B AUM", pe: "14.2", yield: "3.08%", beta: "0.92", about: "Vanguard Total International Stock ETF covers developed and emerging markets outside the United States, adding global diversification to a portfolio." },
  QQQ:  { mktCap: "$345B AUM",  pe: "33.5", yield: "0.55%", beta: "1.12", about: "Invesco QQQ tracks the Nasdaq-100 — the largest non-financial companies on the Nasdaq, tilted heavily toward technology and growth." },
  BND:  { mktCap: "$124B AUM",  pe: "\u2014", yield: "3.92%", beta: "0.04", about: "Vanguard Total Bond Market ETF holds the broad U.S. investment-grade bond market — Treasuries, agency, and corporate debt — for ballast and income." },
  AAPL: { sector: "Technology", mktCap: "$3.78T", pe: "33.2", yield: "0.42%", beta: "1.21", about: "Apple Inc. designs and markets iPhone, Mac, iPad, and wearables, alongside a fast-growing Services business spanning the App Store, iCloud, and Apple Pay." },
  MSFT: { sector: "Technology", mktCap: "$3.34T", pe: "36.8", yield: "0.71%", beta: "0.92", about: "Microsoft Corporation builds software, devices, and cloud services. Its Intelligent Cloud segment — led by Azure — is the company's primary growth engine." },
  CASH: { about: "Cash and money-market balance held in your brokerage, available to invest or withdraw. Currently earning a money-market yield." }
};

/* x-axis tick labels per detail-chart period */
const INV_XLABELS = {
  "1D": ["9:30", "11:00", "12:30", "2:00", "4:00"],
  "1W": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "1M": ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
  "6M": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  "1Y": ["Jul", "Sep", "Nov", "Jan", "Mar", "Jun"],
  "5Y": ["'21", "'22", "'23", "'24", "'25", "'26"]
};
/* points + return-vs-annual factor for each detail period */
const INV_DPERIODS = [
  { k: "1D", pts: 27, intraday: true, vol: 0.004 },
  { k: "1W", pts: 30, f: 0.05, vol: 0.012 },
  { k: "1M", pts: 30, f: 0.14, vol: 0.02 },
  { k: "6M", pts: 52, f: 0.55, vol: 0.035 },
  { k: "1Y", pts: 64, f: 1,    vol: 0.05 },
  { k: "5Y", pts: 80, f: 3.6,  vol: 0.09 }
];

/* ============================================================
   COMPARE CHART — portfolio vs S&P 500 (normalized % return)
   ============================================================ */
function InvCompareChart({ levelsA, levelsB, labels, nameA, nameB, colorA, colorB }) {
  const W = 940, H = 250, padL = 46, padR = 16, padT = 18, padB = 26;
  const [hov, setHov] = ivUseState(null);

  const a0 = levelsA[0], b0 = levelsB[0];
  const pa = levelsA.map((v) => (v / a0 - 1) * 100);
  const pb = levelsB.map((v) => (v / b0 - 1) * 100);
  const all = pa.concat(pb).concat([0]);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad; hi += pad;
  const span = hi - lo;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xOf = (i) => padL + (labels.length === 1 ? innerW / 2 : i / (labels.length - 1) * innerW);
  const yOf = (p) => padT + innerH - (p - lo) / span * innerH;

  const ptsA = pa.map((p, i) => [xOf(i), yOf(p)]);
  const ptsB = pb.map((p, i) => [xOf(i), yOf(p)]);

  const ticks = [hi, (hi + lo) / 2, lo];
  const yZero = yOf(0);
  // split the portfolio line olive above 0% return, red where it dips negative
  const splitA = Math.max(0, Math.min(1, (yZero - padT) / innerH));
  const lastNegA = pa[pa.length - 1] < 0;

  const step = Math.max(1, Math.round((labels.length - 1) / 4));
  const xTicks = [];
  for (let i = 0; i < labels.length; i += step) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== labels.length - 1) xTicks.push(labels.length - 1);

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    labels.forEach((_, i) => { const d = Math.abs(xOf(i) - x); if (d < bd) { bd = d; best = i; } });
    setHov(best);
  }
  const hx = hov != null ? xOf(hov) : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHov(null)} role="img" aria-label={`${nameA} versus ${nameB}`}>
        <defs>
          <linearGradient id="invCmpGrad" x1="0" y1={padT} x2="0" y2={padT + innerH} gradientUnits="userSpaceOnUse">
            <stop offset={splitA} stopColor={colorA} />
            <stop offset={splitA} stopColor="var(--red)" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) =>
          <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{invPct(t, 0)}</text>
          </g>
        )}
        <line x1={padL} y1={yZero} x2={W - padR} y2={yZero} stroke="var(--border)" strokeWidth="1.4" />

        <path d={invSpline(ptsB)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d={invSpline(ptsA)} fill="none" stroke="url(#invCmpGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

        {xTicks.map((i) =>
          <text key={i} x={xOf(i)} y={H - 7} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{labels[i]}</text>
        )}

        {hx != null &&
          <g>
            <line x1={hx} y1={padT - 4} x2={hx} y2={padT + innerH} stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={ptsB[hov][0]} cy={ptsB[hov][1]} r="4" fill="var(--card)" stroke={colorB} strokeWidth="2" />
            <circle cx={ptsA[hov][0]} cy={ptsA[hov][1]} r="4.5" fill="var(--card)" stroke={pa[hov] < 0 ? "var(--red)" : colorA} strokeWidth="2.6" />
          </g>
        }
        {hx == null &&
          <g>
            <circle cx={ptsB[ptsB.length - 1][0]} cy={ptsB[ptsB.length - 1][1]} r="3.4" fill={colorB} />
            <circle cx={ptsA[ptsA.length - 1][0]} cy={ptsA[ptsA.length - 1][1]} r="4" fill={lastNegA ? "var(--red)" : colorA} />
          </g>
        }
      </svg>

      {hov != null &&
        <div className="chart-tip" style={{ left: `${xOf(hov) / W * 100}%`, top: `${Math.min(ptsA[hov][1], ptsB[hov][1]) / H * 100}%` }}>
          <div className="tip-date">{labels[hov]}</div>
          <div className="tip-rows">
            <div className="tip-r"><span className="tr-name"><span className="tr-dot" style={{ background: colorA }} />{nameA}</span><span className="tr-val" style={{ color: pa[hov] >= 0 ? "var(--green)" : "var(--red)" }}>{invPct(pa[hov])}</span></div>
            <div className="tip-r"><span className="tr-name"><span className="tr-dot" style={{ background: colorB }} />{nameB}</span><span className="tr-val">{invPct(pb[hov])}</span></div>
          </div>
        </div>
      }
    </div>);
}

/* ============================================================
   PRICE CHART — single-series area + line, period-sliced
   ============================================================ */
function InvPriceChart({ data, xLabels, up }) {
  const W = 940, H = 250, padL = 52, padR = 18, padT = 18, padB = 28;
  const [hov, setHov] = ivUseState(null);

  let lo = Math.min(...data), hi = Math.max(...data);
  const pad = (hi - lo) * 0.16 || Math.abs(hi) * 0.04 || 1;
  lo -= pad; hi += pad;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xOf = (i) => padL + (data.length === 1 ? innerW / 2 : i / (data.length - 1) * innerW);
  const yOf = (v) => padT + innerH - (v - lo) / (hi - lo) * innerH;
  const pts = data.map((v, i) => [xOf(i), yOf(v)]);
  const line = invSpline(pts);
  const baseY = padT + innerH;
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${baseY} L ${pts[0][0].toFixed(1)} ${baseY} Z`;
  const stroke = up ? "var(--green)" : "var(--red)";

  const ticks = [hi, (hi + lo) / 2, lo];
  const xl = xLabels || [];

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
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHov(null)} role="img" aria-label="Price history">
        <defs>
          <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) =>
          <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{invKfmt(t)}</text>
          </g>
        )}
        <path d={area} fill="url(#invFill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {xl.map((s, i) =>
          <text key={i} x={padL + (xl.length === 1 ? innerW / 2 : i / (xl.length - 1) * innerW)} y={H - 7}
            textAnchor={i === 0 ? "start" : i === xl.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{s}</text>
        )}
        {hp && <line x1={hp[0]} y1={padT - 4} x2={hp[0]} y2={padT + innerH} stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />}
        {hp && <circle cx={hp[0]} cy={hp[1]} r="4.5" fill="var(--card)" stroke={stroke} strokeWidth="2.4" />}
        {!hp && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={stroke} />}
      </svg>
      {hp &&
        <div className="chart-tip" style={{ left: `${hp[0] / W * 100}%`, top: `${hp[1] / H * 100}%` }}>
          <div className="tip-val">{invMoney(data[hov], 2)}</div>
        </div>
      }
    </div>);
}

/* ============================================================
   INVESTMENTS PAGE — KPIs, compare chart, editable holdings
   ============================================================ */
function InvestmentsPage({ holdings, onOpen, onEdit, onDelete }) {
  const { Card, Segmented } = IV;
  const [period, setPeriod] = ivUseState("1Y");
  const [retMode, setRetMode] = ivUseState("%");
  // column sort for the holdings table: key null = natural order. dir 1 asc, -1 desc.
  const [sort, setSort] = ivUseState({ key: "weight", dir: -1 });

  const n = INV_PERIODS[period];
  const sp = INV_SP500.slice(-n);
  const pf = INV_PORT.slice(-n);
  const labels = INV_LABELS.slice(-n);
  const pfRet = (pf[pf.length - 1] / pf[0] - 1) * 100;
  const spRet = (sp[sp.length - 1] / sp[0] - 1) * 100;
  const gap = pfRet - spRet;

  const totalValue = holdings.reduce((s, h) => s + h.value, 0) || 1;
  const dayDollar = holdings.reduce((s, h) => s + h.value * h.day / 100, 0);
  const dayPct = dayDollar / totalValue * 100;
  const yrPf = (INV_PORT[INV_PORT.length - 1] / INV_PORT[INV_PORT.length - 13] - 1) * 100;
  const yrSp = (INV_SP500[INV_SP500.length - 1] / INV_SP500[INV_SP500.length - 13] - 1) * 100;
  const yrDollar = totalValue - totalValue / (1 + yrPf / 100);

  const allocTotals = INV_CLASSES.map((a) => ({
    ...a, value: holdings.filter((h) => h.cls === a.cls).reduce((s, h) => s + h.value, 0)
  })).filter((a) => a.value > 0);

  const open = (h) => onOpen && onOpen(h);

  // ---- sortable holdings (props.holdings stays the source of truth) ----
  const holdGain = (h) => (h.shares != null && h.cost != null ? h.value - h.shares * h.cost : 0);
  const sortKeyVal = (h) => {
    switch (sort.key) {
      case "name": return (h.cls === "Cash" ? "$" : h.ticker);
      case "weight": return h.value;
      case "ret": return retMode === "%" ? h.ret : holdGain(h);
      case "value": return h.value;
      default: return 0;
    }
  };
  const displayHoldings = sort.key
    ? holdings.slice().sort((a, b) => {
        const va = sortKeyVal(a), vb = sortKeyVal(b);
        if (typeof va === "string") return va.localeCompare(vb) * sort.dir;
        return (va - vb) * sort.dir;
      })
    : holdings;
  function toggleSort(key) {
    setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: key === "name" ? 1 : -1 });
  }
  const SortInd = ({ k }) => sort.key === k
    ? <span className="hh-ind">{sort.dir === 1 ? "\u2191" : "\u2193"}</span>
    : null;

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Portfolio value</span>
          <span className="kpi-val">{invMoney(totalValue, 2)}</span>
          <span className={"kpi-delta " + (dayDollar >= 0 ? "pos" : "neg")}>{dayDollar >= 0 ? "\u2191" : "\u2193"} {invSigned(dayDollar, 0)} ({invPct(dayPct, 2)}) today</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Total return · 1Y</span>
          <span className="kpi-val pos">{invPct(yrPf)}</span>
          <span className="kpi-delta pos">{"\u2191"} {invSigned(yrDollar, 0)}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">S&amp;P 500 · 1Y</span>
          <span className="kpi-val">{invPct(yrSp)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>benchmark</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">vs S&amp;P 500</span>
          <span className="kpi-val" style={{ color: yrPf - yrSp >= 0 ? "var(--green)" : "var(--red)" }}>{invPct(yrPf - yrSp)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{yrPf - yrSp >= 0 ? "ahead of the market" : "behind the market"}</span>
        </div></Card>
      </div>

      {/* Compare chart */}
      <Card widget>
        <div className="cf-hero-head">
          <div>
            <span className="widget-eyebrow">Performance vs benchmark</span>
            <div className="cf-hero-title">Your portfolio vs the S&amp;P 500</div>
          </div>
          <div className="cf-hero-right">
            {Segmented && <Segmented options={Object.keys(INV_PERIODS)} value={period} onChange={setPeriod} />}
          </div>
        </div>

        <div className="cmp-readout">
          <span className="cmp-chip"><span className="cmp-dot" style={{ background: "var(--accent)" }} />Portfolio <b style={{ color: pfRet >= 0 ? "var(--green)" : "var(--red)" }}>{invPct(pfRet)}</b></span>
          <span className="cmp-chip"><span className="cmp-dot" style={{ background: "var(--muted)" }} />S&amp;P 500 <b>{invPct(spRet)}</b></span>
          <span className="cmp-gap" style={{ color: gap >= 0 ? "var(--green)" : "var(--red)" }}>{gap >= 0 ? "Outperforming by " : "Trailing by "}{Math.abs(gap).toFixed(1)} pts over {period === "All" ? "2 years" : period}</span>
        </div>

        <InvCompareChart levelsA={pf} levelsB={sp} labels={labels} nameA="Portfolio" nameB="S&P 500" colorA="var(--accent)" colorB="var(--muted)" />
      </Card>

      <div className="dash-grid">
        {/* Holdings */}
        <Card widget className="span4">
          <div className="widget-head">
            <span className="widget-title">Holdings</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="muted">{holdings.length} position{holdings.length === 1 ? "" : "s"} · {invMoney(totalValue, 0)}</span>
              {Segmented && <Segmented options={["%", "$"]} value={retMode} onChange={setRetMode} />}
            </div>
          </div>
          {holdings.length === 0 ?
            <div className="txn-empty">No holdings yet. Use “+ Add investment” to add your first position.</div> :
            <React.Fragment>
              <div className="hold-head">
                <button type="button" className={"hh-name hh-sort" + (sort.key === "name" ? " active" : "")} onClick={() => toggleSort("name")}>Position<SortInd k="name" /></button>
                <button type="button" className={"hh-weight hh-sort" + (sort.key === "weight" ? " active" : "")} onClick={() => toggleSort("weight")}>Weight<SortInd k="weight" /></button>
                <button type="button" className={"hh-ret hh-sort" + (sort.key === "ret" ? " active" : "")} onClick={() => toggleSort("ret")}>{retMode === "%" ? "Return" : "Total gain"}<SortInd k="ret" /></button>
                <button type="button" className={"hh-val hh-sort" + (sort.key === "value" ? " active" : "")} onClick={() => toggleSort("value")}>Value<SortInd k="value" /></button>
                <span className="hh-act" />
              </div>
              <div className="hold-list">
                {displayHoldings.map((h) => (
                  <div className="hold-row clickable" key={h.id} role="button" tabIndex={0}
                    onClick={() => open(h)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(h); } }}>
                    <span className="hold-mono">{h.cls === "Cash" ? "$" : h.ticker}</span>
                    <div className="hold-body">
                      <span className="hold-name">{h.name}</span>
                      <span className="hold-meta">{h.cls}{h.shares != null && ` · ${h.shares} sh · ${invMoney(h.price, 2)}`}</span>
                    </div>
                    <div className="hold-weight" title={`${(h.value / totalValue * 100).toFixed(1)}% of portfolio`}>
                      <span className="hw-pct">{(h.value / totalValue * 100).toFixed(1)}%</span>
                      <span className="hw-bar"><span className="hw-fill" style={{ width: `${h.value / totalValue * 100}%`, background: invClassColor(h.cls) }} /></span>
                    </div>
                    <span className="hold-ret" style={{ color: h.ret > 0 ? "var(--green)" : h.ret < 0 ? "var(--red)" : "var(--muted)" }}>{retMode === "%" ? invPct(h.ret) : invSigned(h.shares != null && h.cost != null ? h.value - h.shares * h.cost : 0, 0)}</span>
                    <div className="hold-right">
                      <span className="hold-val">{invMoney(h.value, 0)}</span>
                      <span className={"hold-day " + (h.day > 0 ? "pos" : h.day < 0 ? "neg" : "")} style={{ color: h.day === 0 ? "var(--muted)" : undefined }}>{invPct(h.day, 2)} today</span>
                    </div>
                    <span className="hold-actions">
                      <button className="hold-act" title="Edit position" aria-label={"Edit " + h.name}
                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(h); }}><Icon name="pencil" /></button>
                      <button className="hold-act del" title="Remove position" aria-label={"Remove " + h.name}
                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(h.id); }}><Icon name="trash" /></button>
                    </span>
                  </div>
                ))}
              </div>
            </React.Fragment>
          }
        </Card>

        {/* Allocation */}
        <Card widget className="span2">
          <div className="widget-head"><span className="widget-title">Allocation</span></div>
          {allocTotals.length === 0 ?
            <div className="txn-empty">No allocation to show.</div> :
            <React.Fragment>
              <div className="alloc-bar" role="img" aria-label="Asset allocation">
                {allocTotals.map((a) =>
                  <span key={a.cls} className="alloc-seg" style={{ width: `${a.value / totalValue * 100}%`, background: a.color }} title={`${a.cls} ${invMoney(a.value)}`} />
                )}
              </div>
              <div className="alloc-legend">
                {allocTotals.map((a) => (
                  <div className="alloc-leg" key={a.cls}>
                    <span className="al-name"><span className="sw" style={{ background: a.color }} />{a.cls}</span>
                    <span className="al-pct">{(a.value / totalValue * 100).toFixed(1)}%</span>
                    <span className="al-val">{invMoney(a.value, 0)}</span>
                  </div>
                ))}
              </div>
              <div className="alloc-note">Stock-heavy mix. A long horizon can ride out swings — rebalance if any slice drifts far from target.</div>
            </React.Fragment>
          }
        </Card>
      </div>
    </React.Fragment>);
}

/* ============================================================
   ADD / EDIT INVESTMENT MODAL
   ============================================================ */
const INV_CLASS_OPTS = ["CAD stocks", "US stocks", "Intl stocks", "Bonds", "Cash"];

/* ---- Ticker autocomplete (search by symbol or company name) ---- */
function InvTickerCombo({ value, onChange, onPick, invalid }) {
  const [open, setOpen] = ivUseState(false);
  const [active, setActive] = ivUseState(0);
  const wrapRef = React.useRef(null);
  const matches = invSearchTickers(value);

  React.useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  React.useEffect(() => { setActive(0); }, [value]);

  function choose(s) { onPick(s); setOpen(false); }
  function onKey(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(matches[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  }

  const showList = open && matches.length > 0;
  return (
    <div className="tk-combo" ref={wrapRef}>
      <input value={value} role="combobox" aria-expanded={showList} aria-autocomplete="list" autoComplete="off"
        onChange={(e) => { onChange(e.target.value.toUpperCase().slice(0, 9)); setOpen(true); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        onKeyDown={onKey}
        placeholder="Search symbol or name…"
        style={{ textTransform: "uppercase", ...(invalid ? { borderColor: "var(--red)" } : {}) }} />
      {showList &&
        <ul className="tk-list" role="listbox">
          {matches.map((s, i) => (
            <li key={s.ticker} role="option" aria-selected={i === active}
              className={"tk-opt" + (i === active ? " active" : "")}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}>
              <span className="tk-sym">{s.ticker}</span>
              <span className="tk-name">{s.name}</span>
              <span className="tk-cls" style={{ color: invClassColor(s.cls) }}>{s.cls.replace(" stocks", "")}</span>
            </li>
          ))}
        </ul>}
    </div>);
}

function InvestmentModal({ modal, onClose, onSave, onDelete }) {
  const { Button, Segmented } = IV;
  const editing = modal.mode === "edit";
  const src = editing ? modal.holding : null;

  const [cls, setCls] = ivUseState(src ? src.cls : "CAD stocks");
  const [ticker, setTicker] = ivUseState(src ? src.ticker : "");
  const [name, setName] = ivUseState(src ? src.name : "");
  const [kind, setKind] = ivUseState(src ? src.kind : "stock");
  const [shares, setShares] = ivUseState(src && src.shares != null ? String(src.shares) : "");
  const [price, setPrice] = ivUseState(src && src.price != null ? String(src.price) : "");
  const [costv, setCostv] = ivUseState(src && src.cost != null ? String(src.cost) : "");
  const [amount, setAmount] = ivUseState(src && src.cls === "Cash" ? String(src.value) : "");
  const [touched, setTouched] = ivUseState(false);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isCash = cls === "Cash";
  const num = (v) => parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  const sh = num(shares), pr = num(price), cs = num(costv), amt = num(amount);

  const validName = name.trim().length > 0;
  const validTicker = isCash || ticker.trim().length > 0;
  const validShares = isCash || (shares !== "" && !Number.isNaN(sh) && sh > 0);
  const validPrice = isCash || (price !== "" && !Number.isNaN(pr) && pr > 0);
  const validAmount = !isCash || (amount !== "" && !Number.isNaN(amt) && amt > 0);
  const valid = validName && validTicker && validShares && validPrice && validAmount;

  const previewValue = isCash ? (Number.isNaN(amt) ? 0 : amt) : (Number.isNaN(sh) || Number.isNaN(pr) ? 0 : sh * pr);
  const previewRet = isCash || Number.isNaN(cs) || cs <= 0 || Number.isNaN(pr) ? 0 : (pr / cs - 1) * 100;

  function submit() {
    setTouched(true);
    if (!valid) return;
    const kindOut = isCash ? "cash" : kind;
    const t = isCash ? "CASH" : ticker.trim().toUpperCase();
    const cost = isCash ? null : (Number.isNaN(cs) || cs <= 0 ? pr : cs);
    const value = isCash ? Math.round(amt) : Math.round(sh * pr);
    const ret = isCash ? 0 : (cost > 0 ? (pr / cost - 1) * 100 : 0);
    onSave({
      id: src ? src.id : "inv-" + Date.now(),
      ticker: t,
      name: name.trim(),
      cls, kind: kindOut,
      shares: isCash ? null : sh,
      price: isCash ? null : pr,
      cost,
      value,
      day: src ? src.day : 0,
      ret: Math.round(ret * 10) / 10
    });
  }

  const monoLabel = isCash ? "$" : (ticker.trim().toUpperCase() || "—");

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit investment" : "Add investment"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="hold-mono" style={{ width: 40, height: 30, fontSize: 11 }}>{monoLabel}</span>{editing ? "Edit position" : "Add investment"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="fs-grid">
          <div className="fs-field full">
            <span>Asset class</span>
            {Segmented && <Segmented options={INV_CLASS_OPTS} value={cls} onChange={setCls} />}
          </div>

          {!isCash &&
            <div className="fs-field">
              <span>Ticker symbol</span>
              <InvTickerCombo value={ticker} invalid={touched && !validTicker}
                onChange={(v) => setTicker(v)}
                onPick={(s) => { setTicker(s.ticker); setName(s.name); setCls(s.cls); setKind(s.kind); if (s.price != null) setPrice(s.price.toFixed(2)); }} />
            </div>
          }
          <label className={"fs-field" + (isCash ? " full" : "")}>
            <span>{isCash ? "Account name" : "Name"}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isCash ? "Money market" : "Apple Inc."}
              style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
          </label>

          {isCash ?
            <label className="fs-field full">
              <span>Amount held ($)</span>
              <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                style={touched && !validAmount ? { borderColor: "var(--red)" } : undefined} />
            </label> :
            <React.Fragment>
              <label className="fs-field">
                <span>Shares</span>
                <input type="number" inputMode="decimal" step="0.0001" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0"
                  style={touched && !validShares ? { borderColor: "var(--red)" } : undefined} />
              </label>
              <label className="fs-field">
                <span>Current price ($)</span>
                <input type="number" inputMode="decimal" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
                  style={touched && !validPrice ? { borderColor: "var(--red)" } : undefined} />
              </label>
              <label className="fs-field">
                <span>Avg cost / share ($)</span>
                <input type="number" inputMode="decimal" step="0.01" value={costv} onChange={(e) => setCostv(e.target.value)} placeholder="optional" />
              </label>
            </React.Fragment>
          }
        </div>

        <div className="fs-modal-foot">
          {editing
            ? <Button variant="danger" size="sm" onClick={() => onDelete(src.id)}>Delete</Button>
            : <span className="fs-foot-note">Market value <b>{invMoney(previewValue, 0)}</b>{!isCash && previewRet !== 0 ? <React.Fragment> · return <b style={{ color: previewRet >= 0 ? "var(--green)" : "var(--red)" }}>{invPct(previewRet)}</b></React.Fragment> : null}</span>}
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>{editing ? "Save changes" : "Add investment"}</Button>}
          </div>
        </div>
      </div>
    </div>);
}

/* ============================================================
   DELETE CONFIRM MODAL
   ============================================================ */
function InvDeleteModal({ holding, onCancel, onConfirm }) {
  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const { Button } = IV;
  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-label={"Remove " + holding.name}>
        <div className="confirm-body">
          <div className="confirm-ico"><Icon name="alert" /></div>
          <h2>Remove this position?</h2>
          <p><b>{holding.name}</b> will be removed from your portfolio. Your portfolio value and allocation will recalculate. This can't be undone.</p>
          <div className="confirm-acct">
            <span className="hold-mono">{holding.cls === "Cash" ? "$" : holding.ticker}</span>
            <div className="acct-row-body">
              <span className="acct-row-name">{holding.name}</span>
              <span className="acct-row-meta">{holding.cls}{holding.shares != null ? " · " + holding.shares + " sh" : ""}</span>
            </div>
            <span className="acct-row-bal">{invMoney(holding.value, 2)}</span>
          </div>
        </div>
        <div className="confirm-foot">
          {Button && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
          <button className="btn-danger-solid" onClick={onConfirm}>
            <Icon name="trash" style={{ width: 15, height: 15 }} />Remove position
          </button>
        </div>
      </div>
    </div>);
}

/* ============================================================
   DETAIL PAGE — live-style quote, price chart, key stats
   ============================================================ */
function InvestmentDetailPage({ holding, portfolioValue, onDelete, onEdit }) {
  const { Card, Badge, Segmented } = IV;
  const [period, setPeriod] = ivUseState("1Y");
  const [confirm, setConfirm] = ivUseState(false);

  const h = holding;
  const meta = INV_META[h.ticker] || {};
  const isCash = h.cls === "Cash" || h.kind === "cash";
  const seed = invHash(h.ticker + "|" + h.id);

  if (isCash) {
    return (
      <React.Fragment>
        <Card widget>
          <div className="inv-hero">
            <span className="inv-mono">$</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="widget-eyebrow">Cash position</span>
              <div className="inv-price-row">
                <span className="inv-price">{invMoney(h.value, 2)}</span>
                <Badge tone="pos">Money market</Badge>
              </div>
              <div className="acct-detail-sub">{h.name} · available to invest or withdraw</div>
            </div>
          </div>
        </Card>
        <div className="dash-grid">
          <Card widget className="span4">
            <div className="widget-head"><span className="widget-title">About</span></div>
            <p className="inv-about">{meta.about}</p>
          </Card>
          <Card widget className="span2">
            <div className="widget-head"><span className="widget-title">Position</span></div>
            <div className="ainfo-list">
              <div className="ainfo-row"><span className="ainfo-k">Amount</span><span className="ainfo-v">{invMoney(h.value, 2)}</span></div>
              <div className="ainfo-row"><span className="ainfo-k">Asset class</span><span className="ainfo-v">{h.cls}</span></div>
              <div className="ainfo-row"><span className="ainfo-k">Portfolio weight</span><span className="ainfo-v">{(h.value / (portfolioValue || h.value) * 100).toFixed(1)}%</span></div>
            </div>
            <div className="danger-zone">
              <span className="dz-title">Remove</span>
              <span className="dz-desc">Take this cash position out of your tracked portfolio.</span>
              <button className="btn-danger-out" onClick={() => setConfirm(true)}><Icon name="trash" />Remove position</button>
            </div>
          </Card>
        </div>
        {confirm && <InvDeleteModal holding={h} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete(); }} />}
      </React.Fragment>);
  }

  // ---- live-style quote numbers (deterministic from seed) ----
  const rnd = invRng(seed);
  const prevClose = h.price / (1 + h.day / 100);
  const open = prevClose * (1 + (rnd() - 0.5) * 0.009);
  const dayLo = Math.min(h.price, open, prevClose) * (1 - (0.001 + rnd() * 0.006));
  const dayHi = Math.max(h.price, open, prevClose) * (1 + (0.001 + rnd() * 0.006));
  const yrStart = h.price / (1 + h.ret / 100);
  const wkLo = Math.min(h.price, yrStart) * (0.9 + rnd() * 0.05);
  const wkHi = Math.max(h.price, yrStart) * (1.04 + rnd() * 0.07);
  const volume = Math.round((2 + rnd() * 55) * 1e6);
  const avgVol = Math.round(volume * (0.8 + rnd() * 0.5));
  const dayDollar = h.value * h.day / 100;

  // ---- price series for the selected period ----
  const dp = INV_DPERIODS.find((p) => p.k === period) || INV_DPERIODS[4];
  const periodRet = dp.intraday ? h.day : h.ret * dp.f;
  const start = h.price / (1 + periodRet / 100);
  const series = invGen(start, h.price, dp.pts, h.price * dp.vol, seed + dp.k.charCodeAt(0));
  const periodUp = h.price >= start;
  const periodChg = h.price - start;
  const periodChgPct = (h.price / start - 1) * 100;

  const costBasis = h.shares * h.cost;
  const totalGain = h.value - costBasis;

  const Stat = ({ k, v, tone }) =>
    <div className="inv-kpi"><span className="k">{k}</span><span className="v" style={tone ? { color: tone } : undefined}>{v}</span></div>;

  return (
    <React.Fragment>
      {/* Hero — quote + price chart */}
      <Card widget>
        <div className="inv-hero">
          <span className="inv-mono">{h.ticker}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="widget-eyebrow">{h.cls}{meta.sector ? " · " + meta.sector : ""}</span>
            <div className="inv-price-row">
              <span className="inv-price">{invMoney(h.price, 2)}</span>
              {Badge && <Badge tone={h.day >= 0 ? "pos" : "neg"}>{h.day >= 0 ? "\u2191" : "\u2193"} {invSigned(h.price - prevClose, 2)} · {invPct(h.day, 2)}</Badge>}
            </div>
            <div className="acct-detail-sub">{h.day >= 0 ? "Up " : "Down "}{invMoney(Math.abs(dayDollar), 2)} on your position today · at close</div>
          </div>
          {Segmented && <Segmented options={INV_DPERIODS.map((p) => p.k)} value={period} onChange={setPeriod} />}
        </div>

        <div className="cmp-readout" style={{ marginTop: 10 }}>
          <span className="cmp-chip"><span className="cmp-dot" style={{ background: periodUp ? "var(--green)" : "var(--red)" }} />{period}<b style={{ color: periodUp ? "var(--green)" : "var(--red)" }}>{invSigned(periodChg, 2)} ({invPct(periodChgPct)})</b></span>
        </div>

        <InvPriceChart data={series} xLabels={INV_XLABELS[period]} up={periodUp} />
      </Card>

      {/* Position + key statistics */}
      <div className="dash-grid">
        <Card widget className="span2">
          <div className="widget-head"><span className="widget-title">Your position</span></div>
          <div className="kpi" style={{ marginBottom: 4 }}>
            <span className="kpi-label">Market value</span>
            <span className="kpi-val">{invMoney(h.value, 2)}</span>
            <span className={"kpi-delta " + (totalGain >= 0 ? "pos" : "neg")}>{totalGain >= 0 ? "\u2191" : "\u2193"} {invSigned(totalGain, 0)} ({invPct(h.ret)}) all time</span>
          </div>
          <div className="ainfo-list">
            <div className="ainfo-row"><span className="ainfo-k">Shares</span><span className="ainfo-v">{h.shares}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Avg cost / share</span><span className="ainfo-v">{invMoney(h.cost, 2)}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Cost basis</span><span className="ainfo-v">{invMoney(costBasis, 2)}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Today</span><span className="ainfo-v" style={{ color: h.day >= 0 ? "var(--green)" : "var(--red)" }}>{invSigned(dayDollar, 2)}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Portfolio weight</span><span className="ainfo-v">{(h.value / (portfolioValue || h.value) * 100).toFixed(1)}%</span></div>
          </div>
          <button className="inv-edit-btn" onClick={() => onEdit && onEdit(h)}><Icon name="pencil" />Edit position</button>
        </Card>

        <Card widget className="span4">
          <div className="widget-head"><span className="widget-title">Key statistics</span><span className="muted">{h.ticker}</span></div>
          <div className="inv-kpis">
            <Stat k="Open" v={invMoney(open, 2)} />
            <Stat k="Previous close" v={invMoney(prevClose, 2)} />
            <Stat k="Day's range" v={invMoney(dayLo, 2) + " – " + invMoney(dayHi, 2)} />
            <Stat k="52-week range" v={invMoney(wkLo, 2) + " – " + invMoney(wkHi, 2)} />
            <Stat k="Volume" v={invVol(volume)} />
            <Stat k="Avg. volume" v={invVol(avgVol)} />
            <Stat k={meta.mktCap && meta.mktCap.includes("AUM") ? "Net assets" : "Market cap"} v={meta.mktCap || "\u2014"} />
            <Stat k="P/E ratio" v={meta.pe || "\u2014"} />
            <Stat k="Dividend yield" v={meta.yield || "\u2014"} />
            <Stat k="Beta (5Y)" v={meta.beta || "\u2014"} />
          </div>
        </Card>
      </div>

      {/* About + danger zone */}
      <div className="dash-grid">
        <Card widget className="span4">
          <div className="widget-head"><span className="widget-title">About {h.name}</span></div>
          <p className="inv-about">{meta.about || (h.name + " is held in your brokerage account. Add notes or research links here.")}</p>
        </Card>
        <Card widget className="span2">
          <div className="widget-head"><span className="widget-title">Manage</span></div>
          <div className="ainfo-list">
            <div className="ainfo-row"><span className="ainfo-k">Symbol</span><span className="ainfo-v">{h.ticker}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Asset class</span><span className="ainfo-v">{h.cls}</span></div>
            <div className="ainfo-row"><span className="ainfo-k">Last price</span><span className="ainfo-v">{invMoney(h.price, 2)}</span></div>
          </div>
          <div className="danger-zone">
            <span className="dz-title">Remove</span>
            <span className="dz-desc">Take this position out of your tracked portfolio. You can add it again later.</span>
            <button className="btn-danger-out" onClick={() => setConfirm(true)}><Icon name="trash" />Remove position</button>
          </div>
        </Card>
      </div>

      {confirm && <InvDeleteModal holding={h} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete(); }} />}
    </React.Fragment>);
}

Object.assign(window, { InvestmentsPage, InvestmentDetailPage, InvestmentModal, InvDeleteModal, INV_SEED });
