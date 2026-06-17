'use strict';
/* ============================================================
   Derived figures — the numbers the dashboard used to hard-code,
   now computed from the user's real rows.
     • net worth (current + monthly series)
     • cash flow by month
     • budget spent per category (current cycle)
     • dashboard KPI bundle
     • insights + monthly review
   ============================================================ */
const { db } = require('./db');

const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const monthKey = (d) => (typeof d === 'string' ? d.slice(0, 7) : d.toISOString().slice(0, 7));

/* ------------------------------------------------------------ basic reads */
function getAccounts(uid) {
  return db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort, created_at').all(uid);
}
function getHoldings(uid) {
  return db.prepare('SELECT * FROM holdings WHERE user_id = ?').all(uid);
}
function getTxns(uid) {
  return db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC').all(uid);
}
function holdingValue(h) { return (h.shares || 0) * (h.price || 0); }
function holdingsTotal(uid) { return getHoldings(uid).reduce((s, h) => s + holdingValue(h), 0); }

// Net worth = sum of account balances + sum of holding market values.
function netWorth(uid) {
  const acctSum = getAccounts(uid).reduce((s, a) => s + (a.balance || 0), 0);
  return round2(acctSum + holdingsTotal(uid));
}

/* ----------------------------------------------------- reporting cycle */
// Window for the cycle that contains `now`, given the start day-of-month.
function cycleWindow(cycleStart = 1, now = new Date()) {
  const day = Math.min(Math.max(parseInt(cycleStart, 10) || 1, 1), 28);
  let start = new Date(now.getFullYear(), now.getMonth(), day);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

const isSpend = (t) => t.amount < 0 && !t.excluded;
const isIncome = (t) => t.amount > 0 && !t.excluded;

/* --------------------------------------------------------- cash flow */
// Last `n` calendar months of income vs. spend.
function cashflowMonths(uid, n = 6) {
  const txns = getTxns(uid);
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    let inc = 0, sp = 0;
    for (const t of txns) {
      if (t.date.slice(0, 7) !== key) continue;
      if (isIncome(t)) inc += t.amount;
      else if (isSpend(t)) sp += -t.amount;
    }
    out.push({ m: MONTHS3[d.getMonth()], key, in: round2(inc), out: round2(sp), net: round2(inc - sp) });
  }
  return out;
}

// Money-flow (Sankey) for a given period: income sources -> net -> spend categories.
function cashflowSankey(uid, monthsBack = 0) {
  const txns = getTxns(uid);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const key = monthKey(target);
  const incomeBy = {}, spendBy = {};
  let income = 0, spend = 0;
  for (const t of txns) {
    if (t.date.slice(0, 7) !== key) continue;
    if (isIncome(t)) { income += t.amount; incomeBy[t.category || t.name] = (incomeBy[t.category || t.name] || 0) + t.amount; }
    else if (isSpend(t)) { spend += -t.amount; spendBy[t.category || 'Uncategorized'] = (spendBy[t.category || 'Uncategorized'] || 0) + -t.amount; }
  }
  const toArr = (o) => Object.entries(o).map(([name, v]) => ({ name, v: round2(v) })).sort((a, b) => b.v - a.v);
  return {
    key,
    income: round2(income),
    spend: round2(spend),
    net: round2(income - spend),
    incomeSources: toArr(incomeBy),
    spendCategories: toArr(spendBy)
  };
}

/* ----------------------------------------------- net-worth monthly series */
// Derived backwards from current net worth using monthly net flow, so the
// curve is consistent with recorded transactions. Returns up to `n` points.
function netWorthSeries(uid, n = 24) {
  const flows = cashflowMonths(uid, n);     // chronological
  const current = netWorth(uid);
  // Walk backwards: value at end of month i. Last point = current.
  const values = new Array(flows.length);
  let v = current;
  for (let i = flows.length - 1; i >= 0; i--) {
    values[i] = round2(v);
    v = v - flows[i].net; // value at end of previous month
  }
  return flows.map((f, i) => ({ label: f.m + " '" + String(new Date().getFullYear()).slice(2), key: f.key, value: values[i] }));
}

/* -------------------------------------------------------- budget spent */
// Spent per category name within the current cycle (expenses only).
function budgetSpent(uid, cycleStart = 1) {
  const { start, end } = cycleWindow(cycleStart);
  const rows = db.prepare(
    `SELECT category AS cat, SUM(-amount) AS spent
       FROM transactions
      WHERE user_id = ? AND amount < 0 AND excluded = 0
        AND date >= ? AND date < ?
      GROUP BY category`
  ).all(uid, start, end);
  const map = {};
  for (const r of rows) if (r.cat) map[r.cat] = round2(r.spent);
  return { window: { start, end }, byCategory: map };
}

function getSettings(uid) {
  const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(uid);
  if (!row) return {};
  try { return JSON.parse(row.data) || {}; } catch { return {}; }
}

/* ------------------------------------------------------ budget summary */
function budgetSummary(uid, cycleStart) {
  const groups = db.prepare('SELECT * FROM budget_groups WHERE user_id = ? ORDER BY sort').all(uid);
  const cats = db.prepare('SELECT * FROM budget_categories WHERE user_id = ? ORDER BY sort').all(uid);
  const { byCategory, window } = budgetSpent(uid, cycleStart);
  let totalBudget = 0, totalSpent = 0;
  const catsOut = cats.map((c) => {
    const spent = byCategory[c.name] || 0;
    totalBudget += c.budget + (c.roll || 0);
    totalSpent += spent;
    return { ...c, spent, available: round2(c.budget + (c.roll || 0) - spent) };
  });
  return {
    groups, categories: catsOut, window,
    totalBudget: round2(totalBudget), totalSpent: round2(totalSpent),
    remaining: round2(totalBudget - totalSpent)
  };
}

/* ---------------------------------------------------------- dashboard */
function dashboard(uid) {
  const settings = getSettings(uid);
  const cycleStart = settings.cycleStart || 1;
  const accounts = getAccounts(uid);
  const holdings = getHoldings(uid);
  const txns = getTxns(uid);
  const { start, end } = cycleWindow(cycleStart);

  let income = 0, spending = 0;
  for (const t of txns) {
    if (t.date < start || t.date >= end) continue;
    if (isIncome(t)) income += t.amount;
    else if (isSpend(t)) spending += -t.amount;
  }
  const net = income - spending;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;

  const nw = netWorth(uid);
  const series = netWorthSeries(uid, 24);
  const prev = series.length > 1 ? series[series.length - 2].value : nw;
  const nwDelta = round2(nw - prev);

  // account groups
  const groupsMap = {};
  for (const a of accounts) {
    (groupsMap[a.group_label] = groupsMap[a.group_label] || []).push(a);
  }
  const bs = budgetSummary(uid, cycleStart);
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at').all(uid);

  return {
    netWorth: nw,
    netWorthDelta: nwDelta,
    netWorthSeries: series,
    income: round2(income),
    spending: round2(spending),
    net: round2(net),
    savingsRate,
    cycle: { start, end, cycleStart },
    accountsTotal: round2(accounts.reduce((s, a) => s + a.balance, 0)),
    holdingsTotal: round2(holdings.reduce((s, h) => s + holdingValue(h), 0)),
    accountGroups: Object.entries(groupsMap).map(([label, accts]) => ({
      label,
      total: round2(accts.reduce((s, a) => s + a.balance, 0)),
      accounts: accts
    })),
    budget: { totalBudget: bs.totalBudget, totalSpent: bs.totalSpent, remaining: bs.remaining, categories: bs.categories },
    goals: goals.map((g) => ({ ...g, pct: g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0 })),
    recent: txns.slice(0, 6),
    cashflow: cashflowMonths(uid, 6),
    counts: {
      accounts: accounts.length, transactions: txns.length,
      holdings: holdings.length, goals: goals.length
    }
  };
}

/* ----------------------------------------------------------- insights */
// Computed signals from real data — replaces the hard-coded feed.
function insights(uid) {
  const settings = getSettings(uid);
  const cycleStart = settings.cycleStart || 1;
  const out = [];
  const bs = budgetSummary(uid, cycleStart);

  // 1) Budget overages
  for (const c of bs.categories) {
    const cap = c.budget + (c.roll || 0);
    if (cap > 0 && c.spent > cap) {
      out.push({
        tone: 'over', icon: 'trend',
        title: `${c.name} is over budget`,
        meta: `${money(c.spent)} of ${money(cap)} this cycle`,
        ts: 'This cycle'
      });
    } else if (cap > 0 && c.spent >= cap * 0.9 && c.spent <= cap) {
      out.push({
        tone: 'warn', icon: 'alert',
        title: `${c.name} is almost spent`,
        meta: `${money(c.spent)} of ${money(cap)} — ${Math.round((c.spent / cap) * 100)}%`,
        ts: 'This cycle'
      });
    }
  }

  // 2) Large transactions in the current cycle
  const { start, end } = cycleWindow(cycleStart);
  const big = db.prepare(
    `SELECT * FROM transactions WHERE user_id = ? AND amount < 0 AND excluded = 0
       AND date >= ? AND date < ? ORDER BY amount ASC LIMIT 1`
  ).get(uid, start, end);
  if (big && -big.amount >= 200) {
    out.push({
      tone: 'neutral', icon: 'info',
      title: `Large purchase: ${big.name}`,
      meta: `${money(-big.amount)} on ${big.date}`,
      ts: big.date
    });
  }

  // 3) Savings rate this cycle
  const cf = cashflowMonths(uid, 1)[0];
  if (cf && cf.in > 0) {
    const rate = Math.round((cf.net / cf.in) * 100);
    out.push({
      tone: rate >= 0 ? 'pos' : 'over', icon: rate >= 0 ? 'check' : 'trend',
      title: rate >= 0 ? `You saved ${rate}% this month` : `You overspent this month`,
      meta: `${money(cf.in)} in · ${money(cf.out)} out`,
      ts: 'This month'
    });
  }

  // 4) Items needing review
  const reviewCount = db.prepare('SELECT COUNT(*) c FROM transactions WHERE user_id = ? AND review = 1').get(uid).c;
  if (reviewCount > 0) {
    out.push({
      tone: 'warn', icon: 'alert',
      title: `${reviewCount} transaction${reviewCount > 1 ? 's' : ''} need review`,
      meta: 'Open Transactions to confirm categories',
      ts: 'Now'
    });
  }

  return { items: out, newCount: out.length, months: monthlyReview(uid) };
}

// Completed-month review cards, newest first (up to 6 months with activity).
function monthlyReview(uid) {
  const txns = getTxns(uid);
  if (!txns.length) return [];
  const now = new Date();
  const cur = monthKey(now);
  const byMonth = {};
  for (const t of txns) {
    const k = t.date.slice(0, 7);
    if (k >= cur) continue; // completed months only
    (byMonth[k] = byMonth[k] || []).push(t);
  }
  const series = netWorthSeries(uid, 24);
  const nwByKey = {};
  series.forEach((p) => { nwByKey[p.key] = p.value; });

  const keys = Object.keys(byMonth).sort().reverse().slice(0, 6);
  return keys.map((k) => {
    const list = byMonth[k];
    let inc = 0, sp = 0;
    const catSpend = {};
    for (const t of list) {
      if (isIncome(t)) inc += t.amount;
      else if (isSpend(t)) { sp += -t.amount; catSpend[t.category || 'Uncategorized'] = (catSpend[t.category || 'Uncategorized'] || 0) + -t.amount; }
    }
    const [y, m] = k.split('-').map(Number);
    const cats = Object.entries(catSpend).map(([name, spent]) => ({ name, spent: round2(spent) })).sort((a, b) => b.spent - a.spent);
    return {
      key: k, year: y, month: m - 1, label: `${MONTHS3[m - 1]} ${y}`,
      income: round2(inc), spending: round2(sp), saved: round2(inc - sp),
      savingsRate: inc > 0 ? Math.round(((inc - sp) / inc) * 100) : 0,
      nwEnd: nwByKey[k] != null ? nwByKey[k] : null,
      categories: cats
    };
  });
}

function money(n) {
  const s = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return (n < 0 ? '-$' : '$') + s;
}

module.exports = {
  netWorth, netWorthSeries, holdingsTotal, holdingValue,
  cashflowMonths, cashflowSankey, cycleWindow,
  budgetSpent, budgetSummary, getSettings,
  dashboard, insights, monthlyReview,
  getAccounts, getHoldings, getTxns
};
