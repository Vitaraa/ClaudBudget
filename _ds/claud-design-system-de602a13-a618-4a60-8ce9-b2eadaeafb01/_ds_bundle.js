/* @ds-bundle: {"format":3,"namespace":"ClaudDesignSystem_de602a","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"ProgressBar","sourcePath":"components/display/ProgressBar.jsx"},{"name":"StatValue","sourcePath":"components/display/StatValue.jsx"},{"name":"Chip","sourcePath":"components/forms/Chip.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Segmented","sourcePath":"components/forms/Segmented.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"SideNav","sourcePath":"components/navigation/SideNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"f78386e31f65","components/buttons/Button.jsx":"892ffdbf85a2","components/display/Avatar.jsx":"df5bc266d94c","components/display/Badge.jsx":"82abac8549f2","components/display/Card.jsx":"529bd24e3201","components/display/ProgressBar.jsx":"7faef74b2b90","components/display/StatValue.jsx":"a425bfa5365a","components/forms/Chip.jsx":"bf963eb1a0cf","components/forms/Field.jsx":"4e9c0e5f3b63","components/forms/Input.jsx":"ac72d97fa430","components/forms/Segmented.jsx":"b1781cfbb1bc","components/forms/Select.jsx":"2d64cfd56261","components/navigation/SideNav.jsx":"5ac2dd148f5e","components/navigation/Tabs.jsx":"971d83ed157e","ui_kits/claud-app/app.jsx":"29fcc53c7b18","ui_kits/claud-app/chart.jsx":"48982cbc9dde","ui_kits/claud-app/data.js":"367481e3749c","ui_kits/claud-app/foresight.jsx":"88d36c6a401f","ui_kits/claud-app/screens.jsx":"952683040ddd","ui_kits/claud-app/widgets.jsx":"11fc8363c628"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ClaudDesignSystem_de602a = window.ClaudDesignSystem_de602a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Logo — the Claud lockup: the cloud-and-bars mark beside the wordmark. Pass
 * `src` (a path to one of the mark SVGs). `wordmark={false}` shows the mark
 * alone. `size` scales the mark; the wordmark tracks it.
 */
function Logo({
  src,
  wordmark = true,
  size = 30,
  brand = "Claud",
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["brand", className].filter(Boolean).join(" "),
    style: {
      fontSize: Math.round(size * 0.62) / 16 + "rem"
    }
  }, rest), src && /*#__PURE__*/React.createElement("img", {
    src: src,
    className: "brand-logo",
    style: {
      width: size,
      height: size
    },
    alt: ""
  }), wordmark && /*#__PURE__*/React.createElement("span", null, brand));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — the product's primary action control.
 * Variants map to Claud's three button styles: a solid indigo `primary`, an
 * outlined `ghost`, and an outlined-red `danger`. `link` renders the inline
 * text-button style used for "+ Add" affordances.
 */
function Button({
  variant = "primary",
  size,
  disabled = false,
  children,
  className = "",
  ...rest
}) {
  if (variant === "link") {
    const cls = ["link", size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
    return /*#__PURE__*/React.createElement("button", _extends({
      type: "button",
      className: cls,
      disabled: disabled
    }, rest), children);
  }
  const cls = ["btn", variant, size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    disabled: disabled
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Avatar — a circular indigo initial badge. Pass `name` (first letter is used)
 * or explicit `initial`. `size` overrides the 28px default.
 */
function Avatar({
  name = "",
  initial,
  size,
  className = "",
  ...rest
}) {
  const ch = (initial || name.slice(0, 1) || "?").toUpperCase();
  const style = size ? {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42)
  } : undefined;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["avatar", className].filter(Boolean).join(" "),
    style: style
  }, rest), ch);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — a small status pill. Tones map to the semantic palette:
 * neutral (default), accent, pos (green), neg (red), warn (amber).
 */
function Badge({
  tone = "neutral",
  children,
  className = "",
  ...rest
}) {
  const cls = ["badge", tone === "neutral" ? "" : tone, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — the surface primitive. A bordered, 14px-radius container on the
 * `--card` surface. Use `widget` to get the vertical flex layout the dashboard
 * widgets use (header + body stack with consistent gaps).
 */
function Card({
  as = "section",
  widget = false,
  children,
  className = "",
  ...rest
}) {
  const Tag = as;
  const cls = ["card", widget ? "widget" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/ProgressBar.jsx
try { (() => {
/**
 * ProgressBar — a thin rounded fill bar for goals and budgets. `value`/`max`
 * set the fill width; `tone` colours it (accent default, pos/over for green/red).
 * Auto-clamps to 0–100%.
 */
function ProgressBar({
  value = 0,
  max = 100,
  tone = "accent",
  className = ""
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  const fillTone = tone === "accent" ? "" : tone;
  return /*#__PURE__*/React.createElement("div", {
    className: ["bar", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("div", {
    className: ["bar-fill", fillTone].filter(Boolean).join(" "),
    style: {
      width: `${pct}%`
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/display/StatValue.jsx
try { (() => {
/**
 * StatValue — a labelled metric: a muted caption above a large tight-tracked
 * figure. `tone` colours the value (pos/neg for green/red), `unit` appends a
 * small muted suffix (e.g. "/ mo").
 */
function StatValue({
  label,
  value,
  tone,
  unit,
  className = ""
}) {
  const valueCls = ["widget-value", tone === "pos" ? "pos" : tone === "neg" ? "neg" : ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: ["stat", className].filter(Boolean).join(" ")
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: valueCls
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    className: "muted unit"
  }, " ", unit)));
}
Object.assign(__ds_scope, { StatValue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatValue.jsx", error: String((e && e.message) || e) }); }

// components/forms/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Chip — a pill-shaped filter toggle (e.g. "All", "Income", "Needs review").
 * Set `active` to apply the selected indigo-tinted state.
 */
function Chip({
  active = false,
  children,
  className = "",
  ...rest
}) {
  const cls = ["chip", active ? "chip-on" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Chip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Field — a labelled control wrapper. Stacks a small muted label above any
 * input/select. Matches the `.field` pattern used across Claud's modals.
 */
function Field({
  label,
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: ["field", className].filter(Boolean).join(" ")
  }, rest), label && /*#__PURE__*/React.createElement("span", null, label), children);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — themed text/number input. A thin wrapper over the native element so
 * it inherits the design system's `input` styling; forwards every native prop.
 */
function Input({
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: className
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Segmented.jsx
try { (() => {
/**
 * Segmented — a small two-or-more-option segmented control (e.g. Dark/Light,
 * Cumulative/Accounts). Controlled: pass `value`, `options`, and `onChange`.
 */
function Segmented({
  options = [],
  value,
  onChange,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["seg", className].filter(Boolean).join(" ")
  }, options.map(o => {
    const v = typeof o === "string" ? o : o.value;
    const label = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      type: "button",
      className: `seg-btn ${value === v ? "seg-on" : ""}`,
      onClick: () => onChange && onChange(v)
    }, label);
  }));
}
Object.assign(__ds_scope, { Segmented });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Segmented.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Select — themed dropdown. Pass `options` as strings or {value,label}, or
 * provide your own <option> children.
 */
function Select({
  options,
  children,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    className: className
  }, rest), options ? options.map(o => {
    const value = typeof o === "string" ? o : o.value;
    const label = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: value,
      value: value
    }, label);
  }) : children);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SideNav.jsx
try { (() => {
/**
 * SideNav — Claud's left navigation rail: brand mark + wordmark, a vertical
 * list of text-only tabs (active = solid indigo), and a user button pinned to
 * the bottom. Controlled via `value` + `onChange`.
 */
function SideNav({
  items = [],
  value,
  onChange,
  brand = "Claud",
  logoSrc,
  user = "User",
  className = ""
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: ["sidebar", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("div", {
    className: "side-brand"
  }, logoSrc && /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    className: "brand-logo",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    className: "side-brandname"
  }, brand)), /*#__PURE__*/React.createElement("nav", {
    className: "side-nav"
  }, items.map(it => {
    const key = typeof it === "string" ? it : it.value;
    const label = typeof it === "string" ? it : it.label;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      className: `side-tab ${value === key ? "side-on" : ""}`,
      onClick: () => onChange && onChange(key)
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    className: "side-user"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "user-btn"
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: user
  }), /*#__PURE__*/React.createElement("span", {
    className: "user-name"
  }, user), /*#__PURE__*/React.createElement("span", {
    className: "user-caret"
  }, "\u25BE"))));
}
Object.assign(__ds_scope, { SideNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SideNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Tabs — the underline tab bar (used inside pages like Transactions:
 * Overview / Transactions). Controlled via `value` + `onChange`.
 */
function Tabs({
  items = [],
  value,
  onChange,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["tabs", className].filter(Boolean).join(" ")
  }, items.map(it => {
    const key = typeof it === "string" ? it : it.value;
    const label = typeof it === "string" ? it : it.label;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      className: `tab ${value === key ? "tab-on" : ""}`,
      onClick: () => onChange && onChange(key)
    }, label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/app.jsx
try { (() => {
/* Claud UI kit — app shell, routing, theme, dashboard composition. */
(function () {
  const {
    useState,
    useEffect,
    useRef
  } = React;
  const {
    fmt2,
    CLAUD
  } = window;
  const {
    fmt
  } = window.CLAUD;
  const CW = window.CW;
  const SCREENS = window.SCREENS;
  const ForesightScreen = window.ForesightScreen;
  const TABS = [["dashboard", "Dashboard"], ["accounts", "Accounts"], ["transactions", "Transactions"], ["cashflow", "Cash Flow"], ["budget", "Budget"], ["investments", "Investments"], ["foresight", "Foresight"]];
  const WIDGETS = [{
    key: "networth",
    label: "Net worth"
  }, {
    key: "spending",
    label: "Spending"
  }, {
    key: "investments",
    label: "Investments"
  }, {
    key: "goals",
    label: "Savings goals"
  }, {
    key: "subscriptions",
    label: "Recurring"
  }, {
    key: "insights",
    label: "Insights"
  }, {
    key: "recent",
    label: "Recent"
  }];
  function MonthCash() {
    const income = 6400,
      expense = 3460;
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "This month")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted",
      style: {
        fontSize: "0.85rem"
      }
    }, "Income"), /*#__PURE__*/React.createElement("span", {
      className: "pos",
      style: {
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums"
      }
    }, "+", window.CLAUD.fmt2(income))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted",
      style: {
        fontSize: "0.85rem"
      }
    }, "Expenses"), /*#__PURE__*/React.createElement("span", {
      className: "neg",
      style: {
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums"
      }
    }, "\u2212", window.CLAUD.fmt2(expense))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderTop: "1px solid var(--border)",
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, "Net saved"), /*#__PURE__*/React.createElement("span", {
      className: "pos",
      style: {
        fontWeight: 700,
        fontSize: "1.1rem",
        fontVariantNumeric: "tabular-nums"
      }
    }, "+", window.CLAUD.fmt2(income - expense)))));
  }
  function Dashboard() {
    const [vis, setVis] = useState(() => Object.fromEntries(WIDGETS.map(w => [w.key, true])));
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const onClick = e => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      window.addEventListener("mousedown", onClick);
      return () => window.removeEventListener("mousedown", onClick);
    }, [open]);
    const comp = {
      networth: CW.NetWorthWidget,
      spending: CW.SpendingWidget,
      investments: CW.InvestmentsWidget,
      goals: CW.GoalsWidget,
      subscriptions: CW.SubscriptionsWidget,
      insights: CW.InsightsWidget,
      recent: CW.RecentWidget
    };
    const large = ["networth", "spending"].filter(k => vis[k]);
    const medium = ["investments", "goals", "subscriptions", "insights", "recent"].filter(k => vis[k]);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: -8
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "customize",
      ref: ref
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setOpen(o => !o)
    }, "Customize"), open && /*#__PURE__*/React.createElement("div", {
      className: "customize-menu"
    }, /*#__PURE__*/React.createElement("span", {
      className: "customize-title muted"
    }, "Show widgets"), WIDGETS.map(w => /*#__PURE__*/React.createElement("label", {
      key: w.key,
      className: "customize-item"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!vis[w.key],
      onChange: () => setVis(v => ({
        ...v,
        [w.key]: !v[w.key]
      }))
    }), /*#__PURE__*/React.createElement("span", null, w.label)))))), large.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "dash-grid dash-large"
    }, large.map(k => {
      const C = comp[k];
      return /*#__PURE__*/React.createElement(C, {
        key: k
      });
    })), medium.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "dash-grid dash-medium"
    }, medium.map(k => {
      const C = comp[k];
      return /*#__PURE__*/React.createElement(C, {
        key: k
      });
    }), /*#__PURE__*/React.createElement(MonthCash, null)));
  }
  function Placeholder({
    title
  }) {
    return /*#__PURE__*/React.createElement("section", {
      className: "card empty",
      style: {
        textAlign: "center",
        padding: "48px 20px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "muted",
      style: {
        margin: 0
      }
    }, title, " is part of the full Claud app. This UI-kit demo focuses on the Dashboard, Accounts, Transactions, Budget and Foresight screens."));
  }
  function App() {
    const [user, setUser] = useState(null);
    const [tab, setTab] = useState("dashboard");
    const [theme, setTheme] = useState("dark");
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
      document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);
    useEffect(() => {
      if (!menuOpen) return;
      const onClick = e => {
        if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      };
      window.addEventListener("mousedown", onClick);
      return () => window.removeEventListener("mousedown", onClick);
    }, [menuOpen]);
    if (!user) return /*#__PURE__*/React.createElement(SCREENS.Login, {
      onLogin: setUser
    });
    const current = TABS.find(([k]) => k === tab);
    const title = tab === "dashboard" ? `Welcome back, ${user}` : current ? current[1] : "Claud";
    const body = {
      dashboard: /*#__PURE__*/React.createElement(Dashboard, null),
      accounts: /*#__PURE__*/React.createElement(SCREENS.Accounts, null),
      transactions: /*#__PURE__*/React.createElement(SCREENS.Transactions, null),
      budget: /*#__PURE__*/React.createElement(SCREENS.Budget, null),
      foresight: /*#__PURE__*/React.createElement(ForesightScreen, null),
      cashflow: /*#__PURE__*/React.createElement(Placeholder, {
        title: "Cash Flow"
      }),
      investments: /*#__PURE__*/React.createElement(Placeholder, {
        title: "Investments"
      })
    }[tab];
    return /*#__PURE__*/React.createElement("div", {
      className: "app-shell"
    }, /*#__PURE__*/React.createElement("aside", {
      className: "sidebar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "side-brand"
    }, /*#__PURE__*/React.createElement("img", {
      src: `../../assets/claud-mark-${theme === "dark" ? "white" : "color"}.svg`,
      className: "brand-logo",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", {
      className: "side-brandname"
    }, "Claud")), /*#__PURE__*/React.createElement("nav", {
      className: "side-nav"
    }, TABS.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      className: `side-tab ${tab === k ? "side-on" : ""}`,
      onClick: () => setTab(k)
    }, l))), /*#__PURE__*/React.createElement("div", {
      className: "side-user",
      ref: menuRef
    }, menuOpen && /*#__PURE__*/React.createElement("div", {
      className: "user-menu"
    }, /*#__PURE__*/React.createElement("button", {
      className: "user-menu-item",
      onClick: () => {
        setTheme(theme === "dark" ? "light" : "dark");
      }
    }, theme === "dark" ? "Light mode" : "Dark mode"), /*#__PURE__*/React.createElement("button", {
      className: "user-menu-item"
    }, "Settings"), /*#__PURE__*/React.createElement("button", {
      className: "user-menu-item danger",
      onClick: () => setUser(null)
    }, "Sign out")), /*#__PURE__*/React.createElement("button", {
      className: "user-btn",
      onClick: () => setMenuOpen(v => !v)
    }, /*#__PURE__*/React.createElement("span", {
      className: "avatar"
    }, user.slice(0, 1).toUpperCase()), /*#__PURE__*/React.createElement("span", {
      className: "user-name"
    }, user), /*#__PURE__*/React.createElement("span", {
      className: "user-caret"
    }, "\u25BE")))), /*#__PURE__*/React.createElement("main", {
      className: "main"
    }, /*#__PURE__*/React.createElement("header", {
      className: "page-head"
    }, /*#__PURE__*/React.createElement("h1", null, title), /*#__PURE__*/React.createElement("div", {
      className: "page-actions"
    }, tab === "foresight" && /*#__PURE__*/React.createElement("button", {
      className: "btn primary sm"
    }, "+ New plan \u25BE"))), body));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/chart.jsx
try { (() => {
/* Claud UI kit — a small, dependency-free SVG line chart. window.LineChart. */
(function () {
  const {
    useRef,
    useState,
    useLayoutEffect
  } = React;
  function useWidth() {
    const ref = useRef(null);
    const [w, setW] = useState(560);
    useLayoutEffect(() => {
      if (!ref.current) return;
      const ro = new ResizeObserver(entries => {
        const cw = entries[0].contentRect.width;
        if (cw > 0) setW(cw);
      });
      ro.observe(ref.current);
      return () => ro.disconnect();
    }, []);
    return [ref, w];
  }

  // series: [{ key, color, dashed?, width? }]
  // data:   [{ x, label, [key]: value }]
  function LineChart({
    data,
    series,
    height = 240,
    yFmt = n => n,
    padL = 52,
    padR = 12,
    padT = 14,
    padB = 22,
    zeroSplit = false,
    // colour green above 0 / red below
    markers = [],
    // [{ x, y, color, glyph, onClick }]
    onDotDrag,
    // (clientXRatio) hook (unused placeholder)
    xTicks,
    // optional explicit array of x values for labels
    numericX = false // x is a number (year) vs index/label
  }) {
    const [ref, W] = useWidth();
    const H = height;
    const innerW = Math.max(10, W - padL - padR);
    const innerH = H - padT - padB;
    const xs = data.map((d, i) => numericX ? d.x : i);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const xSpan = xMax - xMin || 1;
    const allVals = [];
    for (const s of series) for (const d of data) if (d[s.key] != null) allVals.push(d[s.key]);
    let yMax = Math.max(...allVals, 0);
    let yMin = zeroSplit ? Math.min(...allVals, 0) : Math.min(...allVals);
    if (!zeroSplit) yMin = Math.min(yMin, yMax * 0.85); // headroom for non-zero baselines
    const ySpan = yMax - yMin || 1;
    const px = x => padL + (x - xMin) / xSpan * innerW;
    const py = y => padT + (1 - (y - yMin) / ySpan) * innerH;
    const linePath = key => {
      let d = "";
      data.forEach((row, i) => {
        if (row[key] == null) return;
        const X = px(numericX ? row.x : i);
        const Y = py(row[key]);
        d += (d ? " L" : "M") + X.toFixed(1) + " " + Y.toFixed(1);
      });
      return d;
    };

    // y grid ticks (4)
    const ticks = [];
    for (let t = 0; t <= 4; t++) {
      const v = yMin + ySpan * t / 4;
      ticks.push({
        v,
        y: py(v)
      });
    }
    // x labels
    const xLabels = numericX ? xTicks || data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map(d => d.x) : data.map(d => d.label);
    const zeroY = py(0);
    const gradOffset = yMax <= 0 ? 0 : yMin >= 0 ? 1 : yMax / (yMax - yMin);
    const gid = "g" + Math.random().toString(36).slice(2, 8);
    return /*#__PURE__*/React.createElement("div", {
      ref: ref,
      style: {
        width: "100%"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      className: "chart",
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`
    }, zeroSplit && /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: gid,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: gradOffset,
      stopColor: "var(--green)"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: gradOffset,
      stopColor: "var(--red)"
    }))), ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      className: "chart-grid",
      x1: padL,
      y1: t.y,
      x2: W - padR,
      y2: t.y
    }), /*#__PURE__*/React.createElement("text", {
      className: "chart-axis",
      x: padL - 8,
      y: t.y + 3,
      textAnchor: "end"
    }, yFmt(Math.round(t.v))))), zeroSplit && yMin < 0 && /*#__PURE__*/React.createElement("line", {
      className: "chart-zero",
      x1: padL,
      y1: zeroY,
      x2: W - padR,
      y2: zeroY
    }), numericX ? xLabels.map((xv, i) => /*#__PURE__*/React.createElement("text", {
      key: i,
      className: "chart-axis",
      x: px(xv),
      y: H - 6,
      textAnchor: "middle"
    }, xv)) : data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && /*#__PURE__*/React.createElement("text", {
      key: i,
      className: "chart-axis",
      x: px(i),
      y: H - 6,
      textAnchor: "middle"
    }, d.label)), series.map((s, i) => /*#__PURE__*/React.createElement("path", {
      key: i,
      d: linePath(s.key),
      fill: "none",
      stroke: zeroSplit && s.key === series[0].key ? `url(#${gid})` : s.color,
      strokeWidth: s.width || 2.5,
      strokeDasharray: s.dashed ? "5 4" : undefined,
      strokeLinejoin: "round",
      strokeLinecap: "round"
    })), markers.map((m, i) => /*#__PURE__*/React.createElement("g", {
      key: i,
      className: "chart-dot",
      onClick: m.onClick
    }, /*#__PURE__*/React.createElement("circle", {
      cx: px(m.x),
      cy: py(m.y),
      r: "12",
      fill: "var(--card)",
      stroke: m.color,
      strokeWidth: "2.5"
    }), /*#__PURE__*/React.createElement("text", {
      x: px(m.x),
      y: py(m.y),
      textAnchor: "middle",
      dominantBaseline: "central",
      fontSize: "13",
      style: {
        pointerEvents: "none"
      }
    }, m.glyph)))));
  }
  window.LineChart = LineChart;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/chart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/data.js
try { (() => {
/* Claud UI kit — demo data. Plain globals (window.*), no modules. */
(function () {
  const fmt = n => Number(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  const fmt2 = n => Number(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD"
  });

  // ---- Accounts ----
  const accounts = [{
    name: "Everyday Chequing",
    type: "Chequing",
    balance: 4820,
    kind: "asset"
  }, {
    name: "High-Interest Savings",
    type: "Savings",
    balance: 18400,
    kind: "asset"
  }, {
    name: "TFSA · Wealthsimple",
    type: "Investment",
    balance: 62300,
    kind: "asset"
  }, {
    name: "Home",
    type: "Real estate",
    balance: 480000,
    kind: "asset"
  }, {
    name: "Rewards Visa",
    type: "Credit card",
    balance: -1240,
    kind: "liability"
  }, {
    name: "Mortgage",
    type: "Mortgage",
    balance: -309800,
    kind: "liability"
  }];
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  // ---- 12-month net-worth series ----
  const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const nwSeries = MONTHS.map((m, i) => ({
    label: m,
    value: Math.round(232000 + i * 1850 + Math.sin(i / 1.7) * 1400)
  }));
  nwSeries[nwSeries.length - 1].value = netWorth;

  // ---- Spending series (per month) ----
  const spendSeries = MONTHS.map((m, i) => ({
    label: m,
    value: Math.round(2900 + Math.sin(i / 1.2) * 520 + (i === 5 ? 900 : 0) + (i === 11 ? 360 : 0))
  }));

  // ---- Investments vs S&P ----
  const investSeries = MONTHS.map((m, i) => ({
    label: m,
    value: Math.round(54000 + i * 700 + Math.sin(i / 1.4) * 1600),
    spx: Math.round(54000 + i * 540 + Math.sin(i / 1.1) * 1200)
  }));
  const investValue = investSeries[investSeries.length - 1].value;
  const investCost = 56000;

  // ---- Recent transactions ----
  const txns = [{
    id: 1,
    desc: "Payroll · Northwind Co",
    category: "Salary",
    date: "06-12",
    amount: 4200,
    type: "income"
  }, {
    id: 2,
    desc: "Whole Foods Market",
    category: "Groceries",
    date: "06-11",
    amount: 128.4,
    type: "expense"
  }, {
    id: 3,
    desc: "Shell",
    category: "Transport",
    date: "06-10",
    amount: 64.2,
    type: "expense"
  }, {
    id: 4,
    desc: "Netflix",
    category: "Subscriptions",
    date: "06-09",
    amount: 9.99,
    type: "expense"
  }, {
    id: 5,
    desc: "Hydro One",
    category: "Utilities",
    date: "06-08",
    amount: 142.6,
    type: "expense",
    review: true
  }, {
    id: 6,
    desc: "Transfer to Savings",
    category: "Transfer",
    date: "06-07",
    amount: 1000,
    type: "expense"
  }, {
    id: 7,
    desc: "Tim Hortons",
    category: "Dining",
    date: "06-06",
    amount: 6.85,
    type: "expense"
  }, {
    id: 8,
    desc: "Amazon.ca",
    category: "Shopping",
    date: "06-05",
    amount: 54.3,
    type: "expense"
  }];

  // ---- Savings goals ----
  const goals = [{
    id: 1,
    name: "Emergency fund",
    target: 10000,
    saved: 6800
  }, {
    id: 2,
    name: "Japan trip",
    target: 5000,
    saved: 2400
  }, {
    id: 3,
    name: "New laptop",
    target: 2000,
    saved: 2000
  }];

  // ---- Subscriptions ----
  const subs = [{
    id: 1,
    name: "Netflix",
    amount: 9.99,
    cadence: "monthly",
    source: "auto"
  }, {
    id: 2,
    name: "Spotify",
    amount: 11.99,
    cadence: "monthly",
    source: "manual"
  }, {
    id: 3,
    name: "iCloud+",
    amount: 2.99,
    cadence: "monthly",
    source: "auto"
  }, {
    id: 4,
    name: "Adobe CC",
    amount: 22.99,
    cadence: "monthly",
    source: "manual"
  }, {
    id: 5,
    name: "Amazon Prime",
    amount: 139,
    cadence: "annual",
    source: "auto"
  }];

  // ---- Insights ----
  const insights = [{
    severity: "warn",
    text: "Hydro One charge of $142.60 is 2.3× your usual utilities spend."
  }, {
    severity: "good",
    text: "Dining is down 18% vs last month — nice."
  }, {
    severity: "info",
    text: "5 recurring charges detected · ~$612/yr."
  }, {
    severity: "info",
    text: "1 transaction still needs a category."
  }];

  // ---- Budget categories ----
  const budgets = [{
    category: "Groceries",
    amount: 700,
    spent: 612,
    type: "expense"
  }, {
    category: "Dining",
    amount: 250,
    spent: 188,
    type: "expense"
  }, {
    category: "Transport",
    amount: 200,
    spent: 232,
    type: "expense"
  }, {
    category: "Subscriptions",
    amount: 60,
    spent: 48,
    type: "expense"
  }, {
    category: "Utilities",
    amount: 220,
    spent: 264,
    type: "expense"
  }];
  window.CLAUD = {
    fmt,
    fmt2,
    accounts,
    netWorth,
    nwSeries,
    spendSeries,
    investSeries,
    investValue,
    investCost,
    txns,
    goals,
    subs,
    insights,
    budgets,
    MONTHS
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/foresight.jsx
try { (() => {
/* Claud UI kit — Foresight: net-worth projection + editable projected budget. window.ForesightScreen */
(function () {
  const {
    useState,
    useMemo
  } = React;
  const {
    fmt,
    netWorth
  } = window.CLAUD;
  const LineChart = window.LineChart;
  const CUR = 2026;
  const END = 2056;
  const RATE = 0.06;
  const years = [];
  for (let y = CUR; y <= END; y++) years.push(y);
  const PLAN_ICON = {
    retirement: "🏖️",
    house: "🏠",
    job: "💼",
    kids: "👶"
  };
  const plans = [{
    id: "job",
    kind: "job",
    name: "New job",
    year: 2027,
    amount: 95000
  }, {
    id: "house",
    kind: "house",
    name: "Buy a home",
    year: 2029,
    amount: 520000
  }, {
    id: "kids",
    kind: "kids",
    name: "Child",
    year: 2031,
    end: 2050,
    amount: 13000
  }, {
    id: "retire",
    kind: "retirement",
    name: "Retirement",
    year: 2054,
    amount: 1000000
  }];
  const incomeCats = [{
    category: "Salary",
    monthly: 5800
  }, {
    category: "Side income",
    monthly: 600
  }];
  const expenseCats = [{
    category: "Housing",
    monthly: 1850
  }, {
    category: "Groceries",
    monthly: 650
  }, {
    category: "Transport",
    monthly: 320
  }, {
    category: "Lifestyle",
    monthly: 540
  }, {
    category: "Insurance",
    monthly: 180
  }];
  const afterTax = gross => Math.round(gross * 0.72);
  function mortgageAnnual(principal, ratePct, term) {
    const r = ratePct / 100 / 12;
    const n = term * 12;
    const m = principal * r / (1 - Math.pow(1 + r, -n));
    return Math.round(m * 12);
  }
  function ForesightScreen() {
    // overrides: { "cat|year": annual$ } for editable (non-locked) cells
    const [overrides, setOverrides] = useState({});
    const setOverride = (cat, year, val) => setOverrides(o => ({
      ...o,
      [cat + "|" + year]: Math.max(0, Math.round(Number(val) || 0))
    }));
    const job = plans.find(p => p.kind === "job");
    const house = plans.find(p => p.kind === "house");
    const kid = plans.find(p => p.kind === "kids");
    const retire = plans.find(p => p.kind === "retirement");
    const mortgage = mortgageAnnual(house.amount * 0.8, 5.5, 25);
    const model = useMemo(() => {
      const eff = (cat, baseAnnual, y) => {
        const k = cat + "|" + y;
        return overrides[k] != null ? overrides[k] : baseAnnual;
      };
      const incomeRows = incomeCats.map(b => {
        const base = b.monthly * 12;
        const cells = years.map(y => {
          if (b.category === "Salary") {
            if (y > retire.year) return {
              y,
              value: 0,
              locked: true
            };
            if (y >= job.year) return {
              y,
              value: afterTax(job.amount),
              locked: true
            };
          }
          return {
            y,
            value: Math.round(eff(b.category, base, y)),
            locked: false
          };
        });
        return {
          category: b.category,
          cells
        };
      });
      const expenseRows = expenseCats.map(b => {
        const base = b.monthly * 12;
        const cells = years.map(y => {
          if (b.category === "Housing" && y >= house.year && y < house.year + 25) {
            return {
              y,
              value: mortgage,
              locked: true
            };
          }
          return {
            y,
            value: Math.round(eff(b.category, base, y)),
            locked: false
          };
        });
        return {
          category: b.category,
          cells
        };
      });
      // Children row (locked, plan-driven)
      expenseRows.push({
        category: "Children",
        cells: years.map(y => ({
          y,
          value: y >= kid.year && y <= kid.end ? kid.amount : 0,
          locked: true
        }))
      });
      const totals = years.map((y, i) => {
        const income = incomeRows.reduce((s, r) => s + r.cells[i].value, 0);
        const expense = expenseRows.reduce((s, r) => s + r.cells[i].value, 0);
        return {
          y,
          income,
          expense,
          net: income - expense
        };
      });

      // Net-worth line
      let bal = netWorth;
      const line = [];
      totals.forEach((t, i) => {
        if (i > 0) bal = bal * (1 + RATE) + t.net;
        line.push({
          x: t.y,
          value: Math.round(bal)
        });
      });
      const valueAt = yr => (line.find(p => p.x === yr) || line[line.length - 1]).value;
      const markers = plans.map(p => ({
        x: p.year,
        y: valueAt(p.year),
        color: p.kind === "retirement" ? "var(--green)" : "var(--accent)",
        glyph: PLAN_ICON[p.kind]
      }));
      return {
        incomeRows,
        expenseRows,
        totals,
        line,
        valueAt,
        latest: line[line.length - 1].value,
        markers
      };
    }, [overrides]);
    const statusFor = p => {
      if (p.kind === "retirement") return `retire ${p.year} with ${fmt(model.valueAt(p.year))} saved, then $4,000/mo — lasts through ${END}`;
      if (p.kind === "house") return `buy ${fmt(p.amount)} home in ${p.year}`;
      if (p.kind === "job") return `new job ${fmt(p.amount)}/yr from ${p.year}`;
      if (p.kind === "kids") return `child ${p.year}–${p.end}, ${fmt(p.amount)}/yr`;
      return "";
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "foresight-tab"
    }, /*#__PURE__*/React.createElement("section", {
      className: "card chart-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Net worth with all plans \xB7 projected"), /*#__PURE__*/React.createElement("div", {
      className: "widget-value"
    }, fmt(model.latest), /*#__PURE__*/React.createElement("span", {
      className: "muted unit"
    }, " by ", END)), /*#__PURE__*/React.createElement("span", {
      className: "muted drag-hint"
    }, "Drag a dot left/right to change its year \xB7 click it to edit"))), /*#__PURE__*/React.createElement(LineChart, {
      data: model.line,
      height: 300,
      numericX: true,
      zeroSplit: true,
      series: [{
        key: "value",
        color: "var(--accent)",
        width: 2.5
      }],
      yFmt: n => fmt(n),
      markers: model.markers,
      xTicks: [2026, 2031, 2036, 2041, 2046, 2051, 2056]
    }), /*#__PURE__*/React.createElement("ul", {
      className: "foresight-legend"
    }, plans.map(p => /*#__PURE__*/React.createElement("li", {
      key: p.id,
      className: "legend-clickable"
    }, /*#__PURE__*/React.createElement("span", {
      className: "legend-ico"
    }, PLAN_ICON[p.kind]), /*#__PURE__*/React.createElement("strong", null, p.name), /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, " \u2014 ", statusFor(p)))))), /*#__PURE__*/React.createElement("section", {
      className: "card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Projected budget by year"), /*#__PURE__*/React.createElement("span", {
      className: "muted drag-hint"
    }, "Annual $. Tweak any cell to rebalance; \uD83D\uDD12 cells are set by a plan. Over-budget years are red."))), /*#__PURE__*/React.createElement("div", {
      className: "budget-proj-wrap"
    }, /*#__PURE__*/React.createElement("table", {
      className: "budget-proj-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
      className: "bt-row-head"
    }, "Category"), model.totals.map(t => /*#__PURE__*/React.createElement("th", {
      key: t.y,
      className: `right ${t.net < 0 ? "neg" : ""}`
    }, t.y)))), /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
      className: "bt-section"
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, "Income"), years.map(y => /*#__PURE__*/React.createElement("td", {
      key: y
    }))), model.incomeRows.map(row => /*#__PURE__*/React.createElement("tr", {
      key: "i" + row.category
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, row.category), row.cells.map(c => /*#__PURE__*/React.createElement("td", {
      key: c.y,
      className: "right"
    }, c.locked ? /*#__PURE__*/React.createElement("span", {
      className: "bt-locked",
      title: "Set by a plan"
    }, fmt(c.value), " \uD83D\uDD12") : /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "bt-input",
      defaultValue: c.value,
      key: row.category + c.y + c.value,
      onBlur: e => setOverride(row.category, c.y, e.target.value)
    }))))), /*#__PURE__*/React.createElement("tr", {
      className: "bt-subtotal"
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, "Total income"), model.totals.map(t => /*#__PURE__*/React.createElement("td", {
      key: t.y,
      className: "right"
    }, fmt(t.income)))), /*#__PURE__*/React.createElement("tr", {
      className: "bt-section"
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, "Expense"), years.map(y => /*#__PURE__*/React.createElement("td", {
      key: y
    }))), model.expenseRows.map(row => /*#__PURE__*/React.createElement("tr", {
      key: "e" + row.category
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, row.category), row.cells.map(c => /*#__PURE__*/React.createElement("td", {
      key: c.y,
      className: "right"
    }, c.locked ? /*#__PURE__*/React.createElement("span", {
      className: "bt-locked",
      title: "Set by a plan"
    }, fmt(c.value), " \uD83D\uDD12") : /*#__PURE__*/React.createElement("input", {
      type: "number",
      className: "bt-input",
      defaultValue: c.value,
      key: row.category + c.y + c.value,
      onBlur: e => setOverride(row.category, c.y, e.target.value)
    }))))), /*#__PURE__*/React.createElement("tr", {
      className: "bt-subtotal"
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, "Total expense"), model.totals.map(t => /*#__PURE__*/React.createElement("td", {
      key: t.y,
      className: "right"
    }, fmt(t.expense)))), /*#__PURE__*/React.createElement("tr", {
      className: "bt-net"
    }, /*#__PURE__*/React.createElement("td", {
      className: "bt-row-head"
    }, "Net / yr"), model.totals.map(t => /*#__PURE__*/React.createElement("td", {
      key: t.y,
      className: `right ${t.net < 0 ? "neg" : "pos"}`
    }, fmt(t.net)))))))));
  }
  window.ForesightScreen = ForesightScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/foresight.jsx", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/screens.jsx
try { (() => {
/* Claud UI kit — Login, Accounts, Transactions, Budget. window.SCREENS */
(function () {
  const {
    useState
  } = React;
  const {
    fmt,
    fmt2,
    accounts,
    netWorth,
    txns,
    budgets
  } = window.CLAUD;
  function Login({
    onLogin
  }) {
    const [view, setView] = useState("login");
    const [username, setUsername] = useState("avery");
    const [password, setPassword] = useState("••••••••");
    return /*#__PURE__*/React.createElement("div", {
      className: "auth-wrap"
    }, /*#__PURE__*/React.createElement("form", {
      className: "card auth-card",
      onSubmit: e => {
        e.preventDefault();
        onLogin(username || "avery");
      }
    }, /*#__PURE__*/React.createElement("h1", {
      className: "brand brand-center"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/claud-mark-white.svg",
      className: "brand-logo",
      alt: ""
    }), "Claud"), /*#__PURE__*/React.createElement("p", {
      className: "muted",
      style: {
        textAlign: "center"
      }
    }, view === "login" ? "Sign in to your account" : "Create an account"), /*#__PURE__*/React.createElement("div", {
      className: "auth-form"
    }, /*#__PURE__*/React.createElement("label", null, "Username"), /*#__PURE__*/React.createElement("input", {
      value: username,
      onChange: e => setUsername(e.target.value),
      autoComplete: "username"
    }), view === "register" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", null, "Email"), /*#__PURE__*/React.createElement("input", {
      type: "email",
      placeholder: "you@email.com"
    })), /*#__PURE__*/React.createElement("label", null, "Password"), /*#__PURE__*/React.createElement("input", {
      type: "password",
      value: password,
      onChange: e => setPassword(e.target.value)
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn primary"
    }, view === "login" ? "Sign in" : "Create account"), view === "login" && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "link"
    }, "Forgot password?"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "link",
      onClick: () => setView(view === "login" ? "register" : "login")
    }, view === "login" ? "Need an account? Register" : "Already have an account? Sign in"))));
  }
  function Badge2({
    children
  }) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "var(--input-bg)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.7rem",
        fontWeight: 800,
        color: "var(--muted)",
        flexShrink: 0
      }
    }, children);
  }
  function AcctList({
    title,
    items
  }) {
    const total = items.reduce((s, a) => s + Math.abs(a.balance), 0);
    return /*#__PURE__*/React.createElement("section", {
      className: "card",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        fontSize: "1rem"
      }
    }, title), /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, fmt2(total))), items.map((a, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "grid",
        gridTemplateColumns: "38px 1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "9px 0",
        borderTop: i ? "1px solid var(--border)" : "none"
      }
    }, /*#__PURE__*/React.createElement(Badge2, null, a.name.split(" ").map(w => w[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: "0.9rem"
      }
    }, a.name), /*#__PURE__*/React.createElement("div", {
      className: "muted",
      style: {
        fontSize: "0.76rem"
      }
    }, a.type)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        fontSize: "0.9rem"
      },
      className: a.balance < 0 ? "neg" : ""
    }, fmt2(a.balance)))));
  }
  function Accounts() {
    const assets = accounts.filter(a => a.kind === "asset");
    const liabilities = accounts.filter(a => a.kind === "liability");
    const assetTotal = assets.reduce((s, a) => s + a.balance, 0);
    const liabTotal = liabilities.reduce((s, a) => s + a.balance, 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("section", {
      className: "card",
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Net worth"), /*#__PURE__*/React.createElement("strong", {
      style: {
        fontSize: "1.6rem",
        fontWeight: 700,
        letterSpacing: "-0.02em"
      },
      className: "pos"
    }, fmt2(netWorth))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(AcctList, {
      title: "Assets",
      items: assets
    }), /*#__PURE__*/React.createElement(AcctList, {
      title: "Liabilities",
      items: liabilities
    })));
  }
  function Transactions() {
    const [filter, setFilter] = useState("all");
    const shown = txns.filter(t => filter === "all" ? true : filter === "income" ? t.type === "income" : filter === "expense" ? t.type === "expense" : t.review);
    return /*#__PURE__*/React.createElement("section", {
      className: "card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tx-toolbar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tx-filters"
    }, [["all", "All"], ["income", "Income"], ["expense", "Expense"], ["review", "Needs review"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      className: `chip ${filter === k ? "chip-on" : ""}`,
      onClick: () => setFilter(k)
    }, l))), /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm"
    }, "Import statement")), /*#__PURE__*/React.createElement("table", {
      className: "tx-table"
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Description"), /*#__PURE__*/React.createElement("th", null, "Category"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", {
      className: "right"
    }, "Amount"))), /*#__PURE__*/React.createElement("tbody", null, shown.map(t => /*#__PURE__*/React.createElement("tr", {
      key: t.id,
      className: t.review ? "row-review" : ""
    }, /*#__PURE__*/React.createElement("td", null, t.review && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--warn)"
      }
    }, "\u26A0 "), t.desc), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "cat-pill"
    }, t.category)), /*#__PURE__*/React.createElement("td", {
      className: "nowrap muted"
    }, "2026-", t.date), /*#__PURE__*/React.createElement("td", {
      className: `right nowrap ${t.type === "income" ? "pos" : "neg"}`
    }, t.type === "income" ? "+" : "−", fmt2(t.amount)))))));
  }
  function Budget() {
    const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    return /*#__PURE__*/React.createElement("section", {
      className: "card budget-tab"
    }, /*#__PURE__*/React.createElement("p", {
      className: "muted",
      style: {
        margin: 0
      }
    }, fmt2(totalSpent), " of ", fmt2(totalBudget), " budgeted this month \xB7 ", fmt2(totalBudget - totalSpent), " left"), /*#__PURE__*/React.createElement("ul", {
      className: "budget-list"
    }, budgets.map(b => {
      const pct = Math.min(100, b.spent / b.amount * 100);
      const over = b.spent > b.amount;
      return /*#__PURE__*/React.createElement("li", {
        key: b.category,
        className: "budget-row"
      }, /*#__PURE__*/React.createElement("span", {
        className: "budget-cat"
      }, b.category), /*#__PURE__*/React.createElement("div", {
        className: "bar"
      }, /*#__PURE__*/React.createElement("div", {
        className: `bar-fill ${over ? "over" : ""}`,
        style: {
          width: pct + "%"
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "budget-amount"
      }, /*#__PURE__*/React.createElement("span", {
        className: `budget-spent ${over ? "neg" : "muted"}`
      }, fmt2(b.spent), " / ", fmt2(b.amount))));
    })));
  }
  window.SCREENS = {
    Login,
    Accounts,
    Transactions,
    Budget
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/claud-app/widgets.jsx
try { (() => {
/* Claud UI kit — dashboard widgets. window.CW */
(function () {
  const {
    useState
  } = React;
  const {
    fmt,
    fmt2,
    nwSeries,
    spendSeries,
    investSeries,
    investValue,
    investCost,
    goals,
    subs,
    insights,
    txns,
    netWorth
  } = window.CLAUD;
  const LineChart = window.LineChart;
  function Gran({
    value,
    onChange
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "gran-tabs"
    }, ["D", "W", "M", "Y"].map(g => /*#__PURE__*/React.createElement("button", {
      key: g,
      className: `gran-tab ${value === g ? "gran-on" : ""}`,
      onClick: () => onChange(g)
    }, g)));
  }
  function NetWorthWidget() {
    const [mode, setMode] = useState("transactions");
    const [gran, setGran] = useState("M");
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Net worth"), /*#__PURE__*/React.createElement("div", {
      className: "widget-value pos"
    }, fmt2(netWorth))), /*#__PURE__*/React.createElement("div", {
      className: "widget-controls"
    }, /*#__PURE__*/React.createElement("div", {
      className: "seg"
    }, /*#__PURE__*/React.createElement("button", {
      className: `seg-btn ${mode === "transactions" ? "seg-on" : ""}`,
      onClick: () => setMode("transactions")
    }, "Cumulative"), /*#__PURE__*/React.createElement("button", {
      className: `seg-btn ${mode === "accounts" ? "seg-on" : ""}`,
      onClick: () => setMode("accounts")
    }, "Accounts")), /*#__PURE__*/React.createElement(Gran, {
      value: gran,
      onChange: setGran
    }))), /*#__PURE__*/React.createElement(LineChart, {
      data: nwSeries,
      height: 236,
      series: [{
        key: "value",
        color: "var(--accent)",
        width: 2
      }],
      yFmt: n => fmt(n)
    }));
  }
  function SpendingWidget() {
    const [gran, setGran] = useState("M");
    const avg = Math.round(spendSeries.reduce((s, p) => s + p.value, 0) / spendSeries.length);
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Spending"), /*#__PURE__*/React.createElement("div", {
      className: "widget-value neg"
    }, fmt2(avg), /*#__PURE__*/React.createElement("span", {
      className: "muted unit"
    }, " avg / mo"))), /*#__PURE__*/React.createElement(Gran, {
      value: gran,
      onChange: setGran
    })), /*#__PURE__*/React.createElement(LineChart, {
      data: spendSeries,
      height: 236,
      series: [{
        key: "value",
        color: "var(--red)",
        width: 2.5
      }],
      yFmt: n => fmt(n)
    }), /*#__PURE__*/React.createElement("p", {
      className: "muted hint-sm"
    }, "Tip: click a point to see that period's transactions."));
  }
  function InvestmentsWidget() {
    const gain = investValue - investCost;
    const pct = gain / investCost * 100;
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Investments"), /*#__PURE__*/React.createElement("div", {
      className: "widget-value"
    }, fmt2(investValue))), /*#__PURE__*/React.createElement("div", {
      className: `invest-gain ${gain >= 0 ? "pos" : "neg"}`,
      style: {
        textAlign: "right",
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("div", null, gain >= 0 ? "+" : "", fmt2(gain)), /*#__PURE__*/React.createElement("div", {
      className: "muted",
      style: {
        fontSize: "0.72rem"
      }
    }, pct >= 0 ? "+" : "", pct.toFixed(1), "%"))), /*#__PURE__*/React.createElement(LineChart, {
      data: investSeries,
      height: 188,
      series: [{
        key: "value",
        color: "var(--green)",
        width: 2.5
      }, {
        key: "spx",
        color: "var(--muted)",
        width: 1.5,
        dashed: true
      }],
      yFmt: n => fmt(n)
    }), /*#__PURE__*/React.createElement("div", {
      className: "muted",
      style: {
        fontSize: "0.75rem",
        display: "flex",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--green)"
      }
    }, "\u2014"), " Portfolio"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "\u2013 \u2013"), " S&P 500")));
  }
  function GoalsWidget() {
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Savings goals"), /*#__PURE__*/React.createElement("button", {
      className: "link"
    }, "+ Add")), /*#__PURE__*/React.createElement("ul", {
      className: "goal-list"
    }, goals.map(g => {
      const pct = Math.min(100, g.saved / g.target * 100);
      const done = pct >= 100;
      return /*#__PURE__*/React.createElement("li", {
        key: g.id,
        className: "goal"
      }, /*#__PURE__*/React.createElement("div", {
        className: "goal-top"
      }, /*#__PURE__*/React.createElement("span", {
        className: "goal-name"
      }, g.name), /*#__PURE__*/React.createElement("button", {
        className: "x"
      }, "\xD7")), /*#__PURE__*/React.createElement("div", {
        className: "bar"
      }, /*#__PURE__*/React.createElement("div", {
        className: `bar-fill ${done ? "done" : ""}`,
        style: {
          width: pct + "%"
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "goal-meta muted"
      }, fmt2(g.saved), " of ", fmt2(g.target), " \xB7 ", pct.toFixed(0), "%"));
    })));
  }
  function monthly(s) {
    return s.cadence === "annual" ? s.amount / 12 : s.amount;
  }
  function SubscriptionsWidget() {
    const total = subs.reduce((s, x) => s + monthly(x), 0);
    const monthlyCount = subs.filter(s => s.cadence === "monthly").length;
    const annualCount = subs.filter(s => s.cadence === "annual").length;
    const totalAnnual = total * 12;
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Recurring"), /*#__PURE__*/React.createElement("div", {
      className: "widget-value neg"
    }, fmt2(total), /*#__PURE__*/React.createElement("span", {
      className: "muted unit"
    }, " / mo"))), /*#__PURE__*/React.createElement("button", {
      className: "link"
    }, "+ Add")), /*#__PURE__*/React.createElement("div", {
      className: "sub-summary muted"
    }, monthlyCount, " monthly \xB7 ", annualCount, " annual \xB7 ~", fmt(totalAnnual), "/yr"), /*#__PURE__*/React.createElement("ul", {
      className: "sub-list"
    }, subs.map(s => /*#__PURE__*/React.createElement("li", {
      key: s.id,
      className: "sub"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sub-name"
    }, s.name, s.source === "auto" && /*#__PURE__*/React.createElement("span", {
      className: "sub-tag"
    }, "auto")), /*#__PURE__*/React.createElement("span", {
      className: "sub-cad muted"
    }, s.cadence === "annual" ? "yr" : "mo"), /*#__PURE__*/React.createElement("span", {
      className: "sub-amt"
    }, fmt2(monthly(s)), /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "/mo")), /*#__PURE__*/React.createElement("button", {
      className: "x"
    }, "\xD7")))));
  }
  function InsightsWidget() {
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Insights")), /*#__PURE__*/React.createElement("ul", {
      className: "insight-list"
    }, insights.map((ins, i) => /*#__PURE__*/React.createElement("li", {
      key: i,
      className: `insight insight-${ins.severity}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "insight-dot"
    }, ins.severity === "warn" ? "⚠" : ins.severity === "good" ? "↓" : "•"), /*#__PURE__*/React.createElement("span", null, ins.text)))));
  }
  function RecentWidget() {
    return /*#__PURE__*/React.createElement("section", {
      className: "card widget"
    }, /*#__PURE__*/React.createElement("div", {
      className: "widget-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "Recent transactions")), /*#__PURE__*/React.createElement("ul", {
      className: "recent-list"
    }, txns.slice(0, 6).map(t => /*#__PURE__*/React.createElement("li", {
      key: t.id
    }, /*#__PURE__*/React.createElement("span", {
      className: "recent-cat",
      title: t.desc
    }, t.desc), /*#__PURE__*/React.createElement("span", {
      className: "recent-date muted"
    }, t.date), /*#__PURE__*/React.createElement("span", {
      className: t.type === "income" ? "pos" : "neg"
    }, t.type === "income" ? "+" : "−", fmt2(t.amount))))));
  }
  window.CW = {
    NetWorthWidget,
    SpendingWidget,
    InvestmentsWidget,
    GoalsWidget,
    SubscriptionsWidget,
    InsightsWidget,
    RecentWidget
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/claud-app/widgets.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatValue = __ds_scope.StatValue;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Segmented = __ds_scope.Segmented;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.SideNav = __ds_scope.SideNav;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
