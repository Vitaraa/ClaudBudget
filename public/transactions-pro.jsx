/* ============================================================
   Claud — Transactions Pro
   Loaded after transactions.jsx, before app.jsx. Adds, on top of
   the existing Transactions page:
     • Needs-review queue (amber flag + banner + filter)
     • Transaction detail drawer (notes · tags · attachments · history)
     • Split transactions (one charge across categories)
     • Rules / auto-categorization ("always categorize X as Y")
     • Bulk actions (multi-select recategorize / confirm / exclude)
   Self-contained: txp*-prefixed identifiers, persists per-txn extras
   and rules to localStorage. Uses the page globals (Icon, money,
   getCatColors, orderCatNames, CatPicker, hexA) at render time only.
   Exposes its components on window for app.jsx to mount.
   ============================================================ */
const TXP_DS = window.ClaudDesignSystem_de602a || {};

/* ---- own formatters (separate babel scope; don't touch app.jsx's at load) ---- */
const TXP_MINUS = "\u2212";
const txpMoney = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? TXP_MINUS : "") + "$" + s;
};
const txpSigned = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : TXP_MINUS + "$") + s;
};
const txpHexA = (hex, a) => {
  const h = (hex || "#9a8048").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const txpAgo = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return m + (m === 1 ? " min ago" : " mins ago");
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hr ago" : " hrs ago");
  const d = Math.round(h / 24); if (d < 30) return d + (d === 1 ? " day ago" : " days ago");
  const mo = Math.round(d / 30); return mo + (mo === 1 ? " month ago" : " months ago");
};

/* ============================================================
   PERSISTENT STORES
   ============================================================ */
const TXP_META_KEY = "claud:txnMeta:v1";
const TXP_RULES_KEY = "claud:txnRules:v1";
function txpLoad(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function txpStore(key, fallback, evt) {
  let data = txpLoad(key, fallback);
  const subs = new Set();
  const emit = () => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    subs.forEach((fn) => { try { fn(data); } catch (e) {} });
    if (evt) window.dispatchEvent(new Event(evt));
  };
  return {
    get: () => data,
    set: (next) => { data = next; emit(); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    _emit: emit
  };
}

/* per-txn extras: { [id]: { reviewed, note, tags:[], splits:[{cat,amt}], attachment, attachName, history:[{from,to,at}] } }
   localStorage is now a fast optimistic cache only — the source of truth is the
   per-transaction fields on the server (ClaudData.transactions). Every patch is
   ALSO pushed through ClaudActions.updateTxn so it persists per-user and survives
   reload; "reviewed: true" maps to the server's review:false ("cleared"). */
const TXP_META = window.__claudTxnMeta || (window.__claudTxnMeta = (() => {
  const s = txpStore(TXP_META_KEY, {});
  s.one = (id) => s.get()[id] || {};
  s.patch = (id, patch) => {
    const cur = s.get()[id] || {};
    const add = typeof patch === "function" ? patch(cur) : patch;
    s.set({ ...s.get(), [id]: { ...cur, ...add } });
    // mirror the user-facing fields to the backend (history is derived server-side)
    if (window.ClaudActions && window.ClaudActions.updateTxn) {
      const srv = {};
      if ("note" in add) srv.note = add.note;
      if ("tags" in add) srv.tags = add.tags;
      if ("splits" in add) srv.splits = add.splits;
      if ("attachment" in add) srv.attachment = add.attachment;
      if (add.reviewed === true) srv.review = false;
      if (Object.keys(srv).length) { try { window.ClaudActions.updateTxn(id, srv); } catch (e) {} }
    }
  };
  return s;
})());

/* rules: server-backed. Source of truth is ClaudData.rules ({id,match,category}).
   The local txpStore is kept only so subscribe()/legacy reads keep working; all
   mutations go through ClaudActions (which persists then refreshes the store). */
const TXP_RULES = window.__claudTxnRules || (window.__claudTxnRules = (() => {
  const s = txpStore(TXP_RULES_KEY, [], "claud:rules-changed");
  // add a rule and apply it to existing matching transactions immediately
  s.add = (rule) => {
    const match = (rule.match || "").trim();
    const category = rule.category || rule.cat;
    if (!match || !category) return;
    if (window.ClaudActions && window.ClaudActions.addRule) window.ClaudActions.addRule(match, category, true);
  };
  s.remove = (id) => { if (window.ClaudActions && window.ClaudActions.deleteRule) window.ClaudActions.deleteRule(id); };
  s.update = (id, patch) => {
    const p = {};
    if (patch.match != null) p.match = patch.match;
    if (patch.category != null) p.category = patch.category;
    else if (patch.cat != null) p.category = patch.cat;
    if (window.ClaudActions && window.ClaudActions.updateRule) window.ClaudActions.updateRule(id, p);
  };
  return s;
})());

function useTxnMeta() {
  const [m, set] = React.useState(TXP_META.get());
  React.useEffect(() => TXP_META.subscribe(set), []);
  return m;
}
/* read the server rules; normalize so legacy code reading r.cat still works */
function txpNormRules(list) {
  return (list || []).map((r) => ({ ...r, cat: r.category != null ? r.category : r.cat }));
}
function useTxnRules() {
  const data = (window.useClaudData ? window.useClaudData() : window.ClaudData) || {};
  return txpNormRules(data.rules);
}
/* first rule whose merchant-substring is contained in the transaction name */
function txpRuleFor(name, rules) {
  const n = (name || "").toLowerCase();
  const r = (rules || []).find((r) => r.match && n.includes(r.match.toLowerCase())) || null;
  if (!r) return null;
  return { ...r, cat: r.cat != null ? r.cat : r.category };
}

Object.assign(window, { TXP_META, TXP_RULES, useTxnMeta, useTxnRules, txpRuleFor, txpMoney, txpSigned, txpAgo, txpHexA });

/* ============================================================
   SPLIT EDITOR (lives inside the drawer)
   amounts are stored as positive dollar values that should sum to
   the transaction's absolute total.
   ============================================================ */
function SplitEditor({ total, cat, splits, onChange, onClear }) {
  const { Segmented } = TXP_DS;
  const colors = getCatColors();
  const cats = orderCatNames(Object.keys(colors));
  const [mode, setMode] = React.useState("amount"); // amount | percent
  const rows = splits;
  const sum = rows.reduce((s, r) => s + (parseFloat(r.amt) || 0), 0);
  const remaining = Math.round((total - sum) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.005;

  const set = (next) => onChange(next);
  const update = (i, patch) => set(rows.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRow = () => {
    const used = rows.map((r) => r.cat);
    const next = cats.find((c) => !used.includes(c)) || cats[0] || cat;
    set([...rows, { cat: next, amt: Math.max(0, remaining) ? +remaining.toFixed(2) : 0 }]);
  };
  const removeRow = (i) => set(rows.filter((_, j) => j !== i));
  const assignRemaining = (i) => update(i, { amt: +((parseFloat(rows[i].amt) || 0) + remaining).toFixed(2) });

  return (
    <React.Fragment>
      <div className="split-toggle-row">
        <span className="dr-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: "var(--text-xs)", color: "var(--text)", fontWeight: 600 }}>
          Across {rows.length} categor{rows.length === 1 ? "y" : "ies"}
        </span>
        {Segmented && <Segmented options={["amount", "percent"]} value={mode} onChange={setMode} />}
      </div>

      <div className="split-list">
        {rows.map((r, i) => {
          const amt = parseFloat(r.amt) || 0;
          const pct = total ? Math.round(amt / total * 1000) / 10 : 0;
          return (
            <div className="split-row" key={i}>
              <span className="cdot" style={{ background: colors[r.cat] || "#9a8048" }} />
              <select className="dr-select" value={r.cat} onChange={(e) => update(i, { cat: e.target.value })}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                {!cats.includes(r.cat) && <option value={r.cat}>{r.cat}</option>}
              </select>
              <div className="split-amt">
                {mode === "amount" ?
                  <input className="dr-input" type="number" step="0.01" inputMode="decimal" value={r.amt}
                    onChange={(e) => update(i, { amt: e.target.value })} placeholder="0.00" style={{ textAlign: "right" }} />
                  :
                  <input className="dr-input" type="number" step="0.1" inputMode="decimal" value={pct || ""}
                    onChange={(e) => update(i, { amt: +(total * (parseFloat(e.target.value) || 0) / 100).toFixed(2) })}
                    placeholder="0" style={{ textAlign: "right" }} />}
              </div>
              <button className="split-rm" onClick={() => rows.length > 1 ? removeRow(i) : onClear()} aria-label="Remove split" title="Remove"><Icon name="x" /></button>
            </div>);
        })}
      </div>

      <div className="split-foot">
        <span className={"split-remaining " + (balanced ? "ok" : "off")}>
          {balanced ? "Balanced" : <React.Fragment>{remaining > 0 ? "Unassigned " : "Over by "}<b>{txpMoney(Math.abs(remaining))}</b></React.Fragment>}
          {!balanced && rows.length > 0 &&
            <button className="dr-link" style={{ marginLeft: 8 }} onClick={() => assignRemaining(rows.length - 1)}>assign to last</button>}
        </span>
        <button className="split-add" onClick={addRow}><Icon name="plus" /> Add split</button>
      </div>
    </React.Fragment>);
}

/* ============================================================
   TAG EDITOR
   ============================================================ */
const TXP_TAG_SUGGEST = ["Reimbursable", "Business", "Tax-deductible", "Subscription", "One-off", "Shared"];
function TagEditor({ tags, onChange }) {
  const [input, setInput] = React.useState("");
  const add = (t) => {
    const v = (t == null ? input : t).trim();
    if (!v || tags.includes(v)) { setInput(""); return; }
    onChange([...tags, v]); setInput("");
  };
  const remove = (t) => onChange(tags.filter((x) => x !== t));
  const suggestions = TXP_TAG_SUGGEST.filter((s) => !tags.includes(s));
  return (
    <React.Fragment>
      {tags.length > 0 &&
        <div className="tag-list">
          {tags.map((t) =>
            <span className="tag-chip" key={t}>{t}<button className="tag-x" onClick={() => remove(t)} aria-label={"Remove " + t}>{"\u00D7"}</button></span>)}
        </div>}
      <div className="tag-input-row">
        <input className="dr-input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={"Add a tag\u2026"} />
        <button className="tag-suggest" style={{ borderStyle: "solid", color: input.trim() ? "var(--accent)" : "var(--muted)", borderColor: input.trim() ? "var(--accent-line)" : "var(--border)", padding: "0 16px" }} onClick={() => add()} disabled={!input.trim()}>Add</button>
      </div>
      {suggestions.length > 0 &&
        <div className="tag-list">
          {suggestions.slice(0, 4).map((s) =>
            <button className="tag-suggest" key={s} onClick={() => add(s)}><Icon name="plus" /> {s}</button>)}
        </div>}
    </React.Fragment>);
}

/* ============================================================
   DETAIL DRAWER
   ============================================================ */
/* Normalise a name for "same merchant" grouping in the rename scope prompt.
   Mirrors the server's normName (lib/dedup.js) closely enough that the count we
   show matches what the server will rename. Advisory only; server is final. */
const DR_RENAME_NOISE = { pos: 1, purchase: 1, payment: 1, debit: 1, credit: 1, visa: 1, mastercard: 1, amex: 1, recurring: 1, interac: 1, eft: 1, ach: 1, preauth: 1, preauthorized: 1, preauthorised: 1 };
function drNormName(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !DR_RENAME_NOISE[t]).join(" ").trim();
}
function TxnDetailDrawer({ txn, onClose, onRecat, onRemove, onSetIcon, onViewReceipt, hasRule }) {
  const meta = useTxnMeta();
  const colors = getCatColors();
  const fileRef = React.useRef(null);
  const [ruleScopeOpen, setRuleScopeOpen] = React.useState(false);  // categorize/rule scope chooser
  // Inline rename: edit the recorded merchant name, optionally applying the fix to
  // every transaction currently sharing that name (so a single rule covers them).
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");
  const [renameScope, setRenameScope] = React.useState(null);  // { newName, others, from } while choosing scope
  // Source of truth is the server-backed fields carried on the txn object
  // (ClaudData.transactions already exposes note/tags/splits/attachment/history);
  // the local meta store is only a fallback/optimistic cache.
  const m = txn ? (meta[txn.id] || {}) : {};
  const splits = (txn && txn.splits && txn.splits.length ? txn.splits : null) || m.splits || [];
  const tags = (txn && txn.tags && txn.tags.length ? txn.tags : null) || m.tags || [];
  const history = (txn && txn.history && txn.history.length ? txn.history : null) || m.history || [];
  const note = (txn && txn.note != null && txn.note !== "" ? txn.note : null) || m.note || "";
  const attachment = (txn && txn.attachment) || m.attachment || txn.receipt || null;
  const attachName = m.attachName || ((txn && txn.attachment) ? "Attachment" : (txn.receipt ? "Receipt photo" : null));

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reset any in-progress rename when the drawer switches to a different txn.
  React.useEffect(() => { setEditingName(false); setRenameScope(null); setNameDraft(""); setRuleScopeOpen(false); }, [txn && txn.id]);

  if (!txn) return null;
  const total = Math.abs(txn.amt);
  const isSplit = splits.length > 0;

  function setSplits(next) {
    TXP_META.patch(txn.id, { splits: next, reviewed: true });
  }
  function startSplit() {
    // seed two rows: current category gets the full amount, a blank second row
    setSplits([{ cat: txn.cat, amt: +total.toFixed(2) }, { cat: "", amt: 0 }].map((r, i) =>
      i === 1 ? { ...r, cat: nextCatAfter(txn.cat) } : r));
  }
  function nextCatAfter(c) {
    const cats = orderCatNames(Object.keys(colors));
    return cats.find((x) => x !== c) || c;
  }
  function clearSplit() { TXP_META.patch(txn.id, { splits: [] }); }

  /* ---- rename (fix a mis-recorded merchant name) ---- */
  function startRename() { setNameDraft(txn.name); setEditingName(true); }
  function cancelRename() { setEditingName(false); setNameDraft(""); }
  function applyRename(name, scope) {
    setRenameScope(null); setEditingName(false); setNameDraft("");
    const A = window.ClaudActions;
    if (A && A.renameTxn) A.renameTxn(txn.id, name, scope);
    else if (A && A.updateTxn) A.updateTxn(txn.id, { name: name });   // fallback: single-row rename
  }
  function commitRename() {
    const next = nameDraft.trim();
    if (!next || next === txn.name) { cancelRename(); return; }
    // Count other transactions that currently share this name (advisory; the
    // server re-derives the set). If any exist, ask whether to fix them too.
    const d = window.ClaudData;
    const list = (d && Array.isArray(d.transactions)) ? d.transactions : [];
    const key = drNormName(txn.name);
    let others = 0;
    if (key) for (const t of list) { if (t.id === txn.id) continue; if (drNormName(t.name) === key) others++; }
    setEditingName(false);
    if (others > 0) setRenameScope({ newName: next, others, from: txn.name });
    else applyRename(next, "one");
  }

  function pickCategory(c) {
    if (c === txn.cat) return;
    // Route through requestRecat, which prompts to apply the change to other
    // same-merchant transactions (and save a rule) when any exist.
    if (window.requestRecat) { window.requestRecat(txn.id, c); return; }
    onRecat(txn.id, c, txn.cat);
  }

  /* ---- make-automatic: apply the current category at a chosen scope ----------
     Wired to real server actions so the choice actually persists:
       one    → re-tag just this row (bulk recat, no rule)
       past   → re-tag every existing row whose name matches (bulk recat, no rule)
       future → save a rule only; existing rows untouched (addRule, applyNow=false)
       all    → save a rule AND re-tag every existing match (addRule, applyNow=true) */
  function applyCatScope(scope) {
    setRuleScopeOpen(false);
    const A = window.ClaudActions; if (!A) return;
    const cat = txn.cat;
    if (scope === "future") { if (A.addRule) A.addRule(txn.name, cat, false); return; }
    if (scope === "all") { if (A.addRule) A.addRule(txn.name, cat, true); return; }
    // one | past → re-tag a set of existing rows (always clears their review flag), no rule
    let ids = [txn.id];
    if (scope === "past") {
      const d = window.ClaudData; const list = (d && Array.isArray(d.transactions)) ? d.transactions : [];
      const needle = (txn.name || "").toLowerCase();
      if (needle) ids = list.filter((t) => (t.name || "").toLowerCase().includes(needle)).map((t) => t.id);
    }
    if (A.bulkTxn && ids.length) A.bulkTxn(ids, "recat", cat);
    else if (A.recatTxn) A.recatTxn(txn.id, cat);
  }

  function onAttach(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => TXP_META.patch(txn.id, { attachment: ev.target.result, attachName: f.name });
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  const CatPickerC = window.CatPicker;
  return (
    <React.Fragment>
      <div className="drawer-scrim show" onClick={onClose} />
      <aside className="txn-drawer show" role="dialog" aria-modal="true" aria-label={"Details for " + txn.name}>
        <div className="dr-head">
          <window.IconPicker value={txn.icon} onPick={(n) => onSetIcon(txn.id, n)} />
          <div className="dr-head-id">
            <div className="dr-merchant">
              {editingName ?
                <span className="dr-rename">
                  <input className="dr-rename-input" autoFocus value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitRename(); } else if (e.key === "Escape") { e.stopPropagation(); cancelRename(); } }}
                    aria-label="Transaction name"
                    style={{ font: "inherit", fontWeight: 700, width: "100%", boxSizing: "border-box", padding: "3px 8px", borderRadius: 8, border: "1px solid var(--border, #d8d2bd)", background: "var(--surface, #fff)", color: "var(--text)" }} />
                  <span style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button type="button" className="imp-textbtn" onClick={cancelRename}>Cancel</button>
                    <button type="button" className="imp-textbtn" style={{ fontWeight: 700, color: "var(--accent)" }} onClick={commitRename}>Save name</button>
                  </span>
                </span>
                :
                <React.Fragment>
                  <span>{txn.name}</span>
                  <button type="button" className="dr-link dr-merchant-edit" style={{ marginLeft: 8 }} onClick={startRename} title="Edit name">Edit</button>
                </React.Fragment>}
            </div>
            <div className={"dr-amt " + (txn.amt >= 0 ? "pos" : "neg")} style={{ color: txn.amt >= 0 ? "var(--green)" : "var(--text)" }}>{txpSigned(txn.amt)}</div>
            <div className="dr-sub">{txn.day} {"\u00B7"} {txn.account}</div>
          </div>
          <button className="dr-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="dr-body">
          {/* rename scope: fix the name on just this row, or every row that shares it */}
          {renameScope &&
            <div className="dr-section">
              <p className="recat-lead" style={{ margin: "0 0 8px" }}>
                Rename to <b>{renameScope.newName}</b>. There {renameScope.others === 1 ? "is" : "are"} <b>{renameScope.others}</b> other {renameScope.others === 1 ? "transaction" : "transactions"} named <b>{renameScope.from}</b>.
              </p>
              <div className="recat-opts">
                <button type="button" className="recat-opt" onClick={() => applyRename(renameScope.newName, "one")}>
                  <span className="recat-opt-t">Just this one</span>
                  <span className="recat-opt-d">Only this transaction is renamed.</span>
                </button>
                <button type="button" className="recat-opt strong" onClick={() => applyRename(renameScope.newName, "all")}>
                  <span className="recat-opt-t">All {renameScope.others + 1}</span>
                  <span className="recat-opt-d">Rename every transaction named “{renameScope.from}” — a single rule then covers them all.</span>
                </button>
              </div>
            </div>}

          {/* review status */}
          {txn.needsReview ?
            <div className="dr-section">
              <div className="dr-review">
                <span className="ri"><Icon name="alert" /></span>
                <div className="dr-review-text">
                  <div className="dr-review-title">Needs review</div>
                  <div className="dr-review-sub">{txn.reason || "Confirm the category is right."}</div>
                </div>
                <button className="btn-warn" onClick={() => TXP_META.patch(txn.id, { reviewed: true })}>
                  <Icon name="check" /> Looks good
                </button>
              </div>
            </div>
            : (txn.review ?
              <div className="dr-section">
                <span className="dr-reviewed"><Icon name="circleCheck" /> Reviewed</span>
              </div> : null)}

          {/* category / split */}
          <div className="dr-section">
            <div className="dr-section-head">
              <span className="dr-label"><Icon name="tag" /> Category</span>
              {!isSplit
                ? <button className="dr-link" onClick={startSplit}>Split transaction</button>
                : <button className="dr-link" onClick={clearSplit}>Remove split</button>}
            </div>

            {isSplit ?
              <SplitEditor total={total} cat={txn.cat} splits={splits} onChange={setSplits} onClear={clearSplit} />
              :
              <React.Fragment>
                {CatPickerC && <CatPickerC value={txn.cat} onPick={pickCategory} />}
                {/* make-automatic: clicking opens a scope chooser, then actually
                    saves a rule and/or re-tags existing rows via ClaudActions. */}
                {hasRule ?
                  <div className="dr-rule on">
                    <span className="dr-rule-ico"><Icon name="spark" /></span>
                    <span className="dr-rule-text">A rule already tags <b>{txn.name}</b> as <b>{txn.cat}</b>. Manage it in Rules.</span>
                  </div>
                  :
                  <React.Fragment>
                    {/* the pill stays as the persistent header whether open or closed \u2014
                        only the caret flips \u2014 so the layout doesn't jump on click. */}
                    <button type="button" className={"dr-rule" + (ruleScopeOpen ? " open" : "")} aria-expanded={ruleScopeOpen}
                      onClick={() => setRuleScopeOpen((v) => !v)}>
                      <span className="dr-rule-ico"><Icon name="spark" /></span>
                      <span className="dr-rule-text">Always categorize <b>{txn.name}</b> as <b>{txn.cat}</b></span>
                      <span className="cat-caret">{ruleScopeOpen ? "\u25b4" : "\u25be"}</span>
                    </button>
                    {ruleScopeOpen &&
                      <div className="dr-rule-scope">
                        <div className="recat-opts">
                          <button type="button" className="recat-opt" onClick={() => applyCatScope("one")}>
                            <span className="recat-opt-t">Just this one</span>
                            <span className="recat-opt-d">Only this transaction. No rule saved.</span>
                          </button>
                          <button type="button" className="recat-opt" onClick={() => applyCatScope("past")}>
                            <span className="recat-opt-t">All past {txn.name}</span>
                            <span className="recat-opt-d">Re-tag existing {txn.name} transactions. No rule saved.</span>
                          </button>
                          <button type="button" className="recat-opt" onClick={() => applyCatScope("future")}>
                            <span className="recat-opt-t">Going forward</span>
                            <span className="recat-opt-d">Save a rule so future {txn.name} imports auto-tag; leave existing as-is.</span>
                          </button>
                          <button type="button" className="recat-opt strong" onClick={() => applyCatScope("all")}>
                            <span className="recat-opt-t">Everything {"\u00b7"} past &amp; future</span>
                            <span className="recat-opt-d">Re-tag existing rows and save a rule for future {txn.name}.</span>
                          </button>
                        </div>
                      </div>}
                  </React.Fragment>}
              </React.Fragment>}
          </div>

          {/* notes */}
          <div className="dr-section">
            <span className="dr-label"><Icon name="note" /> Note</span>
            <textarea className="dr-textarea" value={note} placeholder={"Add a note for this transaction\u2026"}
              onChange={(e) => TXP_META.patch(txn.id, { note: e.target.value })} />
          </div>

          {/* tags */}
          <div className="dr-section">
            <span className="dr-label"><Icon name="tag" /> Tags</span>
            <TagEditor tags={tags} onChange={(t) => TXP_META.patch(txn.id, { tags: t })} />
          </div>

          {/* attachment */}
          <div className="dr-section">
            <span className="dr-label"><Icon name="paperclip" /> Attachment</span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAttach} />
            {attachment ?
              <div className="dr-attach">
                <button className="dr-attach-thumb" onClick={() => onViewReceipt({ ...txn, receipt: attachment })} aria-label="View attachment">
                  <img src={attachment} alt={attachName || "attachment"} />
                </button>
                <div className="dr-attach-meta">
                  <div className="dr-attach-name">{attachName || "Attachment"}</div>
                  <div className="dr-attach-sub">Tap to view full size</div>
                </div>
                <button className="imp-textbtn" onClick={() => TXP_META.patch(txn.id, { attachment: null, attachName: null })}>Remove</button>
              </div>
              :
              <button className="dr-attach-add" onClick={() => fileRef.current && fileRef.current.click()}>
                <Icon name="camera" /> Attach a receipt photo
              </button>}
          </div>

          {/* history */}
          <div className="dr-section">
            <span className="dr-label"><Icon name="clock" /> Recategorize history</span>
            {history.length === 0 ?
              <span className="hist-empty">No category changes yet.</span>
              :
              <div className="hist-list">
                {[...history].reverse().map((h, i) =>
                  <div className="hist-item" key={i}>
                    <span className="hist-dot" />
                    <div>
                      <div className="hist-text">{h.from ? <React.Fragment><b>{h.from}</b> {"\u2192"} <b>{h.to}</b></React.Fragment> : <React.Fragment>Categorized as <b>{h.to}</b></React.Fragment>}</div>
                      <div className="hist-when">{txpAgo(h.at)}{h.via ? " \u00B7 " + h.via : ""}</div>
                    </div>
                  </div>)}
              </div>}
          </div>
        </div>

        <div className="dr-foot">
          <button className="dr-exclude" onClick={() => { onRemove(txn.id); onClose(); }}>
            <Icon name="trash" /> Exclude transaction
          </button>
        </div>
      </aside>
    </React.Fragment>);
}

/* ============================================================
   RULES MANAGER (modal)
   ============================================================ */
function RulesManager({ onClose }) {
  const rules = useTxnRules();
  const colors = getCatColors();
  const cats = orderCatNames(Object.keys(colors));
  const [match, setMatch] = React.useState("");
  const [cat, setCat] = React.useState(cats[0] || "Groceries");

  React.useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { Button } = TXP_DS;
  const canAdd = match.trim().length > 0;
  function add() { if (!canAdd) return; TXP_RULES.add({ match: match.trim(), cat }); setMatch(""); }

  return (
    <div className="set-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label="Auto-categorization rules" style={{ maxWidth: 540 }}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico"><Icon name="spark" /></span>Auto-categorization rules</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="imp-body" style={{ paddingBottom: 8 }}>
          <div className="rule-add">
            <div className="rule-add-field">
              <span className="dr-label">When merchant contains</span>
              <input className="dr-input" value={match} onChange={(e) => setMatch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="e.g. Whole Foods" />
            </div>
            <div className="rule-add-field">
              <span className="dr-label">Categorize as</span>
              <select className="dr-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {Button && <Button variant="primary" size="sm" onClick={add} disabled={!canAdd}>Add rule</Button>}
          </div>

          {rules.length === 0 ?
            <div className="rule-empty">
              <div className="re-ico"><Icon name="spark" /></div>
              No rules yet. Add one above, or use<br />“Always categorize…” on any transaction.
            </div>
            :
            <div className="rule-list">
              {rules.map((r) =>
                <div className="rule-row" key={r.id}>
                  <span className="rule-merch">Merchant contains <b>“{r.match}”</b></span>
                  <span className="rule-arrow"><Icon name="chevR" /></span>
                  <select className="dr-select rule-cat" value={r.cat} onChange={(e) => TXP_RULES.update(r.id, { cat: e.target.value })}>
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                    {!cats.includes(r.cat) && <option value={r.cat}>{r.cat}</option>}
                  </select>
                  <button className="rule-del" onClick={() => TXP_RULES.remove(r.id)} aria-label={"Delete rule for " + r.match}><Icon name="trash" /></button>
                </div>)}
            </div>}

          {rules.length > 0 &&
            <p className="rules-applied">Rules apply automatically to matching transactions and clear them from the review queue. The newest matching rule wins.</p>}
        </div>

        <div className="fs-modal-foot">
          <span className="fs-foot-note">Matching is case-insensitive and checks if the merchant name contains your text.</span>
          <div className="right">
            {Button && <Button variant="primary" size="sm" onClick={onClose}>Done</Button>}
          </div>
        </div>
      </div>
    </div>);
}

/* ============================================================
   BULK ACTION BAR
   ============================================================ */
function BulkBar({ count, total, allSelected, onToggleAll, onRecat, onConfirm, onExclude, onClear }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const ref = React.useRef(null);
  const colors = getCatColors();
  const cats = orderCatNames(Object.keys(colors));
  React.useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); }
    function onKey(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  return (
    <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
      {onToggleAll &&
        <button className="bulk-selall" onClick={onToggleAll} aria-pressed={allSelected}
          title={allSelected ? "Deselect all" : "Select all " + total}>
          <span className={"bulk-selall-box" + (allSelected ? " on" : "")}>{allSelected ? "\u2713" : ""}</span>
          {allSelected ? "Deselect all" : "Select all " + total}
        </button>}
      {onToggleAll && <span className="bulk-sep" />}
      <span className="bulk-count"><b>{count}</b> selected</span>
      <span className="bulk-sep" />
      <div className="bulk-recat" ref={ref}>
        <button className="bulk-btn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={menuOpen}>
          <Icon name="tag" /> Recategorize
        </button>
        {menuOpen &&
          <div className="cat-menu up" role="listbox" aria-label="Recategorize to">
            {cats.map((c) =>
              <button key={c} type="button" role="option" className="cat-opt"
                onClick={() => { onRecat(c); setMenuOpen(false); }}>
                <span className="cdot" style={{ background: colors[c] || "#9a8048" }} />
                <span className="cat-opt-name">{c}</span>
              </button>)}
          </div>}
      </div>
      <button className="bulk-btn warn" onClick={onConfirm}><Icon name="circleCheck" /> Mark reviewed</button>
      <button className="bulk-btn danger" onClick={onExclude}><Icon name="trash" /> Exclude</button>
      <span className="bulk-sep" />
      <button className="bulk-x" onClick={onClear} aria-label="Clear selection"><Icon name="x" /></button>
    </div>);
}

Object.assign(window, { TxnDetailDrawer, RulesManager, BulkBar, SplitEditor, TagEditor });
