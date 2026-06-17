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
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
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
   A statement (PDF / CSV / OFX) is "scanned" into a reviewable
   list of detected transactions; a receipt image is "read" into
   a single editable transaction with the photo attached. Both
   funnel through onImport(items[]) — the same store the add-
   transaction modal writes to. Files never leave the browser.
   ============================================================ */
const TX_STMT_POOL = [
  { name: "Payroll deposit",     cat: "Income",        amt:  2180.00, icon: "income" },
  { name: "Trader Joe's",        cat: "Groceries",     amt:   -68.15, icon: "cart" },
  { name: "Shell",               cat: "Transport",     amt:   -52.40, icon: "fuel" },
  { name: "Hydro One",           cat: "Utilities",     amt:   -94.30, icon: "bag" },
  { name: "Netflix",             cat: "Subscriptions", amt:   -16.49, icon: "music" },
  { name: "Blue Bottle Coffee",  cat: "Dining",        amt:    -6.85, icon: "coffee" },
  { name: "Amazon",              cat: "Shopping",      amt:   -39.99, icon: "bag" },
  { name: "Rogers",              cat: "Utilities",     amt:   -85.00, icon: "bag" },
  { name: "Uber",                cat: "Transport",     amt:   -23.70, icon: "fuel" },
  { name: "Whole Foods Market",  cat: "Groceries",     amt:   -54.12, icon: "cart" }
];
const TX_RCPT_POOL = [
  { name: "Trader Joe's",       cat: "Groceries", amt: 41.86, icon: "cart" },
  { name: "Pharmaprix",         cat: "Shopping",  amt: 23.40, icon: "bag" },
  { name: "Le Petit Café",      cat: "Dining",    amt: 18.75, icon: "coffee" },
  { name: "Esso",               cat: "Transport", amt: 61.20, icon: "fuel" },
  { name: "The Home Depot",     cat: "Shopping",  amt: 87.34, icon: "bag" }
];

const txIsoDaysAgo = (n) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const txReadableSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const txFmtAmt = (n) => {
  const v = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "\u2212$" : "+$") + v;
};

let txUid = 0;
const txNextId = () => "imp" + (Date.now().toString(36)) + "_" + (txUid++);

function ImportModal({ accounts = [], onClose, onImport, initialMode }) {
  const { Segmented, Button } = TX_DS;
  const [mode, setMode] = React.useState(initialMode || "Statement"); // Statement | Receipt
  const [account, setAccount] = React.useState(accounts[0] || "Everyday Checking");
  const [stmt, setStmt] = React.useState(null);   // { fileName, size, status, rows:[] }
  const [rcpts, setRcpts] = React.useState([]);   // [{ id, url, status, name, cat, amt, date }]
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isStmt = mode === "Statement";

  /* ---- statement ---- */
  function scanStatement(file) {
    setStmt({ fileName: file.name, size: file.size, status: "scanning", rows: [] });
    setTimeout(() => {
      const n = 5 + Math.floor(Math.random() * 3); // 5–7 detected
      const rows = TX_STMT_POOL.slice(0, n).map((t, i) => ({
        ...t, id: txNextId(), date: txIsoDaysAgo(i + 1), include: true
      }));
      setStmt((s) => s && { ...s, status: "ready", rows });
    }, 1500);
  }

  /* ---- receipts ---- */
  function readReceipts(files) {
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const id = txNextId();
      const reader = new FileReader();
      reader.onload = (ev) => {
        setRcpts((prev) => prev.map((r) => r.id === id ? { ...r, url: ev.target.result } : r));
        setTimeout(() => {
          const guess = TX_RCPT_POOL[Math.floor(Math.random() * TX_RCPT_POOL.length)];
          setRcpts((prev) => prev.map((r) => r.id === id ? {
            ...r, status: "ready", name: guess.name, cat: guess.cat, icon: guess.icon,
            amt: String(guess.amt.toFixed(2))
          } : r));
        }, 1500);
      };
      setRcpts((prev) => [...prev, { id, url: null, status: "scanning", name: "", cat: "Shopping", icon: "bag", amt: "", date: txIsoDaysAgo(0), fileName: file.name }]);
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
        review: true, reason: "Imported from statement"
      }));
    } else {
      items = rcptReady.map((r) => {
        const a = Math.abs(parseFloat(r.amt) || 0);
        return {
          name: r.name || "Receipt", cat: r.cat, amt: -a, date: r.date, day: txDayLabel(r.date),
          account, icon: r.icon, receipt: r.url
        };
      });
    }
    onImport(items);
  }

  function reset() { setStmt(null); setRcpts([]); }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal imp-modal" role="dialog" aria-modal="true" aria-label="Import transactions">
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name="upload" /></span>Import to transactions</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="imp-body">
          <div className="imp-modeswitch">
            {Segmented && <Segmented options={["Statement", "Receipt"]} value={mode} onChange={(m) => { setMode(m); }} />}
            <span className="imp-mode-hint">{isStmt ? "Bulk-import a bank or card statement." : "Snap a receipt and we'll read the details."}</span>
          </div>

          <input ref={inputRef} type="file" hidden multiple={!isStmt}
            accept={isStmt ? ".pdf,.csv,.ofx,.qfx" : "image/*"}
            onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

          {/* ---------- STATEMENT ---------- */}
          {isStmt && (!stmt ?
            <div className={"dropzone" + (drag ? " drag" : "")}
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <span className="dz-ico"><Icon name="file" /></span>
              <span className="dz-title">Drop a statement, or <b>browse</b></span>
              <span className="dz-sub">We scan it locally and list every transaction for you to review.</span>
              <span className="dz-formats">PDF · CSV · OFX · QFX</span>
            </div>
            :
            <div className="imp-result">
              <div className="imp-filebar">
                <span className="imp-file-ico"><Icon name="file" /></span>
                <div className="imp-file-meta">
                  <span className="imp-file-name">{stmt.fileName}</span>
                  <span className="imp-file-sub">
                    {stmt.status === "scanning" ? "Scanning\u2026" :
                      stmtSel.length + " of " + stmt.rows.length + " selected \u00B7 " + txReadableSize(stmt.size)}
                  </span>
                </div>
                {stmt.status === "scanning"
                  ? <span className="imp-spin"><Icon name="loader" /></span>
                  : <button className="imp-textbtn" onClick={reset}>Replace</button>}
              </div>

              {stmt.status === "scanning" ?
                <div className="imp-skeleton">{[0, 1, 2, 3].map((i) => <div key={i} className="imp-skel-row" />)}</div>
                :
                <React.Fragment>
                  <div className="imp-acctsel">
                    <span>Import into</span>
                    <select value={account} onChange={(e) => setAccount(e.target.value)}>
                      {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="imp-detected">
                    {stmt.rows.map((r) =>
                      <label className={"imp-row" + (r.include ? "" : " off")} key={r.id}>
                        <input type="checkbox" checked={r.include}
                          onChange={() => setStmt((s) => ({ ...s, rows: s.rows.map((x) => x.id === r.id ? { ...x, include: !x.include } : x) }))} />
                        <span className="imp-row-ico"><Icon name={r.icon} /></span>
                        <span className="imp-row-main">
                          <span className="imp-row-name">{r.name}</span>
                          <span className="imp-row-meta">{txDayLabel(r.date)} {"\u00B7"} {r.cat}</span>
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
                  {rcpts.map((r) =>
                    <div className="rcpt-card" key={r.id}>
                      <div className="rcpt-thumb">
                        {r.url ? <img src={r.url} alt={r.fileName} /> : <span className="rcpt-ph"><Icon name="image" /></span>}
                        {r.status === "scanning" && <span className="rcpt-reading"><span className="imp-spin"><Icon name="loader" /></span>Reading{"\u2026"}</span>}
                      </div>
                      {r.status === "ready" ?
                        <div className="rcpt-fields">
                          <label className="rcpt-field"><span>Merchant</span>
                            <input value={r.name} onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} /></label>
                          <div className="rcpt-field-row">
                            <label className="rcpt-field"><span>Amount</span>
                              <input type="number" step="0.01" inputMode="decimal" value={r.amt}
                                onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, amt: e.target.value } : x))} /></label>
                            <label className="rcpt-field"><span>Category</span>
                              <select value={r.cat} onChange={(e) => setRcpts((p) => p.map((x) => x.id === r.id ? { ...x, cat: e.target.value } : x))}>
                                {txExpenseCats().map((c) => <option key={c} value={c}>{c}</option>)}
                              </select></label>
                          </div>
                          <button className="rcpt-remove" onClick={() => setRcpts((p) => p.filter((x) => x.id !== r.id))} aria-label="Remove receipt"><Icon name="trash" /></button>
                        </div>
                        :
                        <div className="rcpt-fields"><div className="imp-skel-row" /><div className="imp-skel-row short" /></div>}
                    </div>
                  )}
                </div>}
            </div>}
        </div>

        <div className="fs-modal-foot">
          <span className="fs-foot-note">{isStmt
            ? "Nothing is uploaded \u2014 your statement is read on this device."
            : "Receipts attach to the transaction and stay on this device."}</span>
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
