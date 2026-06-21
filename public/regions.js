/* ============================================================
   Claud — regional account model. Plain JS, loaded after
   actions.js and BEFORE the JSX modules (so window.ClaudRegions
   exists when accounts.jsx / app.jsx evaluate).

   One registry, keyed by ISO-ish country code, describing the
   account types, default currency, and representative institutions
   for each supported region. The Add/Edit-account flow and the
   first-run setup read from here so the app speaks the user's local
   financial vocabulary (TFSA/RRSP in Canada, 401(k)/Roth IRA in the
   US, ISA/SIPP in the UK, Super in Australia, …).

   Account-type shape: { group, icon, kind, ph, registered? }
     group : 'Cash' | 'Investments' | 'Credit'  (drives the Accounts page grouping)
     kind  : 'checking' | 'savings' | 'investment' | 'credit'
     icon  : a global Icon name (bank / piggy / chart / shield / card)
     ph    : placeholder account name
     registered : tax-advantaged account (informational)

   The chosen region lives in settings.country; until a user picks one
   (existing accounts, or before setup) we fall back to Canada, which is
   the app's historical default.
   ============================================================ */
(function () {
  var R = {
    US: {
      code: 'US', name: 'United States', flag: '🇺🇸',
      currency: 'USD', locale: 'en-US',
      banks: [
        'Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'U.S. Bank',
        'Capital One', 'PNC Bank', 'TD Bank', 'Truist', 'Ally Bank',
        'Fidelity', 'Charles Schwab', 'Vanguard', 'American Express', 'Other'],
      types: {
        'Checking':        { group: 'Cash',        icon: 'bank',  kind: 'checking',   ph: 'Everyday Checking' },
        'Savings':         { group: 'Cash',        icon: 'piggy', kind: 'savings',    ph: 'High-Yield Savings' },
        '401(k)':          { group: 'Investments', icon: 'shield', kind: 'investment', ph: '401(k)',          registered: true },
        'Roth IRA':        { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'Roth IRA',        registered: true },
        'Traditional IRA': { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'Traditional IRA', registered: true },
        'HSA':             { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'HSA',             registered: true },
        'Brokerage':       { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'Brokerage' },
        'Credit card':     { group: 'Credit',      icon: 'card',  kind: 'credit',     ph: 'Visa' }
      }
    },
    CA: {
      code: 'CA', name: 'Canada', flag: '🇨🇦',
      currency: 'CAD', locale: 'en-CA',
      banks: [
        'RBC Royal Bank', 'TD Canada Trust', 'Scotiabank', 'BMO', 'CIBC',
        'National Bank', 'Desjardins', 'Tangerine', 'EQ Bank', 'Simplii Financial',
        'American Express', 'Wealthsimple', 'Questrade', 'Other'],
      types: {
        'Chequing':    { group: 'Cash',        icon: 'bank',  kind: 'checking',   ph: 'Everyday Chequing' },
        'Savings':     { group: 'Cash',        icon: 'piggy', kind: 'savings',    ph: 'Emergency Savings' },
        'TFSA':        { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'TFSA', registered: true },
        'RRSP':        { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'RRSP', registered: true },
        'FHSA':        { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'FHSA', registered: true },
        'Investment':  { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'Non-registered' },
        'Credit card': { group: 'Credit',      icon: 'card',  kind: 'credit',     ph: 'Visa' }
      }
    },
    UK: {
      code: 'UK', name: 'United Kingdom', flag: '🇬🇧',
      currency: 'GBP', locale: 'en-GB',
      banks: [
        'Barclays', 'HSBC UK', 'Lloyds Bank', 'NatWest', 'Santander UK',
        'Halifax', 'Nationwide', 'Monzo', 'Starling Bank', 'Revolut',
        'Hargreaves Lansdown', 'Vanguard Investor', 'Other'],
      types: {
        'Current account': { group: 'Cash',        icon: 'bank',  kind: 'checking',   ph: 'Current account' },
        'Savings':         { group: 'Cash',        icon: 'piggy', kind: 'savings',    ph: 'Savings' },
        'ISA':             { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'Stocks & Shares ISA', registered: true },
        'Lifetime ISA':    { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'Lifetime ISA',       registered: true },
        'SIPP':            { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'SIPP',               registered: true },
        'Investment':      { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'General Investment' },
        'Credit card':     { group: 'Credit',      icon: 'card',  kind: 'credit',     ph: 'Credit card' }
      }
    },
    AU: {
      code: 'AU', name: 'Australia', flag: '🇦🇺',
      currency: 'AUD', locale: 'en-AU',
      banks: [
        'Commonwealth Bank', 'Westpac', 'NAB', 'ANZ', 'Macquarie Bank',
        'Bendigo Bank', 'ING Australia', 'Up', 'CommSec', 'Vanguard Australia', 'Other'],
      types: {
        'Transaction':    { group: 'Cash',        icon: 'bank',  kind: 'checking',   ph: 'Everyday account' },
        'Savings':        { group: 'Cash',        icon: 'piggy', kind: 'savings',    ph: 'Savings' },
        'Superannuation': { group: 'Investments', icon: 'shield', kind: 'investment', ph: 'Super', registered: true },
        'Share trading':  { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'Share trading' },
        'Investment':     { group: 'Investments', icon: 'chart',  kind: 'investment', ph: 'Managed fund' },
        'Credit card':    { group: 'Credit',      icon: 'card',  kind: 'credit',     ph: 'Credit card' }
      }
    }
  };

  var ORDER = ['US', 'CA', 'UK', 'AU'];
  var DEFAULT = 'CA';   // app's historical default (CAD, Canadian types)

  // Map a stored / typed country value to a registry key. Accepts the code,
  // the full name, and common aliases; falls back to the default region.
  function norm(v) {
    if (!v) return DEFAULT;
    var s = String(v).trim().toUpperCase();
    var alias = {
      US: 'US', USA: 'US', 'UNITED STATES': 'US', AMERICA: 'US',
      CA: 'CA', CAN: 'CA', CANADA: 'CA',
      UK: 'UK', GB: 'UK', GBR: 'UK', 'UNITED KINGDOM': 'UK', BRITAIN: 'UK', ENGLAND: 'UK',
      AU: 'AU', AUS: 'AU', AUSTRALIA: 'AU'
    };
    return R[s] ? s : (alias[s] || DEFAULT);
  }

  function get(v) { return R[norm(v)]; }

  // The region currently in effect, read live from settings.country.
  function current() {
    var s = (window.ClaudData && window.ClaudData.settings) || {};
    return get(s.country);
  }

  // Currency 3-letter code for a region (used to default the display currency).
  function currencyFor(v) { return get(v).currency; }

  window.ClaudRegions = {
    regions: R,
    order: ORDER,
    DEFAULT: DEFAULT,
    norm: norm,
    get: get,
    current: current,
    currencyFor: currencyFor,
    // Convenience accessors keyed by an optional country (defaults to current()).
    list: function () { return ORDER.map(function (c) { return R[c]; }); },
    types: function (v) { return (v ? get(v) : current()).types; },
    banks: function (v) { return (v ? get(v) : current()).banks; },
    typeNames: function (v) { return Object.keys((v ? get(v) : current()).types); }
  };
})();
