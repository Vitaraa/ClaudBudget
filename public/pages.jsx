/* ============================================================
   Claud — Budget & Investments pages
   Loaded BEFORE app.jsx. Self-contained: uses uniquely-named
   top-level identifiers (pg*) and the DS bundle directly, then
   exposes BudgetPage / InvestmentsPage on window so app.jsx can
   mount them. Visual vocabulary matches the existing dashboard.
   ============================================================ */
const PG = window.ClaudDesignSystem_de602a || {};
const { useState: pgUseState } = React;

/* ------------------------------------------------------------------
   Shared budget store — survives tab unmounts so the Foresight tab can
   read the live budget categories set here. Holds the BudgetPage's
   editable groups; notifies subscribers (and a window event) on change.
   ------------------------------------------------------------------ */
const PG_BUDGET_STORE = window.__claudBudgetStore || (window.__claudBudgetStore = (() => {
  const subs = new Set();
  const emit = () => { const g = pgBuildLiveGroups(); subs.forEach((fn) => { try { fn(g); } catch (e) {} }); window.dispatchEvent(new CustomEvent("claud:budgets-changed")); };
  // Re-derive from the live store whenever server data refreshes, so Foresight
  // (which reads window.__claudBudgetStore) always sees the current budgets.
  try { window.addEventListener("claud:data", emit); } catch (e) {}
  return {
    // build the page's group/category shape from ClaudData on every read
    get: () => pgBuildLiveGroups(),
    // kept for backward-compat: budgets now persist via ClaudActions, so this
    // just notifies subscribers (the canonical data already lives in ClaudData).
    set: () => emit(),
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
})());

/* ---- format helpers (own names, no collision with app.jsx) ---- */
const PG_MINUS = "\u2212";
const pgMoney = (n, dec = 0) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n < 0 ? PG_MINUS : "") + "$" + s;
};
const pgSigned = (n, dec = 2) => {
  const s = Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (n >= 0 ? "+$" : PG_MINUS + "$") + s;
};
const pgPct = (n, dec = 1) => (n >= 0 ? "+" : PG_MINUS) + Math.abs(n).toFixed(dec) + "%";

/* smooth cardinal-spline path through [x,y] points */
const pgSpline = (pts) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

/* ============================================================
   BUDGET — data
   ============================================================ */
const BUDGET_GROUPS = [
  { label: "Essentials", cats: [
    { name: "Housing", budget: 1700, spent: 1650, roll: 0, color: "#c0763e" },
    { name: "Groceries", budget: 700, spent: 612, roll: 60, color: "#7a9a52" },
    { name: "Utilities", budget: 260, spent: 244, roll: 0, color: "#9a8048" },
    { name: "Transport", budget: 300, spent: 208, roll: 0, color: "#5a93a8" },
    { name: "Insurance", budget: 180, spent: 180, roll: 0, color: "#8a6fae" } ] },
  { label: "Lifestyle", cats: [
    { name: "Dining", budget: 300, spent: 385, roll: 0, color: "#cf6b3f" },
    { name: "Shopping", budget: 400, spent: 421, roll: 0, color: "#b06a8c" },
    { name: "Entertainment", budget: 150, spent: 96, roll: 25, color: "#5a8aa8" },
    { name: "Subscriptions", budget: 120, spent: 104, roll: 0, color: "#7e7a3c" } ] },
  { label: "Health & other", cats: [
    { name: "Health & fitness", budget: 250, spent: 128, roll: 0, color: "#4f9a6a" },
    { name: "Misc", budget: 240, spent: 95, roll: 0, color: "#a88a72" } ] },
  { label: "Savings goals", cats: [
    { name: "Emergency fund", budget: 800, spent: 800, roll: 0, color: "#4f9a6a" },
    { name: "Japan trip", budget: 250, spent: 250, roll: 0, color: "#5a93a8" },
    { name: "New laptop", budget: 200, spent: 120, roll: 0, color: "#8a6fae" } ] }
];

const BUDGET_GROUP_COLOR = { Essentials: "#c0763e", Lifestyle: "#b06a8c", "Health & other": "#4f9a6a", "Savings goals": "#3f8f7a" };

// fraction of the current month elapsed (drives the spend "pace" marker)
const pgMonthElapsed = () => {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(1, now.getDate() / days);
};
// current month label, e.g. "June"
const pgMonthLabel = () => new Date().toLocaleDateString("en-US", { month: "long" });

/* Build the Budget page's {id,label,cats:[...]} group shape from the live store:
   ClaudData.budgetGroups (each {id,label,sort}) joined with ClaudData.dashCategories
   (each {id,group_id,name,budget,color,roll,spent,available}) grouped by group_id.
   Server-derived `spent` is used as-is. A hoisted function so PG_BUDGET_STORE.get()
   can call it lazily at render time. */
function pgBuildLiveGroups() {
  const D = window.ClaudData || {};
  const groups = Array.isArray(D.budgetGroups) ? D.budgetGroups : [];
  const cats = Array.isArray(D.dashCategories) ? D.dashCategories : [];
  return groups.slice()
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map((g) => ({
      id: g.id,
      label: g.label,
      cats: cats
        .filter((c) => c.group_id === g.id)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .map((c) => ({
          id: c.id,
          name: c.name,
          budget: c.budget || 0,
          color: c.color || PG_CAT_PALETTE[0],
          roll: c.roll || 0,
          spent: c.spent || 0
        }))
    }));
}

/* ============================================================
   BUDGET PAGE
   ============================================================ */
// palette new categories pick from (matches the warm system already in use)
const PG_CAT_PALETTE = ["#c0763e", "#7a9a52", "#9a8048", "#5a93a8", "#8a6fae", "#cf6b3f", "#b06a8c", "#5a8aa8", "#7e7a3c", "#4f9a6a", "#a88a72", "#c89a3c"];

// seed the live, editable budget state from the static groups (give every cat a stable id)
const pgSeedGroups = () =>
  BUDGET_GROUPS.map((g) => ({
    label: g.label,
    cats: g.cats.map((c) => ({ ...c, id: "seed-" + g.label + "-" + c.name }))
  }));

function BudgetPage({ coverStyle = "suggested" }) {
  const { Card, Button, ProgressBar, Segmented } = PG;
  useClaudData(); // re-render whenever the live store refreshes
  const [rollover, setRollover] = pgUseState(true);
  const [cover, setCover] = pgUseState(null);
  // groups are derived live from the store (ClaudData.budgetGroups + dashCategories),
  // so a brand-new user sees an empty slate and every change persists to the server.
  const groups = PG_BUDGET_STORE.get();
  // modal: null | { mode: "add", group } | { mode: "edit", cat, group }
  const [modal, setModal] = pgUseState(null);
  // drag-to-reorder categories within a group: { group, id } of the row being dragged
  const [drag, setDrag] = pgUseState(null);

  // header "+ Add budget" button (lives in app.jsx) fires this event
  React.useEffect(() => {
    const open = () => setModal({ mode: "add", group: groups[0] ? groups[0].id : "" });
    window.addEventListener("claud:add-budget", open);
    return () => window.removeEventListener("claud:add-budget", open);
  }, [groups]);

  const cats = groups.flatMap((g) => g.cats);
  const totalBudget = cats.reduce((s, c) => s + c.budget + (rollover ? c.roll : 0), 0);
  const totalSpent = cats.reduce((s, c) => s + c.spent, 0);
  const remaining = totalBudget - totalSpent;
  const overCount = cats.filter((c) => c.spent > c.budget + (rollover ? c.roll : 0)).length;
  const pacePct = Math.round(pgMonthElapsed() * 100);
  const monthName = pgMonthLabel();

  // stacked composition bar by group (spent), plus remaining
  const groupSpend = groups.map((g) => ({
    label: g.label, color: BUDGET_GROUP_COLOR[g.label] || (g.cats[0] && g.cats[0].color) || "var(--accent)",
    spent: g.cats.reduce((s, c) => s + c.spent, 0)
  })).filter((g) => g.spent > 0);

  // ---- mutations (persist via ClaudActions; the store refresh re-renders us) ----
  function saveCat(data) {
    // data: { id?, name, group(=group_id), budget, color, roll }
    setModal(null);
    if (data.id) {
      ClaudActions.updateCategory(data.id, {
        name: data.name, budget: data.budget, color: data.color,
        roll: data.roll != null ? data.roll : 0, group_id: data.group
      });
      return;
    }
    const add = (groupId) => ClaudActions.addCategory({
      group_id: groupId, name: data.name, budget: data.budget,
      color: data.color, roll: data.roll != null ? data.roll : 0
    });
    if (data.group) { add(data.group); return; }
    // empty slate: no group yet -> create a default one, then add the category to it
    Promise.resolve(ClaudActions.addBudgetGroup("Budget")).then(() => {
      const gs = (window.ClaudData && window.ClaudData.budgetGroups) || [];
      const g = gs[gs.length - 1];
      if (g) return add(g.id);
    });
  }
  function removeCat(id) {
    ClaudActions.deleteCategory(id);
  }
  // move category `fromId` to occupy `toId`'s slot, within one group; persist new order via sort
  function moveCat(groupLabel, fromId, toId) {
    if (fromId === toId) return;
    const g = groups.find((x) => x.label === groupLabel);
    if (!g) return;
    const ids = g.cats.map((c) => c.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from === -1 || to === -1 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    ids.forEach((id, i) => ClaudActions.updateCategory(id, { sort: i }));
  }

  // ---- cover overspend: move base budget from categories with room ----
  function openCover(c) {
    const avail = c.budget + (rollover ? c.roll : 0);
    setCover({ id: c.id, name: c.name, spent: c.spent, color: c.color, avail, budget: c.budget });
  }
  const coverSources = cover ? cats.filter((c) => c.id !== cover.id).map((c) => {
    const avail = c.budget + (rollover ? c.roll : 0);
    return { id: c.id, name: c.name, color: c.color, slack: Math.round((avail - c.spent) * 100) / 100 };
  }).filter((s) => s.slack > 0) : [];
  function applyCover(moves) {
    // moves: [{id, amt}] amounts pulled FROM each source. Convert to absolute new
    // budgets and persist via ClaudActions.coverOverspend([{id, budget}]).
    const total = moves.reduce((s, m) => s + m.amt, 0);
    const byId = {};
    cats.forEach((c) => { byId[c.id] = c.budget; });
    const out = [{ id: cover.id, budget: Math.round(((byId[cover.id] || 0) + total) * 100) / 100 }];
    moves.forEach((m) => { out.push({ id: m.id, budget: Math.round(((byId[m.id] || 0) - m.amt) * 100) / 100 }); });
    ClaudActions.coverOverspend(out);
    setCover(null);
  }
  const firstOver = cats.find((c) => c.spent > c.budget + (rollover ? c.roll : 0));

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-row">
        <Card widget><div className="kpi">
          <span className="kpi-label">Budgeted · {monthName}</span>
          <span className="kpi-val">{pgMoney(totalBudget)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{cats.length} categories</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Spent so far</span>
          <span className="kpi-val">{pgMoney(totalSpent)}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{pacePct}% of month elapsed</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Left to spend</span>
          <span className="kpi-val" style={{ color: remaining < 0 ? "var(--red)" : "var(--text)" }}>{pgMoney(Math.abs(remaining))}</span>
          <span className={"kpi-delta " + (remaining >= 0 ? "pos" : "neg")}>{remaining >= 0 ? "on track" : "over budget"}</span>
        </div></Card>
        <Card widget><div className="kpi">
          <span className="kpi-label">Over budget</span>
          <span className="kpi-val" style={{ color: overCount ? "var(--red)" : "var(--green)" }}>{overCount}</span>
          <span className="kpi-delta" style={{ color: "var(--muted)" }}>{overCount ? "categories need a look" : "all within budget"}</span>
        </div></Card>
      </div>

      {/* Overspend banner */}
      {firstOver &&
        <div className="bud-over-banner">
          <span className="bob-ico"><Icon name="alert" /></span>
          <div className="bob-text">
            <b>{overCount} {overCount === 1 ? "category is" : "categories are"} over budget.</b>
            <span className="bob-sub">Cover the gap by moving budget from a category with room to spare.</span>
          </div>
          {Button && <Button variant="primary" size="sm" onClick={() => openCover(firstOver)}>Cover {firstOver.name}</Button>}
        </div>}

      {/* Hero composition */}
      <Card widget>
        <div className="cf-hero-head">
          <div>
            <span className="widget-eyebrow">{monthName} budget</span>
            <div className="cf-hero-title">{pgMoney(Math.abs(remaining))} {remaining >= 0 ? "left to spend" : "over budget"}</div>
          </div>
          <div className="cf-hero-right">
            <label className="roll-toggle">
              <span>Budget rollover</span>
              <button className={"roll-switch " + (rollover ? "on" : "")} role="switch" aria-checked={rollover} onClick={() => setRollover((v) => !v)}><span className="roll-knob" /></button>
            </label>
          </div>
        </div>

        <div className="bud-bar" role="img" aria-label="Spending composition">
          {groupSpend.map((g) =>
            <span key={g.label} className="bud-seg" style={{ width: `${g.spent / totalBudget * 100}%`, background: g.color }} title={`${g.label} ${pgMoney(g.spent)}`} />
          )}
          <span className="bud-pace" style={{ left: `${pacePct}%` }} title={`${pacePct}% of month`} />
        </div>
        <div className="bud-legend">
          {groupSpend.map((g) =>
            <span key={g.label} className="bud-leg"><span className="sw" style={{ background: g.color }} />{g.label} <b>{pgMoney(g.spent)}</b></span>
          )}
          <span className="bud-leg"><span className="sw" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }} />Unspent <b>{pgMoney(Math.max(0, remaining))}</b></span>
          <span className="bud-pace-key"><span className="bud-pace-dot" />{pacePct}% of month elapsed</span>
        </div>
      </Card>

      {/* Empty slate for a brand-new user */}
      {groups.length === 0 &&
        <Card widget>
          <div className="cat-empty" style={{ textAlign: "center", padding: "28px 16px" }}>
            <div style={{ fontSize: "var(--text-base)", color: "var(--text)", marginBottom: 6 }}>No budget categories yet.</div>
            <div style={{ marginBottom: 14 }}>Add your first category to start tracking what you plan to spend each month. Spending fills in automatically as transactions come in.</div>
            {Button && <Button variant="primary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("claud:add-budget"))}><Icon name="plus" /> Add a budget category</Button>}
          </div>
        </Card>}

      {/* Category groups */}
      {groups.map((g) => {
        const gColor = BUDGET_GROUP_COLOR[g.label] || (g.cats[0] && g.cats[0].color) || "var(--accent)";
        const gBudget = g.cats.reduce((s, c) => s + c.budget + (rollover ? c.roll : 0), 0);
        const gSpent = g.cats.reduce((s, c) => s + c.spent, 0);
        return (
          <Card widget key={g.label}>
            <div className="widget-head">
              <span className="widget-title"><span className="cat-dot" style={{ background: gColor, marginRight: 9 }} />{g.label}</span>
              <span className="group-sub muted">{pgMoney(gSpent)} of <b>{pgMoney(gBudget)}</b></span>
            </div>
            <div className="cat-list">
              {g.cats.map((c) => {
                const avail = c.budget + (rollover ? c.roll : 0);
                const over = c.spent > avail;
                const left = avail - c.spent;
                const dragging = drag && drag.group === g.label && drag.id === c.id;
                return (
                  <div className={"cat-row" + (dragging ? " dragging" : "")} key={c.id}
                    draggable
                    onDragStart={(e) => { setDrag({ group: g.label, id: c.id }); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", c.id); } catch (err) {} }}
                    onDragOver={(e) => { if (drag && drag.group === g.label && drag.id !== c.id) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; moveCat(g.label, drag.id, c.id); } }}
                    onDrop={(e) => { if (drag && drag.group === g.label) e.preventDefault(); setDrag(null); }}
                    onDragEnd={() => setDrag(null)}>
                    <div className="cat-top">
                      <span className="cat-name">
                        <span className="cat-grip" aria-hidden="true" title="Drag to reorder"><Icon name="grip" /></span>
                        <span className="cat-dot" style={{ background: c.color }} />{c.name}
                        {rollover && c.roll > 0 && <span className="roll-tag" title="Rolled over from May">+{pgMoney(c.roll)} rolled</span>}
                      </span>
                      <span className="cat-right">
                        <span className="cat-fig"><b style={{ color: over ? "var(--red)" : "var(--text)" }}>{pgMoney(c.spent)}</b> / {pgMoney(avail)}</span>
                        <span className="cat-actions">
                          <button className="cat-act" title="Edit category" aria-label={"Edit " + c.name} onClick={() => setModal({ mode: "edit", cat: c, group: g.id })}><Icon name="pencil" /></button>
                          <button className="cat-act del" title="Delete category" aria-label={"Delete " + c.name} onClick={() => removeCat(c.id)}><Icon name="trash" /></button>
                        </span>
                      </span>
                    </div>
                    <ProgressBar value={c.spent} max={avail} tone={over ? "over" : "accent"} />
                    <span className={"bud-cat-foot " + (over ? "neg" : "")}>
                      {over ? `${pgMoney(-left)} over` : `${pgMoney(left)} left`}
                      {over && <button className="bud-cover-btn" onClick={() => openCover(c)} title={"Cover " + c.name + " overspend"}><Icon name="repeat" /> Cover</button>}
                    </span>
                  </div>);
              })}
              {g.cats.length === 0 &&
                <div className="cat-empty">No categories here yet.</div>}
              <button className="cat-add" onClick={() => setModal({ mode: "add", group: g.id })}>
                <Icon name="plus" /> Add category to {g.label}
              </button>
            </div>
          </Card>);
      })}

      {modal && <BudgetModal modal={modal} groups={groups} onClose={() => setModal(null)} onSave={saveCat} onDelete={(id) => { removeCat(id); setModal(null); }} />}
      {cover && <CoverOverspendModal over={cover} sources={coverSources} style={coverStyle} onApply={applyCover} onClose={() => setCover(null)} />}
    </React.Fragment>);
}

/* ---- Add / edit a budget category ---- */
function BudgetModal({ modal, groups, onClose, onSave, onDelete }) {
  const { Button, Segmented } = PG;
  const editing = modal.mode === "edit";
  const src = editing ? modal.cat : null;
  const [name, setName] = pgUseState(src ? src.name : "");
  const [group, setGroup] = pgUseState(modal.group || (groups[0] && groups[0].id) || "");
  const [budget, setBudget] = pgUseState(src ? String(src.budget) : "");
  const [color, setColor] = pgUseState(src ? src.color : PG_CAT_PALETTE[0]);
  const [touched, setTouched] = pgUseState(false);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const budgetNum = parseFloat(String(budget).replace(/[^0-9.\-]/g, ""));
  const validName = name.trim().length > 0;
  const validBudget = budget !== "" && !Number.isNaN(budgetNum) && budgetNum > 0;
  const valid = validName && validBudget;

  function submit() {
    setTouched(true);
    if (!valid) return;
    onSave({
      id: src ? src.id : undefined,
      name: name.trim(),
      group,
      budget: Math.round(budgetNum),
      color,
      spent: src ? src.spent : 0,
      roll: src ? src.roll : 0
    });
  }

  return (
    <div className="fs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fs-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit budget category" : "Add budget category"}>
        <div className="fs-modal-head">
          <span className="fs-modal-title"><span className="fs-ico" style={{ width: 22, height: 22, borderRadius: 7, background: color }} />{editing ? "Edit category" : "New budget category"}</span>
          <button className="fs-modal-close" onClick={onClose} aria-label="Close">{"\u00D7"}</button>
        </div>

        <div className="fs-grid">
          <label className="fs-field full">
            <span>Category name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Childcare" autoFocus
              style={touched && !validName ? { borderColor: "var(--red)" } : undefined} />
          </label>

          <label className="fs-field">
            <span>Group</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
          <label className="fs-field">
            <span>Monthly budget</span>
            <input type="number" inputMode="decimal" step="10" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0"
              style={touched && !validBudget ? { borderColor: "var(--red)" } : undefined} />
          </label>

          <div className="fs-field full">
            <span>Color</span>
            <div className="set-swatches">
              {PG_CAT_PALETTE.map((c) =>
                <button key={c} type="button" className={"set-sw " + (color === c ? "on" : "")} style={{ background: c }} aria-label={"Color " + c} onClick={() => setColor(c)}>
                  {color === c && <Icon name="check" />}
                </button>)}
            </div>
          </div>
        </div>

        <div className="fs-modal-foot">
          {editing
            ? <Button variant="danger" size="sm" onClick={() => onDelete(src.id)}>Delete</Button>
            : <span className="fs-foot-note">Spending updates as transactions come in.</span>}
          <div className="right">
            {Button && <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>}
            {Button && <Button variant="primary" size="sm" onClick={submit}>{editing ? "Save changes" : "Add category"}</Button>}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { BudgetPage });
