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

function AddTransactionModal({ accounts = [], onClose, onAdd }) {
  const { Segmented, Button } = TX_DS;
  const [kind, setKind] = React.useState("Expense");
  const [name, setName] = React.useState("");
  const [amt, setAmt] = React.useState("");
  const [cat, setCat] = React.useState("Groceries");
  const [account, setAccount] = React.useState(accounts[0] || "");
  const [date, setDate] = React.useState(txToday());
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isIncome = kind === "Income";
  const amtNum = parseFloat(String(amt).replace(/[^0-9.\-]/g, ""));
  const validName = name.trim().length > 0;
  const validAmt = amt !== "" && !Number.isNaN(amtNum) && amtNum > 0;
  const valid = validName && validAmt;

  function submit() {
    setTouched(true);
    if (!valid) return;
    const finalCat = isIncome ? "Income" : cat;
    onAdd({
      name: name.trim(),
      cat: finalCat,
      amt: isIncome ? Math.abs(amtNum) : -Math.abs(amtNum),
      date: date,
      day: txDayLabel(date),
      account: account || (accounts[0] || "Everyday Checking"),
      icon: TX_ICON[finalCat] || "bag"
    });
  }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label="Add transaction">
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name={TX_ICON[isIncome ? "Income" : cat] || "bag"} /></span>Add transaction</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"×"}</button>
        </div>

        <div className="fs-grid">
          <div className="fs-field full">
            <span>Type</span>
            {Segmented && <Segmented options={["Expense", "Income"]} value={kind} onChange={setKind} />}
          </div>

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
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
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
        </div>

        <div className="fs-modal-foot">
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>Add transaction</Button>}
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

/* ---- keyword categoriser (imported rows are flagged for review anyway) ---- */
const TX_CAT_RULES = [
  [/(grocer|market|whole foods|trader joe|safeway|kroger|loblaw|metro|costco|walmart|aldi|sobeys|no frills|superstore|save[- ]?on)/i, "Groceries", "cart"],
  [/(coffee|caf[eé]|starbucks|restaurant|dining|pizza|mcdonald|uber eats|doordash|grubhub|skip|tim hortons|\bbar\b|\bpub\b|bistro|grill|sushi)/i, "Dining", "coffee"],
  [/(uber|lyft|shell|esso|petro|chevron|\bgas\b|fuel|transit|parking|presto|via rail|\bair\b|airlines|train)/i, "Transport", "fuel"],
  [/(netflix|spotify|disney|hulu|prime video|youtube premium|subscription|patreon|icloud|dropbox|adobe|notion|openai|claude)/i, "Subscriptions", "music"],
  [/(hydro|electric|water|rogers|bell|telus|fido|koodo|at&t|verizon|comcast|internet|wireless|utility|utilit)/i, "Utilities", "bag"],
  [/(rent|mortgage|landlord|property|strata|condo fee|housing)/i, "Housing", "bank"],
  [/(amazon|target|\bstore\b|\bshop\b|best buy|home depot|ikea|pharmaprix|shoppers|walgreens|cvs|etsy|aliexpress)/i, "Shopping", "bag"]
];
function txGuessCat(name) {
  const s = String(name || "");
  for (const r of TX_CAT_RULES) if (r[0].test(s)) return { cat: r[1], icon: r[2] };
  return { cat: "Shopping", icon: "bag" };
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
const TX_PREFIX = /^(?:(?:sq|tst|sp|pp|paypal|dd|ec)\s?\*\s*|(?:pos(?: purchase| debit)?|point of sale|purchase|payment|pre-?authorized|pre-?auth|recurring|debit card|credit card|debit|visa|mastercard|amex|interac e-?transfer|interac|e-?transfer|bill payment|web pmt|ach|eft)[\s:#-]+)/i;
const TX_KEEP_UPPER = new Set(["KFC", "BP", "IGA", "BMO", "RBC", "CIBC", "HSBC", "TD", "LCBO", "IKEA", "IHOP", "UPS", "DHL", "KPMG", "AMC", "GNC", "CVS", "DSW", "H&M", "A&W", "BBQ", "ATM", "PC"]);
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
function txCleanMerchant(raw) {
  let s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
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
  // the real merchant name leads on card descriptors -> keep up to the first noise token
  const toks = s.split(" ");
  const kept = [];
  for (const t of toks) { if (txIsNoiseToken(t)) break; kept.push(t); }
  s = kept.length ? kept.join(" ") : toks.filter((t) => !txIsNoiseToken(t)).join(" ");
  // drop trailing country, then a trailing province/state code
  for (let i = 0; i < 2; i++) s = s.replace(/\s+(?:ca|can|canada|usa|us|united states)$/i, "").trim();
  for (let i = 0; i < 2; i++) s = s.replace(new RegExp("\\s+(?:" + TX_REGION + ")$"), "").trim();
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s,.*#-]+|[\s,.*#-]+$/g, "").trim();
  if (!s) s = original.replace(/[#*]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters && letters === letters.toUpperCase()) s = s.split(" ").map(txTitleCaseWord).join(" ");
  s = s.replace(/\.(com|ca|net|org|io|co|biz|us|app|store)\b/i, (m) => m.toLowerCase());
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

/* ---- duplicate detection: same date + same |amount| as an existing txn ---- */
function txExistingTxns() {
  const d = window.ClaudData;
  return (d && Array.isArray(d.transactions)) ? d.transactions : [];
}
function txIsDuplicate(date, amt) {
  if (!date || amt == null || isNaN(amt)) return false;
  const cents = Math.round(Math.abs(amt) * 100);
  return txExistingTxns().some((t) => {
    const td = t.date || t.day;
    const ta = t.amt != null ? t.amt : t.amount;
    return td === date && ta != null && Math.round(Math.abs(ta) * 100) === cents;
  });
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
function txParsePdfLines(lines) {
  const out = [];
  let yearHint = new Date().getFullYear();
  for (const l of lines) { const m = l.match(/(20\d{2})/); if (m) { yearHint = +m[1]; break; } }
  const dateRe = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?)/i;
  const moneyRe = /\(?-?\$?\s?\d[\d,]*\.\d{2}\)?-?/g;
  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm) continue;
    const date = txParseDate(dm[0], yearHint);
    if (!date) continue;
    const monies = line.match(moneyRe);
    if (!monies || !monies.length) continue;
    const amt = txParseAmount(monies[monies.length - 1]);   // rightmost money = txn amount (tune per bank)
    if (amt == null) continue;
    let name = line.replace(dm[0], "");
    monies.forEach((mm) => { name = name.replace(mm, ""); });
    name = name.replace(/\s+/g, " ").trim().replace(/^[\-–·,\s]+|[\-–·,\s]+$/g, "");
    out.push({ date, name: name || "Transaction", amt });
  }
  return out;
}
async function txParsePDF(file) {
  const lib = await txLoadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = {};
    tc.items.forEach((it) => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5]);
      (byY[y] = byY[y] || []).push({ x: it.transform[4], s: it.str });
    });
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach((y) => {
      const line = byY[y].sort((a, b) => a.x - b.x).map((o) => o.s).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    });
  }
  return { txns: txParsePdfLines(lines), text: lines.join("\n") };
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
  return txParseReceiptText((res && res.data && res.data.text) || "");
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

  /* derive a preview row from a parsed transaction, given the chosen orientation */
  function txRowFrom(t, flip, id) {
    const amt = flip ? -t.amt : t.amt;
    const g = amt > 0 ? { cat: "Income", icon: "income" } : txGuessCat(t.name);
    return { id: id || txNextId(), name: txCleanMerchant(t.name), rawAmt: t.amt, cat: g.cat, icon: g.icon, amt, date: t.date, include: !txIsDuplicate(t.date, amt), dup: txIsDuplicate(t.date, amt) };
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
        const g = amt > 0 ? { cat: "Income", icon: "income" } : txGuessCat(r.name);
        return { ...r, amt, cat: g.cat, icon: g.icon, dup: txIsDuplicate(r.date, amt) };
      });
      return { ...s, rows };
    });
  }, [isCredit]);

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
          setRcpts((prev) => prev.map((r) => {
            if (r.id !== id) return r;
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
          setRcpts((prev) => prev.map((r) => r.id === id ? { ...r, status: "ready", note: "Couldn’t read it automatically — add the details below." } : r));
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
        name: r.name, cat: r.cat, amt: r.amt, date: r.date, day: txDayLabel(r.date),
        account, icon: r.icon,
        // statement rows arrive auto-categorized by our parser — flag them for a quick human check
        review: true, reason: r.dup ? "Imported from statement · possible duplicate" : "Imported from statement"
      }));
    } else {
      items = rcptReady.map((r) => {
        const a = Math.abs(parseFloat(r.amt) || 0);
        return {
          name: r.name || "Receipt", cat: r.cat, amt: -a, date: r.date, day: txDayLabel(r.date),
          account, icon: r.icon, receipt: r.url,
          review: true, reason: "Scanned receipt"
        };
      });
    }
    onImport(items);
  }

  function reset() { setStmt(null); setRcpts([]); }

  const dupCount = isStmt && stmt && stmt.status === "ready" ? stmt.rows.filter((r) => r.dup).length : 0;

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
                    const rDup = r.status === "ready" && r.amt ? txIsDuplicate(r.date, parseFloat(r.amt)) : false;
                    return (
                    <div className="rcpt-card" key={r.id}>
                      <div className="rcpt-thumb">
                        {r.url ? <img src={r.url} alt={r.fileName} /> : <span className="rcpt-ph"><Icon name="image" /></span>}
                        {r.status === "scanning" && <span className="rcpt-reading"><span className="imp-spin"><Icon name="loader" /></span>Reading{"…"}</span>}
                      </div>
                      {r.status === "ready" ?
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
