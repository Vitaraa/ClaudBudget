/* ============================================================
   Claud — write actions. Plain JS. Each action maps the frontend's
   object shape to the API body, persists it, then refreshes the
   store (re-pulling derived figures) so every view updates.
   Errors surface as a small alert so a failed save isn't silent.
   ============================================================ */
(function () {
  var API = window.ClaudAPI, Store = window.ClaudStore;
  function fail(e) { console.error('[Claud]', e); try { alert(e && e.message ? e.message : 'Something went wrong'); } catch (x) {} throw e; }
  function done() { return Store.refresh(); }

  function groupForType(type) {
    var t = String(type || '').toLowerCase();
    if (/credit|card|loan|mortgage|line of credit/.test(t)) return 'Credit';
    // Investment / tax-advantaged types across all supported regions
    // (US 401k/IRA/HSA/brokerage, CA TFSA/RRSP/FHSA, UK ISA/LISA/SIPP, AU Super/share).
    if (/broker|401|ira|roth|retire|invest|hsa|529|tfsa|rrsp|rsp|fhsa|resp|\bisa\b|lisa|sipp|pension|super|share trading|managed fund/.test(t)) return 'Investments';
    return 'Cash';
  }
  function mapAccount(a) {
    return {
      name: a.name,
      balance: a.bal != null ? a.bal : a.balance,
      mask: a.mask, apy: a.apy, icon: a.icon, type: a.type,
      institution: a.inst != null ? a.inst : a.institution,
      group_label: a.group_label || a.group || groupForType(a.type)
    };
  }
  function mapTxn(x) {
    var t = {
      name: x.name,
      category: x.cat != null ? x.cat : x.category,
      amount: x.amt != null ? x.amt : x.amount,
      account: x.account != null ? x.account : x.account_name,
      date: x.date || x.day, icon: x.icon,
      review: x.review, reason: x.reason
    };
    // Pass through the account id (lets the server scope dedup/recurring to the
    // right account) and forceInclude (user re-included a flagged duplicate).
    // `origin` is deliberately NOT forwarded — the server assigns it.
    if (x.account_id !== undefined) t.account_id = x.account_id;
    if (x.forceInclude !== undefined) t.forceInclude = x.forceInclude;
    return t;
  }
  function mapHolding(h) {
    // account_id links the holding to an investment account; '' / null clears it.
    var acct = h.account_id !== undefined ? h.account_id : (h.accountId !== undefined ? h.accountId : null);
    if (h.kind === 'cash') {
      var amt = h.value != null ? h.value : (h.amount != null ? h.amount : (h.price || 0));
      return { ticker: 'CASH', name: h.name, cls: h.cls || 'Cash', kind: 'cash', shares: 1, price: amt, cost: amt, account_id: acct };
    }
    return {
      ticker: h.ticker, name: h.name, cls: h.cls, kind: h.kind,
      shares: h.shares, price: h.price, cost: h.cost, account_id: acct
    };
  }

  window.ClaudActions = {
    // accounts
    addAccount: function (a) { return API.post('/api/accounts', mapAccount(a)).then(done).catch(fail); },
    updateAccount: function (id, patch) { return API.put('/api/accounts/' + id, patch).then(done).catch(fail); },
    reorderAccounts: function (ids) { return API.post('/api/accounts/reorder', { order: ids }).then(done).catch(fail); },
    deleteAccount: function (id) { return API.del('/api/accounts/' + id).then(done).catch(fail); },
    setAccountIcon: function (name, icon) {
      var a = Store.get().accounts.find(function (x) { return x.name === name; });
      if (!a) return Promise.resolve();
      return API.put('/api/accounts/' + a.id, { icon: icon }).then(done).catch(fail);
    },

    // transactions
    addTxn: function (x) { return API.post('/api/transactions', mapTxn(x)).then(done).catch(fail); },
    updateTxn: function (id, patch) { return API.put('/api/transactions/' + id, patch).then(done).catch(fail); },
    removeTxn: function (id) { return API.del('/api/transactions/' + id).then(done).catch(fail); },
    recatTxn: function (id, cat) { return API.put('/api/transactions/' + id, { category: cat, review: false }).then(done).catch(fail); },
    setTxnIcon: function (id, icon) { return API.put('/api/transactions/' + id, { icon: icon }).then(done).catch(fail); },
    importTxns: function (items) {
      // Keep the server response (count / skippedCount / linkedCount / skipped)
      // so the caller can surface "Imported N · skipped M · linked K", then
      // refresh the store and resolve to that response.
      return API.post('/api/transactions/import', { items: (items || []).map(mapTxn) })
        .then(function (res) { return done().then(function () { return res; }); })
        .catch(fail);
    },
    bulkTxn: function (ids, action, category) { return API.post('/api/transactions/bulk', { ids: ids, action: action, category: category }).then(done).catch(fail); },

    // rules
    addRule: function (match, category, applyNow) { return API.post('/api/rules', { match: match, category: category, applyNow: !!applyNow }).then(done).catch(fail); },
    updateRule: function (id, patch) { return API.put('/api/rules/' + id, patch).then(done).catch(fail); },
    deleteRule: function (id) { return API.del('/api/rules/' + id).then(done).catch(fail); },

    // budget
    addBudgetGroup: function (label) { return API.post('/api/budget/groups', { label: label }).then(done).catch(fail); },
    seedStarterBudget: function () { return API.post('/api/budget/seed', {}).then(done).catch(fail); },
    updateBudgetGroup: function (id, patch) { return API.put('/api/budget/groups/' + id, patch).then(done).catch(fail); },
    deleteBudgetGroup: function (id) { return API.del('/api/budget/groups/' + id).then(done).catch(fail); },
    addCategory: function (c) { return API.post('/api/budget/categories', c).then(done).catch(fail); },
    updateCategory: function (id, patch) { return API.put('/api/budget/categories/' + id, patch).then(done).catch(fail); },
    deleteCategory: function (id) { return API.del('/api/budget/categories/' + id).then(done).catch(fail); },
    coverOverspend: function (moves) { return API.post('/api/budget/cover', { moves: moves }).then(done).catch(fail); },

    // recurring
    addRecurring: function (r) { return API.post('/api/recurring', r).then(done).catch(fail); },
    updateRecurring: function (id, patch) { return API.put('/api/recurring/' + id, patch).then(done).catch(fail); },
    deleteRecurring: function (id) { return API.del('/api/recurring/' + id).then(done).catch(fail); },

    // goals
    addGoal: function (g) { return API.post('/api/goals', g).then(done).catch(fail); },
    updateGoal: function (id, patch) { return API.put('/api/goals/' + id, patch).then(done).catch(fail); },
    deleteGoal: function (id) { return API.del('/api/goals/' + id).then(done).catch(fail); },
    addFunds: function (id, amount, fromAccountId) { return API.post('/api/goals/' + id + '/funds', { amount: amount, fromAccountId: fromAccountId }).then(done).catch(fail); },

    // holdings
    saveHolding: function (h) {
      var p = (h.id && String(h.id).indexOf('hd_') === 0)
        ? API.put('/api/holdings/' + h.id, mapHolding(h))
        : API.post('/api/holdings', mapHolding(h));
      return p.then(done).catch(fail);
    },
    deleteHolding: function (id) { return API.del('/api/holdings/' + id).then(done).catch(fail); },
    // Sell some/all shares of a holding; proceeds settle into its account's cash.
    sellHolding: function (id, shares, price) { return API.post('/api/holdings/' + id + '/sell', { shares: shares, price: price }).then(done).catch(fail); },

    // foresight
    addPlan: function (p) { return API.post('/api/foresight/plans', p).then(done).catch(fail); },
    updatePlan: function (id, patch) { return API.put('/api/foresight/plans/' + id, patch).then(done).catch(fail); },
    deletePlan: function (id) { return API.del('/api/foresight/plans/' + id).then(done).catch(fail); },
    setOverride: function (cat, year, amount) { return API.put('/api/foresight/overrides', { cat: cat, year: year, amount: amount }).then(done).catch(fail); },

    // settings + plan
    saveSettings: function (patch) { return API.put('/api/settings', patch).then(done).catch(fail); },
    setPlan: function (plan) { return API.setPlan(plan).then(done).catch(fail); },
    updateProfile: function (name) { return API.put('/api/auth/profile', { name: name }).then(done).catch(fail); }
  };
})();
