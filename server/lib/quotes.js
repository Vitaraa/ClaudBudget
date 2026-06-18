'use strict';
/* ============================================================
   Claud — live market data.
   A small quotes layer with a provider abstraction. The default
   provider is Yahoo Finance's public v8 chart endpoint: keyless,
   covers US + Canadian (.TO) + most international symbols in the
   exact ticker format this app already uses, and returns both a
   real-time-ish quote and historical candles.

   Design rules:
     • Zero external dependencies — Node 22's global fetch only.
     • Every failure is swallowed and surfaced as null, so the app
       degrades gracefully to the user's last-entered prices rather
       than throwing. A missing quote must never break a page.
     • Everything is cached with a short TTL so we stay well under
       any rate limit even with auto-refresh + multiple holdings.

   Swapping providers: set FINNHUB_API_KEY or TWELVEDATA_API_KEY in
   the environment and quotes will route through that official feed
   instead (history always falls back to Yahoo). No code change.
   ============================================================ */

const QUOTE_TTL_MS = 60 * 1000;        // live quotes: 60s
const HIST_TTL_MS = 10 * 60 * 1000;    // candle history: 10 min
const FETCH_TIMEOUT_MS = 7000;
const MAX_CONCURRENCY = 5;
const UA = 'Mozilla/5.0 (compatible; ClaudBudget/1.0; +personal-finance)';

const quoteCache = new Map();   // SYMBOL            -> { t, data }
const histCache = new Map();    // SYMBOL|PERIOD     -> { t, data }

/* ------------------------------------------------------------ helpers */
const numOr = (v, d = null) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function providerName() {
  if (process.env.FINNHUB_API_KEY) return 'finnhub';
  if (process.env.TWELVEDATA_API_KEY) return 'twelvedata';
  return 'yahoo';
}

async function fetchJson(url, { headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, headers || {})
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Run async fn over items with a bounded number of workers.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// Last finite value in an array (Yahoo pads trailing nulls on live days).
function lastFinite(arr) {
  if (!Array.isArray(arr)) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(arr[i])) return arr[i];
  return null;
}

/* ================================================================
   YAHOO FINANCE (default, keyless)
   ================================================================ */
const YH = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// period key -> Yahoo range/interval, for the single-symbol detail chart.
const HIST_MAP = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' }
};

// period key -> range/interval for the portfolio-vs-benchmark compare chart.
const SERIES_MAP = {
  '3M': { range: '3mo', interval: '1wk' },
  '6M': { range: '6mo', interval: '1wk' },
  '1Y': { range: '1y', interval: '1wk' },
  'All': { range: '2y', interval: '1mo' }
};

function parseYahooChart(json) {
  const r = json && json.chart && Array.isArray(json.chart.result) && json.chart.result[0];
  if (!r || !r.meta) return null;
  const m = r.meta;
  const ind = r.indicators && r.indicators.quote && r.indicators.quote[0];
  const price = numOr(m.regularMarketPrice);
  if (price == null) return null;
  const prev = numOr(m.previousClose, numOr(m.chartPreviousClose));
  const day = (prev && prev > 0) ? ((price - prev) / prev) * 100 : 0;
  return {
    meta: {
      price,
      prevClose: prev,
      day,
      open: lastFinite(ind && ind.open),
      dayHigh: numOr(m.regularMarketDayHigh, lastFinite(ind && ind.high)),
      dayLow: numOr(m.regularMarketDayLow, lastFinite(ind && ind.low)),
      wkHigh: numOr(m.fiftyTwoWeekHigh),
      wkLow: numOr(m.fiftyTwoWeekLow),
      volume: numOr(m.regularMarketVolume, lastFinite(ind && ind.volume)),
      currency: m.currency || null,
      exchange: m.fullExchangeName || m.exchangeName || null,
      marketState: m.marketState || null,
      asOf: m.regularMarketTime ? m.regularMarketTime * 1000 : Date.now()
    },
    raw: r
  };
}

async function yahooQuote(symbol) {
  const json = await fetchJson(YH + encodeURIComponent(symbol) + '?interval=1d&range=1d');
  const parsed = parseYahooChart(json);
  return parsed ? parsed.meta : null;
}

// Pull aligned {timestamps, closes} out of a chart payload (prefers adjclose).
function extractHistory(json) {
  const parsed = parseYahooChart(json);
  if (!parsed) return null;
  const r = parsed.raw;
  const ts = Array.isArray(r.timestamp) ? r.timestamp : [];
  const ind = r.indicators && r.indicators.quote && r.indicators.quote[0];
  const adj = r.indicators && r.indicators.adjclose && r.indicators.adjclose[0];
  const closeArr = (adj && Array.isArray(adj.adjclose) ? adj.adjclose
    : ind && Array.isArray(ind.close) ? ind.close : []);
  const timestamps = [];
  const closes = [];
  for (let i = 0; i < ts.length; i++) {
    if (Number.isFinite(closeArr[i])) { timestamps.push(ts[i]); closes.push(closeArr[i]); }
  }
  if (closes.length < 2) return null;
  return { timestamps, closes };
}

async function yahooHistory(symbol, range, interval) {
  const json = await fetchJson(
    YH + encodeURIComponent(symbol) + '?interval=' + interval + '&range=' + range
  );
  return extractHistory(json);
}

/* ================================================================
   OPTIONAL OFFICIAL PROVIDERS (only used when a key is present).
   Quote-only; history always uses Yahoo.
   ================================================================ */
async function finnhubQuote(symbol) {
  const key = process.env.FINNHUB_API_KEY;
  const j = await fetchJson(
    'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + key
  );
  const price = numOr(j.c);
  if (price == null || price === 0) return null;       // 0 = unknown symbol on free tier
  const prev = numOr(j.pc);
  return {
    price, prevClose: prev,
    day: numOr(j.dp, (prev && prev > 0 ? ((price - prev) / prev) * 100 : 0)),
    open: numOr(j.o), dayHigh: numOr(j.h), dayLow: numOr(j.l),
    wkHigh: null, wkLow: null, volume: null, currency: 'USD',
    exchange: null, marketState: null, asOf: (numOr(j.t) ? j.t * 1000 : Date.now())
  };
}

async function twelvedataQuote(symbol) {
  const key = process.env.TWELVEDATA_API_KEY;
  const j = await fetchJson(
    'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(symbol) + '&apikey=' + key
  );
  const price = numOr(parseFloat(j.close));
  if (price == null || j.status === 'error') return null;
  const prev = numOr(parseFloat(j.previous_close));
  return {
    price, prevClose: prev,
    day: numOr(parseFloat(j.percent_change), (prev && prev > 0 ? ((price - prev) / prev) * 100 : 0)),
    open: numOr(parseFloat(j.open)), dayHigh: numOr(parseFloat(j.high)), dayLow: numOr(parseFloat(j.low)),
    wkHigh: numOr(j.fifty_two_week && parseFloat(j.fifty_two_week.high)),
    wkLow: numOr(j.fifty_two_week && parseFloat(j.fifty_two_week.low)),
    volume: numOr(parseFloat(j.volume)), currency: j.currency || null,
    exchange: j.exchange || null, marketState: j.is_market_open === false ? 'CLOSED' : null,
    asOf: Date.now()
  };
}

async function fetchOneQuote(symbol) {
  const prov = providerName();
  try {
    if (prov === 'finnhub') return (await finnhubQuote(symbol)) || (await yahooQuote(symbol));
    if (prov === 'twelvedata') return (await twelvedataQuote(symbol)) || (await yahooQuote(symbol));
    return await yahooQuote(symbol);
  } catch {
    // last resort: try Yahoo if an official provider threw
    if (prov !== 'yahoo') { try { return await yahooQuote(symbol); } catch { /* give up */ } }
    return null;
  }
}

/* ================================================================
   PUBLIC API
   ================================================================ */

// getQuotes(['AAPL','RY.TO']) -> { AAPL: {price,day,...}|null, 'RY.TO': {...} }
async function getQuotes(symbols) {
  const want = Array.from(new Set((symbols || [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter((s) => s && s !== 'CASH')));
  const result = {};
  const now = Date.now();
  const need = [];
  for (const sym of want) {
    const c = quoteCache.get(sym);
    if (c && now - c.t < QUOTE_TTL_MS) result[sym] = c.data;
    else need.push(sym);
  }
  if (need.length) {
    await mapLimit(need, MAX_CONCURRENCY, async (sym) => {
      const data = await fetchOneQuote(sym);
      quoteCache.set(sym, { t: Date.now(), data });   // cache nulls too (don't hammer bad symbols)
      result[sym] = data;
    });
  }
  return result;
}

// getHistory('AAPL','1Y') -> { timestamps:[...], closes:[...] } | null
async function getHistory(symbol, periodKey) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym || sym === 'CASH') return null;
  const period = HIST_MAP[periodKey] ? periodKey : '1Y';
  const key = sym + '|' + period;
  const c = histCache.get(key);
  if (c && Date.now() - c.t < HIST_TTL_MS) return c.data;
  const { range, interval } = HIST_MAP[period];
  let data = null;
  try { data = await yahooHistory(sym, range, interval); } catch { data = null; }
  histCache.set(key, { t: Date.now(), data });
  return data;
}

/* Build a real portfolio-vs-benchmark series from the user's holdings.
   holdings: rows with { ticker, kind, shares, price } (cash kinds count
   as a flat cash sleeve). Returns { labels, portfolio, benchmark,
   benchmarkSymbol } or null if the benchmark can't be loaded. */
async function getPortfolioSeries(holdings, periodKey, benchmarkSymbol = '^GSPC') {
  const period = SERIES_MAP[periodKey] ? periodKey : '1Y';
  const { range, interval } = SERIES_MAP[period];

  const bench = await yahooHistory(benchmarkSymbol, range, interval).catch(() => null);
  if (!bench || bench.closes.length < 2) return null;       // no benchmark -> caller falls back
  const spine = bench.timestamps;

  const equity = (holdings || []).filter(
    (h) => h.kind !== 'cash' && h.ticker && String(h.ticker).toUpperCase() !== 'CASH' && h.shares > 0
  );
  const cashValue = (holdings || [])
    .filter((h) => h.kind === 'cash' || String(h.ticker).toUpperCase() === 'CASH')
    .reduce((s, h) => s + (h.shares || 1) * (h.price || 0), 0);

  // Pull each holding's history (same range/interval -> comparable spine).
  const series = await mapLimit(equity, MAX_CONCURRENCY, async (h) => {
    const hist = await yahooHistory(String(h.ticker).toUpperCase(), range, interval).catch(() => null);
    return { h, hist };
  });

  // Forward-filled close at each spine timestamp, per holding.
  function closeAt(hist, ts) {
    if (!hist) return null;
    const { timestamps, closes } = hist;
    let val = null;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] <= ts) val = closes[i]; else break;
    }
    return val;
  }

  const portfolio = spine.map((ts) => {
    let total = cashValue;
    let any = false;
    for (const { h, hist } of series) {
      const px = closeAt(hist, ts);
      if (px != null) { total += h.shares * px; any = true; }
    }
    return any || cashValue ? total : null;
  });

  // Need a usable portfolio curve; otherwise let the caller fall back.
  if (portfolio.filter((v) => v != null).length < 2) return null;
  // Forward-fill any leading nulls so the line is continuous.
  let last = portfolio.find((v) => v != null);
  for (let i = 0; i < portfolio.length; i++) {
    if (portfolio[i] == null) portfolio[i] = last; else last = portfolio[i];
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = spine.map((ts) => {
    const d = new Date(ts * 1000);
    return MONTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(-2);
  });

  return { labels, portfolio, benchmark: bench.closes, benchmarkSymbol };
}

module.exports = {
  providerName,
  getQuotes,
  getHistory,
  getPortfolioSeries,
  // exported for unit testing
  _parseYahooChart: parseYahooChart,
  _extractHistory: extractHistory
};
