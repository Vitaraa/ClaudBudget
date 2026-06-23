/* ============================================================
   Claud — Add transaction flow
   Loaded after accounts.jsx, before app.jsx (which mounts it).
   Self-contained: tx*-prefixed identifiers, reuses the global
   Icon component, CAT_COLORS, and the DS bundle. Exposes
   AddTransactionModal on window.
   ============================================================ */
const TX_DS = window.ClaudDesignSystem_de602a || {};

const TX_EXPENSE_CATS = ["Groceries", "Dining", "Transport", "Shopping", "Subscriptions", "Utilities", "Housing"];
// built-in expense categories ∪ the user's live budget categories (so a budget like "test" is taggable)
const txExpenseCats = () => {
  const base = [...TX_EXPENSE_CATS];
  const store = window.__claudBudgetStore;
  const groups = store && store.get && store.get();
  if (groups) groups.forEach((g) => g.cats.forEach((c) => { if (c.name !== "Income" && !base.includes(c.name)) base.push(c.name); }));
  return base;
};
const TX_ICON = {
  Income: "income", Groceries: "cart", Dining: "coffee", Transport: "fuel",
  Shopping: "bag", Subscriptions: "music", Utilities: "bag", Housing: "bank" };

const txToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const txDayLabel = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return M[d.getMonth()] + " " + d.getDate();
};

/* The add-transaction modal does three jobs, chosen by the Type control:
   Expense / Income (a single signed transaction) and Transfer (moves a sum
   between two accounts — handled by onTransfer, which the server records as two
   linked, spending-excluded legs). `lockedAccount` pre-selects the account when
   opened from an account's own page; `initialType` opens straight on a type. */
function AddTransactionModal({ accounts = [], onClose, onAdd, onTransfer, lockedAccount, initialType }) {
  const { Segmented, Button } = TX_DS;
  const acctList = accounts || [];
  const canTransfer = !!onTransfer && acctList.length >= 2;
  const TYPES = canTransfer ? ["Expense", "Income", "Transfer"] : ["Expense", "Income"];
  const firstAcct = (lockedAccount && acctList.indexOf(lockedAccount) !== -1) ? lockedAccount : (acctList[0] || "");
  const [kind, setKind] = React.useState(TYPES.indexOf(initialType) !== -1 ? initialType : "Expense");
  const [name, setName] = React.useState("");
  const [amt, setAmt] = React.useState("");
  const [cat, setCat] = React.useState("Groceries");
  const [account, setAccount] = React.useState(firstAcct);
  const [fromAcct, setFromAcct] = React.useState(firstAcct);
  const [toAcct, setToAcct] = React.useState(acctList.find((a) => a !== firstAcct) || "");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(txToday());
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isIncome = kind === "Income";
  const isTransfer = kind === "Transfer";

  // keep the destination valid when the source changes onto it
  React.useEffect(() => {
    if (isTransfer && fromAcct && fromAcct === toAcct) setToAcct(acctList.find((a) => a !== fromAcct) || "");
  }, [fromAcct]); // eslint-disable-line

  const amtNum = parseFloat(String(amt).replace(/[^0-9.\-]/g, ""));
  const validAmt = amt !== "" && !Number.isNaN(amtNum) && amtNum > 0;
  const validName = name.trim().length > 0;
  const validTransfer = !!(fromAcct && toAcct && fromAcct !== toAcct && validAmt);
  const valid = isTransfer ? validTransfer : (validName && validAmt);

  function submit() {
    setTouched(true);
    if (!valid) return;
    if (isTransfer) {
      onTransfer({ from: fromAcct, to: toAcct, amt: Math.abs(amtNum), date: date, note: note.trim() });
      return;
    }
    const finalCat = isIncome ? "Income" : cat;
    onAdd({
      name: name.trim(),
      cat: finalCat,
      amt: isIncome ? Math.abs(amtNum) : -Math.abs(amtNum),
      date: date,
      day: txDayLabel(date),
      account: account || (acctList[0] || "Everyday Checking"),
      icon: TX_ICON[finalCat] || "bag"
    });
  }

  const titleIcon = isTransfer ? "repeat" : (TX_ICON[isIncome ? "Income" : cat] || "bag");
  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={isTransfer ? "Transfer between accounts" : "Add transaction"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name={titleIcon} /></span>{isTransfer ? "Transfer between accounts" : "Add transaction"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>

        <div className="fs-grid">
          <div className="fs-field full">
            <span>Type</span>
            {Segmented && <Segmented options={TYPES} value={kind} onChange={setKind} />}
          </div>

          {isTransfer ?
            <React.Fragment>
              <label className="fs-field">
                <span>From</span>
                <select value={fromAcct} onChange={(e) => setFromAcct(e.target.value)}
                  style={touched && (!fromAcct || fromAcct === toAcct) ? { borderColor: "var(--red)" } : undefined}>
                  {acctList.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="fs-field">
                <span>To</span>
                <select value={toAcct} onChange={(e) => setToAcct(e.target.value)}
                  style={touched && (!toAcct || fromAcct === toAcct) ? { borderColor: "var(--red)" } : undefined}>
                  <option value="" disabled>Select account{"…"}</option>
                  {acctList.filter((a) => a !== fromAcct).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="fs-field">
                <span>Amount (CAD)</span>
                <input type="number" inputMode="decimal" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00"
                  style={touched && !validAmt ? { borderColor: "var(--red)" } : undefined} />
              </label>
              <label className="fs-field">
                <span>Date</span>
                <input type="date" value={date} max={txToday()} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="fs-field full">
                <span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly savings" />
              </label>
              {validTransfer &&
                <div className="fs-field full tx-transfer-note">
                  Moves <b>{"$" + (amtNum || 0).toFixed(2)}</b> from <b>{fromAcct}</b> to <b>{toAcct}</b>. Kept out of income &amp; spending.
                </div>}
            </React.Fragment>
            :
            <React.Fragment>
              <label className="fs-field full">
                <span>Description</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isIncome ? "e.g. Paycheck" : "e.g. Whole Foods Market"}
                  style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
              </label>

              <label className="fs-field">
                <span>Amount (CAD)</span>
                <input type="number" inputMode="decimal" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00"
                  style={touched && !validAmt ? { borderColor: "var(--red)" } : undefined} />
              </label>
              <label className="fs-field">
                <span>Account</span>
                <select value={account} onChange={(e) => setAccount(e.target.value)}>
                  {acctList.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>

              {!isIncome &&
                <label className="fs-field">
                  <span>Category</span>
                  <select value={cat} onChange={(e) => setCat(e.target.value)}>
                    {txExpenseCats().map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              }
              <label className={"fs-field" + (isIncome ? " full" : "")}>
                <span>Date</span>
                <input type="date" value={date} max={txToday()} onChange={(e) => setDate(e.target.value)} />
              </label>
            </React.Fragment>}
        </div>

        <div className="fs-modal-foot">
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>{isTransfer ? "Transfer" : "Add transaction"}</Button>}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { AddTransactionModal });

/* ============================================================
   Claud — Import flow (statements + receipts)
   A statement (PDF / CSV / OFX) is parsed locally into a
   reviewable list of REAL detected transactions; a receipt image
   is read with on-device OCR into a single editable transaction
   with the photo attached. Both funnel through onImport(items[]) —
   the same store the add-transaction modal writes to. Files never
   leave the browser (parsing + OCR run client-side).
   ============================================================ */

/* ---- lazy CDN loader: tries each url until one loads ---- */
const TX_CDN = {};
function txLoadScript(key, urls) {
  if (TX_CDN[key]) return TX_CDN[key];
  TX_CDN[key] = new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) { reject(new Error("Could not load " + key)); return; }
      const s = document.createElement("script");
      s.src = urls[i++];
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); tryNext(); };
      document.head.appendChild(s);
    };
    tryNext();
  });
  return TX_CDN[key];
}
const TX_PDFJS_VER = "3.11.174";
function txLoadPdfJs() {
  return txLoadScript("pdfjs", [
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@" + TX_PDFJS_VER + "/build/pdf.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + TX_PDFJS_VER + "/pdf.min.js"
  ]).then(() => {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error("pdf.js unavailable");
    try {
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@" + TX_PDFJS_VER + "/build/pdf.worker.min.js";
    } catch (e) {}
    return lib;
  });
}
function txLoadTesseract() {
  return txLoadScript("tesseract", [
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js"
  ]).then(() => {
    if (!window.Tesseract) throw new Error("Tesseract unavailable");
    return window.Tesseract;
  });
}

/* ---- value parsers (shared by every statement format) ---- */
const TX_MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function txISO(y, mo, da) {
  if (!y || !mo || !da || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
}
/* parse a date in many common statement formats → ISO yyyy-mm-dd (or null) */
function txParseDate(raw, yearHint) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const Y = yearHint || new Date().getFullYear();
  let m;
  if ((m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/))) return txISO(+m[1], +m[2], +m[3]);   // ISO
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return txISO(+m[1], +m[2], +m[3]);                     // OFX yyyymmdd
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/))) {                            // mm/dd[/yy] or dd/mm
    let a = +m[1], b = +m[2], y = m[3] != null ? +m[3] : Y;
    if (y < 100) y += 2000;
    let mo, da;
    if (a > 12 && b <= 12) { da = a; mo = b; } else { mo = a; da = b; }   // default North-American mm/dd
    return txISO(y, mo, da);
  }
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
  if ((m = s.match(new RegExp("^" + mon + "[a-z]*\\.?\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?$", "i"))))      // Mon DD, YYYY
    return txISO(m[3] ? +m[3] : Y, TX_MON[m[1].toLowerCase()] + 1, +m[2]);
  if ((m = s.match(new RegExp("^(\\d{1,2})\\s+" + mon + "[a-z]*\\.?(?:\\s+(\\d{4}))?$", "i"))))        // DD Mon YYYY
    return txISO(m[3] ? +m[3] : Y, TX_MON[m[2].toLowerCase()] + 1, +m[1]);
  return null;
}
/* parse a money string → signed number (handles $, commas, (parens)=neg, trailing -, DR/CR) */
function txParseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) neg = true;                 // (12.34) → negative
  if (/-\s*$/.test(s) || /^-/.test(s)) neg = true;    // leading/trailing minus
  if (/\bDR\b/i.test(s)) neg = true;
  if (/\bCR\b/i.test(s)) neg = false;
  s = s.replace(/[^0-9.]/g, "");
  if (!s || isNaN(parseFloat(s))) return null;
  const n = parseFloat(s);
  return neg ? -n : n;
}

/* ---- keyword categoriser ---------------------------------------------------
   A merchant that matches one of these rules is categorised with confidence, so
   it does NOT need a human review on import. Anything that matches nothing here
   (and has no usable bank spend-category) falls through to the review queue. */
const TX_CAT_RULES = [
  [/(grocer|market|whole foods|trader joe|safeway|kroger|loblaw|metro|costco|walmart|aldi|sobeys|no frills|superstore|save[- ]?on|foody)/i, "Groceries", "cart"],
  [/(coffee|caf[eé]|starbucks|restaurant|dining|pizza|mcdonald|uber eats|doordash|grubhub|skip|tim hortons|\bbar\b|\bpub\b|bistro|grill|sushi|hotpot|\btea\b)/i, "Dining", "coffee"],
  [/(uber|lyft|shell|esso|petro|chevron|\bgas\b|fuel|transit|parking|presto|via rail|\bair\b|airlines|train|impark)/i, "Transport", "fuel"],
  [/(netflix|spotify|disney|hulu|prime video|youtube premium|subscription|patreon|icloud|dropbox|adobe|notion|openai|claude)/i, "Subscriptions", "music"],
  [/(hydro|electric|water|rogers|bell|telus|fido|koodo|at&t|verizon|comcast|internet|wireless|utility|utilit)/i, "Utilities", "bag"],
  [/(rent|mortgage|landlord|property|strata|condo fee|housing)/i, "Housing", "bank"],
  [/(amazon|target|\bstore\b|\bshop\b|best buy|home depot|ikea|pharmaprix|shoppers|walgreens|cvs|etsy|aliexpress|apple)/i, "Shopping", "bag"]
];
function txGuessCat(name) {
  const s = String(name || "");
  for (const r of TX_CAT_RULES) if (r[0].test(s)) return { cat: r[1], icon: r[2], matched: true };
  return { cat: "Shopping", icon: "bag", matched: false };
}

/* ---- bank-provided spend categories ----------------------------------------
   Some issuers (e.g. CIBC) print their own spend-category beside each charge;
   when the PDF is flattened it bleeds into the merchant text. We detect it so we
   can (a) strip it out of the name and (b) reuse it as a categorisation hint.
   A `null` target means the bank's bucket is too broad to map confidently, so
   such rows stay in the review queue. */
const TX_BANK_CATS = [
  [/\bretail and grocery\b/i, "Groceries"],
  [/\brestaurants?\b/i, "Dining"],
  [/\btransportation\b/i, "Transport"],
  [/\bhome and office improvements?\b/i, "Shopping"],
  [/\bpersonal and household expenses?\b/i, "Shopping"],
  [/\bhealth and education\b/i, "Shopping"],
  [/\bprofessional and financial services\b/i, null],
  [/\bhotel,?\s*entertainment and recreation\b/i, null],
  [/\bforeign currency transactions?\b/i, null],
  [/\bother transactions?\b/i, null]
];
function txStripBankCat(name) {
  let s = String(name || ""), cat = null, mapped = false;
  for (const [re, target] of TX_BANK_CATS) {
    if (re.test(s)) { s = s.replace(re, " ").replace(/\s{2,}/g, " ").trim(); cat = target; mapped = target != null; break; }
  }
  return { name: s, bankCat: cat, bankMapped: mapped };
}
/* Resolve a final category + a confidence flag. Keyword match wins (most
   specific), then a mapped bank category, else the generic default — and only
   that last case is "not confident" → flagged for review. */
function txResolveCat(rawName, cleanName, amt, bankCat, bankMapped) {
  if (amt > 0) return { cat: "Income", icon: "income", confident: true };
  const kw = txGuessCat((cleanName || "") + " " + (rawName || ""));
  if (kw.matched) return { cat: kw.cat, icon: kw.icon, confident: true };
  if (bankMapped && bankCat) return { cat: bankCat, icon: TX_ICON[bankCat] || "bag", confident: true };
  return { cat: "Shopping", icon: "bag", confident: false };
}

/* ---- merchant-name cleaner -------------------------------------------------
   Bank/card statements pad the payee with the posting date, store/auth refs,
   processor prefixes (SQ*, TST*…) and a trailing city/region. The date is
   already shown in its own column, so strip it and reduce the rest to a tidy,
   human-readable merchant name. */
const TX_REGION = "AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
const TX_DATE_LEAD = new RegExp(
  "^(?:" +
    "\\d{4}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{1,2}" +
    "|\\d{1,2}[\\/\\-.]\\d{1,2}(?:[\\/\\-.]\\d{2,4})?" +
    "|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2}(?:,?\\s*\\d{2,4})?" +
    "|\\d{1,2}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?(?:\\s+\\d{2,4})?" +
  ")\\b[\\s,]*", "i");
const TX_TIME_LEAD = /^\d{1,2}:\d{2}(?::\d{2})?\s+/;
const TX_PREFIX = /^(?:(?:sq|tst|sp|pp|paypal|dd|ec)\s?\*\s*|(?:sp|sq|tst)\s+(?=[a-z0-9])|(?:pos(?: purchase| debit)?|point of sale|purchase|payment|pre-?authorized|pre-?auth|recurring|debit card|credit card|debit|visa|mastercard|amex|interac e-?transfer|interac|e-?transfer|bill payment|web pmt|ach|eft)[\s:#-]+)/i;
const TX_KEEP_UPPER = new Set(["KFC", "BP", "IGA", "BMO", "RBC", "CIBC", "HSBC", "TD", "LCBO", "IKEA", "IHOP", "UPS", "DHL", "KPMG", "AMC", "GNC", "CVS", "DSW", "H&M", "A&W", "BBQ", "ATM", "PC", "ICBC", "AMZN"]);
/* known-merchant dictionary: messy statement descriptors → a clean display name.
   First match wins. This is the local-only "lookup" — no network, fully private. */
const TX_MERCHANTS = [
  [/wal-?mart|walmart/i, "Walmart"], [/\bamzn\b|amazon/i, "Amazon"], [/apple\.?com|apple\s*bill|itunes/i, "Apple"],
  [/aliexpress/i, "AliExpress"], [/\bpaypal\b/i, "PayPal"], [/uber\s*eats/i, "Uber Eats"], [/\buber\b/i, "Uber"],
  [/\blyft\b/i, "Lyft"], [/netflix/i, "Netflix"], [/spotify/i, "Spotify"], [/disney\s*\+?/i, "Disney+"],
  [/tim\s*hortons?/i, "Tim Hortons"], [/mcdonald'?s?/i, "McDonald's"], [/starbucks/i, "Starbucks"], [/costco/i, "Costco"],
  [/canadian tire/i, "Canadian Tire"], [/canada computers/i, "Canada Computers"], [/\bicbc\b/i, "ICBC"], [/impark/i, "Impark"],
  [/\bchevron\b|^chv\d|\bchv\b/i, "Chevron"], [/\bshell\b/i, "Shell"], [/\besso\b/i, "Esso"], [/petro[- ]?can/i, "Petro-Canada"],
  [/cineplex/i, "Cineplex"], [/\bgoogle\b/i, "Google"], [/\bmicrosoft\b|msft/i, "Microsoft"], [/\bopenai\b/i, "OpenAI"],
  [/anthropic|\bclaude\b/i, "Anthropic"], [/wheelwiz/i, "WheelWiz"], [/superstore/i, "Superstore"], [/loblaws?/i, "Loblaws"],
  [/save[- ]?on[- ]?foods/i, "Save-On-Foods"], [/\bt&t\b/i, "T&T Supermarket"], [/foody world/i, "Foody World"],
  [/cashback|remise en argent/i, "Cashback"]
];
function txMerchantAlias(s) { for (const [re, name] of TX_MERCHANTS) if (re.test(s)) return name; return null; }
function txIsNoiseToken(t) {
  if (!t) return false;
  if (/[#*]/.test(t)) return true;                       // store#, masked or processor refs
  if (/\d{4,}/.test(t)) return true;                     // 4+ digit run (ref / store / card / phone tail)
  if (/^x+\d+$/i.test(t)) return true;                   // masked card  xxxx1234
  if (/^[A-Za-z0-9]+$/.test(t) && (t.match(/\d/g) || []).length >= 2 && /[A-Za-z]/.test(t)) return true; // W123, RT4G83
  return false;
}
function txTitleCaseWord(w) {
  if (!w) return w;
  if (TX_KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
  return w.replace(/[A-Za-z][A-Za-z'’]*/g, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
}
/* ---- bank transaction-type normaliser --------------------------------------
   Chequing/savings statements lead each entry with a transaction TYPE, often a
   reference number, and (on the next printed line) a counterparty:
       ATM DEPOSIT            / Alderbridge Garden City 2B2E
       E-TRANSFER 011574003512 / ERIC TUNG QUANG DIEP
       PAY 10742396544         / CANADA COMPUTERS INC
       RETAIL PURCHASE 6130…   / LA PATISSERIE
   For "self-naming" types (ATM, fees, card transfers) the TYPE *is* the name and
   the trailing text is just a machine/location/ref → drop it. For "counterparty"
   types (e-transfer, payroll, purchases) the person/company is the useful name →
   strip the type + reference and keep that. mode: "type" | "party". First match
   wins, so list the more specific rule first (e.g. "service charge discount"
   before "service charge"). */
const TX_TYPE_RULES = [
  [/^a[bt]m\s+deposit\b/i,                            "type",  "ATM Deposit"],
  [/^a[bt]m\s+withdrawal\b/i,                         "type",  "ATM Withdrawal"],
  [/^(?:mobile|cheque|cash)\s+deposit\b/i,            "type",  "Deposit"],
  [/^service\s+charge\s+discount\b/i,                 "type",  "Service Charge Discount"],
  [/^service\s+charge\b/i,                            "type",  "Service Charge"],
  [/^(?:capped\s+)?monthly\s+(?:account\s+)?fee\b/i,  "type",  "Monthly Fee"],
  [/^overdraft(?:\s+(?:interest|fee|handling))?\b/i,  "type",  "Overdraft"],
  [/^interest\b/i,                                    "type",  "Interest"],
  [/^reward\b/i,                                      "type",  "Reward"],
  [/^internet\s+transfer\b/i,                         "type",  "Internet Transfer"],
  [/^(?:online|mobile)\s+transfer\b/i,                "type",  "Transfer"],
  [/^(?:interac\s+)?e-?transfer\b/i,                  "party", "E-Transfer"],
  [/^(?:payroll(?:\s+deposit)?|direct\s+deposit)\b/i, "party", "Payroll"],
  [/^pay(?=\s)/i,                                     "party", "Payroll"],  // "PAY <employer>" (not "PAY-O-MATIC")
  [/^retail\s+purchase\b/i,                           "party", "Purchase"],
  [/^(?:point of sale|pos)(?:\s+(?:purchase|debit))?\b/i, "party", "Purchase"],
  [/^purchase\b/i,                                    "party", "Purchase"],
  [/^bill\s+payment\b/i,                              "party", "Bill Payment"],
  [/^pre-?authoriz(?:ed|ation)\s+(?:debit|payment|credit)?\b/i, "party", "Pre-Authorized"]
];
/* a leading machine/reference chunk sitting between the type and the payee
   ("011574003512", "613000939123", a masked card…). Requires a 3+ char digit run
   so it never eats a real name that merely starts with a number (e.g. "7-Eleven"). */
const TX_REF_LEAD = /^(?:to\s+card\b|from\b|ref(?:erence)?\b|conf(?:irmation)?\b|trace\b|[:#-])?\s*(?:[A-Za-z]{0,4}\d[\d*xX]{2,}[\d*xX-]*\s*)+/i;
function txTypedName(s) {
  for (const [re, mode, label] of TX_TYPE_RULES) {
    const m = re.exec(s);
    if (!m) continue;
    if (mode === "type") return label;                            // type is the name; drop location/ref
    let rest = s.slice(m[0].length).replace(/^[\s:#-]+/, "");
    rest = rest.replace(TX_REF_LEAD, "").trim();                  // drop the reference chunk
    if ((rest.match(/[A-Za-z]/g) || []).length < 2) return label; // nothing useful left → the type is the name
    return txCleanMerchantCore(rest);                             // clean the counterparty (alias, casing, city strip…)
  }
  return null;
}
function txCleanMerchant(raw) {
  let s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  s = s.replace(/^[^A-Za-z0-9(]+/, "").trim();          // strip leading symbols (Ý, *, etc.)
  if (!s) return "Transaction";
  const typed = txTypedName(s);                         // bank entries lead with a transaction type
  if (typed != null) return typed;
  return txCleanMerchantCore(s);
}
function txCleanMerchantCore(raw) {
  let s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  s = s.replace(/^[^A-Za-z0-9(]+/, "").trim();          // strip leading symbols (Ý, *, etc.)
  if (!s) return "Transaction";
  const original = s;
  // peel leading dates / times / processor prefixes (in any order, repeatedly)
  for (let i = 0; i < 8; i++) {
    const before = s;
    if (TX_DATE_LEAD.test(s)) s = s.replace(TX_DATE_LEAD, "").trim();
    if (TX_TIME_LEAD.test(s)) s = s.replace(TX_TIME_LEAD, "").trim();
    if (TX_PREFIX.test(s)) s = s.replace(TX_PREFIX, "").trim();
    if (s === before) break;
  }
  // a known merchant short-circuits all the structural cleanup
  const alias = txMerchantAlias(s);
  if (alias) return alias;
  // the real merchant name leads on card descriptors -> keep up to the first noise token
  const toks = s.split(" ");
  const kept = [];
  for (const t of toks) { if (txIsNoiseToken(t)) break; kept.push(t); }
  s = kept.length ? kept.join(" ") : toks.filter((t) => !txIsNoiseToken(t)).join(" ");
  // drop trailing country, then a trailing province/state code and the city before it
  for (let i = 0; i < 2; i++) s = s.replace(/\s+(?:ca|can|canada|usa|us|united states)$/i, "").trim();
  let hadProv = false;
  const provRe = new RegExp("\\s+(?:" + TX_REGION + ")$");   // uppercase only → won't eat "in"/"or"
  for (let i = 0; i < 2; i++) { if (provRe.test(s)) { s = s.replace(provRe, "").trim(); hadProv = true; } }
  if (hadProv) {  // the token right before a province code is the city → drop it (unless it's the whole name)
    const cityStripped = s.replace(/\s+[A-Za-z][A-Za-z'’.\-]+$/, "").trim();
    if (cityStripped && cityStripped.replace(/[^A-Za-z]/g, "").length >= 2) s = cityStripped;
  }
  s = s.replace(/\.(?:com|ca|net|org|io|co|biz|us|app|store|inc)\b.*$/i, "").trim();   // drop TLD + tail (APPLE.COM/BILL → APPLE)
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s,.*#\-\/]+|[\s,.*#\-\/]+$/g, "").trim();
  if (!s) s = original.replace(/[#*]+/g, " ").replace(/\s{2,}/g, " ").trim();
  s = s.split(" ").map(txTitleCaseWord).join(" ");          // tidy casing (Foody World, Mr. Bro Korean Bistro…)
  return s || "Transaction";
}

/* ---- account auto-detection (match the statement to an account by last-4) -- */
function txAcctName(a) { return typeof a === "string" ? a : ((a && a.name) || ""); }
function txAcctIsCredit(a) {
  if (!a || typeof a === "string") return false;
  const hay = ((a.type || "") + " " + (a.group || "") + " " + (a.group_label || "") + " " + (a.kind || "")).toLowerCase();
  return /credit/.test(hay);
}
function txLast4(v) { return String(v == null ? "" : v).replace(/\D/g, "").slice(-4); }
/* pull candidate last-4s out of raw statement text (OFX ids, "ending 1234",
   masked cards, full 4-4-4-4 numbers) — only from labelled spots, so stray
   amounts/dates never look like an account number. */
function txExtractAcctHints(text) {
  const hits = new Set();
  const s = String(text || "");
  let m;
  const add = (d) => { const f = txLast4(d); if (f.length === 4) hits.add(f); };
  const tagRe = /<(?:ACCTID|CCACCTID|BANKID)>\s*([0-9Xx*\- ]{3,40})/gi;
  while ((m = tagRe.exec(s))) add(m[1]);
  const endRe = /ending(?:\s+in)?\s*[:#]?\s*(\d{4})\b/gi;
  while ((m = endRe.exec(s))) add(m[1]);
  const acctRe = /acc(?:oun)?t\s*(?:number|no\.?|#)?\s*[:#]?\s*[*xX•·\- ]*?(\d{4})\b/gi;
  while ((m = acctRe.exec(s))) add(m[1]);
  const cardRe = /card\s*(?:number|no\.?|#|ending)?\s*[:#]?\s*[*xX•·\- ]*?(\d{4})\b/gi;
  while ((m = cardRe.exec(s))) add(m[1]);
  const maskRe = /(?:[*xX•·]\s*){2,}(\d{4})\b/g;
  while ((m = maskRe.exec(s))) add(m[1]);
  const fullRe = /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-](\d{4})\b/g;
  while ((m = fullRe.exec(s))) add(m[1]);
  return hits;
}
function txMatchAccount(hints, accts) {
  if (!hints || !hints.size) return null;
  for (const a of (accts || [])) {
    if (a && typeof a === "object" && a.mask && hints.has(txLast4(a.mask))) return a;
  }
  return null;
}
/* On a credit-card statement, charges (your purchases) are the dominant rows.
   Issuers disagree on the sign, so if charges came in positive (pos majority),
   invert every row so purchases become expenses and payments become credits.
   Bank/cash statements use the reliable "deposit +, withdrawal -" convention,
   so they are never flipped. */
function txStatementFlip(rows, isCreditCard) {
  if (!isCreditCard) return false;
  let pos = 0, neg = 0;
  (rows || []).forEach((r) => { if (r.amt > 0) pos++; else if (r.amt < 0) neg++; });
  return pos > neg;
}

/* ---- duplicate detection (client mirror of server/lib/dedup.js) ------------
   Same balanced rule the server applies, so the preview the user sees matches
   what the server will do: same |amount| (cents), within ±3 days, compatible
   account, and a similar merchant name. Kept inline (no import) since this file
   is loaded as a plain Babel/JSX script. */
function txExistingTxns() {
  const d = window.ClaudData;
  return (d && Array.isArray(d.transactions)) ? d.transactions : [];
}
// Normalise a merchant name: reuse the existing cleaner first (handles dates,
// processor prefixes, city/region), then lowercase + collapse like the server.
function txNormName(raw) {
  let s = txCleanMerchant(raw == null ? "" : raw);
  s = String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return s;
}
function txNameSimilar(a, b) {
  const na = txNormName(a), nb = txNormName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1)) return true;
  const sa = na.split(" ").filter(Boolean), sb = nb.split(" ").filter(Boolean);
  if (!sa.length || !sb.length) return false;
  const setB = new Set(sb); let inter = 0;
  for (const t of sa) if (setB.has(t)) inter++;
  const union = sa.length + sb.length - inter;
  return union > 0 && (inter / union) >= 0.5;
}
function txSameCents(a, b) {
  return Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);
}
function txWithinDays(d1, d2, days) {
  if (days == null) days = 3;
  const t1 = Date.parse(String(d1) + "T00:00:00"), t2 = Date.parse(String(d2) + "T00:00:00");
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= days * 86400000;
}
function txAccountOk(aId, bId) {
  if (aId && bId) return aId === bId;
  return true;
}
/* Return the existing transaction `incoming` duplicates (or null). `incoming`
   is { date, amt, name, account_id }; account_id is optional. Balanced rule:
   sameCents && withinDays(3) && accountOk && nameSimilar. */
function txIsDuplicate(incoming) {
  const date = incoming && incoming.date;
  const amt = incoming && (incoming.amt != null ? incoming.amt : incoming.amount);
  if (!date || amt == null || isNaN(amt)) return null;
  const name = (incoming && incoming.name) || "";
  const acctId = incoming && incoming.account_id;
  const list = txExistingTxns();
  for (const t of list) {
    const td = t.date || t.day;
    const ta = t.amt != null ? t.amt : t.amount;
    if (ta == null) continue;
    if (!txSameCents(amt, ta)) continue;
    if (!txWithinDays(date, td, 3)) continue;
    if (!txAccountOk(acctId, t.account_id)) continue;
    if (!txNameSimilar(name, t.name)) continue;
    return t;
  }
  return null;
}
/* ---- recurring-lite (client advisory; the server re-derives authoritatively) -
   Match an incoming outflow against the user's saved recurring rules so the
   preview can show a green "recurring" badge and pre-fill its category/icon.
   Mirrors server/lib/dedup.matchRecurring: name similar, magnitude within 1%
   (min 1¢), compatible account, within ±5 days of next_date. */
function txRecurringRules() {
  const d = window.ClaudData;
  return (d && Array.isArray(d.recurring)) ? d.recurring : [];
}
function txMatchRecurring(incoming) {
  const amt = incoming && (incoming.amt != null ? incoming.amt : incoming.amount);
  if (amt == null || isNaN(amt) || !(amt < 0)) return null;   // outflows only
  const date = incoming && incoming.date;
  const name = (incoming && incoming.name) || "";
  const acctId = incoming && incoming.account_id;
  const inAmt = Math.abs(amt);
  for (const r of txRecurringRules()) {
    if (!txNameSimilar(name, r.name)) continue;
    const rAmt = Math.abs(Number(r.amount));
    const tol = Math.max(0.01, rAmt * 0.01);
    if (Math.abs(inAmt - rAmt) > tol) continue;
    if (!txAccountOk(acctId, r.account_id)) continue;
    if (r.next_date && date && !txWithinDays(date, r.next_date, 5)) continue;
    return r;
  }
  return null;
}

/* ---- statement parsers: CSV / OFX-QFX / PDF ---- */
function txCSVLine(line, delim) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === delim) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function txParseCSV(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length);
  if (!raw.length) return [];
  const head = raw[0];
  const count = (ch) => (head.split(ch).length - 1);
  const delim = count(";") > count(",") ? ";" : count("\t") > count(",") ? "\t" : ",";
  const rows = raw.map((l) => txCSVLine(l, delim));
  const hdr = rows[0].map((h) => h.toLowerCase());
  const find = (...keys) => hdr.findIndex((h) => keys.some((k) => h.includes(k)));
  let di = find("date", "posted"), ai = find("amount", "amt"),
      ci = find("description", "payee", "name", "memo", "details", "narration", "merchant"),
      debit = find("debit", "withdraw", "money out", "outflow", "paid out"),
      credit = find("credit", "deposit", "money in", "inflow", "paid in");
  const hasHeader = di >= 0 || ai >= 0 || ci >= 0 || debit >= 0 || credit >= 0;
  let body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) {
    // infer columns by content
    const ncol = Math.max.apply(null, rows.map((r) => r.length));
    let bd = -1, bds = -1, ba = -1, bas = -1, bt = -1, btl = -1;
    for (let c = 0; c < ncol; c++) {
      let ds = 0, as = 0, tl = 0;
      for (const r of rows) {
        const v = (r[c] || "").trim();
        if (txParseDate(v)) ds++;
        else if (txParseAmount(v) != null && /\d/.test(v)) as++;
        tl += v.replace(/[0-9.,$\-\/]/g, "").length;
      }
      if (ds > bds) { bds = ds; bd = c; }
      if (as > bas) { bas = as; ba = c; }
      if (tl > btl) { btl = tl; bt = c; }
    }
    di = bd; ai = ba; ci = bt;
  }
  const out = [];
  for (const r of body) {
    const date = txParseDate(di >= 0 ? r[di] : null);
    let amt = null;
    if (ai >= 0) amt = txParseAmount(r[ai]);
    if (amt == null && (debit >= 0 || credit >= 0)) {
      const dv = debit >= 0 ? txParseAmount(r[debit]) : null;
      const cv = credit >= 0 ? txParseAmount(r[credit]) : null;
      if (dv) amt = -Math.abs(dv); else if (cv) amt = Math.abs(cv);
    }
    const name = (ci >= 0 ? (r[ci] || "") : "").trim();
    if (!date || amt == null) continue;
    out.push({ date, name: name || "Transaction", amt });
  }
  return out;
}
function txParseOFX(text) {
  const out = [];
  const blocks = String(text || "").match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const tag = (b, t) => { const m = b.match(new RegExp("<" + t + ">([^<\\r\\n]+)", "i")); return m ? m[1].trim() : null; };
  blocks.forEach((b) => {
    const date = txParseDate(tag(b, "DTPOSTED") || "");
    const amt = txParseAmount(tag(b, "TRNAMT"));
    const name = tag(b, "NAME") || tag(b, "MEMO") || "Transaction";
    if (date && amt != null) out.push({ date, name, amt });
  });
  return out;
}
/* Lines that are statement summary / payment-slip fields, never real charges. */
/* Note: "new balance" is intentionally excluded — it collides with the shoe
   brand. Real "new balance" summary lines carry no date, so the date filter
   already drops them. */
const TX_STMT_SKIP = /\b(?:minimum payment|amount due|previous balance|statement balance|outstanding balance|total balance|balance due|balance forward|opening balance|closing balance|credit limit|available credit|available funds|cash advance limit|payment due|amount enclosed|total payment|total for|total charges|total credits|interest charge|interest rate|annual interest|annual fee|finance charge|grace period|past due|over[- ]?limit|payment received|paiement|montant d[uû])\d*\b/i;   // \d* tolerates footnote superscripts (e.g. "Amount Due1")
/* The charge table almost always opens with a column-header row… */
const TX_SECTION_START = /(?:\bdescription\b[\s\S]*\bamount\b|\bdate\b[\s\S]*\bdescription\b|your new charges|transactions?\s+(?:detail|history|from)|trans(?:action)?\s+date)/i;
/* …and closes with a per-card total or the page's legal blurb. */
const TX_SECTION_END = /\b(?:total for|information about your|how we charge|important information|payment options|interest charges? on)\b/i;
function txParsePdfLines(lines) {
  const out = [];
  let yearHint = new Date().getFullYear();
  for (const l of lines) { const m = l.match(/(20\d{2})/); if (m) { yearHint = +m[1]; break; } }
  const dateRe = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?)/i;
  const moneyRe = /\(?-?\$?\s?\d[\d,]*\.\d{2}\)?-?/g;
  // Only treat lines inside a transaction section as charges. If the document
  // never declares a section header (some exports don't), fall back to scanning
  // every line so simpler statements don't regress.
  const hasSection = lines.some((l) => TX_SECTION_START.test(l));
  let inSection = !hasSection;
  for (const line of lines) {
    if (hasSection) {
      if (!inSection) { if (TX_SECTION_START.test(line)) inSection = true; continue; }
      if (TX_SECTION_END.test(line)) { inSection = false; continue; }
    }
    if (TX_STMT_SKIP.test(line)) continue;                  // summary / payment-slip line
    const dm = line.match(dateRe);
    if (!dm) continue;
    const date = txParseDate(dm[0], yearHint);
    if (!date) continue;
    const monies = line.match(moneyRe);
    if (!monies || !monies.length) continue;
    const amt = txParseAmount(monies[monies.length - 1]);   // rightmost money = txn amount (tune per bank)
    if (amt == null) continue;
    // recover the payee: strip money first (so a date isn't nicked out of the
    // decimals), then peel the leading trans/post date(s), then the bank category.
    let name = line;
    monies.forEach((mm) => { name = name.replace(mm, " "); });
    for (let i = 0; i < 3; i++) { const b = name; if (TX_DATE_LEAD.test(name)) name = name.replace(TX_DATE_LEAD, "").trim(); if (name === b) break; }
    const bc = txStripBankCat(name);
    name = bc.name.replace(/\s+/g, " ").trim().replace(/^[\-–·,\s]+|[\-–·,\s]+$/g, "");
    // A real charge has a payee. Bare "date + amount" rows (e.g. the payment slip
    // "Jun 04, 2026  $10.00") have no letters left → skip them.
    if ((name.match(/[A-Za-z]/g) || []).length < 2) continue;
    out.push({ date, name, amt, bankCat: bc.bankCat, bankMapped: bc.bankMapped });
  }
  return out;
}
/* ---- column-aware bank-statement parser ------------------------------------
   Chequing/savings statements print money in separate Withdrawals/Deposits (or
   Debit/Credit) columns plus a running Balance. The flat line scanner can't tell
   them apart, so every row looks positive and the rightmost number (the balance)
   gets mistaken for the amount. Here we read the column header to learn each
   column's x-position, bucket every money token by where it sits (left=withdrawal
   → expense, middle=deposit → income, right=balance → ignored), carry the date
   down to continuation rows, and stitch multi-line descriptions onto the row that
   carries the amount. Returns [] when there are no such columns, so the caller
   falls back to txParsePdfLines (credit cards, single-column exports). */
const TXB_MON = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const TXB_DATE = new RegExp("^\\s*(\\d{1,2}\\s*(?:" + TXB_MON + ")[a-z]*|(?:" + TXB_MON + ")[a-z]*\\.?\\s*\\d{1,2}(?:,?\\s*\\d{2,4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/\\-.]\\d{1,2}(?:[\\/\\-.]\\d{2,4})?)", "i");
const TXB_MONEY = /^\(?-?\$?\s?\d[\d,]*\.\d{2}\)?-?$/;
const TXB_HW = /withdrawal|debit|money out|paid out/i;
const TXB_HD = /deposit|credit|money in|paid in/i;
const TXB_HB = /balance/i;
/* page furniture that must never become a description or a transaction */
const TXB_FURNITURE = /\b\d+\s+of\s+\d+\b|account statement|details of your account|important information|^from\b.*\bto\b.*\d{4}/i;
const TXB_CONT = /\bcontinued\b/i;   // "(continued on next page)" / "(continued)" — closes the open txn, not detail
function txParseBankColumns(pages) {
  let yearHint = new Date().getFullYear();
  outer: for (const pg of pages) for (const r of pg.rows) { const m = r.text.match(/(20\d{2})/); if (m) { yearHint = +m[1]; break outer; } }
  let cols = null, curDate = null, buf = [], cur = null;
  const out = [];
  const colOf = (tx) => { let i = 0; while (i < cols.bounds.length && tx >= cols.bounds[i]) i++; return cols.hdrs[i].k; };
  for (const pg of pages) {
    for (const r of pg.rows) {                       // (re)detect money-column header; carry forward across pages
      const hw = r.cells.find((c) => TXB_HW.test(c.s)), hd = r.cells.find((c) => TXB_HD.test(c.s));
      if (hw && hd) {
        const hb = r.cells.find((c) => TXB_HB.test(c.s));
        const sc = r.cells.find((c) => /^desc/i.test(c.s)), dc = r.cells.find((c) => /^date$/i.test(c.s));
        const hdrs = [{ k: "w", x: hw.x }, { k: "d", x: hd.x }].concat(hb ? [{ k: "b", x: hb.x }] : []);
        hdrs.sort((a, b) => a.x - b.x);
        const bounds = []; for (let i = 0; i < hdrs.length - 1; i++) bounds.push((hdrs[i].x + hdrs[i + 1].x) / 2);
        cols = { hdrs, bounds, descx: sc ? sc.x : (dc ? dc.x + 20 : hw.x - 60), descMax: Math.min(hw.x, hd.x) };
        break;
      }
    }
    if (!cols) continue;                             // header not seen yet → not a columnar statement
    for (const r of pg.rows) {
      const t = r.text;
      if (TXB_HW.test(t) && TXB_HD.test(t)) continue;                         // the header row itself
      if (TX_STMT_SKIP.test(t) || TXB_FURNITURE.test(t) || TXB_CONT.test(t)) { buf = []; cur = null; continue; }  // summary / page furniture / "(continued)" → close the open txn
      const dm = t.match(TXB_DATE);
      if (dm) { const d = txParseDate(dm[1].replace(/(\d)(?=[A-Za-z])/g, "$1 ").replace(/([A-Za-z])(?=\d)/g, "$1 "), yearHint); if (d) curDate = d; }
      let wd = null, dp = null, bal = false;
      for (const c of r.cells) {
        if (!TXB_MONEY.test(c.s)) continue;
        const v = txParseAmount(c.s); if (v == null) continue;
        const k = colOf(c.x);
        if (k === "w") { if (wd == null) wd = Math.abs(v); }
        else if (k === "d") { if (dp == null) dp = Math.abs(v); }
        else bal = true;
      }
      let desc = r.cells.filter((c) => !TXB_MONEY.test(c.s) && c.x >= (cols.descx - 6) && c.x < cols.descMax).map((c) => c.s).join(" ");
      if (dm) desc = desc.replace(TXB_DATE, "");
      desc = desc.replace(/\s+/g, " ").replace(/^[\s\-–·,]+|[\s\-–·,]+$/g, "").trim();
      const hasDesc = (desc.match(/[A-Za-z]/g) || []).length >= 1;
      if (wd != null || dp != null) {
        // An amount row STARTS a transaction. CIBC-style statements print the type
        // ("ATM DEPOSIT", "E-TRANSFER 0115…") ON this row and the location/payee on
        // the line(s) BELOW — so a row that carries its own description owns the
        // detail lines that follow it. A row with no description of its own falls
        // back to the lines buffered just above it (wrap-before layouts).
        const amt = dp != null ? dp : -wd;                                    // deposit +, withdrawal −
        const name = hasDesc ? desc : buf.join(" ").trim();
        if (curDate && (name.match(/[A-Za-z]/g) || []).length >= 2) {
          const tx = { date: curDate, name, amt };
          out.push(tx);
          cur = hasDesc ? tx : null;                                          // only an own-desc row keeps collecting trailing detail
        } else cur = null;
        buf = [];
      } else if (bal) { buf = []; cur = null; }                              // balance-only row = boundary between entries
      else if (hasDesc) {
        buf.push(desc);                                                       // may lead the NEXT amount row (wrap-before)
        if (cur) cur.name = (cur.name + " " + desc).trim();                   // …and trails the CURRENT txn (wrap-after / CIBC)
      }
    }
  }
  return out;
}
async function txParsePDF(file) {
  const lib = await txLoadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  const lines = [], pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = {};
    tc.items.forEach((it) => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5]);
      (byY[y] = byY[y] || []).push({ x: it.transform[4], s: it.str });
    });
    const rows = [];
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach((y) => {
      const cells = byY[y].sort((a, b) => a.x - b.x);
      const line = cells.map((o) => o.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) { lines.push(line); rows.push({ cells, text: line }); }
    });
    pages.push({ rows });
  }
  // Bank statements (Withdrawals/Deposits/Balance columns) → column parser;
  // credit-card & single-column exports fall back to the line scanner.
  const bank = txParseBankColumns(pages);
  return { txns: bank.length ? bank : txParsePdfLines(lines), text: lines.join("\n") };
}
/* dispatch by extension, with a content sniff fallback.
   returns { txns:[{date,name,amt}], hints:Set<last4> } */
async function txParseStatement(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1);
  if (ext === "pdf") { const r = await txParsePDF(file); return { txns: r.txns, hints: txExtractAcctHints(r.text) }; }
  const text = await file.text();
  const txns = (ext === "ofx" || ext === "qfx" || /<STMTTRN>/i.test(text)) ? txParseOFX(text) : txParseCSV(text);
  return { txns, hints: txExtractAcctHints(text) };
}

/* ---- receipt OCR (on-device, via Tesseract.js) ---- */
function txParseReceiptText(text) {
  const lines = String(text || "").split(/\n/).map((l) => l.trim()).filter(Boolean);
  let merchant = "";
  for (const l of lines) {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    if (letters >= 3 && letters >= l.replace(/\s/g, "").length * 0.5 && !/receipt|invoice|order|tel|www|\.com/i.test(l)) { merchant = l; break; }
  }
  const moneyIn = (s) => { const m = s.match(/\d[\d,]*\.\d{2}/g); return m ? m.map((x) => parseFloat(x.replace(/,/g, ""))) : []; };
  let amt = null;
  for (const l of lines) {
    if (/(grand total|amount due|balance due|total)/i.test(l) && !/sub\s*total|subtotal/i.test(l)) {
      const ms = moneyIn(l); if (ms.length) amt = ms[ms.length - 1];
    }
  }
  if (amt == null) { let all = []; lines.forEach((l) => { all = all.concat(moneyIn(l)); }); if (all.length) amt = Math.max.apply(null, all); }
  let date = null;
  for (const l of lines) { const m = l.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/); if (m) { const d = txParseDate(m[0]); if (d) { date = d; break; } } }
  merchant = merchant ? txCleanMerchant(merchant) : "";
  const g = txGuessCat(merchant);
  return { merchant, amt, date, cat: g.cat, icon: g.icon };
}
async function txOcrReceipt(image) {
  const T = await txLoadTesseract();
  const res = await T.recognize(image, "eng");
  const text = (res && res.data && res.data.text) || "";
  return { ...txParseReceiptText(text), _text: text, _conf: (res && res.data && res.data.confidence != null ? res.data.confidence : 0) };
}

const txIsoDaysAgo = (n) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const txReadableSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const txFmtAmt = (n) => {
  const v = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "−$" : "+$") + v;
};
const TX_DUP_STYLE = { color: "var(--warn, #cf8a2c)", fontWeight: 600 };
const TX_RECUR_STYLE = { color: "var(--green, #4f9a6a)", fontWeight: 600 };

let txUid = 0;
const txNextId = () => "imp" + (Date.now().toString(36)) + "_" + (txUid++);

function ImportModal({ accounts = [], onClose, onImport, initialMode }) {
  const { Button } = TX_DS;
  // Each entry button (Import statement / Scan receipt) opens its own dedicated
  // popup — the mode is fixed by initialMode, there is no in-modal toggle.
  const mode = initialMode === "Receipt" ? "Receipt" : "Statement";
  const isStmt = mode === "Statement";
  // accounts may arrive as rich objects ({name,mask,type,...}) or plain names
  const acctNames = (accounts || []).map(txAcctName).filter(Boolean);
  const acctObj = (nm) => (accounts || []).find((a) => txAcctName(a) === nm) || null;
  const [account, setAccount] = React.useState(acctNames[0] || "Everyday Checking");
  const [stmt, setStmt] = React.useState(null);   // { fileName, size, status, rows:[], detected?, error? }
  const [rcpts, setRcpts] = React.useState([]);   // [{ id, url, status, name, cat, amt, date, note }]
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isCredit = txAcctIsCredit(acctObj(account));
  // Resolve the selected account's id (when accounts arrived as rich objects) so
  // the client dup/recurring checks are account-aware, matching the server.
  const selAcctId = (function () { const a = acctObj(account); return a && a.id != null ? a.id : null; })();

  /* derive a preview row from a parsed transaction, given the chosen orientation */
  function txRowFrom(t, flip, id) {
    const amt = flip ? -t.amt : t.amt;
    const clean = txCleanMerchant(t.name);
    const r = txResolveCat(t.name, clean, amt, t.bankCat, t.bankMapped);
    const dup = txIsDuplicate({ date: t.date, amt, name: clean, account_id: selAcctId });
    const recur = txMatchRecurring({ date: t.date, amt, name: clean, account_id: selAcctId });
    // Recurring match (advisory): pre-fill its category/icon and treat it as a
    // confident, expected charge. A duplicate still wins the "unchecked" default.
    const cat = recur && recur.category ? recur.category : r.cat;
    const icon = recur && recur.icon ? recur.icon : r.icon;
    return { id: id || txNextId(), name: clean, rawName: t.name, rawAmt: t.amt,
             bankCat: t.bankCat, bankMapped: t.bankMapped, cat, icon,
             confident: recur ? true : r.confident, amt, date: t.date,
             include: !dup, dup, recur: recur ? recur.name : null };
  }

  /* ---- statement: parse the real file ---- */
  function scanStatement(file) {
    setStmt({ fileName: file.name, size: file.size, status: "scanning", rows: [] });
    txParseStatement(file).then(({ txns, hints }) => {
      if (!txns || !txns.length) {
        setStmt((s) => s && { ...s, status: "empty", rows: [] });
        return;
      }
      // auto-detect the matching account by last-4 found in the statement
      const detected = txMatchAccount(hints, accounts);
      if (detected) setAccount(detected.name);
      const useCredit = detected ? txAcctIsCredit(detected) : isCredit;
      const flip = txStatementFlip(txns, useCredit);
      const rows = txns.map((t) => txRowFrom(t, flip))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      setStmt((s) => s && { ...s, status: "ready", rows, detected: detected ? detected.name : null });
    }).catch((err) => {
      setStmt((s) => s && { ...s, status: "error", rows: [], error: (err && err.message) || "Could not read this file" });
    });
  }

  /* re-orient signs/categories if the chosen account's credit-ness changes
     after parsing (e.g. the user picks a different account); include toggles
     are preserved by id. */
  React.useEffect(() => {
    setStmt((s) => {
      if (!s || s.status !== "ready" || !s.rows || !s.rows.length) return s;
      const flip = txStatementFlip(s.rows.map((r) => ({ amt: r.rawAmt })), isCredit);
      const rows = s.rows.map((r) => {
        const amt = flip ? -r.rawAmt : r.rawAmt;
        const rr = txResolveCat(r.rawName, r.name, amt, r.bankCat, r.bankMapped);
        const dup = txIsDuplicate({ date: r.date, amt, name: r.name, account_id: selAcctId });
        const recur = txMatchRecurring({ date: r.date, amt, name: r.name, account_id: selAcctId });
        const cat = recur && recur.category ? recur.category : rr.cat;
        const icon = recur && recur.icon ? recur.icon : rr.icon;
        return { ...r, amt, cat, icon, confident: recur ? true : rr.confident, dup, recur: recur ? recur.name : null };
      });
      return { ...s, rows };
    });
  }, [isCredit, selAcctId]);

  /* ---- receipts: read the photo with on-device OCR ---- */
  function readReceipts(files) {
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const id = txNextId();
      setRcpts((prev) => [...prev, { id, url: null, status: "scanning", name: "", cat: "Shopping", icon: "bag", amt: "", date: txIsoDaysAgo(0), fileName: file.name, note: "" }]);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target.result;
        setRcpts((prev) => prev.map((r) => r.id === id ? { ...r, url } : r));
        txOcrReceipt(url).then((g) => {
          // Decide whether this photo is actually a receipt. A real receipt always
          // carries a price (e.g. 12.99) plus a fair amount of text; a hand, blank
          // page, or blurry shot has neither — so we fail clearly rather than
          // fabricate a name/amount from number-noise.
          const text = g._text || "";
          const alnum = (text.match(/[A-Za-z0-9]/g) || []).length;
          const detected = (g.amt != null) && alnum >= 8;
          setRcpts((prev) => prev.map((r) => {
            if (r.id !== id) return r;
            if (!detected) {
              return {
                ...r, status: "failed", name: "", amt: "",
                note: "We couldn’t detect a receipt in this photo. Make sure the whole receipt is in frame, well-lit, and in focus — then try again."
              };
            }
            const amt = g.amt != null ? String(g.amt.toFixed(2)) : "";
            const got = !!(g.merchant || g.amt != null);
            return {
              ...r, status: "ready",
              name: g.merchant || "", cat: g.cat || r.cat, icon: g.icon || r.icon,
              amt, date: g.date || r.date,
              note: got ? "" : "Couldn’t read it automatically — add the details below."
            };
          }));
        }).catch(() => {
          setRcpts((prev) => prev.map((r) => r.id === id ? { ...r, status: "failed", name: "", amt: "", note: "We couldn’t read this photo. Please try again with a clearer picture." } : r));
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function onFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (isStmt) scanStatement(files[0]);
    else readReceipts(files);
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    onFiles(e.dataTransfer.files);
  }

  /* ---- commit ---- */
  const stmtSel = stmt && stmt.status === "ready" ? stmt.rows.filter((r) => r.include) : [];
  const rcptReady = rcpts.filter((r) => r.status === "ready");
  const count = isStmt ? stmtSel.length : rcptReady.length;
  const canImport = count > 0;

  function doImport() {
    if (!canImport) return;
    let items;
    if (isStmt) {
      items = stmtSel.map((r) => ({
        name: r.name, merchant: r.rawName || r.name, cat: r.cat, amt: r.amt, date: r.date, day: txDayLabel(r.date),
        account, account_id: selAcctId, icon: r.icon,
        // A row only reaches stmtSel when it's checked. If it's ALSO a flagged
        // duplicate, the user deliberately re-included it, so tell the server to
        // skip its auto-skip for this row.
        forceInclude: !!r.dup,
        // Recurring rows are expected, known charges → not flagged. Otherwise
        // surface uncertain categories / possible duplicates for review.
        review: r.recur ? false : ((!r.confident) || !!r.dup),
        reason: r.recur ? ("Linked to recurring: " + r.recur)
              : (r.dup ? "Possible duplicate · same day & amount as an existing transaction"
              : (!r.confident ? "Couldn’t confidently categorize · please confirm the category" : ""))
      }));
    } else {
      items = rcptReady.map((r) => {
        const a = Math.abs(parseFloat(r.amt) || 0);
        return {
          name: r.name || "Receipt", merchant: r.name || null, cat: r.cat, amt: -a, date: r.date, day: txDayLabel(r.date),
          account, icon: r.icon, receipt: r.url,
          review: true, reason: "Scanned receipt"
        };
      });
    }
    onImport(items);
  }

  function reset() { setStmt(null); setRcpts([]); }

  const dupCount = isStmt && stmt && stmt.status === "ready" ? stmt.rows.filter((r) => r.dup).length : 0;
  const recurCount = isStmt && stmt && stmt.status === "ready" ? stmt.rows.filter((r) => r.recur).length : 0;

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal imp-modal" role="dialog" aria-modal="true" aria-label="Import transactions">
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name={isStmt ? "upload" : "camera"} /></span>{isStmt ? "Import statement" : "Scan receipt"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>

        <div className="imp-body">
          <p className="imp-mode-hint" style={{ margin: "0 0 6px" }}>
            {isStmt ? "Bulk-import a bank or card statement — read on this device." : "Snap a receipt and we'll read the details on this device."}
          </p>

          <input ref={inputRef} type="file" hidden multiple={!isStmt}
            accept={isStmt ? ".pdf,.csv,.tsv,.ofx,.qfx,.txt" : "image/*"}
            onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

          {/* ---------- STATEMENT ---------- */}
          {isStmt && (!stmt ?
            <div className={"dropzone" + (drag ? " drag" : "")}
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <span className="dz-ico"><Icon name="file" /></span>
              <span className="dz-title">Drop a statement, or <b>browse</b></span>
              <span className="dz-sub">We read it on this device and list every transaction for you to review.</span>
              <span className="dz-formats">PDF · CSV · OFX · QFX</span>
            </div>
            :
            <div className="imp-result">
              <div className="imp-filebar">
                <span className="imp-file-ico"><Icon name="file" /></span>
                <div className="imp-file-meta">
                  <span className="imp-file-name">{stmt.fileName}</span>
                  <span className="imp-file-sub">
                    {stmt.status === "scanning" ? "Reading…" :
                      stmt.status === "empty" ? "No transactions found · " + txReadableSize(stmt.size) :
                      stmt.status === "error" ? "Couldn’t read this file" :
                      stmtSel.length + " of " + stmt.rows.length + " selected · " + txReadableSize(stmt.size)}
                  </span>
                </div>
                {stmt.status === "scanning"
                  ? <span className="imp-spin"><Icon name="loader" /></span>
                  : <button className="imp-textbtn" onClick={reset}>Replace</button>}
              </div>

              {stmt.status === "scanning" ?
                <div className="imp-skeleton">{[0, 1, 2, 3].map((i) => <div key={i} className="imp-skel-row" />)}</div>
                : stmt.status === "empty" ?
                <div className="txn-empty" style={{ padding: "18px 14px" }}>
                  We couldn&rsquo;t find any transactions in <b>{stmt.fileName}</b>. If it&rsquo;s a scanned/image PDF, try exporting your statement as <b>CSV</b> or <b>OFX/QFX</b> from your bank, then drop it here.
                </div>
                : stmt.status === "error" ?
                <div className="txn-empty" style={{ padding: "18px 14px", color: "var(--red)" }}>
                  {stmt.error}. Try a CSV or OFX/QFX export from your bank.
                </div>
                :
                <React.Fragment>
                  <div className="imp-acctsel">
                    <span>Import into</span>
                    <select value={account} onChange={(e) => setAccount(e.target.value)}>
                      {acctNames.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  {stmt.detected &&
                    <div className="imp-mode-hint" style={{ display: "block", margin: "-2px 2px 8px", color: "var(--accent)" }}>
                      Matched to <b>{stmt.detected}</b> by the last 4 digits on your statement.
                    </div>}
                  {dupCount > 0 &&
                    <div className="imp-mode-hint" style={{ ...TX_DUP_STYLE, display: "block", margin: "2px 2px 8px" }}>
                      {"⚠ "}{dupCount} {dupCount === 1 ? "row looks like a transaction you already have" : "rows look like transactions you already have"} (same day &amp; amount) — unchecked by default.
                    </div>}
                  {recurCount > 0 &&
                    <div className="imp-mode-hint" style={{ ...TX_RECUR_STYLE, display: "block", margin: "2px 2px 8px" }}>
                      {"↻ "}{recurCount} {recurCount === 1 ? "row matches a recurring bill" : "rows match recurring bills"} — categorized for you.
                    </div>}
                  <div className="imp-detected">
                    {stmt.rows.map((r) =>
                      <label className={"imp-row" + (r.include ? "" : " off")} key={r.id}>
                        <input type="checkbox" checked={r.include}
                          onChange={() => setStmt((s) => ({ ...s, rows: s.rows.map((x) => x.id === r.id ? { ...x, include: !x.include } : x) }))} />
                        <span className="imp-row-ico"><Icon name={r.icon} /></span>
                        <span className="imp-row-main">
                          <span className="imp-row-name">{r.name}</span>
                          <span className="imp-row-meta">
                            {txDayLabel(r.date)} {"·"} {r.cat}
                            {r.recur && <span style={TX_RECUR_STYLE}> {"·"} {"↻"} recurring · {r.recur}</span>}
                            {r.dup && <span style={TX_DUP_STYLE}> {"·"} {"⚠"} possible duplicate</span>}
                          </span>
                        </span>
                        <span className={"imp-row-amt" + (r.amt > 0 ? " pos" : "")}>{txFmtAmt(r.amt)}</span>
                      </label>
                    )}
                  </div>
                </React.Fragment>}
            </div>)}

          {/* ---------- RECEIPT ---------- */}
          {!isStmt &&
            <div className="imp-result">
              <div className={"dropzone compact" + (drag ? " drag" : "")}
                onClick={() => inputRef.current && inputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                <span className="dz-ico"><Icon name="camera" /></span>
                <span className="dz-title">Drop receipt photos, or <b>browse</b></span>
                <span className="dz-formats">JPG · PNG · HEIC</span>
              </div>

              {rcpts.length > 0 &&
                <div className="rcpt-cards">
                  {rcpts.map((r) => {
                    const rDup = r.status === "ready" && r.amt ? txIsDuplicate({ date: r.date, amt: -Math.abs(parseFloat(r.amt) || 0), name: r.name, account_id: selAcctId }) : null;
                    return (
                    <div className="rcpt-card" key={r.id}>
                      <div className="rcpt-thumb">
                        {r.url ? <img src={r.url} alt={r.fileName} /> : <span className="rcpt-ph"><Icon name="image" /></span>}
                        {r.status === "scanning" && <span className="rcpt-reading"><span className="imp-spin"><Icon name="loader" /></span>Reading{"…"}</span>}
                      </div>
                      {r.status === "failed" ?
                        <div className="rcpt-fields">
                          <span className="imp-mode-hint" style={{ display: "block", marginBottom: 8, color: "var(--red)" }}>{r.note}</span>
                          <div className="rcpt-field-row">
                            <button className="imp-textbtn" onClick={() => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, status: "ready", name: "", amt: "", date: x.date || txIsoDaysAgo(0), cat: "Shopping", icon: "bag", note: "" } : x))}>Enter details manually</button>
                            <button className="imp-textbtn" onClick={() => setRcpts((p) => p.filter((x) => x.id !== r.id))}>Remove</button>
                          </div>
                        </div>
                        : r.status === "ready" ?
                        <div className="rcpt-fields">
                          {r.note && <span className="imp-mode-hint" style={{ display: "block", marginBottom: 4 }}>{r.note}</span>}
                          {rDup && <span className="imp-mode-hint" style={{ ...TX_DUP_STYLE, display: "block", marginBottom: 4 }}>{"⚠"} You may already have this (same day &amp; amount).</span>}
                          <label className="rcpt-field"><span>Merchant</span>
                            <input value={r.name} onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} /></label>
                          <div className="rcpt-field-row">
                            <label className="rcpt-field"><span>Amount</span>
                              <input type="number" step="0.01" inputMode="decimal" value={r.amt}
                                onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, amt: e.target.value } : x))} /></label>
                            <label className="rcpt-field"><span>Date</span>
                              <input type="date" max={txToday()} value={r.date}
                                onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, date: e.target.value } : x))} /></label>
                          </div>
                          <div className="rcpt-field-row">
                            <label className="rcpt-field"><span>Category</span>
                              <select value={r.cat} onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, cat: e.target.value } : x))}>
                                {txExpenseCats().map((c) => <option key={c} value={c}>{c}</option>)}
                              </select></label>
                            <button className="rcpt-remove" onClick={() => setRcpts((p) => p.filter((x) => x.id !== r.id))} aria-label="Remove receipt"><Icon name="trash" /></button>
                          </div>
                        </div>
                        :
                        <div className="rcpt-fields"><div className="imp-skel-row" /><div className="imp-skel-row short" /></div>}
                    </div>);
                  })}
                </div>}
            </div>}
        </div>

        <div className="fs-modal-foot">
          <span className="fs-foot-note">{isStmt
            ? "Nothing is uploaded — your statement is read on this device."
            : "Receipts are read on this device and attach to the transaction."}</span>
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={doImport} disabled={!canImport}>
              {canImport ? "Import " + count + (isStmt ? (count === 1 ? " transaction" : " transactions") : (count === 1 ? " receipt" : " receipts")) : "Import"}
            </Button>}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { ImportModal });
