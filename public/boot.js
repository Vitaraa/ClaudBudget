/* ============================================================
   Claud — client boot. Plain JS (no JSX), loaded first on every
   page. Provides:
     • instant appearance (theme/surface/accent) before React paints
     • window.ClaudAPI — fetch client with bearer-token auth
     • auth guards (redirect rules for the app vs. the landing page)
   ============================================================ */
(function () {
  var TOKEN_KEY = 'claud:token';
  var APPEARANCE_KEY = 'claud:appearance';

  /* ---- instant appearance (avoids a flash of the wrong theme) ---- */
  try {
    var ap = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null');
    if (ap && typeof ap === 'object') {
      var root = document.documentElement;
      if (ap.theme) root.setAttribute('data-theme', ap.theme);
      if (ap.surface) root.setAttribute('data-surface', ap.surface);
      if (ap.accent) root.style.setProperty('--accent', ap.accent);
      if (ap.density === 'compact') root.classList.add('compact');
    }
  } catch (e) {}

  function saveAppearance(ap) {
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(ap)); } catch (e) {}
  }

  /* ---- token storage ---- */
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  /* ---- fetch client ---- */
  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var tok = getToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    return fetch(path, {
      method: method,
      headers: headers,
      body: body != null ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { error: txt || 'Bad response' }; }
        if (!res.ok) {
          if (res.status === 401 && !/\/(login|^\/$)/.test(location.pathname) && path.indexOf('/api/auth/') !== 0) {
            // token invalid/expired while inside the app -> bounce to sign-in
            setToken(null);
            if (location.pathname !== '/' && location.pathname !== '/login') location.replace('/');
          }
          var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          err.status = res.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  window.ClaudAPI = {
    getToken: getToken,
    setToken: setToken,
    saveAppearance: saveAppearance,
    isAuthed: function () { return !!getToken(); },
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b); },
    put: function (p, b) { return request('PUT', p, b); },
    del: function (p, b) { return request('DELETE', p, b); },
    bootstrap: function () { return request('GET', '/api/bootstrap'); },
    register: function (email, password, name) { return request('POST', '/api/auth/register', { email: email, password: password, name: name }); },
    login: function (email, password) { return request('POST', '/api/auth/login', { email: email, password: password }); },
    me: function () { return request('GET', '/api/auth/me'); },
    setPlan: function (plan) { return request('POST', '/api/auth/plan', { plan: plan }); },
    quotes: function (symbols) { return request('GET', '/api/quotes' + (symbols && symbols.length ? ('?symbols=' + encodeURIComponent(symbols.join(','))) : '')); },
    quotesHistory: function (symbol, period) { return request('GET', '/api/quotes/history?symbol=' + encodeURIComponent(symbol) + '&period=' + encodeURIComponent(period || '1Y')); },
    portfolioSeries: function (period) { return request('GET', '/api/portfolio/series?period=' + encodeURIComponent(period || '1Y')); },
    logout: function () { setToken(null); location.assign('/'); }
  };

  /* ---- guards ---- */
  // On the app: require a token, else go to landing.
  window.ClaudRequireAuth = function () {
    if (!getToken()) { location.replace('/'); return false; }
    return true;
  };
  // On the landing page: if already signed in, skip straight to the app.
  window.ClaudRedirectIfAuthed = function () {
    if (getToken()) location.replace('/app');
  };
})();
