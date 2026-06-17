/* ============================================================
   Claud — client data store. Plain JS, loaded after boot.js and
   before the Babel/JSX scripts so the data containers exist when
   the components evaluate.

   ClaudData holds STABLE array references that the JSX modules
   capture at eval time (e.g. `const ALL_TXNS = ClaudData.transactions`).
   refresh() therefore mutates arrays IN PLACE (never reassigns them),
   then dispatches 'claud:data' so React re-renders with fresh content.

   apply() also shapes server rows into the field names the existing
   frontend expects (bal, inst, chg, trend, cat, amt, when …) so the
   designed markup keeps working unchanged.
   ============================================================ */
(function () {
  var D = {
    ready: false, user: null, settings: {}, dashboard: {},
    insights: { items: [], months: [] }, sankey: {}, foresightStartNetWorth: 0,
    accounts: [], transactions: [], rules: [], recurring: [], goals: [],
    holdings: [], foresightPlans: [], foresightOverrides: [],
    accountGroups: [], netWorthSeries: [], dashCategories: [],
    budgetGroups: [], recent: [], cashflow: []
  };
  window.ClaudData = D;

  function mut(arr, items) {
    arr.length = 0;
    if (Array.isArray(items)) for (var i = 0; i < items.length; i++) arr.push(items[i]);
    return arr;
  }
  var GROUP_ORDER = { Cash: 0, Investments: 1, Credit: 2 };
  function curMonth() { return new Date().toISOString().slice(0, 10).slice(0, 7); }

  // This-month net movement for an account, from its transactions.
  function acctChange(accId) {
    var k = curMonth(), s = 0;
    for (var i = 0; i < D.transactions.length; i++) {
      var t = D.transactions[i];
      if (t.account_id === accId && String(t.date || '').slice(0, 7) === k && !t.excluded) s += t.amount;
    }
    return Math.round(s * 100) / 100;
  }
  // Small eased 8-point sparkline ending at the current balance.
  function trendFor(bal, chg) {
    var start = bal - chg, out = [];
    for (var i = 0; i < 8; i++) { var f = i / 7; out.push(Math.round(start + (bal - start) * (f * f * (3 - 2 * f)))); }
    return out;
  }

  function apply(boot) {
    D.user = boot.user || null;
    D.settings = boot.settings || {};
    D.dashboard = boot.dashboard || {};
    D.insights = boot.insights || { items: [], months: [] };
    D.sankey = (boot.cashflow && boot.cashflow.sankey) || {};
    D.foresightStartNetWorth = (boot.foresight && boot.foresight.startNetWorth) || 0;

    mut(D.transactions, boot.transactions);
    mut(D.rules, boot.rules);
    mut(D.recurring, boot.recurring);
    mut(D.goals, boot.goals);
    mut(D.holdings, boot.holdings);
    mut(D.foresightPlans, boot.foresight && boot.foresight.plans);
    mut(D.foresightOverrides, boot.foresight && boot.foresight.overrides);
    mut(D.budgetGroups, boot.budget && boot.budget.groups);
    mut(D.netWorthSeries, (boot.dashboard && boot.dashboard.netWorthSeries) || []);
    mut(D.dashCategories, (boot.dashboard && boot.dashboard.budget && boot.dashboard.budget.categories) || []);
    mut(D.cashflow, (boot.cashflow && boot.cashflow.months) || (boot.dashboard && boot.dashboard.cashflow) || []);

    // accounts: add frontend aliases (bal, inst, chg, trend)
    var accts = (boot.accounts || []).map(function (a) {
      var chg = acctChange(a.id);
      return Object.assign({}, a, { bal: a.balance, inst: a.institution || '', chg: chg, trend: trendFor(a.balance, chg) });
    });
    mut(D.accounts, accts);

    // grouped accounts (Cash / Investments / Credit) for the Accounts page + dashboard
    var groups = {};
    accts.forEach(function (a) { (groups[a.group_label] = groups[a.group_label] || []).push(a); });
    var grouped = Object.keys(groups)
      .sort(function (x, y) { return (GROUP_ORDER[x] != null ? GROUP_ORDER[x] : 9) - (GROUP_ORDER[y] != null ? GROUP_ORDER[y] : 9); })
      .map(function (label) { return { label: label, accounts: groups[label] }; });
    mut(D.accountGroups, grouped);

    // recent transactions shaped for the dashboard widget (name/cat/when/amt/icon)
    mut(D.recent, (boot.dashboard && boot.dashboard.recent || []).map(function (r) {
      return { name: r.name, cat: r.category, when: r.date, amt: r.amount, icon: r.icon };
    }));

    syncAppearance(D.settings);
  }

  var ACCENTS = { Olive: '#7e7a3c', Terracotta: '#c05f2e', Sage: '#4f9a6a', Plum: '#8a5cc0' };
  function syncAppearance(s) {
    if (!s) return;
    var ap = {};
    if (s.dark != null) ap.theme = s.dark ? 'dark' : 'light';
    if (s.surface) ap.surface = s.surface;
    if (s.density) ap.density = s.density;
    if (s.accent) ap.accent = ACCENTS[s.accent] || s.accent;
    if (Object.keys(ap).length && window.ClaudAPI) window.ClaudAPI.saveAppearance(ap);
  }

  function emit() { try { window.dispatchEvent(new CustomEvent('claud:data')); } catch (e) {} }
  function load() {
    return window.ClaudAPI.bootstrap().then(function (boot) {
      apply(boot); D.ready = true; emit(); return D;
    });
  }

  window.ClaudStore = {
    data: D, hydrate: load, refresh: load, get: function () { return D; }, emit: emit,
    accountNames: function () { return D.accounts.map(function (a) { return a.name; }); },
    accountById: function (id) { return D.accounts.find(function (a) { return a.id === id; }) || null; },
    isPro: function () { return !!(D.user && D.user.plan === 'pro'); }
  };

  window.useClaudData = function () {
    var React = window.React;
    var st = React.useState(0);
    React.useEffect(function () {
      var fn = function () { st[1](function (n) { return n + 1; }); };
      window.addEventListener('claud:data', fn);
      return function () { window.removeEventListener('claud:data', fn); };
    }, []);
    return D;
  };
})();
