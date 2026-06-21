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
    quotes: {}, quotesProvider: null, quotesAsOf: 0, fxRates: {}, fxBase: 'CAD',
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

  // The 3-letter code of the user's chosen display currency. The setting is
  // stored as a label like "CAD — $ Canadian Dollar"; take the leading token.
  // Defaults to CAD (also the app default) when unset.
  function displayCurrency() {
    var c = (D.settings && D.settings.currency) || 'CAD';
    c = String(c).trim().split(/[\s—-]/)[0].toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : 'CAD';
  }
  // Multiplier that turns an amount priced in `from` into the display currency.
  // 1 when same currency or when no rate is available (degrade to no-convert).
  function fxFactor(from) {
    var disp = displayCurrency();
    from = String(from || disp).toUpperCase();
    if (from === disp) return 1;
    var r = D.fxRates && D.fxRates[from];
    return (typeof r === 'number' && r > 0) ? r : 1;
  }

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
    mut(D.holdings, (boot.holdings || []).map(function (h) { return Object.assign({ day: 0 }, h); }));
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

  // ---- live market quotes -------------------------------------------------
  // Overlay live quotes onto holdings in place (recompute value/return). Never
  // throws; a missing quote leaves the user's entered price untouched.
  function applyQuotes(map) {
    D.quotes = map || {};
    var disp = displayCurrency();
    for (var i = 0; i < D.holdings.length; i++) {
      var h = D.holdings[i];
      if (h.kind === 'cash' || !h.ticker) { if (h.day == null) h.day = 0; h.currency = disp; h.fxRate = 1; continue; }
      var q = D.quotes[String(h.ticker).toUpperCase()];
      if (q && typeof q.price === 'number' && q.price > 0) {
        var cur = (q.currency || disp).toUpperCase();   // native trading currency
        var rate = fxFactor(cur);                        // native -> display multiplier
        h.currency = cur;
        h.fxRate = rate;
        h.priceNative = q.price;                         // native price (return % + detail page)
        h.price = q.price * rate;                        // per-share price in display currency
        h.day = (typeof q.day === 'number') ? q.day : (h.day || 0);
        h.value = Math.round(h.shares * h.price * 100) / 100;   // value in display currency
        // Return is a ratio computed in the native currency, so the FX factor
        // cancels and a same-day buy still reads ~0% whatever the currency.
        var costNative = (h.cost != null ? h.cost : q.price);
        h.ret = costNative > 0 ? Math.round(((q.price / costNative) - 1) * 1000) / 10 : 0;
        h.quote = q; h.live = true;
      } else {
        if (h.day == null) h.day = 0;            // no live data yet -> flat, never NaN
        if (h.fxRate == null) h.fxRate = 1;      // entered price assumed already in display currency
        if (h.currency == null) h.currency = disp;
      }
    }
  }
  // Fetch FX rates for every foreign currency present in `quotes`, relative to
  // the display currency. Resolves to a rates map (possibly empty); never throws.
  function fetchFxFor(quotes) {
    var disp = displayCurrency();
    var need = {};
    for (var k in quotes) {
      if (!Object.prototype.hasOwnProperty.call(quotes, k)) continue;
      var q = quotes[k];
      var cur = q && q.currency ? String(q.currency).toUpperCase() : '';
      if (cur && cur !== disp) need[cur] = 1;
    }
    var curs = Object.keys(need);
    if (!curs.length || !window.ClaudAPI || !window.ClaudAPI.fx) return Promise.resolve({});
    return window.ClaudAPI.fx(curs, disp)
      .then(function (f) { return (f && f.rates) || {}; })
      .catch(function () { return {}; });
  }

  // Pull live quotes for held tickers (plus the FX rates needed to convert any
  // foreign holdings into the display currency), then re-render. Safe offline.
  function refreshQuotes() {
    if (!window.ClaudAPI || !window.ClaudAPI.quotes) return Promise.resolve();
    var syms = [];
    for (var i = 0; i < D.holdings.length; i++) {
      var h = D.holdings[i];
      if (h.ticker && h.kind !== 'cash' && String(h.ticker).toUpperCase() !== 'CASH') syms.push(h.ticker);
    }
    if (!syms.length) { applyQuotes({}); return Promise.resolve(); }
    return window.ClaudAPI.quotes(syms).then(function (r) {
      var quotes = (r && r.quotes) || {};
      return fetchFxFor(quotes).then(function (rates) {
        D.fxRates = rates || {};
        D.fxBase = displayCurrency();
        applyQuotes(quotes);
        D.quotesProvider = r && r.provider;
        D.quotesAsOf = (r && r.asOf) || Date.now();
        emit();
        return r;
      });
    }).catch(function () { applyQuotes(D.quotes || {}); emit(); });
  }

  function load() {
    return window.ClaudAPI.bootstrap().then(function (boot) {
      apply(boot); D.ready = true; emit();
      refreshQuotes();   // live prices, non-blocking; emits again when they land
      return D;
    });
  }

  window.ClaudStore = {
    data: D, hydrate: load, refresh: load, get: function () { return D; }, emit: emit,
    refreshQuotes: refreshQuotes,
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
