/* ============================================================
   Claud — Warm Finance Dashboard
   Built on the Claud design-system bundle (window.ClaudDesignSystem_de602a).
   React + inline SVG charts. One persona, one calm dashboard.
   ============================================================ */
const DS = window.ClaudDesignSystem_de602a || {};
const { Card, Button, Badge, ProgressBar } = DS;
const { useState, useEffect, useRef } = React;

/* ---------------------------------- format helpers ---- */
const MINUS = "\u2212";
const money = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? MINUS : "") + "$" + s;
};
const signed = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : MINUS + "$") + s;
};

/* ---------------------------------- persona data ---- */
const NAV = ["Dashboard", "Accounts", "Transactions", "Recurring", "Cash Flow", "Budget", "Goals", "Investments", "Foresight"];

// Which primary action lives in the page header, per tab. Tabs not listed show no button.
const PAGE_ACTION = {
  Accounts: "Add account",
  Transactions: "Add transaction",
  Budget: "Add category",
  Goals: "New goal",
  Investments: "Add investment"
};

// 24 monthly net-worth points, ending at the headline figure.
const NET_WORTH = [];

const MONTH_LABELS = (() => {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out = [];let m = 6;let y = 24; // start ~ Jul '24
  for (let i = 0; i < 24; i++) {out.push(names[m % 12] + " '" + String(y).padStart(2, "0"));m++;if (m % 12 === 0) y++;}
  return out;
})();
const PERIODS = { "3M": 4, "6M": 7, "1Y": 13, "All": 24 };

const CASHFLOW = ClaudData.cashflow;


const CATEGORIES = ClaudData.dashCategories;


const TXNS = ClaudData.recent;


const GOALS = ClaudData.goals;


const ACCOUNTS = ClaudData.accounts;


/* ---------------------------------- Accounts page data ---- */
const ACCOUNT_GROUPS = ClaudData.accountGroups;


function findAccount(name) {
  for (const g of ACCOUNT_GROUPS) {
    const a = g.accounts.find((x) => x.name === name);
    if (a) return { ...a, group: g.label };
  }
  return null;
}

/* ---------------------------------- Transactions page data ---- */
const CAT_COLORS = {
  Income: "#4f9a6a", Groceries: "#7a9a52", Dining: "#cf6b3f", Transport: "#5a93a8",
  Shopping: "#b06a8c", Subscriptions: "#8a6fae", Utilities: "#9a8048", Housing: "#c0763e" };

const CAT_ICON = {
  Income: "income", Groceries: "cart", Dining: "coffee", Transport: "fuel",
  Shopping: "bag", Subscriptions: "music", Utilities: "bag", Housing: "bank" };

/* Live category map = built-in categories ∪ the user's live budget categories.
   Create a budget called "test" and it becomes a category you can tag a transaction with. */
function getCatColors() {
  const map = { ...CAT_COLORS };
  const store = window.__claudBudgetStore;
  const groups = store && store.get && store.get();
  if (groups) groups.forEach((g) => g.cats.forEach((c) => { if (!map[c.name]) map[c.name] = c.color; }));
  return map;
}
/* re-render pickers/chips when the budget list changes (category added / edited / removed)
   — also fires when the user reorders categories */
function useBudgetVersion() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    window.addEventListener("claud:budgets-changed", fn);
    return () => window.removeEventListener("claud:budgets-changed", fn);
  }, []);
}

/* User-defined category order, persisted. Drag the filter chips on the Transactions
   page to set it; the inline category dropdown reads the same order. */
const CAT_ORDER_KEY = "claud:catOrder";
function getCatOrder() {
  try { const v = JSON.parse(localStorage.getItem(CAT_ORDER_KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function setCatOrder(order) {
  try { localStorage.setItem(CAT_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
  window.dispatchEvent(new Event("claud:budgets-changed"));
}
/* sort a set of category names by the stored order; unknown names keep their natural order at the end */
function orderCatNames(names) {
  const order = getCatOrder();
  return [...names].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
function orderedCats() { return orderCatNames(Object.keys(getCatColors())); }
Object.assign(window, { getCatColors, CAT_ICON, getCatOrder, setCatOrder, orderCatNames, orderedCats });

const hexA = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const ALL_TXNS = ClaudData.transactions;


/* ---------------------------------- tiny line icons (Lucide-ish, 1.8 stroke) ---- */
function Icon({ name, ...rest }) {
  const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    cart: <g {...P}><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h2.2l2.3 12.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20 7H6" /></g>,
    income: <g {...P}><path d="M12 19V5M12 5l-5 5M12 5l5 5" transform="rotate(180 12 12)" /></g>,
    music: <g {...P}><path d="M9 18V6l10-2v11" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="15" r="2.5" /></g>,
    fuel: <g {...P}><path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M3 20h12" /><path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8l-3-3" /><path d="M7 9h4" /></g>,
    coffee: <g {...P}><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17" /><path d="M7 3v2M11 3v2" /></g>,
    bag: <g {...P}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></g>,
    bank: <g {...P}><path d="M3 10l9-5 9 5M4 10v8M20 10v8M8 10v8M12 10v8M16 10v8M3 19h18" /></g>,
    piggy: <g {...P}><path d="M4 12a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6 4 4 0 0 1-1.5 3v3h-3v-2H9v2H6v-3a5.8 5.8 0 0 1-2-3Z" /><path d="M9 5.5C9 4 10.5 3 12 3" /><circle cx="16" cy="11" r=".6" fill="currentColor" /></g>,
    chart: <g {...P}><path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6" /></g>,
    shield: <g {...P}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="M9.5 12l1.7 1.7 3.3-3.4" /></g>,
    card: <g {...P}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h3" /></g>,
    grid: <g {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>,
    menu: <g {...P}><path d="M4 7h16M4 12h16M4 17h16" /></g>,
    sun: <g {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" /></g>,
    moon: <g {...P}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></g>,
    search: <g {...P}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></g>,
    settings: <g {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></g>,
    sliders: <g {...P}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></g>,
    sort: <g {...P}><path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" /></g>,
    grip: <g {...P}><circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" /></g>,
    bell: <g {...P}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></g>,
    user: <g {...P}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>,
    logout: <g {...P}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></g>,
    help: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.7 1c0 1.7-2.2 2-2.2 3.5" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></g>,
    bug: <g {...P}><path d="m8 2 1.6 1.6M16 2l-1.6 1.6" /><path d="M9 7.5a3 3 0 0 1 6 0V9H9V7.5Z" /><path d="M6 11a6 6 0 0 0 12 0v-2H6v2Z" /><path d="M12 13v8" /><path d="M6 12H3M6 8 3.5 6.5M6 16l-2.5 1.5M18 12h3M18 8l2.5-1.5M18 16l2.5 1.5" /></g>,
    bulb: <g {...P}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.1 13.5c.2-1 .8-1.8 1.5-2.5A5 5 0 1 0 7.4 11c.7.7 1.3 1.5 1.5 2.5" /></g>,
    chat: <g {...P}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></g>,
    book: <g {...P}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></g>,
    check: <g {...P}><path d="M5 13l4 4L19 7" /></g>,
    chevR: <g {...P}><path d="M9 6l6 6-6 6" /></g>,
    arrowL: <g {...P}><path d="M19 12H5M11 18l-6-6 6-6" /></g>,
    trash: <g {...P}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6" /></g>,
    pencil: <g {...P}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></g>,
    plus: <g {...P}><path d="M12 5v14M5 12h14" /></g>,
    alert: <g {...P}><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></g>,
    upload: <g {...P}><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 15V3M8 7l4-4 4 4" /></g>,
    file: <g {...P}><path d="M14 3v5h5" /><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M9 13h6M9 17h6" /></g>,
    paperclip: <g {...P}><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.1 17.8a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6" /></g>,
    image: <g {...P}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 17 4.5-4.5a1.5 1.5 0 0 1 2 0L17 19M14 14l1.8-1.8a1.5 1.5 0 0 1 2 0L20 14" /></g>,
    camera: <g {...P}><path d="M5 8h2l1.4-2h7.2L17 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.2" /></g>,
    home: <g {...P}><path d="M4 11l8-7 8 7" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /><path d="M10 20v-5h4v5" /></g>,
    utensils: <g {...P}><path d="M4 3v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M6 3v18M16 3c-1.6 0-3 1.9-3 5 0 2.6 1.1 4.2 3 4.7V21" /></g>,
    heart: <g {...P}><path d="M12 20s-7-4.4-9.3-8.8A4.6 4.6 0 0 1 12 6.2 4.6 4.6 0 0 1 21.3 11C19 15.6 12 20 12 20Z" /></g>,
    dumbbell: <g {...P}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></g>,
    gift: <g {...P}><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" /><path d="M3 7h18v4H3z" /><path d="M12 7v14" /><path d="M12 7S10.8 3 8.5 3a2.2 2.2 0 0 0 0 4.4" /><path d="M12 7s1.2-4 3.5-4a2.2 2.2 0 0 1 0 4.4" /></g>,
    plane: <g {...P}><path d="M10 4.5a1.4 1.4 0 0 1 2.7 0L14 10l6.5 3.5a1 1 0 0 1 .5.9v1l-7-2-1 5 2 1.5v1l-3.5-1L8 21v-1l2-1.5-1-5-7 2v-1a1 1 0 0 1 .5-.9L9 10Z" /></g>,
    ticket: <g {...P}><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 8 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-8Z" /><path d="M13 7.5v9" strokeDasharray="2 2.5" /></g>,
    gamepad: <g {...P}><path d="M7 8h10a4 4 0 0 1 0 8c-1.4 0-2.2-.7-3-1.5a2 2 0 0 0-1.4-.6h-1.2a2 2 0 0 0-1.4.6C9.2 15.3 8.4 16 7 16a4 4 0 0 1 0-8Z" /><path d="M8 11v2M7 12h2M15.5 11.5h.01M17 13h.01" /></g>,
    phone: <g {...P}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></g>,
    wifi: <g {...P}><path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.3" r=".7" fill="currentColor" /></g>,
    dollar: <g {...P}><path d="M12 2.5v19M16 6.5A3.8 3.8 0 0 0 12.8 5h-1.8a2.8 2.8 0 0 0 0 5.6h2a2.8 2.8 0 0 1 0 5.6h-2A3.8 3.8 0 0 1 8 14.7" /></g>,
    spark: <g {...P}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M19 15l.7 1.8L21.5 17.5 19.7 18.2 19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15Z" /></g>,
    loader: <g {...P}><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></g>,
    tag: <g {...P}><path d="M3 7v5.2a2 2 0 0 0 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L11.6 5.6A2 2 0 0 0 10.2 5H5a2 2 0 0 0-2 2Z" /><circle cx="7.6" cy="7.6" r="1.15" fill="currentColor" stroke="none" /></g>,
    split: <g {...P}><rect x="3" y="5" width="18" height="14" rx="2.2" /><path d="M12 5v14" /></g>,
    note: <g {...P}><path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M8 8h8M8 12h8M8 16h5" /></g>,
    circleCheck: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M8.4 12.4l2.4 2.4 4.8-5.1" /></g>,
    x: <g {...P}><path d="M6 6l12 12M18 6 6 18" /></g>,
    clock: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.9" /></g>,
    calendar: <g {...P}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></g>,
    repeat: <g {...P}><path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5 3.5 18 7 14.5" /><path d="M20.5 13v2a3 3 0 0 1-3 3h-14" /></g>,
    target: <g {...P}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></g>,
    trendUp: <g {...P}><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></g>,
    trendDown: <g {...P}><path d="M3 7l6 6 4-4 8 8" /><path d="M17 17h4v-4" /></g>,
    wallet: <g {...P}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" /><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M16 12.5h.01M21 11h-4a1.5 1.5 0 0 0 0 3h4" /></g>,
    laptop: <g {...P}><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M2 20h20" /></g>
  };
  // Default to text-sized (1em) so an icon never falls back to the SVG default
  // of 300x150 when no surrounding CSS constrains it. Any explicit width/height,
  // style, or CSS rule still overrides this (rest is spread after; CSS/inline
  // styles win over presentational attributes).
  return <svg viewBox="0 0 24 24" width="1em" height="1em" {...rest}>{paths[name]}</svg>;
}

/* ============================================================
   NET WORTH — line + area chart with hover crosshair
   ============================================================ */
function NetWorthChart({ data, labels }) {
  const W = 660,H = 210,padL = 6,padR = 6,padT = 16,padB = 22;
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) return <svg className="nw-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" />;
  const min = Math.min(...data),max = Math.max(...data);
  const span = max - min || 1;
  const innerW = W - padL - padR,innerH = H - padT - padB;
  const pts = data.map((v, i) => ({
    x: padL + (data.length === 1 ? innerW / 2 : i / (data.length - 1) * innerW),
    y: padT + innerH - (v - min) / span * innerH,
    v, label: labels[i]
  }));

  // zero-dollar baseline → split the olive line/area to red where it dips negative
  const zeroY = padT + innerH - (0 - min) / span * innerH;
  const splitOff = Math.max(0, Math.min(1, (zeroY - padT) / innerH));
  const lastNeg = data[data.length - 1] < 0;

  // cardinal spline
  const path = (() => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i],p1 = pts[i],p2 = pts[i + 1],p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6,c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6,c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  })();
  const area = path + ` L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`;
  const grid = [0, 0.5, 1].map((f) => padT + innerH - f * innerH);

  function onMove(e) {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    let best = 0,bd = Infinity;
    pts.forEach((p, i) => {const d = Math.abs(p.x - x);if (d < bd) {bd = d;best = i;}});
    setHover(best);
  }
  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Net worth trend">
        <defs>
          <linearGradient id="nwFill" x1="0" y1={padT} x2="0" y2={padT + innerH} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset={splitOff} stopColor="var(--accent)" stopOpacity="0.02" />
            <stop offset={splitOff} stopColor="var(--red)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--red)" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="nwLine" x1="0" y1={padT} x2="0" y2={padT + innerH} gradientUnits="userSpaceOnUse">
            <stop offset={splitOff} stopColor="var(--accent)" />
            <stop offset={splitOff} stopColor="var(--red)" />
          </linearGradient>
        </defs>
        {grid.map((y, i) =>
        <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
        )}
        <path d={area} fill="url(#nwFill)" />
        <path d={path} fill="none" stroke="url(#nwLine)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {hp && <line x1={hp.x} y1={padT - 6} x2={hp.x} y2={padT + innerH} stroke="var(--accent-line)" strokeWidth="1" strokeDasharray="3 3" />}
        {hp && <circle cx={hp.x} cy={hp.y} r="4.5" fill="var(--card)" stroke={hp.v < 0 ? "var(--red)" : "var(--accent)"} strokeWidth="2.4" />}
        {!hp && <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={lastNeg ? "var(--red)" : "var(--accent)"} />}
      </svg>
      {hp &&
      <div className="chart-tip" style={{ left: `${hp.x / W * 100}%`, top: `${hp.y / H * 100}%` }}>
          <div className="tip-date">{hp.label}</div>
          <div className="tip-val">{money(hp.v)}</div>
        </div>
      }
    </div>);

}

/* ============================================================
   SPENDING RING
   ============================================================ */
function SpendRing({ spent, budget }) {
  const R = 72,C = 2 * Math.PI * R,sz = 168;
  const pct = Math.min(1, spent / budget);
  const over = spent > budget;
  const remaining = budget - spent;
  return (
    <div className="ring-wrap">
      <div className="ring-center">
        <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
          <circle cx={sz / 2} cy={sz / 2} r={R} fill="none" stroke="var(--input-bg)" strokeWidth="14" />
          <circle cx={sz / 2} cy={sz / 2} r={R} fill="none"
          stroke={over ? "var(--red)" : "var(--accent)"} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${pct * C} ${C}`} />
        </svg>
        <div className="ring-mid">
          <span className="rm-big" style={{ color: over ? "var(--red)" : "var(--text)" }}>{money(Math.abs(remaining))}</span>
          <span className="rm-small">{over ? "over budget" : "left to spend"}</span>
        </div>
      </div>
      <div className="ring-legend">
        <div><span className="ll">Spent</span><span className="lv">{money(spent)}</span></div>
        <div><span className="ll">Budget</span><span className="lv">{money(budget)}</span></div>
      </div>
    </div>);

}

/* ============================================================
   CASH FLOW grouped bars
   ============================================================ */
function CashFlow({ data }) {
  const W = 340,H = 150,padB = 22,padT = 8;
  const max = Math.max(...data.flatMap((d) => [d.in, d.out]));
  const innerH = H - padB - padT;
  const groupW = W / data.length;
  const bw = 13,gap = 5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Cash flow">
      {data.map((d, i) => {
        const cx = i * groupW + groupW / 2;
        const inH = d.in / max * innerH,outH = d.out / max * innerH;
        return (
          <g key={i}>
            <rect x={cx - bw - gap / 2} y={padT + innerH - inH} width={bw} height={inH} rx="3" fill="var(--accent)" />
            <rect x={cx + gap / 2} y={padT + innerH - outH} width={bw} height={outH} rx="3" fill="var(--red)" opacity="0.85" />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{d.m}</text>
          </g>);

      })}
    </svg>);

}

/* ============================================================
   SPARKLINE — tiny trend line for account rows
   ============================================================ */
function Sparkline({ data }) {
  const W = 92, H = 30, p = 3;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = p + i / (data.length - 1) * (W - 2 * p);
    const y = p + (H - 2 * p) - (v - min) / span * (H - 2 * p);
    return [x, y];
  });
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const up = data[data.length - 1] >= data[0];
  const col = up ? "var(--green)" : "var(--red)";
  return (
    <div className="acct-spark">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={col} />
      </svg>
    </div>);

}

/* ============================================================
   ACCOUNTS PAGE
   ============================================================ */
function AccountsPage({ onOpen, deleted = [], added = [], iconOv = {}, onSetIcon }) {
  const flat = [...ACCOUNT_GROUPS.flatMap((g) => g.accounts.map((a) => ({ ...a, group: g.label }))), ...added].filter((a) => !deleted.includes(a.name));
  const assets = flat.filter((a) => a.bal > 0).reduce((s, a) => s + a.bal, 0);
  const liabilities = flat.filter((a) => a.bal < 0).reduce((s, a) => s + Math.abs(a.bal), 0);
  const net = assets - liabilities;

  const openRow = (name) => onOpen && onOpen(name);

  const empty = flat.length === 0;
  const creditCount = flat.filter((a) => a.bal < 0).length;

  return (
    <React.Fragment>
      <div className="kpi-3">
        <Card widget><div className="kpi">
          <span className="kpi-label">Total assets</span>
          <span className="kpi-val">{money(assets, 2)}</span>
          {empty
            ? <span className="kpi-delta" style={{ color: "var(--muted)" }}>{"\u2014"}</span>
            : <span className="kpi-delta pos">{"\u2191"} {signed(4570, 0)} this month</span>}
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Total liabilities</span>
          <span className="kpi-val neg">{money(liabilities, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{creditCount} credit account{creditCount === 1 ? "" : "s"}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Net worth</span>
          <span className="kpi-val">{money(net, 2)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{empty ? "0 accounts" : flat.length + " accounts · synced 2h ago"}</span>
        </div></Card>
      </div>

      {empty &&
        <div className="placeholder">
          <Icon name="bank" className="ph-ico" />
          <h2>No accounts</h2>
          <p>You've removed every account. Add one to start tracking again.</p>
        </div>}

      {ACCOUNT_GROUPS.map((g) => {
        const accts = [...g.accounts, ...added.filter((a) => a.group === g.label)].filter((a) => !deleted.includes(a.name));
        if (accts.length === 0) return null;
        const sub = accts.reduce((s, a) => s + a.bal, 0);
        return (
          <Card widget key={g.label}>
            <div className="widget-head">
              <span className="widget-title">{g.label}</span>
              <span className="group-sub muted">{accts.length} account{accts.length === 1 ? "" : "s"} <b style={{ color: sub < 0 ? "var(--red)" : "var(--text)" }}>{money(sub, 2)}</b></span>
            </div>
            <div className="acct-rows">
              {accts.map((a) =>
              <div className="acct-row clickable" key={a.name} role="button" tabIndex={0}
                onClick={() => openRow(a.name)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(a.name); } }}>
                  <IconPicker className="acct-ico" value={iconOv[a.name] || a.icon} onPick={(n) => onSetIcon && onSetIcon(a.name, n)} />
                  <div className="acct-row-body">
                    <span className="acct-row-name">{a.name}{a.apy && <span className="apy-tag">{a.apy}</span>}</span>
                    <span className="acct-row-meta">{a.inst} {"\u00B7\u00B7\u00B7\u00B7"} {a.mask}</span>
                  </div>
                  <Sparkline data={a.trend} />
                  <div className="acct-row-right">
                    <span className={"acct-row-bal " + (a.bal < 0 ? "neg" : "")}>{money(a.bal, 2)}</span>
                    <span className={"acct-row-chg " + (a.chg >= 0 ? "pos" : "neg")}>{signed(a.chg, 0)}</span>
                  </div>
                  <span className="acct-chev"><Icon name="chevR" /></span>
                </div>
              )}
            </div>
          </Card>);

      })}
    </React.Fragment>);

}


/* ============================================================
   TRANSACTIONS PAGE
   ============================================================ */
/* Inline category editor — click the badge to recategorize a row */
function CatPicker({ value, onPick, categories }) {
  useBudgetVersion();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const map = categories || getCatColors();
  const cats = orderCatNames(Object.keys(map));
  if (!cats.includes(value)) cats.unshift(value);
  const colOf = (c) => map[c] || "#9a8048";
  return (
    <span className="cat-edit" ref={ref}>
      <button type="button" className={"cat-badge editable" + (open ? " open" : "")}
        style={{ background: hexA(colOf(value), 0.14), color: colOf(value) }}
        onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title="Change category">
        {value}<span className="cat-caret">{"\u25BE"}</span>
      </button>
      {open &&
        <div className="cat-menu" role="listbox">
          {cats.map((c) =>
            <button key={c} type="button" role="option" aria-selected={c === value}
              className={"cat-opt" + (c === value ? " on" : "")}
              onClick={() => { onPick(c); setOpen(false); }}>
              <span className="cdot" style={{ background: colOf(c) }} />
              <span className="cat-opt-name">{c}</span>
              {c === value && <span className="cat-check">{"\u2713"}</span>}
            </button>
          )}
        </div>}
    </span>);
}

/* themed transaction icons the user can pick from (the same 1.8-stroke line set) */
const TXN_ICON_CHOICES = ["bag", "cart", "coffee", "fuel", "home", "utensils", "music", "card", "bank", "piggy", "chart", "income", "heart", "dumbbell", "gift", "plane", "ticket", "gamepad", "phone", "wifi", "dollar", "camera", "laptop", "book", "wallet", "target", "shield"];

/* Inline icon editor — click a row's icon to pick a new glyph.
   className lets a surface reuse its own icon shape (e.g. "acct-ico", "rec-ico", "goalp-ico");
   color tints the glyph (used by Recurring to match the budget group color). */
function IconPicker({ value, onPick, className = "trow-ico", color, menuAlign = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="ico-edit" ref={ref}>
      <button type="button" className={className + " editable" + (open ? " open" : "")}
        style={color ? { color } : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-haspopup="listbox" aria-expanded={open} title="Change icon" aria-label="Change icon">
        <Icon name={value} />
      </button>
      {open &&
        <div className="ico-menu" role="listbox">
          {TXN_ICON_CHOICES.map((n) =>
            <button key={n} type="button" role="option" aria-selected={n === value}
              className={"ico-opt" + (n === value ? " on" : "")} title={n}
              onClick={(e) => { e.stopPropagation(); onPick(n); setOpen(false); }}>
              <Icon name={n} />
            </button>
          )}
        </div>}
    </span>);
}
Object.assign(window, { CatPicker, IconPicker });

const TXN_SORTS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["high", "Amount: high to low"],
  ["low", "Amount: low to high"],
];
const TXN_SORT_LABEL = Object.fromEntries(TXN_SORTS);

function TransactionsPage({ added = [], removed = [], catOverrides = {}, iconOverrides = {}, onRemove, onRecat, onSetIcon, onUpload }) {
  const { Segmented, Button } = DS;
  useBudgetVersion();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("All");
  const [selCats, setSelCats] = useState([]); // multi-select category filter; empty = all
  const [catOpen, setCatOpen] = useState(false);
  const [sort, setSort] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [viewRcpt, setViewRcpt] = useState(null);
  const [openId, setOpenId] = useState(null);     // detail-drawer transaction id
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [sel, setSel] = useState([]);             // selected ids for bulk actions
  const meta = useTxnMeta();
  const rules = useTxnRules();
  const liveColors = getCatColors();
  const catRef = useRef(null);
  const sortRef = useRef(null);

  useEffect(() => {
    if (!catOpen) return;
    function onDoc(e) { if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false); }
    function onKey(e) { if (e.key === "Escape") setCatOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [catOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    function onDoc(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); }
    function onKey(e) { if (e.key === "Escape") setSortOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [sortOpen]);

  function toggleCat(c) {
    setSelCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }

  // Each transaction gets a stable id. Effective category, in priority order:
  //   explicit per-txn override  ▸  matching auto-rule  ▸  the recorded category.
  // Per-txn extras (splits, note, tags, attachment) come from the meta store; a row
  // "needs review" only until it's confirmed, recategorized, ruled, or split.
  const source = [...added, ...ALL_TXNS.map((x, i) => ({ ...x, id: x.id || "s" + i }))]
    .filter((x) => !removed.includes(x.id))
    .map((x) => {
      const ov = catOverrides[x.id];
      const rule = ov ? null : txpRuleFor(x.name, rules);
      let cat = x.cat;
      if (ov) cat = ov; else if (rule) cat = rule.cat;
      const icon = iconOverrides[x.id] || (cat !== x.cat ? (CAT_ICON[cat] || x.icon) : x.icon);
      const mm = meta[x.id] || {};
      const splits = mm.splits || [];
      const needsReview = Boolean(x.review) && !mm.reviewed && !ov && !rule && splits.length === 0;
      return {
        ...x, cat, icon, splits, needsReview, ruled: !!rule,
        hasNote: !!(mm.note && mm.note.trim()),
        tags: mm.tags || [],
        hasAttach: !!(mm.attachment || x.receipt)
      };
    });

  const reviewCount = source.filter((x) => x.needsReview).length;

  // When the queue empties (everything cleared/reviewed), drop the review-only
  // filter so the pill doesn't linger over an empty list.
  React.useEffect(() => {
    if (reviewCount === 0 && reviewOnly) setReviewOnly(false);
  }, [reviewCount, reviewOnly]);

  // recategorize: update the app-level override, log history, and clear the review flag
  function recat(id, newCat, oldCat) {
    onRecat && onRecat(id, newCat);
    TXP_META.patch(id, (cur) => ({
      reviewed: true,
      history: [...(cur.history || []), { from: oldCat, to: newCat, at: Date.now() }]
    }));
  }
  const confirmReviewed = (ids) => ids.forEach((id) => TXP_META.patch(id, { reviewed: true }));
  const toggleSel = (id) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // categories that actually appear in transactions
  const presentCats = [];
  source.forEach((x) => { if (x.cat && !presentCats.includes(x.cat)) presentCats.push(x.cat); });
  const availCats = orderCatNames(presentCats);
  const activeCats = selCats.filter((c) => availCats.includes(c));

  const filtered = source.filter((x) => {
    if (reviewOnly && !x.needsReview) return false;
    if (q && !x.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (kind === "Income" && x.amt < 0) return false;
    if (kind === "Expenses" && x.amt >= 0) return false;
    if (activeCats.length && !activeCats.includes(x.cat)) return false;
    return true;
  });

  const inflow = filtered.filter((x) => x.amt > 0).reduce((s, x) => s + x.amt, 0);
  const outflow = filtered.filter((x) => x.amt < 0).reduce((s, x) => s + Math.abs(x.amt), 0);

  // apply sort: date sorts keep day grouping; amount sorts produce a flat list.
  // source is maintained newest-first, so "oldest" is just a reverse.
  const byDate = sort === "newest" || sort === "oldest";
  let arranged = filtered;
  if (sort === "oldest") arranged = [...filtered].reverse();
  else if (sort === "high") arranged = [...filtered].sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt));
  else if (sort === "low") arranged = [...filtered].sort((a, b) => Math.abs(a.amt) - Math.abs(b.amt));

  // group by day (date sorts only), preserving arranged order
  const days = [];
  arranged.forEach((x) => {
    let grp = days.find((d) => d.day === x.day);
    if (!grp) { grp = { day: x.day, items: [] }; days.push(grp); }
    grp.items.push(x);
  });

  const renderRow = (x, showWhen) => {
    const selected = sel.includes(x.id);
    const isSplit = x.splits && x.splits.length > 0;
    return (
    <div className={"trow" + (x.needsReview ? " flagged" : "") + (selected ? " selected" : "")} key={x.id}>
      <button className="trow-check" onClick={() => toggleSel(x.id)} aria-pressed={selected} aria-label={selected ? "Deselect transaction" : "Select transaction"}>
        <span className={"tcheck-box" + (selected ? " on" : "")}>{selected ? "\u2713" : ""}</span>
      </button>
      <IconPicker value={x.icon} onPick={(n) => onSetIcon && onSetIcon(x.id, n)} />
      <div className="trow-main">
        <button className="trow-name linkish" onClick={() => setOpenId(x.id)} title="Open details">
          {x.needsReview && <span className="trow-flag" title={x.reason || "Needs review"}><Icon name="alert" /></span>}
          {x.name}
        </button>
        <div className="trow-tags">
          {isSplit
            ? <button className="split-badge" onClick={() => setOpenId(x.id)} title="Split across categories"><Icon name="split" /> Split {"\u00B7"} {x.splits.length}</button>
            : <CatPicker value={x.cat} onPick={(c) => recat(x.id, c, x.cat)} />}
          {(x.hasNote || x.tags.length > 0 || x.hasAttach) &&
            <span className="trow-marks">
              {x.hasNote && <span className="mk" title="Has a note"><Icon name="note" /></span>}
              {x.tags.length > 0 && <span className="mk" title={x.tags.join(", ")}><Icon name="tag" />{x.tags.length}</span>}
              {x.hasAttach && <span className="mk" title="Has attachment"><Icon name="paperclip" /></span>}
            </span>}
          {showWhen && <span className="trow-when">{x.day}</span>}
        </div>
      </div>
      {x.receipt &&
        <button className="trow-clip" onClick={() => setViewRcpt(x)} aria-label={"View receipt for " + x.name} title="View receipt"><Icon name="paperclip" /></button>}
      <span className="trow-acct">{x.account}</span>
      <span className={"trow-amt " + (x.amt >= 0 ? "pos" : "")}>{signed(x.amt)}</span>
      <button className="trow-del" onClick={() => onRemove && onRemove(x.id)} aria-label={"Remove " + x.name} title="Remove transaction"><Icon name="trash" /></button>
    </div>);
  };

  return (
    <React.Fragment>
      <Card widget>
        <div className="txn-summary">
          <div className="txn-sum"><span className="ts-lbl">Showing</span><span className="ts-val">{filtered.length}</span></div>
          <div className="txn-sum"><span className="ts-lbl">Money in</span><span className="ts-val pos">{signed(inflow, 0)}</span></div>
          <div className="txn-sum"><span className="ts-lbl">Money out</span><span className="ts-val neg">{MINUS}{money(outflow, 0).replace(MINUS, "")}</span></div>
          <div className="txn-sum"><span className="ts-lbl">Net</span><span className="ts-val" style={{ color: inflow - outflow >= 0 ? "var(--green)" : "var(--red)" }}>{signed(inflow - outflow, 0)}</span></div>
        </div>
      </Card>

      <div className="txn-toolbar">
        <div className="txn-toolbar-row">
        <div className="txn-search">
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions" aria-label="Search transactions" />
        </div>
        {Segmented && <Segmented options={["All", "Income", "Expenses"]} value={kind} onChange={setKind} />}
        </div>
        <div className="txn-toolbar-row txn-toolbar-controls">
        <div className="ttc-group">
        {(reviewCount > 0 || reviewOnly) &&
          <button type="button" className={"rev-pill" + (reviewOnly ? " on" : "")} onClick={() => setReviewOnly((v) => !v)} aria-pressed={reviewOnly}>
            <span className="btn-ico"><Icon name="alert" /></span>
            Needs review
            {reviewCount > 0 && <span className="rev-pill-count">{reviewCount}</span>}
          </button>}
        <div className="cat-filter" ref={catRef}>
          <button type="button" className={"catf-btn" + (catOpen ? " open" : "") + (activeCats.length ? " active" : "")}
            onClick={() => setCatOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={catOpen}>
            <span className="btn-ico"><Icon name="sliders" /></span>
            Filter
            <span className="cat-caret">{"\u25BE"}</span>
          </button>
          {catOpen &&
            <div className="catf-menu" role="listbox" aria-label="Filter by category">
              <div className="catf-head">
                <span>Filter by category</span>
                {activeCats.length > 0 &&
                  <button type="button" className="catf-clear" onClick={() => setSelCats([])}>Clear</button>}
              </div>
              <div className="catf-list">
                {availCats.length === 0 ?
                  <div className="catf-empty">No categories yet.</div> :
                  availCats.map((c) => {
                    const on = activeCats.includes(c);
                    return (
                      <button key={c} type="button" role="option" aria-selected={on}
                        className={"catf-opt" + (on ? " on" : "")} onClick={() => toggleCat(c)}>
                        <span className={"catf-box" + (on ? " on" : "")}>{on ? "\u2713" : ""}</span>
                        <span className="cdot" style={{ background: liveColors[c] || "#9a8048" }} />
                        <span className="catf-name">{c}</span>
                      </button>);
                  })}
              </div>
            </div>}
        </div>
        <div className="cat-filter sort-filter" ref={sortRef}>
          <button type="button" className={"catf-btn" + (sortOpen ? " open" : "") + (sort !== "newest" ? " active" : "")}
            onClick={() => setSortOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={sortOpen}>
            <span className="btn-ico"><Icon name="sort" /></span>
            Sort
            <span className="cat-caret">{"\u25BE"}</span>
          </button>
          {sortOpen &&
            <div className="catf-menu" role="listbox" aria-label="Sort transactions">
              <div className="catf-head"><span>Sort by</span></div>
              <div className="catf-list">
                {TXN_SORTS.map(([k, l]) => {
                  const on = sort === k;
                  return (
                    <button key={k} type="button" role="option" aria-selected={on}
                      className={"catf-opt" + (on ? " on" : "")} onClick={() => { setSort(k); setSortOpen(false); }}>
                      <span className={"catf-box" + (on ? " on" : "")}>{on ? "\u2713" : ""}</span>
                      <span className="catf-name">{l}</span>
                    </button>);
                })}
              </div>
            </div>}
        </div>
        </div>
        <div className="txn-toolbar-actions">
          {Button && <Button variant="ghost" size="sm" onClick={() => setRulesOpen(true)}><span className="btn-ico"><Icon name="spark" /></span>Rules{rules.length ? " \u00B7 " + rules.length : ""}</Button>}
          {Button && <Button variant="ghost" size="sm" onClick={() => onUpload && onUpload("Statement")}><span className="btn-ico"><Icon name="upload" /></span>Import statement</Button>}
          {Button && <Button variant="ghost" size="sm" onClick={() => onUpload && onUpload("Receipt")}><span className="btn-ico"><Icon name="camera" /></span>Scan receipt</Button>}
        </div>
        </div>
      </div>


      <Card widget>
        {arranged.length === 0 ?
        <div className="txn-empty">No transactions match your filters.</div> :
        byDate ?
        <div className="txn-table">
            {days.map((d) => {
            const dayTot = d.items.reduce((s, x) => s + x.amt, 0);
            return (
              <React.Fragment key={d.day}>
                  <div className="txn-day"><span>{d.day}</span><span className="day-tot" style={{ color: dayTot >= 0 ? "var(--green)" : "var(--muted)" }}>{signed(dayTot, 0)}</span></div>
                  {d.items.map((x) => renderRow(x, false))}
                </React.Fragment>);

          })}
          </div>
        :
        <div className="txn-table">
            {arranged.map((x) => renderRow(x, true))}
          </div>
        }
      </Card>

      {sel.length > 0 && (() => {
        const visibleIds = arranged.map((x) => x.id);
        const allSel = visibleIds.length > 0 && visibleIds.every((id) => sel.includes(id));
        return (
        <BulkBar count={sel.length} total={visibleIds.length} allSelected={allSel}
          onToggleAll={() => setSel(allSel ? [] : visibleIds)}
          onRecat={(c) => { sel.forEach((id) => { const t = source.find((x) => x.id === id); if (t) recat(id, c, t.cat); }); setSel([]); }}
          onConfirm={() => { confirmReviewed(sel); setSel([]); }}
          onExclude={() => { sel.forEach((id) => onRemove && onRemove(id)); setSel([]); }}
          onClear={() => setSel([])} />);
      })()}

      {openId && (() => {
        const t = source.find((x) => x.id === openId);
        if (!t) return null;
        const hasRule = !catOverrides[t.id] && !!txpRuleFor(t.name, rules);
        return <TxnDetailDrawer txn={t} hasRule={hasRule}
          onClose={() => setOpenId(null)} onRecat={recat}
          onRemove={(id) => onRemove && onRemove(id)}
          onSetIcon={(id, n) => onSetIcon && onSetIcon(id, n)}
          onViewReceipt={(x) => setViewRcpt(x)} />;
      })()}

      {rulesOpen && <RulesManager onClose={() => setRulesOpen(false)} />}

      {viewRcpt &&
        <div className="rcpt-overlay" onClick={() => setViewRcpt(null)}>
          <div className="rcpt-light" onClick={(e) => e.stopPropagation()}>
            <div className="rcpt-light-head">
              <div className="rcpt-light-id">
                <span className="rcpt-light-name">{viewRcpt.name}</span>
                <span className="rcpt-light-sub">{viewRcpt.day} {"\u00B7"} {viewRcpt.account}</span>
              </div>
              <span className="rcpt-light-amt">{signed(viewRcpt.amt)}</span>
              <button className="fs-modal-close" onClick={() => setViewRcpt(null)} aria-label="Close">{"\u00D7"}</button>
            </div>
            <div className="rcpt-light-body"><img src={viewRcpt.receipt} alt={"Receipt for " + viewRcpt.name} /></div>
          </div>
        </div>}
    </React.Fragment>);

}

/* ============================================================
   CASH FLOW PAGE — data
   Income sources flow into a "Net income" hub, then back out to
   spending categories and savings buckets. In always equals out
   (savings is the balancer), so the Sankey reads as a closed loop.
   ============================================================ */
const CF_FLOW = {
  "This month": {
    income: [
    { name: "Salary", amt: 5200, color: "#4f9a6a" },
    { name: "Freelance", amt: 850, color: "#5a93a8" },
    { name: "Investments", amt: 370, color: "#7e7a3c" }],

    out: [
    { name: "Housing", amt: 1650, color: "#c0763e", kind: "spend" },
    { name: "Food & dining", amt: 997, color: "#7a9a52", kind: "spend" },
    { name: "Health & other", amt: 600, color: "#b06a8c", kind: "spend" },
    { name: "Shopping", amt: 421, color: "#cf6b3f", kind: "spend" },
    { name: "Utilities", amt: 309, color: "#9a8048", kind: "spend" },
    { name: "Transport", amt: 208, color: "#5a8aa8", kind: "spend" },
    { name: "Emergency fund", amt: 1485, color: "#4f9a6a", kind: "save" },
    { name: "Investing", amt: 750, color: "#3f8f9a", kind: "save" }] },


  "Last month": {
    income: [
    { name: "Salary", amt: 5200, color: "#4f9a6a" },
    { name: "Freelance", amt: 520, color: "#5a93a8" },
    { name: "Investments", amt: 310, color: "#7e7a3c" }],

    out: [
    { name: "Housing", amt: 1650, color: "#c0763e", kind: "spend" },
    { name: "Food & dining", amt: 1080, color: "#7a9a52", kind: "spend" },
    { name: "Health & other", amt: 690, color: "#b06a8c", kind: "spend" },
    { name: "Shopping", amt: 540, color: "#cf6b3f", kind: "spend" },
    { name: "Utilities", amt: 309, color: "#9a8048", kind: "spend" },
    { name: "Transport", amt: 260, color: "#5a8aa8", kind: "spend" },
    { name: "Emergency fund", amt: 990, color: "#4f9a6a", kind: "save" },
    { name: "Investing", amt: 511, color: "#3f8f9a", kind: "save" }] },


  "3-mo avg": {
    income: [
    { name: "Salary", amt: 5200, color: "#4f9a6a" },
    { name: "Freelance", amt: 640, color: "#5a93a8" },
    { name: "Investments", amt: 330, color: "#7e7a3c" }],

    out: [
    { name: "Housing", amt: 1650, color: "#c0763e", kind: "spend" },
    { name: "Food & dining", amt: 1010, color: "#7a9a52", kind: "spend" },
    { name: "Health & other", amt: 560, color: "#b06a8c", kind: "spend" },
    { name: "Shopping", amt: 500, color: "#cf6b3f", kind: "spend" },
    { name: "Utilities", amt: 309, color: "#9a8048", kind: "spend" },
    { name: "Transport", amt: 230, color: "#5a8aa8", kind: "spend" },
    { name: "Emergency fund", amt: 1265, color: "#4f9a6a", kind: "save" },
    { name: "Investing", amt: 646, color: "#3f8f9a", kind: "save" }] } };



const CF_TREND = [
{ m: "Jul", in: 6180, out: 4360 }, { m: "Aug", in: 6240, out: 4510 },
{ m: "Sep", in: 6090, out: 4180 }, { m: "Oct", in: 6420, out: 4720 },
{ m: "Nov", in: 6210, out: 4390 }, { m: "Dec", in: 6880, out: 5240 },
{ m: "Jan", in: 6100, out: 4300 }, { m: "Feb", in: 6250, out: 3980 },
{ m: "Mar", in: 6200, out: 4520 }, { m: "Apr", in: 6420, out: 4185 },
{ m: "May", in: 6300, out: 4410 }, { m: "Jun", in: 6420, out: 4185 }];


/* Representative line items behind each Sankey flow. Scaled to the period's
   category total so a click can drill from a ribbon down to its transactions. */
const TXN_TEMPLATES = {
  "Salary": [["Acme Corp", "Payroll \u00b7 direct deposit", 0.5], ["Acme Corp", "Payroll \u00b7 direct deposit", 0.5]],
  "Freelance": [["Northwind Studio", "Invoice #214", 0.56], ["Cedar & Co.", "Invoice #221", 0.44]],
  "Investments": [["Vanguard", "Dividend", 0.58], ["Ally Savings", "Interest", 0.42]],
  "Housing": [["Sterling Apartments", "Rent", 0.89], ["Lemonade", "Renter's insurance", 0.11]],
  "Food & dining": [["Whole Foods", "Groceries", 0.32], ["Trader Joe's", "Groceries", 0.21], ["Tartine", "Dining out", 0.18], ["DoorDash", "Delivery", 0.16], ["Blue Bottle", "Coffee", 0.13]],
  "Health & other": [["Cigna", "Premium", 0.4], ["Equinox", "Gym", 0.32], ["CVS Pharmacy", "Prescriptions", 0.28]],
  "Shopping": [["Amazon", "Household", 0.42], ["Uniqlo", "Apparel", 0.31], ["Best Buy", "Electronics", 0.27]],
  "Utilities": [["PG&E", "Electric & gas", 0.41], ["Comcast", "Internet", 0.29], ["Verizon", "Phone", 0.22], ["City Water", "Water", 0.08]],
  "Transport": [["Shell", "Fuel", 0.43], ["Clipper", "Transit pass", 0.3], ["Lyft", "Rides", 0.27]],
  "Emergency fund": [["Ally Savings", "Auto-transfer", 0.62], ["Ally Savings", "Round-ups", 0.38]],
  "Investing": [["Fidelity", "Brokerage transfer", 0.6], ["Vanguard", "Roth IRA", 0.4]] };

const buildTxns = (name, amt, monthLabel) => {
  const tpl = TXN_TEMPLATES[name] || [[name, "", 1]];
  const days = [3, 8, 12, 16, 21, 26];
  const rows = tpl.map(([payee, memo, share], i) => ({
    payee, memo, amt: Math.round(amt * share),
    date: monthLabel ? monthLabel + " " + days[i % days.length] : "" }));
  rows[0].amt += amt - rows.reduce((s, r) => s + r.amt, 0); // absorb rounding drift
  return rows;
};

/* ============================================================
   SANKEY — money flow (income → net income → spending / saving)
   ============================================================ */
function Sankey({ income, out, monthLabel }) {
  const W = 1000, H = 440;
  const nodeW = 15, gap = 16;
  const padL = 122, padR = 156, padT = 30, padB = 30;
  const [hov, setHov] = useState(null);
  const [tip, setTip] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {setSel(null);setHov(null);setTip(null);}, [income, out]);

  const total = income.reduce((s, n) => s + n.amt, 0);
  const x0 = padL;
  const x2 = W - padR - nodeW;
  const x1 = (x0 + x2) / 2 - nodeW / 2;

  const maxCount = Math.max(income.length, out.length);
  const availH = H - padT - padB - (maxCount - 1) * gap;
  const scale = availH / total;

  const layout = (nodes, x) => {
    const colH = nodes.reduce((s, n) => s + n.amt * scale, 0) + (nodes.length - 1) * gap;
    let y = padT + (H - padT - padB - colH) / 2;
    return nodes.map((n) => {
      const h = Math.max(2, n.amt * scale);
      const o = { ...n, x, y, h, cx: x + nodeW / 2, mid: y + h / 2 };
      y += h + gap;
      return o;
    });
  };

  const inc = layout(income, x0);
  const outN = layout(out, x2);
  const hubH = total * scale;
  const hubY = padT + (H - padT - padB - hubH) / 2;
  const hub = { x: x1, y: hubY, h: hubH, cx: x1 + nodeW / 2 };

  const links = [];
  let hubIn = hubY;
  inc.forEach((n) => {
    const h = n.amt * scale;
    links.push({ key: "i-" + n.name, color: n.color, value: n.amt, label: n.name + " → Net income",
      sx: n.x + nodeW, sy0: n.y, sy1: n.y + h, tx: hub.x, ty0: hubIn, ty1: hubIn + h });
    hubIn += h;
  });
  let hubOut = hubY;
  outN.forEach((n) => {
    const h = n.amt * scale;
    links.push({ key: "o-" + n.name, color: n.color, value: n.amt, label: "Net income → " + n.name,
      sx: hub.x + nodeW, sy0: hubOut, sy1: hubOut + h, tx: n.x, ty0: n.y, ty1: n.y + h });
    hubOut += h;
  });

  // Resolve a clicked node/ribbon name to its category meta, and toggle selection.
  const pick = (name) => {
    const s = income.find((n) => n.name === name);
    if (s) return { name, amt: s.amt, color: s.color, kind: "income" };
    const o = out.find((n) => n.name === name);
    return o ? { name, amt: o.amt, color: o.color, kind: o.kind } : null;
  };
  const toggle = (name) => {setHov(null);setTip(null);setSel((cur) => cur && cur.name === name ? null : pick(name));};
  const toggleHub = () => {setHov(null);setTip(null);setSel((cur) => cur && cur.kind === "hub" ? null : { name: "Net income", kind: "hub", amt: total, color: "var(--accent)" });};

  const ribbon = (l) => {
    const mx = (l.sx + l.tx) / 2;
    return `M${l.sx},${l.sy0} C${mx},${l.sy0} ${mx},${l.ty0} ${l.tx},${l.ty0} ` +
    `L${l.tx},${l.ty1} C${mx},${l.ty1} ${mx},${l.sy1} ${l.sx},${l.sy1} Z`;
  };

  const txt = (s, x, y, anchor, fill, size, weight) =>
  <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={size} fontWeight={weight}
    style={{ fontVariantNumeric: "tabular-nums" }}>{s}</text>;

  return (
    <div className="sankey-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cash flow Sankey diagram"
        onMouseLeave={() => {setHov(null);setTip(null);}}>
        {/* ribbons */}
        {links.map((l, i) => {
          const rel = sel ? sel.kind === "hub" ? true : sel.kind === "income" ? l.key === "i-" + sel.name : l.key === "o-" + sel.name : null;
          const op = sel ? rel ? 0.6 : 0.05 : hov == null ? 0.28 : hov === i ? 0.6 : 0.07;
          return (
            <path key={l.key} className="sk-flow" d={ribbon(l)} fill={l.color} fillOpacity={op}
              onMouseEnter={() => {if (!sel) {setHov(i);setTip({ x: (l.sx + l.tx) / 2, y: (l.ty0 + l.ty1) / 2, ...l });}}}
              onClick={() => toggle(l.key.slice(2))} />);
        })}

        {/* nodes */}
        {inc.map((n) => <rect key={n.name} className="sk-node" x={n.x} y={n.y} width={nodeW} height={n.h} rx="3" fill={n.color}
          stroke={sel && sel.name === n.name ? "var(--text)" : "none"} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => toggle(n.name)} />)}
        <rect className="sk-node" x={hub.x} y={hub.y} width={nodeW} height={hub.h} rx="3" fill="var(--accent)"
          stroke={sel && sel.kind === "hub" ? "var(--text)" : "none"} strokeWidth="2" style={{ cursor: "pointer" }} onClick={toggleHub} />
        {outN.map((n) => <rect key={n.name} className="sk-node" x={n.x} y={n.y} width={nodeW} height={n.h} rx="3" fill={n.color}
          stroke={sel && sel.name === n.name ? "var(--text)" : "none"} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => toggle(n.name)} />)}

        {/* income labels (left) */}
        {inc.map((n) =>
        <g key={n.name} style={{ cursor: "pointer" }} onClick={() => toggle(n.name)}>
            {txt(n.name, n.x - 12, n.mid - 2, "end", "var(--text)", 13.5, 600)}
            {txt(money(n.amt), n.x - 12, n.mid + 13, "end", "var(--muted)", 12, 500)}
          </g>
        )}

        {/* hub label (above) */}
        {txt("Net income", hub.cx, hub.y - 22, "middle", "var(--text)", 14, 700)}
        {txt(money(total), hub.cx, hub.y - 6, "middle", "var(--accent)", 13, 700)}

        {/* out labels (right) */}
        {outN.map((n) =>
        <g key={n.name} style={{ cursor: "pointer" }} onClick={() => toggle(n.name)}>
            {txt(n.name, n.x + nodeW + 12, n.mid - 2, "start", "var(--text)", 13.5, 600)}
            {txt(money(n.amt), n.x + nodeW + 12, n.mid + 13, "start", n.kind === "save" ? "var(--green)" : "var(--muted)", 12, 500)}
          </g>
        )}
      </svg>

      {!sel && tip &&
      <div className="sk-tip" style={{ left: `${tip.x / W * 100}%`, top: `${tip.y / H * 100}%` }}>
          <div className="skt-flow">{tip.label}</div>
          <div className="skt-val">{money(tip.value, 0)}</div>
        </div>
      }

      {sel && (() => {
        const side = sel.kind === "income" || sel.kind === "hub" ? "left" : "right";
        const isCredit = sel.kind !== "spend";
        const amtColor = isCredit ? "var(--green)" : "var(--text)";
        const kindLabel = sel.kind === "hub" ? "All sources" : sel.kind === "income" ? "Income" : sel.kind === "save" ? "Saved" : "Spending";
        const rows = sel.kind === "hub" ?
        income.map((n) => ({ payee: n.name, memo: "Net income", amt: n.amt, date: "" })) :
        buildTxns(sel.name, sel.amt, monthLabel);
        const foot = sel.kind === "spend" ? "Debits this period" : sel.kind === "hub" ? "Money in, before it flowed back out" : sel.kind === "save" ? "Moved into savings & investments" : "Deposits this period";
        return (
          <div className={"sk-detail " + side}>
            <div className="skd-head">
              <span className="skd-dot" style={{ background: sel.color || "var(--accent)" }} />
              <div className="skd-headtext">
                <div className="skd-title">{sel.name}</div>
                <div className="skd-sub">{kindLabel + " \u00b7 " + rows.length + " " + (sel.kind === "hub" ? "sources" : "transactions")}</div>
              </div>
              <div className="skd-total" style={{ color: amtColor }}>{money(sel.amt, 0)}</div>
              <button className="skd-close" onClick={() => setSel(null)} aria-label="Close">{"\u00d7"}</button>
            </div>
            <div className="skd-list">
              {rows.map((r, i) =>
              <div className="skd-row" key={i}>
                  <div className="skd-rowtext">
                    <div className="skd-payee">{r.payee}</div>
                    <div className="skd-memo">{r.memo}{r.date ? " \u00b7 " + r.date : ""}</div>
                  </div>
                  <div className="skd-amt" style={{ color: amtColor }}>{money(r.amt, 0)}</div>
                </div>
              )}
            </div>
            <div className="skd-foot">{foot}</div>
          </div>);
      })()}
    </div>);

}

/* ============================================================
   CASH FLOW TREND — 12-month grouped bars + net-saved line
   ============================================================ */
function CashFlowTrend({ data }) {
  const W = 940, H = 240, padL = 46, padR = 14, padT = 18, padB = 30;
  const [hov, setHov] = useState(null);
  const max = Math.max(...data.flatMap((d) => [d.in, d.out]));
  const niceMax = Math.ceil(max / 1000) * 1000;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const groupW = innerW / data.length;
  const bw = Math.min(15, groupW / 3.4);
  const yOf = (v) => padT + innerH - v / niceMax * innerH;
  const kf = (v) => "$" + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  const ticks = [0, niceMax / 2, niceMax];

  const netPts = data.map((d, i) => [padL + i * groupW + groupW / 2, yOf(d.in - d.out)]);
  const netPath = netPts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  return (
    <div className="cft-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12-month cash flow"
        onMouseLeave={() => setHov(null)}>
        {ticks.map((t, i) =>
        <g key={i}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
            <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{kf(t)}</text>
          </g>
        )}
        {data.map((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const inH = d.in / niceMax * innerH, outH = d.out / niceMax * innerH;
          const on = hov === i;
          return (
            <g key={i} onMouseEnter={() => setHov(i)}>
              <rect x={cx - groupW / 2} y={padT} width={groupW} height={innerH} fill={on ? "var(--hover)" : "transparent"} />
              <rect x={cx - bw - 1.5} y={padT + innerH - inH} width={bw} height={inH} rx="3" fill="var(--accent)" opacity={hov == null || on ? 1 : 0.4} />
              <rect x={cx + 1.5} y={padT + innerH - outH} width={bw} height={outH} rx="3" fill="var(--red)" opacity={hov == null || on ? 0.92 : 0.35} />
              <text x={cx} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.m}</text>
            </g>);

        })}
        <path d={netPath} fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 5" />
        {netPts.map((p, i) =>
        <circle key={i} cx={p[0]} cy={p[1]} r={hov === i ? 4 : 2.6} fill="var(--green)" />
        )}
        {hov != null && (() => {
          const px = netPts[hov][0], py = netPts[hov][1];
          const label = signed(data[hov].in - data[hov].out, 0);
          const w = label.length * 7.3 + 18, h = 21;
          let bx = Math.max(padL, Math.min(px - w / 2, W - padR - w));
          let by = py - h - 9, below = false;
          if (by < padT + 2) {by = py + 9;below = true;}
          const tipX = Math.max(bx + 9, Math.min(px, bx + w - 9));
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={px} y1={py} x2={tipX} y2={below ? by : by + h} stroke="var(--green)" strokeWidth="1" strokeOpacity="0.45" />
              <rect x={bx} y={by} width={w} height={h} rx="6" fill="var(--card)" stroke="var(--green)" strokeOpacity="0.55" />
              <text x={bx + w / 2} y={by + h / 2 + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--green)" style={{ fontVariantNumeric: "tabular-nums" }}>{label}</text>
            </g>);
        })()}
      </svg>
    </div>);

}

/* ============================================================
   CASH FLOW PAGE
   ============================================================ */
function CashFlowPage() {
  useClaudData();
  const { Segmented } = DS;
  const sk = ClaudData.sankey || {};
  const cfColor = (name) => (window.getCatColors && window.getCatColors()[name]) || "#8a8a8a";
  const _income = (sk.incomeSources || []).map((x) => ({ name: x.name, amt: x.v, color: cfColor(x.name) }));
  const _spendOut = (sk.spendCategories || []).map((x) => ({ name: x.name, amt: x.v, color: cfColor(x.name), kind: "spend" }));
  const _ti = _income.reduce((a, x) => a + x.amt, 0);
  const _sp = _spendOut.reduce((a, x) => a + x.amt, 0);
  const _save = Math.max(0, _ti - _sp);
  const flow = { income: _income, out: _save > 0 ? [..._spendOut, { name: "Net saved", amt: _save, color: "var(--green)", kind: "save" }] : _spendOut };
  const periods = ["This month"];
  const per = "This month";
  const setPer = () => {};

  const tin = flow.income.reduce((s, n) => s + n.amt, 0);
  const spend = flow.out.filter((o) => o.kind === "spend").reduce((s, n) => s + n.amt, 0);
  const save = flow.out.filter((o) => o.kind === "save").reduce((s, n) => s + n.amt, 0);
  const rate = Math.round(save / tin * 100);

  return (
    <React.Fragment>
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Money in</span>
          <span className="kpi-val pos">{money(tin, 0)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{flow.income.length} sources</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Money out</span>
          <span className="kpi-val neg">{money(spend, 0)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>across {flow.out.filter((o) => o.kind === "spend").length} categories</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Net saved</span>
          <span className="kpi-val pos">{signed(save, 0)}</span>
          <span className="kpi-delta pos">{"\u2191"} put to work</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Savings rate</span>
          <span className="kpi-val">{rate}%</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>of income kept</span>
        </div></Card>
      </div>

      <Card widget>
        <div className="cf-hero-head">
          <div>
            <span className="widget-eyebrow">Money flow</span>
            <div className="cf-hero-title">Where every dollar went</div>
          </div>
          <div className="cf-hero-right">
            <div className="sk-legend">
              <span className="sk-leg"><span className="sw" style={{ background: "var(--accent)" }} />Spending</span>
              <span className="sk-leg"><span className="sw" style={{ background: "var(--green)" }} />Saved</span>
            </div>
            {Segmented && <Segmented options={periods} value={per} onChange={setPer} />}
          </div>
        </div>
        {(flow.income.length || flow.out.length) ?
          <Sankey income={flow.income} out={flow.out} monthLabel="this month" /> :
          <div className="sk-cap" style={{ padding: "28px 0", textAlign: "center" }}>No money has moved yet this month. Add income and expense transactions to see your flow.</div>}
        <div className="sk-cap">Tip: hover any flow to trace a dollar from its source — or click a band to see the transactions behind it.</div>
      </Card>

      <Card widget>
        <div className="widget-head">
          <span className="widget-title">12-month cash flow</span>
          <div className="cf-legend">
            <span className="cf-leg"><span className="sw" style={{ background: "var(--accent)" }} />In</span>
            <span className="cf-leg"><span className="sw" style={{ background: "var(--red)" }} />Out</span>
            <span className="cf-leg"><span className="sw" style={{ background: "var(--green)", borderRadius: "999px", width: 10, height: 10 }} />Net saved</span>
          </div>
        </div>
        <CashFlowTrend data={ClaudData.cashflow} />
      </Card>
    </React.Fragment>);

}

/* ============================================================
   APP
   ============================================================ */
const ACCENTS = {
  Terracotta: { light: "#c05f2e", dark: "#cf7846" },
  Amber: { light: "#c2892c", dark: "#cf9847" },
  Clay: { light: "#a65b43", dark: "#bd7860" },
  Olive: { light: "#7e7a3c", dark: "#9c9856" }
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "Olive",
  "surface": "linen",
  "density": "cozy",
  "recurringView": "timeline",
  "goalsLayout": "rows",
  "coverStyle": "suggested",
  "insightsPlacement": "sidebar"
} /*EDITMODE-END*/;

/* ---------------------------------- small switch (reuses .roll-switch) ---- */
function Switch({ on, onChange }) {
  return (
    <button className={"roll-switch " + (on ? "on" : "")} role="switch" aria-checked={on}
      onClick={() => onChange(!on)}>
      <span className="roll-knob" />
    </button>);

}

/* ---------------------------------- user menu (click name → dropdown) ---- */
function UserMenu({ onSettings, onHelp, onUpgrade, onProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const u = (window.ClaudData && ClaudData.user) || {};
  const uname = u.name || u.email || "You";
  const uinit = (String(uname).trim().charAt(0) || "Y").toUpperCase();
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  return (
    <div className="user-wrap" ref={ref}>
      {open &&
      <div className="user-menu" role="menu">
        <div className="user-menu-head">
          <span className="avatar" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{uinit}</span>
          <div className="umh-id">
            <div className="umh-name">{uname}</div>
            <div className="umh-mail">{u.email || ""}</div>
          </div>
        </div>
        <div className="user-menu-list">
          <button className="um-item upgrade" role="menuitem" onClick={() => { setOpen(false); onUpgrade && onUpgrade(); }}>
            <Icon name="spark" />Upgrade to Pro
          </button>
          <button className="um-item" role="menuitem" onClick={() => { setOpen(false); onSettings(); }}>
            <Icon name="settings" />Settings
          </button>
          <button className="um-item" role="menuitem" onClick={() => { setOpen(false); onProfile && onProfile(); }}><Icon name="user" />Profile</button>
          <button className="um-item" role="menuitem" onClick={() => { setOpen(false); onHelp && onHelp(); }}><Icon name="help" />Help & support</button>
        </div>
        <div className="user-menu-foot">
          <button className="um-item danger" role="menuitem" onClick={() => window.ClaudAPI && window.ClaudAPI.logout()}><Icon name="logout" />Sign out</button>
        </div>
      </div>
      }
      <button className={"user-btn " + (open ? "open" : "")} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{uinit}</span>
        <span className="user-name">{uname}<span className="user-sub">{u.email || ""}</span></span>
        <span className="user-caret">{"\u25BE"}</span>
      </button>
    </div>);

}

/* ---------------------------------- settings modal ---- */
const CURRENCIES = ["CAD — $ Canadian Dollar", "USD — $ US Dollar", "EUR — \u20AC Euro", "GBP — \u00A3 British Pound"];
const SET_SECTIONS = [
  { id: "Appearance", icon: "sun" },
  { id: "Preferences", icon: "sliders" },
  { id: "Reports", icon: "calendar" },
  { id: "Notifications", icon: "bell" }];


function SettingsModal({ t, setTweak, onClose, currency, setCurrency, cycleStart, setCycleStart }) {
  const { Segmented } = DS;
  const [sec, setSec] = useState("Appearance");
  // demo-local preference state
  const [weekStart, setWeekStart] = useState("Monday");
  const [rollover, setRollover] = useState(true);
  const [nWeekly, setNWeekly] = useState(true);
  const [nOver, setNOver] = useState(true);
  const [nLarge, setNLarge] = useState(false);
  // reports
  const [rangeBasis, setRangeBasis] = useState("cycle"); // cycle | custom
  const [customFrom, setCustomFrom] = useState("2026-05-13");
  const [customTo, setCustomTo] = useState("2026-06-12");
  const [name, setName] = useState((window.ClaudData && ClaudData.user && ClaudData.user.name) || "");
  const [email, setEmail] = useState((window.ClaudData && ClaudData.user && ClaudData.user.email) || "");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Row = ({ title, desc, children }) =>
    <div className="set-row">
      <div className="set-row-label">
        <span className="srl-t">{title}</span>
        {desc && <span className="srl-d">{desc}</span>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>;

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="set-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="set-head">
          <h2>Settings</h2>
          <button className="set-close" onClick={onClose} aria-label="Close settings">{"\u00D7"}</button>
        </div>
        <div className="set-main">
          <nav className="set-nav">
            {SET_SECTIONS.map((s) =>
            <button key={s.id} className={sec === s.id ? "on" : ""} onClick={() => setSec(s.id)}>
              <Icon name={s.icon} />{s.id}
            </button>
            )}
          </nav>
          <div className="set-body">
            {sec === "Appearance" &&
            <React.Fragment>
              <Row title="Theme" desc="Use a light or dark interface.">
                {Segmented && <Segmented options={["Light", "Dark"]} value={t.dark ? "Dark" : "Light"} onChange={(v) => setTweak("dark", v === "Dark")} />}
              </Row>
              <Row title="Accent color" desc="The single brand color used across the app.">
                <div className="set-swatches">
                  {Object.keys(ACCENTS).map((k) =>
                  <button key={k} className={"set-sw " + (t.accent === k ? "on" : "")} title={k} aria-label={k}
                    style={{ background: t.dark ? ACCENTS[k].dark : ACCENTS[k].light }}
                    onClick={() => setTweak("accent", k)}>
                    {t.accent === k && <Icon name="check" />}
                  </button>
                  )}
                </div>
              </Row>
              <Row title="Background warmth" desc="Light-theme surface tint.">
                {Segmented && <Segmented options={["Sand", "Cream", "Linen"]} value={t.surface.charAt(0).toUpperCase() + t.surface.slice(1)} onChange={(v) => setTweak("surface", v.toLowerCase())} />}
              </Row>
              <Row title="Density" desc="Spacing between cards and rows.">
                {Segmented && <Segmented options={["Cozy", "Compact"]} value={t.density === "compact" ? "Compact" : "Cozy"} onChange={(v) => setTweak("density", v.toLowerCase())} />}
              </Row>
            </React.Fragment>
            }
            {sec === "Preferences" &&
            <React.Fragment>
              <Row title="Currency" desc="How money is displayed throughout ClaudBudget.">
                <select className="set-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Row>
              <Row title="First day of week" desc="Used in cash-flow and budget periods.">
                <select className="set-select" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}>
                  <option>Sunday</option><option>Monday</option>
                </select>
              </Row>
              <Row title="Budget rollover" desc="Carry each category's leftover budget into the next month.">
                <Switch on={rollover} onChange={setRollover} />
              </Row>
            </React.Fragment>
            }
            {sec === "Reports" &&
            <React.Fragment>
              <Row title="Reporting period" desc="How summaries and budgets group your activity.">
                {Segmented && <Segmented options={["Monthly cycle", "Custom range"]} value={rangeBasis === "custom" ? "Custom range" : "Monthly cycle"} onChange={(v) => setRangeBasis(v === "Custom range" ? "custom" : "cycle")} />}
              </Row>
              {rangeBasis === "cycle" ?
              <React.Fragment>
                <Row title="Month starts on" desc="Set this to your pay date — e.g. the 13th — so each cycle matches when money actually lands.">
                  <select className="set-select" value={cycleStart} onChange={(e) => setCycleStart(Number(e.target.value))} style={{ minWidth: 150 }}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => {
                      const suf = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
                      return <option key={d} value={d}>{d === 1 ? "1st (calendar month)" : d + suf}</option>;
                    })}
                  </select>
                </Row>
                <div className="set-row" style={{ borderBottom: "none" }}>
                  <div className="set-row-label">
                    <span className="srl-t" style={{ color: "var(--muted)" }}>This month's cycle</span>
                  </div>
                  <div className="set-row-control">
                    <span className="rev-cycle" style={{ margin: 0 }}><Icon name="calendar" /> {insCycleLabel(2026, 5, cycleStart)}</span>
                  </div>
                </div>
              </React.Fragment> :
              <Row title="Custom date range" desc="Report on an exact window — useful for a trip, a project, or a tax period.">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="date" className="set-input" style={{ minWidth: 0 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <span className="muted">{"\u2192"}</span>
                  <input type="date" className="set-input" style={{ minWidth: 0 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </Row>
              }
            </React.Fragment>
            }
            {sec === "Notifications" &&
            <React.Fragment>
              <Row title="Weekly summary email" desc="A Monday recap of last week's spending.">
                <Switch on={nWeekly} onChange={setNWeekly} />
              </Row>
              <Row title="Budget overspend alerts" desc="Notify when a category goes over budget.">
                <Switch on={nOver} onChange={setNOver} />
              </Row>
              <Row title="Large transaction alerts" desc="Flag any single charge over $500.">
                <Switch on={nLarge} onChange={setNLarge} />
              </Row>
            </React.Fragment>
            }
          </div>
        </div>
        <div className="set-foot">
          <span className="set-note">Your settings are saved to your account.</span>
          {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
          {Button && <Button variant="primary" size="sm" onClick={() => { if (window.ClaudActions && typeof name === "string") ClaudActions.updateProfile(name); onClose(); }}>Done</Button>}
        </div>
      </div>
    </div>);

}

/* ---------------------------------- Help & support ---- */
const HELP_FAQ = [
  { q: "How does ClaudBudget know my account balances?", a: "ClaudBudget reads the balances you connect under Accounts and refreshes them periodically. Nothing is moved — it only ever reads, so your money stays where it is." },
  { q: "What is Foresight projecting?", a: "Foresight walks your net worth forward year by year using today's budget and the life-event plans you add. Figures are shown in today's dollars, so the line reflects real purchasing power." },
  { q: "Why don't my Foresight expenses match my budget exactly?", a: "Foresight rolls your monthly budget categories into a few annual groups (Housing, Food & dining, Lifestyle, and so on) and multiplies by twelve. Edit a category in the Budget tab and the projection updates." },
  { q: "Does budget rollover carry over unspent money?", a: "Yes. With rollover on, whatever you don't spend in a category this month is added to next month's available amount for that category." },
  { q: "Is my data shared with anyone?", a: "No. ClaudBudget is a single-person app behind your login. Your figures aren't sold, shared, or used to train anything." }
];

/* ---------------------------------- profile modal ---- */
function ProfileModal({ onClose }) {
  const [name, setName] = useState((window.ClaudData && ClaudData.user && ClaudData.user.name) || "");
  const [email, setEmail] = useState((window.ClaudData && ClaudData.user && ClaudData.user.email) || "");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initial = (name.trim().charAt(0) || "A").toUpperCase();

  const Row = ({ title, desc, children }) =>
    <div className="set-row">
      <div className="set-row-label">
        <span className="srl-t">{title}</span>
        {desc && <span className="srl-d">{desc}</span>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>;

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="set-modal pf-modal" role="dialog" aria-modal="true" aria-label="Profile">
        <div className="set-head">
          <h2>Profile</h2>
          <button className="set-close" onClick={onClose} aria-label="Close profile">{"\u00D7"}</button>
        </div>
        <div className="pf-body">
          <div className="pf-identity">
            <span className="avatar pf-avatar" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{initial}</span>
            <div className="pf-id-text">
              <div className="pf-id-name">{name || "Your name"}</div>
              <div className="pf-id-mail muted">{email || "your@email.com"}</div>
            </div>
          </div>
          <Row title="Name">
            <input className="set-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Row>
          <Row title="Email" desc="Where account and summary emails are sent.">
            <input className="set-input" type="email" value={email} readOnly title="Email is your sign-in and can\u2019t be changed here." />
          </Row>
          <Row title="Phone" desc="Optional — used only for security alerts.">
            <input className="set-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add a number" />
          </Row>
        </div>
        <div className="set-foot">
          <span className="set-note">Your settings are saved to your account.</span>
          {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
          {Button && <Button variant="primary" size="sm" onClick={() => { if (window.ClaudActions && typeof name === "string") ClaudActions.updateProfile(name); onClose(); }}>Done</Button>}
        </div>
      </div>
    </div>);
}

function HelpFaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"hs-faq" + (open ? " open" : "")}>
      <button className="hs-faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="hs-faq-caret"><Icon name="chevR" /></span>
      </button>
      {open && <div className="hs-faq-a">{a}</div>}
    </div>);
}

function HelpModal({ onClose }) {
  // view: "home" | "bug" | "feature" | "faq" ; sent: which form was just submitted
  const [view, setView] = useState("home");
  const [sent, setSent] = useState(null);
  const [text, setText] = useState("");
  const [severity, setSeverity] = useState("Minor");
  const [email, setEmail] = useState((window.ClaudData && ClaudData.user && ClaudData.user.email) || "");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (v) => { setView(v); setSent(null); setText(""); setSeverity("Minor"); };

  const OPTIONS = [
    { id: "bug", icon: "bug", title: "Report a bug", desc: "Something looks wrong or isn't working." },
    { id: "feature", icon: "bulb", title: "Request a feature", desc: "Suggest something you'd like ClaudBudget to do." },
    { id: "faq", icon: "book", title: "Browse the FAQ", desc: "Quick answers to common questions." }
  ];
  const titleOf = { bug: "Report a bug", feature: "Request a feature", faq: "Frequently asked questions" };

  const submit = (kind) => { if (kind !== "faq" && !text.trim()) return; setSent(kind); };

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hs-modal" role="dialog" aria-modal="true" aria-label="Help and support">
        <div className="set-head">
          <h2>{view === "home" ? "Help & support" : titleOf[view]}</h2>
          <button className="set-close" onClick={onClose} aria-label="Close help">{"\u00D7"}</button>
        </div>

        {view !== "home" &&
          <button className="hs-back" onClick={() => go("home")}><Icon name="arrowL" />All topics</button>}

        <div className="hs-body">
          {view === "home" &&
            <React.Fragment>
              <p className="hs-intro">How can we help? Pick a topic below — or email <a href="mailto:support@claud.app" className="hs-link">support@claud.app</a> and we'll get back to you within a day.</p>
              <div className="hs-options">
                {OPTIONS.map((o) =>
                  <button key={o.id} className="hs-option" onClick={() => go(o.id)}>
                    <span className="hs-option-ico"><Icon name={o.icon} /></span>
                    <span className="hs-option-text">
                      <span className="hs-option-title">{o.title}</span>
                      <span className="hs-option-desc">{o.desc}</span>
                    </span>
                    <span className="hs-option-chev"><Icon name="chevR" /></span>
                  </button>
                )}
              </div>
            </React.Fragment>
          }

          {(view === "bug" || view === "feature") && (sent ?
            <div className="hs-success">
              <span className="hs-success-ico"><Icon name="check" /></span>
              <div className="hs-success-title">{sent === "bug" ? "Bug report sent" : "Request received"}</div>
              <p className="hs-success-text">Thanks — we've logged this and will follow up at <b>{email}</b> if we need more detail.</p>
              <div className="hs-success-actions">
                {Button && <Button variant="ghost" size="sm" onClick={() => go(sent)}>Submit another</Button>}
                {Button && <Button variant="primary" size="sm" onClick={onClose}>Done</Button>}
              </div>
            </div> :
            <div className="hs-form">
              {view === "bug" &&
                <label className="hs-field">
                  <span className="hs-field-label">How serious is it?</span>
                  <div className="hs-seg">
                    {["Minor", "Annoying", "Blocking"].map((s) =>
                      <button key={s} type="button" className={"hs-seg-btn" + (severity === s ? " on" : "")} onClick={() => setSeverity(s)}>{s}</button>
                    )}
                  </div>
                </label>
              }
              <label className="hs-field">
                <span className="hs-field-label">{view === "bug" ? "What happened?" : "What would you like to see?"}</span>
                <textarea className="hs-textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={view === "bug" ? "Describe what you were doing and what went wrong. Steps to reproduce help a lot." : "Tell us about the feature and what problem it would solve for you."} />
              </label>
              <label className="hs-field">
                <span className="hs-field-label">Your email</span>
                <input className="hs-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <div className="hs-form-foot">
                <span className="hs-note">{view === "bug" ? "Diagnostics about your current screen are attached automatically." : "We read every request, even if we can't build them all."}</span>
                {Button && <Button variant="primary" size="sm" onClick={() => submit(view)} disabled={!text.trim()}>{view === "bug" ? "Send report" : "Send request"}</Button>}
              </div>
            </div>)
          }

          {view === "faq" &&
            <div className="hs-faqs">
              {HELP_FAQ.map((f, i) => <HelpFaqItem key={i} q={f.q} a={f.a} />)}
              <p className="hs-faq-foot">Didn't find it? <button className="hs-link as-btn" onClick={() => go("bug")}>Report a bug</button> or email <a href="mailto:support@claud.app" className="hs-link">support@claud.app</a>.</p>
            </div>
          }
        </div>
      </div>
    </div>);
}

/* ---------------------------------- upgrade to Pro ---- */
// Free = everything in the app today. Pro = the reasoning features.
const UP_FREE = [
  { t: "All your accounts" },
  { t: "Unlimited transactions" },
  { t: "Cash flow & budgets" },
  { t: "Investments & net worth" },
  { t: "Dark & light themes" }
];
const UP_PRO = [
  { t: "Receipt scanning", d: "Photograph a receipt; the payee, date and amount fill themselves in." },
  { t: "Foresight", d: "Project your net worth decades ahead, anchored to your real balances." },
  { t: "Insights", d: "A quiet note when your spending or saving meaningfully shifts." }
];
// CAD/USD share the dollar sign; only the footer code differs.
const CURRENCY_SYMBOL = { CAD: "$", USD: "$", EUR: "\u20AC", GBP: "\u00A3" };
function currencyCode(c) { return (c || "").trim().split(/[\s\u2014-]/)[0] || "CAD"; }

function UpgradeModal({ currency, onClose }) {
  const [billing, setBilling] = useState("annual");
  const code = currencyCode(currency);
  const sym = CURRENCY_SYMBOL[code] || "$";
  const monthly = 8;
  const annualTotal = monthly * 9;            // ~25% off
  const annualPerMo = +(annualTotal / 12).toFixed(2);
  const save = monthly * 12 - annualTotal;
  const proAmt = billing === "annual" ? annualPerMo : monthly;
  const proSub = billing === "annual" ? `${sym}${annualTotal} billed yearly` : "billed monthly";

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="up cards" role="dialog" aria-modal="true" aria-label="Choose your plan">
        <div className="up-head">
          <div className="up-head-text">
            <h2>Choose your plan</h2>
            <p>Free keeps everything you track today. Pro adds receipt scanning, Foresight and insights.</p>
          </div>
          <button className="up-close" aria-label="Close" onClick={onClose}>{"\u00D7"}</button>
        </div>

        <div className="up-billing">
          <div className="up-seg" role="tablist" aria-label="Billing period">
            <button className={billing === "monthly" ? "on" : ""} onClick={() => setBilling("monthly")}>Monthly</button>
            <button className={billing === "annual" ? "on" : ""} onClick={() => setBilling("annual")}>Annual</button>
          </div>
          {billing === "annual" && <span className="up-save">Save {sym}{save} a year</span>}
        </div>

        <div className="up-cards-grid">
          {/* FREE */}
          <div className="plan free">
            <div>
              <div className="plan-eyebrow">Free</div>
              <div className="plan-price" style={{ marginTop: 10 }}>
                <span className="pp-amt">{sym}0</span>
              </div>
              <div className="plan-sub">free forever</div>
            </div>
            <p className="plan-line">The essentials, tracked honestly.</p>
            <Button variant="ghost" disabled>Your current plan</Button>
            <ul className="plan-feats">
              {UP_FREE.map((f) => (
                <li className="feat" key={f.t}>
                  <span className="feat-check"><Icon name="check" /></span>
                  <div className="feat-body"><div className="feat-t">{f.t}</div></div>
                </li>
              ))}
            </ul>
          </div>

          {/* PRO */}
          <div className="plan pro">
            <span className="plan-rec">Recommended</span>
            <div>
              <div className="plan-eyebrow">Pro</div>
              <div className="plan-price" style={{ marginTop: 10 }}>
                <span className="pp-amt">{sym}{proAmt}</span>
                <span className="pp-per">/ month</span>
              </div>
              <div className="plan-sub">{proSub}</div>
            </div>
            <p className="plan-line">Everything in Free, plus the features that do the reading for you.</p>
            <Button variant="primary" onClick={() => { ClaudActions.setPlan("pro").then(() => onClose && onClose()); }}>Upgrade to Pro</Button>
            <ul className="plan-feats">
              <li className="feat">
                <span className="feat-check"><Icon name="check" /></span>
                <div className="feat-body"><div className="feat-t feat-more">Everything in Free</div></div>
              </li>
              {UP_PRO.map((f) => (
                <li className="feat key" key={f.t}>
                  <span className="feat-check"><Icon name="check" /></span>
                  <div className="feat-body">
                    <div className="feat-t">{f.t}</div>
                    <div className="feat-d">{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="up-foot-note">Switch or cancel anytime · prices in {code}</div>
      </div>
    </div>);
}

function ProGate({ feature, blurb, onUpgrade }) {
  return (
    <div className="placeholder">
      <Icon name="spark" className="ph-ico" />
      <h2>{feature} is a Pro feature</h2>
      <p>{blurb}</p>
      {Button && <Button variant="primary" onClick={onUpgrade} style={{ marginTop: 14 }}>Upgrade to Pro</Button>}
    </div>);
}

/* Soft email-verification gate: a dismissible banner shown until the signed-in
   user's email is verified. Lets them keep using the app (no hard wall) while
   nudging confirmation, with a rate-limited Resend. */
function VerifyBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const user = (window.ClaudData && ClaudData.user) || {};
  if (dismissed || !user || user.email_verified) return null;

  const resend = () => {
    if (busy || sent) return;
    setBusy(true);
    window.ClaudAPI.resendVerification()
      .then(function () { setBusy(false); setSent(true); })
      .catch(function () { setBusy(false); setSent(true); });   // stay generic
  };

  const wrap = {
    display: "flex", alignItems: "center", gap: 11,
    background: "var(--warn-soft)", border: "1px solid var(--warn-line)",
    color: "var(--text)", borderRadius: "var(--radius-md, 10px)",
    padding: "11px 14px", fontSize: "var(--text-sm, 0.9rem)", lineHeight: 1.45
  };
  const linkBtn = {
    background: "none", border: "none", color: "var(--accent)", fontFamily: "inherit",
    fontSize: "inherit", fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline"
  };
  const xBtn = {
    background: "none", border: "none", color: "var(--muted)", fontSize: 18, lineHeight: 1,
    cursor: "pointer", padding: "0 4px", marginLeft: "auto", flexShrink: 0
  };

  return (
    <div className="verify-banner" style={wrap}>
      <span aria-hidden="true" style={{ color: "var(--warn)", display: "inline-flex", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
      </span>
      <span>
        {sent
          ? "Verification email sent — check your inbox (and spam)."
          : (<React.Fragment>Confirm your email{user.email ? (<React.Fragment> — we sent a link to <b>{user.email}</b></React.Fragment>) : null}. </React.Fragment>)}
        {!sent && <button type="button" style={linkBtn} onClick={resend} disabled={busy}>{busy ? "Sending…" : "Resend"}</button>}
      </span>
      <button type="button" aria-label="Dismiss" style={xBtn} onClick={() => setDismissed(true)}>{"×"}</button>
    </div>
  );
}

/* ============================================================
   FIRST-RUN SETUP MODAL
   Shown once on first login (when settings.onboarded is falsy). Lets the user
   pick which of the seeded default categories to keep, and optionally fill in a
   recommended 50/30/20 budget from an average monthly income.
   On finish it deletes unchecked categories and (if income given) updates the
   kept categories' budgets, then flips settings.onboarded = true so it never
   reshows. All names below are FirstRun- and Frs-prefixed to stay unique in the
   shared Babel scope.
   ============================================================ */

// Default monthly amounts the 50/30/20 split is proportioned from (the seeded
// starter budget). Keyed by category NAME (see server DEFAULT_BUDGET).
const FRS_DEFAULT_AMT = {
  "Housing": 1700, "Groceries": 700, "Utilities": 260, "Transport": 300, "Insurance": 180,
  "Dining": 300, "Shopping": 400, "Entertainment": 150, "Subscriptions": 120,
  "Health & fitness": 250, "Misc": 240, "Emergency fund": 800, "General savings": 250
};

// Map a (groupLabel, categoryName) to a 50/30/20 bucket. Group-level mapping,
// except "Health & other" which is split per-category. Unknown -> null (left as-is).
function frsBucketFor(groupLabel, catName) {
  if (groupLabel === "Essentials") return "needs";
  if (groupLabel === "Lifestyle") return "wants";
  if (groupLabel === "Savings goals") return "savings";
  if (groupLabel === "Health & other") {
    if (catName === "Health & fitness") return "needs";
    if (catName === "Misc") return "wants";
    return null;
  }
  return null;
}
const FRS_BUCKET_PCT = { needs: 0.5, wants: 0.3, savings: 0.2 };

// Snapshot the live budget tree as [{id,label,cats:[{id,name,budget,color}]}].
// Prefer the BudgetPage's live store (real DB ids); fall back to joining the
// boot payload's groups + dashCategories by group_id.
function frsReadGroups() {
  const store = window.__claudBudgetStore;
  if (store && typeof store.get === "function") {
    const g = store.get();
    if (Array.isArray(g) && g.length) return g.map((grp) => ({ id: grp.id, label: grp.label, cats: (grp.cats || []).map((c) => ({ id: c.id, name: c.name, budget: c.budget || 0, color: c.color })) }));
  }
  const D = window.ClaudData || {};
  const groups = D.budgetGroups || [];
  const cats = D.dashCategories || [];
  return groups.map((grp) => ({
    id: grp.id, label: grp.label,
    cats: cats.filter((c) => c.group_id === grp.id)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map((c) => ({ id: c.id, name: c.name, budget: c.budget || 0, color: c.color }))
  }));
}

function FirstRunSetup({ onClose }) {
  // Snapshot the budget tree once so the list is stable while toggling.
  const [groups] = useState(frsReadGroups);
  const allIds = React.useMemo(() => {
    const out = []; groups.forEach((g) => g.cats.forEach((c) => out.push(c.id))); return out;
  }, [groups]);
  // checked category ids — default: everything checked
  const [checked, setChecked] = useState(() => new Set(allIds));
  const [useReco, setUseReco] = useState(false);
  const [income, setIncome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOn = (id) => checked.has(id);
  const toggleCat = (id) => setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const groupState = (g) => {
    const on = g.cats.filter((c) => checked.has(c.id)).length;
    return on === 0 ? "none" : on === g.cats.length ? "all" : "some";
  };
  const toggleGroup = (g) => setChecked((prev) => {
    const n = new Set(prev);
    const allOn = g.cats.every((c) => n.has(c.id));
    g.cats.forEach((c) => { if (allOn) n.delete(c.id); else n.add(c.id); });
    return n;
  });

  const incomeNum = Number(income);
  const hasIncome = useReco && Number.isFinite(incomeNum) && incomeNum > 0;

  // Recommended amount per kept category, proportioned within each 50/30/20
  // bucket by each category's default amount. Returns Map(catId -> dollars).
  const recommended = React.useMemo(() => {
    const map = new Map();
    if (!hasIncome) return map;
    // collect checked categories per bucket, with their default weights
    const byBucket = { needs: [], wants: [], savings: [] };
    groups.forEach((g) => g.cats.forEach((c) => {
      if (!checked.has(c.id)) return;
      const b = frsBucketFor(g.label, c.name);
      const w = FRS_DEFAULT_AMT[c.name];
      if (b && w != null) byBucket[b].push({ id: c.id, w });
    }));
    Object.keys(byBucket).forEach((b) => {
      const items = byBucket[b];
      const sum = items.reduce((s, x) => s + x.w, 0);
      if (sum <= 0) return;
      const dollars = incomeNum * FRS_BUCKET_PCT[b];
      items.forEach((x) => map.set(x.id, Math.round(dollars * x.w / sum)));
    });
    return map;
  }, [groups, checked, hasIncome, incomeNum]);

  const keptCount = checked.size;

  const finish = () => {
    if (busy) return;
    setBusy(true);
    const API = window.ClaudAPI;
    const tasks = [];
    if (API) {
      // delete unchecked categories
      groups.forEach((g) => g.cats.forEach((c) => {
        if (!checked.has(c.id)) tasks.push(API.del("/api/budget/categories/" + c.id).catch(() => {}));
      }));
      // update kept categories to the recommended amounts (only if income given)
      if (hasIncome) {
        recommended.forEach((amt, id) => {
          if (checked.has(id)) tasks.push(API.put("/api/budget/categories/" + id, { budget: amt }).catch(() => {}));
        });
      }
    }
    const done = () => {
      const flip = (API ? API.put("/api/settings", { onboarded: true }).catch(() => {}) : Promise.resolve());
      flip.then(() => {
        if (window.ClaudStore && ClaudStore.refresh) ClaudStore.refresh().catch(() => {});
        onClose();
      });
    };
    Promise.all(tasks).then(done, done);
  };

  const skip = () => {
    if (busy) return;
    setBusy(true);
    const API = window.ClaudAPI;
    const flip = (API ? API.put("/api/settings", { onboarded: true }).catch(() => {}) : Promise.resolve());
    flip.then(() => onClose());
  };

  // tiny accent checkbox
  const box = (on, mixed) => ({
    width: 18, height: 18, flexShrink: 0, borderRadius: 5,
    border: "1px solid " + (on || mixed ? "var(--accent)" : "var(--border)"),
    background: on ? "var(--accent)" : mixed ? "var(--accent-soft)" : "var(--input-bg)",
    color: "var(--accent-contrast)", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, cursor: "pointer"
  });

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) skip(); }}>
      <div className="set-modal" role="dialog" aria-modal="true" aria-label="Set up your budget" style={{ maxWidth: 560 }}>
        <div className="set-head">
          <h2>Set up your budget</h2>
          <button className="set-close" onClick={skip} aria-label="Skip setup">{"×"}</button>
        </div>
        <div className="set-body">
          <p className="hs-intro" style={{ margin: "6px 0 14px" }}>
            Welcome to ClaudBudget. We've started you with a set of categories — keep the ones you want, and we'll track your spending against them.
          </p>

          {groups.map((g) => {
            const gs = groupState(g);
            return (
              <div key={g.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <button type="button" onClick={() => toggleGroup(g)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                    <span style={box(gs === "all", gs === "some")}>{gs === "all" ? "✓" : gs === "some" ? "–" : ""}</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "var(--tracking-tight)" }}>{g.label}</span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 28 }}>
                  {g.cats.map((c) => {
                    const on = isOn(c.id);
                    const amt = recommended.get(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)" }}>
                        <span style={box(on, false)}>{on ? "✓" : ""}</span>
                        <span className="cat-dot" style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, background: c.color || "var(--accent)" }} />
                        <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 600, opacity: on ? 1 : 0.5 }}>{c.name}</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                          {hasIncome && on && amt != null ? money(amt) : money(c.budget)}
                        </span>
                      </button>);
                  })}
                </div>
              </div>);
          })}

          <div style={{ borderTop: "1px solid var(--border)", padding: "14px 0 4px" }}>
            <div className="set-row" style={{ padding: "4px 0", borderBottom: "none" }}>
              <div className="set-row-label">
                <span className="srl-t">Recommended budget</span>
                <span className="srl-d">Fill each category using the 50/30/20 rule from your average monthly income.</span>
              </div>
              <div className="set-row-control"><Switch on={useReco} onChange={setUseReco} /></div>
            </div>
            {useReco &&
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 2px" }}>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Average monthly income</span>
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: 11, color: "var(--muted)", fontSize: "var(--text-sm)" }}>$</span>
                  <input className="set-input" type="number" min="0" step="100" inputMode="numeric"
                    value={income} onChange={(e) => setIncome(e.target.value)} placeholder="5,000"
                    style={{ minWidth: 0, width: 150, paddingLeft: 22 }} />
                </div>
              </div>}
            {useReco && !hasIncome &&
              <p className="srl-d" style={{ margin: "8px 0 0", color: "var(--muted)" }}>Enter an income above to preview the recommended amounts.</p>}
          </div>
        </div>
        <div className="set-foot">
          <span className="set-note">{keptCount} categor{keptCount === 1 ? "y" : "ies"} selected{hasIncome ? " · amounts from 50/30/20" : ""}.</span>
          {Button && <Button variant="ghost" size="sm" onClick={skip} disabled={busy}>Skip for now</Button>}
          {Button && <Button variant="primary" size="sm" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish setup"}</Button>}
        </div>
      </div>
    </div>);
}

function App() {
  useClaudData();
  useEffect(() => { if (!ClaudData.ready) ClaudStore.hydrate(); }, []);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [dashGoals] = useFeatGoals();
  const [tab, setTab] = useState("Dashboard");
  const [period, setPeriod] = useState("1Y");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);   // first-run setup modal
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [navOpen, setNavOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(null);
  const [deletedAccts, setDeletedAccts] = useState([]);
  const [addedAccts, setAddedAccts] = useState([]);
  const [acctIconOv, setAcctIconOv] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [addedTxns, setAddedTxns] = useState([]);
  const [removedTxns, setRemovedTxns] = useState([]);
  const [catOverrides, setCatOverrides] = useState({});
  const [iconOverrides, setIconOverrides] = useState({});
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(null);
  // investments
  const holdings = ClaudData.holdings;
  const [openHoldingId, setHoldingOpen] = useState(null);
  const [invModal, setInvModal] = useState(null);   // {mode:'add'} | {mode:'edit', holding}
  const [invDelete, setInvDelete] = useState(null);  // holding pending delete-confirm
  // insights + monthly review + reporting cycle
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cycleStart, setCycleStart] = useState(1); // day of month the reporting cycle starts on

  // accounts available to attach a transaction to — full objects (carry mask/type
  // for import auto-detection) and a names-only list for the simpler pickers
  const acctList = [...ACCOUNT_GROUPS.flatMap((g) => g.accounts), ...addedAccts]
    .filter((a) => !deletedAccts.includes(a.name));
  const acctNames = acctList.map((a) => a.name);

  // leaving the Accounts tab closes any open account
  useEffect(() => { if (tab !== "Accounts") setAcctOpen(null); if (tab !== "Investments") setHoldingOpen(null); }, [tab]);

  // close the mobile nav drawer on Escape
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Investments empty-state CTA → open the add-holding modal.
  useEffect(() => { const h = () => setInvModal({ mode: "add" }); window.addEventListener("claud:add-holding", h); return () => window.removeEventListener("claud:add-holding", h); }, []);

  // ---- settings persistence (appearance + layout + reporting cycle) ----
  const didInitSettings = useRef(false);
  useEffect(() => {
    if (!ClaudData.ready || didInitSettings.current) return;
    didInitSettings.current = true;
    const sv = ClaudData.settings || {};
    const patch = {};
    ["dark", "surface", "accent", "density", "insightsPlacement", "recurringView", "goalsLayout", "coverStyle"].forEach((k) => { if (sv[k] !== undefined && sv[k] !== null) patch[k] = sv[k]; });
    if (Object.keys(patch).length) setTweak(patch);
    if (sv.cycleStart) setCycleStart(sv.cycleStart);
  }, [ClaudData.ready]);

  // First-run: open the setup modal the first time the user opens the Budget
  // tab while not yet onboarded. The onboarded flag flips on finish/skip, so
  // this won't reopen afterward.
  useEffect(() => {
    if (tab === "Budget" && !((ClaudData.settings) || {}).onboarded) setSetupOpen(true);
  }, [tab]);

  useEffect(() => {
    if (!didInitSettings.current) return;
    const dark = !!t.dark;
    const accentHex = (ACCENTS[t.accent] || ACCENTS.Terracotta)[dark ? "dark" : "light"];
    if (window.ClaudAPI) {
      ClaudAPI.saveAppearance({ theme: dark ? "dark" : "light", surface: t.surface, accent: accentHex, density: t.density });
      ClaudAPI.put("/api/settings", { dark: t.dark, surface: t.surface, accent: t.accent, density: t.density, insightsPlacement: t.insightsPlacement, recurringView: t.recurringView, goalsLayout: t.goalsLayout, coverStyle: t.coverStyle }).catch(() => {});
    }
  }, [t.dark, t.surface, t.accent, t.density, t.insightsPlacement, t.recurringView, t.goalsLayout, t.coverStyle]);

  useEffect(() => {
    if (!didInitSettings.current || !window.ClaudAPI) return;
    ClaudAPI.put("/api/settings", { cycleStart: cycleStart }).then(() => ClaudStore.refresh()).catch(() => {});
  }, [cycleStart]);
  const openAcct = tab === "Accounts" && acctOpen ? (findAccount(acctOpen) || addedAccts.find((a) => a.name === acctOpen) || null) : null;
  const openHolding = tab === "Investments" && openHoldingId ? (holdings.find((h) => h.id === openHoldingId) || null) : null;
  const portfolioTotal = holdings.reduce((s, h) => s + h.value, 0);

  const saveHolding = (h) => { ClaudActions.saveHolding(h); setInvModal(null); };
  const deleteHolding = (id) => { ClaudActions.deleteHolding(id); setHoldingOpen((cur) => cur === id ? null : cur); };

  // apply tweaks to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.dark ? "dark" : "light");
    root.setAttribute("data-surface", t.surface);
    root.classList.toggle("compact", t.density === "compact");
    const a = ACCENTS[t.accent] || ACCENTS.Terracotta;
    root.style.setProperty("--accent", t.dark ? a.dark : a.light);
  }, [t.dark, t.accent, t.surface, t.density]);

  const _dash = ClaudData.dashboard || {};
  const _series = ClaudData.netWorthSeries || [];
  const _nwVals = _series.map((p) => p.value);
  const _nwLabs = _series.map((p) => p.label);
  const _per = PERIODS[period] || _nwVals.length;
  const nwData = _nwVals.slice(-_per);
  const nwLabels = _nwLabs.slice(-_per);
  const nwCurrent = _dash.netWorth || 0;
  const nwDelta = _dash.netWorthDelta || 0;
  const _nwPrev = nwCurrent - nwDelta;
  const nwPct = _nwPrev ? (nwDelta / _nwPrev * 100) : 0;

  const income = _dash.income || 0, spending = _dash.spending || 0, budget = (_dash.budget && _dash.budget.totalBudget) || 0;
  const net = _dash.net || 0;
  const savingsRate = _dash.savingsRate || 0;
  const spentTotal = (_dash.budget && _dash.budget.totalSpent) || 0;
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isPro = !!(ClaudData.user && ClaudData.user.plan === "pro");

  const { Segmented } = DS;

  if (!ClaudData.ready) {
    return (<div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ margin: "auto", color: "var(--muted)", fontSize: "var(--text-sm)" }}>Loading your dashboard…</div>
    </div>);
  }
  return (
    <div className="app">
      {/* ---- Mobile top bar (phones / narrow viewports) ---- */}
      <header className="mobile-topbar">
        <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open navigation" aria-expanded={navOpen}>
          <Icon name="menu" />
        </button>
        <span className="mobile-brand">
          <svg className="brand-logo" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M80 176C53 176 32 156 32 130C32 106 49 86 72 82C80 55 104 36 132 36C166 36 194 60 200 92C221 97 236 115 236 136C236 158 218 176 196 176H80Z" fill="var(--accent)" />
            <polyline points="94,134 120,117 139,127 170,105" fill="none" stroke="var(--mark-line)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="156,105 170,105 170,121" fill="none" stroke="var(--mark-line)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="side-brandname">Budget</span>
        </span>
      </header>

      {/* ---- Sidebar (off-canvas drawer on mobile) ---- */}
      <div className={"nav-scrim" + (navOpen ? " show" : "")} onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside className={"sidebar" + (navOpen ? " open" : "")}>
        <div className="side-brand">
          <svg className="brand-logo" viewBox="0 0 256 256" fill="none" aria-hidden="true">
            <path d="M80 176C53 176 32 156 32 130C32 106 49 86 72 82C80 55 104 36 132 36C166 36 194 60 200 92C221 97 236 115 236 136C236 158 218 176 196 176H80Z" fill="var(--accent)" />
            <polyline points="94,134 120,117 139,127 170,105" fill="none" stroke="var(--mark-line)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="156,105 170,105 170,121" fill="none" stroke="var(--mark-line)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="side-brandname">Budget</span>
          <button className="drawer-close" onClick={() => setNavOpen(false)} aria-label="Close navigation">{"\u00D7"}</button>
        </div>
        <nav className="side-nav">
          {NAV.map((n) =>
          <button key={n} className={`side-tab ${tab === n ? "side-on" : ""}`} onClick={() => { setTab(n); setNavOpen(false); if (n === "Accounts") setAcctOpen(null); }}>{n}</button>
          )}
        </nav>
        <div className="side-foot">
          {isPro && t.insightsPlacement === "sidebar" &&
            <div className="notif-wrap side-ins-wrap">
              <button className={"side-tab side-ins notif-trigger" + (notifOpen ? " side-on" : "")} aria-label="Insights"
                aria-expanded={notifOpen}
                onClick={() => { setNotifOpen((o) => !o); setNotifSeen(true); }}>
                <Icon name="bell" style={{ width: 17, height: 17 }} />
                <span>Insights</span>
                {!notifSeen && INS_NOTIF_NEW > 0 && <span className="side-ins-count">{INS_NOTIF_NEW}</span>}
              </button>
              {notifOpen && <InsightsFeed onClose={() => setNotifOpen(false)} onOpenReview={() => setReviewOpen(true)} placement="sidebar" />}
            </div>}
          <UserMenu onSettings={() => setSettingsOpen(true)} onHelp={() => setHelpOpen(true)} onUpgrade={() => setUpgradeOpen(true)} onProfile={() => setProfileOpen(true)} />
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="main">
        <div className="main-inner">
          <VerifyBanner />
          <header className="page-head">
            {openAcct ?
            <div>
              <button className="back-link" onClick={() => setAcctOpen(null)}><Icon name="arrowL" />Accounts</button>
              <h1>{openAcct.name}</h1>
              <p className="page-sub">{openAcct.inst} {"\u00B7\u00B7\u00B7\u00B7"} {openAcct.mask} · {openAcct.group}</p>
            </div> :
            openHolding ?
            <div>
              <button className="back-link" onClick={() => setHoldingOpen(null)}><Icon name="arrowL" />Investments</button>
              <h1>{openHolding.cls === "Cash" ? openHolding.name : openHolding.ticker}</h1>
              <p className="page-sub">{openHolding.cls === "Cash" ? openHolding.cls + " position" : openHolding.name + " · " + openHolding.cls}</p>
            </div> :
            <div>
              <h1>{tab === "Dashboard" ? ("Welcome back" + (ClaudData.user && ClaudData.user.name ? ", " + String(ClaudData.user.name).split(" ")[0] : "")) : tab}</h1>
              {tab === "Dashboard" && <p className="page-sub">{todayLabel} · Here's where your money stands today.</p>}
              {tab === "Recurring" && <p className="page-sub">Bills and subscriptions, anchored to your real account activity.</p>}
              {tab === "Cash Flow" && <p className="page-sub">June · how income moved in and flowed back out this month.</p>}
              {tab === "Budget" && <p className="page-sub">June · what you planned to spend, and where it's landing.</p>}
              {tab === "Goals" && <p className="page-sub">Track each goal, fund it from an account, and see when you'll get there.</p>}
              {tab === "Investments" && <p className="page-sub">Tracking your portfolio against the S&P 500 benchmark.</p>}
              {tab === "Foresight" && <p className="page-sub">A what-if canvas for the decades ahead — add life events and watch your net worth bend.</p>}
              {isPro && t.insightsPlacement === "inline" &&
                <div className="notif-wrap ins-inline-wrap">
                  <button className={"ins-inline-pill notif-trigger" + (notifOpen ? " on" : "")} aria-label="Insights"
                    aria-expanded={notifOpen}
                    onClick={() => { setNotifOpen((o) => !o); setNotifSeen(true); }}>
                    <Icon name="bell" style={{ width: 14, height: 14 }} />
                    <span><b>{INS_NOTIF_NEW} new insights</b> this week</span>
                    <Icon name="chevR" style={{ width: 14, height: 14 }} />
                  </button>
                  {notifOpen && <InsightsFeed onClose={() => setNotifOpen(false)} onOpenReview={() => setReviewOpen(true)} placement="inline" />}
                </div>}
            </div>
            }
            <div className="head-actions">
              {tab === "Dashboard" && isPro && Button &&
                <Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)} style={{ display: "inline-flex", alignItems: "center" }}>
                  <Icon name="calendar" style={{ width: 15, height: 15, marginRight: 6, display: "inline-block" }} />View summary
                </Button>}
              {!openAcct && !openHolding && isPro && (t.insightsPlacement === "bell" || t.insightsPlacement === "labeled") &&
                <div className="notif-wrap">
                  {t.insightsPlacement === "labeled" ?
                    <button className={"btn ghost sm ins-labeled notif-trigger" + (notifOpen ? " on" : "")} aria-label="Insights"
                      aria-expanded={notifOpen}
                      onClick={() => { setNotifOpen((o) => !o); setNotifSeen(true); }}>
                      <Icon name="bell" style={{ width: 15, height: 15 }} />
                      Insights
                      {!notifSeen && INS_NOTIF_NEW > 0 && <span className="ins-count">{INS_NOTIF_NEW}</span>}
                    </button> :
                    <button className={"icon-btn notif-trigger" + (notifOpen ? " on" : "")} aria-label="Insights"
                      aria-expanded={notifOpen}
                      onClick={() => { setNotifOpen((o) => !o); setNotifSeen(true); }}>
                      <Icon name="bell" />
                      {!notifSeen && INS_NOTIF_NEW > 0 && <span className="notif-dot">{INS_NOTIF_NEW}</span>}
                    </button>}
                  {notifOpen && <InsightsFeed onClose={() => setNotifOpen(false)} onOpenReview={() => setReviewOpen(true)} placement={t.insightsPlacement} />}
                </div>}
              {!openAcct && !openHolding && PAGE_ACTION[tab] && Button && <Button variant="primary" size="sm" onClick={() => { if (tab === "Accounts") setAddOpen(true); else if (tab === "Transactions") setAddTxnOpen(true); else if (tab === "Budget") window.dispatchEvent(new CustomEvent("claud:add-budget")); else if (tab === "Goals") window.dispatchEvent(new CustomEvent("claud:add-goal")); else if (tab === "Investments") setInvModal({ mode: "add" }); }}>+ {PAGE_ACTION[tab]}</Button>}
            </div>
          </header>

          {tab === "Dashboard" ?
          <React.Fragment>
              {/* KPI strip */}
              <div className="kpi-row">
                <Card widget><div className="kpi">
                  <span className="kpi-label">Income · this month</span>
                  <span className="kpi-val">{money(income)}</span>
                  <span className="kpi-delta pos">{"\u2191"} {signed(220, 0)} vs avg</span>
                </div></Card>
                <Card widget><div className="kpi">
                  <span className="kpi-label">Spending · this month</span>
                  <span className="kpi-val">{money(spending)}</span>
                  <span className="kpi-delta pos">{"\u2193"} {money(225)} vs avg</span>
                </div></Card>
                <Card widget><div className="kpi">
                  <span className="kpi-label">Net cash flow</span>
                  <span className="kpi-val pos">{signed(net, 0)}</span>
                  <span className="kpi-delta" style={{ color: "var(--muted)" }}>saved this month</span>
                </div></Card>
                <Card widget><div className="kpi">
                  <span className="kpi-label">Savings rate</span>
                  <span className="kpi-val">{savingsRate}%</span>
                  <span className="kpi-delta" style={{ color: "var(--muted)" }}>of income kept</span>
                </div></Card>
              </div>

              {/* Main grid */}
              <div className="dash-grid">
                {/* Net worth */}
                <Card widget className="span4">
                  <div className="widget-head">
                    <div>
                      <span className="widget-eyebrow">Net worth</span>
                      <div className="nw-headline">
                        <span className="nw-value">{money(nwCurrent)}</span>
                        <Badge tone="pos">{"\u2191"} {signed(nwDelta, 0)} · {nwPct.toFixed(1)}%</Badge>
                      </div>
                    </div>
                    {Segmented && <Segmented options={Object.keys(PERIODS)} value={period} onChange={setPeriod} />}
                  </div>
                  <NetWorthChart data={nwData} labels={nwLabels} />
                </Card>

                {/* Spending ring */}
                <Card widget className="span2">
                  <div className="widget-head"><span className="widget-title">June budget</span></div>
                  <SpendRing spent={spending} budget={budget} />
                </Card>

                {/* Budget categories */}
                <Card widget className="span3">
                  <div className="widget-head">
                    <span className="widget-title">Budget by category</span>
                    <span className="muted">{money(spentTotal)} spent</span>
                  </div>
                  {CATEGORIES.length === 0 ?
                  <button type="button" className="cat-empty-cta" onClick={() => setTab("Budget")}>
                      Click here to set up budget categories
                    </button> :

                  <div className="cat-list cat-list--dash">
                    {CATEGORIES.map((c) => {
                    const over = c.spent > c.budget;
                    return (
                      <div className="cat-row" key={c.name}>
                          <div className="cat-top">
                            <span className="cat-name"><span className="cat-dot" style={{ background: c.color }} />{c.name}</span>
                            <span className="cat-fig"><b>{money(c.spent)}</b> / {money(c.budget)}</span>
                          </div>
                          <ProgressBar value={c.spent} max={c.budget} tone={over ? "over" : "accent"} />
                        </div>);

                  })}
                  </div>}
                </Card>

                {/* Cash flow */}
                <Card widget className="span3">
                  <div className="widget-head">
                    <span className="widget-title">Cash flow</span>
                    <div className="cf-legend">
                      <span className="cf-leg"><span className="sw" style={{ background: "var(--accent)" }} />In</span>
                      <span className="cf-leg"><span className="sw" style={{ background: "var(--red)" }} />Out</span>
                    </div>
                  </div>
                  <CashFlow data={CASHFLOW.slice(-6)} />
                </Card>

                {/* Recent transactions */}
                <Card widget className="span4">
                  <div className="widget-head">
                    <span className="widget-title">Recent transactions</span>
                    {Button && <Button variant="link">View all</Button>}
                  </div>
                  <div className="txn-list txn-list--dash">
                    {TXNS.slice(0, 6).map((x, i) =>
                  <div className="txn" key={i}>
                        <span className="txn-ico"><Icon name={x.icon} /></span>
                        <div className="txn-body">
                          <div className="txn-name">{x.name}</div>
                          <div className="txn-meta">{x.cat} · {x.when}</div>
                        </div>
                        <span className={"txn-amt " + (x.amt >= 0 ? "pos" : "")}>{signed(x.amt)}</span>
                      </div>
                  )}
                  </div>
                </Card>

                {/* Goals */}
                <Card widget className="span2">
                  <div className="widget-head"><span className="widget-title">Savings goals</span></div>
                  <div className="goal-list--dash">
                    {dashGoals.map((g) => {
                    const pct = Math.round(g.have / g.target * 100);
                    return (
                      <div className="goal" key={g.name}>
                          <div className="goal-top">
                            <span className="goal-name"><span className="goal-ico"><Icon name={g.icon} /></span>{g.name}</span>
                            <span className="goal-pct">{pct}%</span>
                          </div>
                          <ProgressBar value={g.have} max={g.target} tone={pct >= 100 ? "done" : "accent"} />
                          <span className="goal-fig"><b>{money(g.have)}</b> of {money(g.target)}</span>
                        </div>);

                  })}
                  </div>
                </Card>

                {/* Accounts */}
                <Card widget className="span6">
                  <div className="widget-head">
                    <span className="widget-title">Accounts</span>
                    <span className="muted">{ACCOUNTS.length} connected</span>
                  </div>
                  <div className="acct-grid">
                    {ACCOUNTS.map((a) =>
                  <div className="acct" key={a.name}>
                        <div className="acct-head">
                          <span className="acct-ico"><Icon name={a.icon} /></span>
                          <div>
                            <div className="acct-type">{a.type}</div>
                            <div className="acct-name">{a.name}</div>
                          </div>
                        </div>
                        <span className={"acct-bal " + (a.bal < 0 ? "neg" : "")}>{money(a.bal, 2)}</span>
                      </div>
                  )}
                  </div>
                </Card>
              </div>
            </React.Fragment> :

          tab === "Accounts" ?
          (openAcct ?
            <AccountDetailPage acct={openAcct} onDelete={() => { ClaudActions.deleteAccount(openAcct.id); setAcctOpen(null); }} /> :
            <AccountsPage onOpen={setAcctOpen} deleted={deletedAccts} added={addedAccts} iconOv={acctIconOv} onSetIcon={(name, n) => { setAcctIconOv((p) => ({ ...p, [name]: n })); ClaudActions.setAccountIcon(name, n); }} />) :

          tab === "Transactions" ?
          <TransactionsPage added={addedTxns} removed={removedTxns} catOverrides={catOverrides} iconOverrides={iconOverrides} onUpload={(mode) => setImportOpen(mode || "Statement")} onRemove={(id) => ClaudActions.removeTxn(id)} onRecat={(id, c) => ClaudActions.recatTxn(id, c)} onSetIcon={(id, n) => ClaudActions.setTxnIcon(id, n)} /> :

          tab === "Recurring" ?
          <RecurringSection view={t.recurringView} onImport={(mode) => setImportOpen(mode || "Statement")} /> :

          tab === "Cash Flow" ?
          <CashFlowPage /> :

          tab === "Budget" ?
          <BudgetPage coverStyle={t.coverStyle} /> :

          tab === "Goals" ?
          <GoalsPage layout={t.goalsLayout} /> :

          tab === "Investments" ?
          (openHolding ?
            <InvestmentDetailPage holding={openHolding} portfolioValue={portfolioTotal}
              onDelete={() => deleteHolding(openHolding.id)}
              onEdit={(h) => setInvModal({ mode: "edit", holding: h })} /> :
            <InvestmentsPage holdings={holdings}
              onOpen={(h) => setHoldingOpen(h.id)}
              onEdit={(h) => setInvModal({ mode: "edit", holding: h })}
              onDelete={(id) => setInvDelete(holdings.find((x) => x.id === id) || null)} />) :

          tab === "Foresight" ?
          (isPro ? <ForesightPage /> : <ProGate feature="Foresight" blurb="Project your net worth decades ahead, anchored to your real balances. Upgrade to Pro to unlock it." onUpgrade={() => setUpgradeOpen(true)} />) :

          <div className="placeholder">
              <Icon name="grid" className="ph-ico" />
              <h2>{tab}</h2>
              <p>This area isn't part of the dashboard demo — the sidebar shows where it lives in ClaudBudget.</p>
            </div>
          }
        </div>
      </div>

      {/* ---- First-run setup ---- */}
      {setupOpen && <FirstRunSetup onClose={() => setSetupOpen(false)} />}

      {/* ---- Settings ---- */}
      {settingsOpen && <SettingsModal t={t} setTweak={setTweak} onClose={() => setSettingsOpen(false)} currency={currency} setCurrency={setCurrency} cycleStart={cycleStart} setCycleStart={setCycleStart} />}

      {/* ---- Monthly summary / review ---- */}
      {reviewOpen && <MonthlyReviewModal onClose={() => setReviewOpen(false)} cycleStartDay={cycleStart} />}

      {/* ---- Profile ---- */}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {/* ---- Upgrade to Pro ---- */}
      {upgradeOpen && <UpgradeModal currency={currency} onClose={() => setUpgradeOpen(false)} />}

      {/* ---- Help & support ---- */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {/* ---- Add account ---- */}
      {addOpen && <AddAccountModal onClose={() => setAddOpen(false)} onAdd={(a) => { ClaudActions.addAccount(a); setAddOpen(false); }} />}

      {/* ---- Add transaction ---- */}
      {addTxnOpen && <AddTransactionModal accounts={acctNames} onClose={() => setAddTxnOpen(false)} onAdd={(x) => { ClaudActions.addTxn(x); setAddTxnOpen(false); }} />}

      {/* ---- Import statements / receipts ---- */}
      {importOpen && <ImportModal accounts={acctList} initialMode={importOpen} onClose={() => setImportOpen(null)} onImport={(items) => { ClaudActions.importTxns(items); setImportOpen(null); }} />}

      {/* ---- Add / edit investment ---- */}
      {invModal && <InvestmentModal modal={invModal} onClose={() => setInvModal(null)} onSave={saveHolding} onDelete={(id) => { setInvModal(null); setInvDelete(holdings.find((x) => x.id === id) || null); }} />}

      {/* ---- Delete investment confirm ---- */}
      {invDelete && <InvDeleteModal holding={invDelete} onCancel={() => setInvDelete(null)} onConfirm={() => { deleteHolding(invDelete.id); setInvDelete(null); }} />}

      {/* ---- Tweaks ---- */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakColor label="Accent" value={(ACCENTS[t.accent] || ACCENTS.Terracotta).light}
        options={Object.keys(ACCENTS).map((k) => ACCENTS[k].light)}
        onChange={(v) => {
          const key = Object.keys(ACCENTS).find((k) => ACCENTS[k].light === v) || "Terracotta";
          setTweak("accent", key);
        }} />
        <TweakRadio label="Surface" value={t.surface} options={["sand", "cream", "linen"]} onChange={(v) => setTweak("surface", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["cozy", "compact"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Features" />
        <TweakRadio label="Insights placement" value={t.insightsPlacement} options={["bell", "labeled", "sidebar", "inline"]} onChange={(v) => setTweak("insightsPlacement", v)} />
        <TweakRadio label="Recurring view" value={t.recurringView} options={["timeline", "calendar"]} onChange={(v) => setTweak("recurringView", v)} />
        <TweakRadio label="Goals layout" value={t.goalsLayout} options={["cards", "rows"]} onChange={(v) => setTweak("goalsLayout", v)} />
        <TweakRadio label="Cover overspend" value={t.coverStyle} options={["suggested", "manual"]} onChange={(v) => setTweak("coverStyle", v)} />
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);