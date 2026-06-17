# Claud — Design System

**Claud** is a modern, minimal budgeting app for people who are new to budgeting. One person, behind a personal login, tracks their accounts, transactions, budgets, and investments — and projects a long-range net-worth timeline called **Foresight**. The product is calm, precise, and data-forward; it informs rather than gamifies. There are no streaks, confetti, or nudges — just legible numbers and honest charts.

The interface is a left **sidebar** (brand mark + 7 tabs: Dashboard · Accounts · Transactions · Cash Flow · Budget · Investments · Foresight, with a user menu pinned to the bottom) beside a **main content area** with a page header and a customizable widget grid.

This repository is a design system: the tokens, components, foundation specimens, and full-screen UI-kit recreations that let a design agent build new Claud surfaces on-brand.

## Sources

This system was reverse-engineered from the product's own source, which the reader can explore further to build higher-fidelity work:

- **GitHub — [Vitaraa/App](https://github.com/Vitaraa/App)** — the full Claud app (React + Vite client, Express + SQLite server). The client's `src/index.css` is the original design source of truth; the `widgets/`, `ForesightTab.jsx`, `Login.jsx`, and `Dashboard.jsx` files defined the screens recreated here.
- **Uploaded logo** — `uploads/logov2.svg`, the full-color cloud-and-bars mark.

> Note on access: the links above may require permission. Everything needed to use this system is copied into this project; the sources are recorded for provenance and deeper reference.

---

## CONTENT FUNDAMENTALS

How Claud writes.

- **Voice — plain, second person, quietly reassuring.** Copy addresses the user as **"you"** and **"your"**: "Carry each category's leftover budget into the next month." "Anchored to your real account balances." It never refers to itself as "I."
- **Tone — calm, factual, lightly warm.** Microcopy states what a thing does, then stops. Empty states are gentle and instructive, not salesy: *"No goals yet. Add one to start tracking."* / *"No recurring charges detected yet. Add one or import statements."* The single greeting — *"Welcome back, {name}"* — is the warmest the product gets.
- **Casing — sentence case everywhere.** Buttons, labels, headings: "Sign in", "Create plan", "Budget rollover", "New job / income change". The only uppercase is the small eyebrow/table-head treatment (letter-spaced): "SHOW WIDGETS", "CATEGORY".
- **Numbers are the content.** Money is always currency-formatted (`$254,480.00`), tabular-aligned, signed (`+$4,200.00`, `−$128.40`), and colored (green positive / red negative). Figures are the loudest thing on most screens; labels stay muted and small.
- **Tips, not tutorials.** Inline hints are one line, prefixed conversationally: *"Tip: click a bar to see that period's transactions."* / *"Drag a dot left/right to change its year · click it to edit."*
- **Emoji — used sparingly, and only as functional iconography in Foresight.** Life-event plan markers carry a single emoji each (🏖️ retirement, 🏠 house, 💼 job, 🎓 education, 👶 kids, 💵 income, 💸 expense, 🏦 pension). Emoji never appear in marketing-style copy or buttons. A few Unicode glyphs do utility duty: `⚠` review flag, `↓` improvement, `×` delete, `▾` caret, `🔒` plan-locked cell.
- **Domain words.** "Net worth", "Cash flow", "Foresight", "Recurring", "Needs review", "Cumulative vs Accounts", "Rollover". Real personal-finance vocabulary, no invented jargon.

---

## VISUAL FOUNDATIONS

What Claud looks like, and the rules behind it.

### Themes
**Dark is the hero.** A near-black-blue background (`#0f1115`) with layered surfaces — sidebar slightly lifted (`#14171d`), cards above that (`#181b22`), inputs darker insets (`#20242d`). A **polished light theme** mirrors it (`#f4f6f9` bg, white cards). The theme toggles via `:root[data-theme="light"]`; every token re-points, so all components flip cleanly. Indigo holds across both themes; green/red deepen on light for contrast.

### Color
A disciplined, three-signal palette:
- **Blue `#3a7bd5`** is the only brand/UI accent — primary buttons, the active nav pill, selected segments/chips, focus rings, links, progress fills, and the live projection line. (A calm azure that sits easily on the near-black background and nods to the brand's cloud-cyan; it replaced the original `#6366f1` indigo, which vibrated on dark.)
- **Green `#34d399` / Red `#f87171`** are *meaning*, never decoration: positive vs negative money, under vs over budget, on-track vs running-out. They appear on text, lines, and soft-tinted status panels (`rgba(...,0.12)` fill + `0.35–0.40` border).
- **Amber `#fbbf24`** is reserved exclusively for the "needs review" import flag.
- **Cloud cyan `#00AAD2`** lives only in the full-color logomark — never in UI chrome.
- Soft accent washes (`rgba(58,123,213,0.16)`) tint selected chips and hover rows.

### Type
The **native system UI stack** (`system-ui, -apple-system, "Segoe UI", Roboto, …`) — zero webfont latency, at home on every OS, exactly right for a utilitarian tool. **There is no custom webfont.** Headings, values, and the wordmark are tight-tracked (`-0.02em`) and heavy (700); body is 15px/400; captions and labels are ~13px muted. **Tabular numerals** (`font-variant-numeric: tabular-nums`) are used everywhere money or dates align. Eyebrows and table heads are the only uppercase, letter-spaced ~0.03–0.04em at ~11.5px.

### Shape, border & elevation
- **Corner radii are gentle.** 14px is the signature card/modal radius; 9px for inputs and buttons; 6px for segmented controls; full pills (999px) for chips, progress bars, avatars, and status dots.
- **Borders carry the structure.** A single 1px hairline (`#262a33` dark / `#e2e6ee` light) defines cards, dividers, table rows, and inputs. Resting cards have **no shadow** — they're border-only and flat.
- **Shadow means "floating."** It appears only on layers above the page: dropdown menus (`0 10px 30px`), in-card drill-down popovers (`0 12px 32px`), and centered modals (`0 20px 50px`), all soft near-black. Modals sit over a `rgba(0,0,0,0.6)` scrim.

### Layout
A fixed **230px sidebar** (sticky, full-height) beside a fluid main column capped at **1140px**, padded 24×28px. Content stacks at a 16px gap. The dashboard is a **widget grid**: large widgets in 2 columns, medium widgets in 3, collapsing to 1 column under 860px. Dense data screens (Foresight's projected-budget table) scroll horizontally within the card with sticky header row and first column.

### Motion
Restrained and quick. Hover/active states are `~0.12s` color/background transitions; progress and budget bars animate width over `0.3s ease`. Charts don't animate on load (figures should read instantly). No bounces, no decorative loops. Hover = subtle background wash (`rgba(255,255,255,0.04)`) or a brightness bump on solid buttons; press = a slight darken. There are no parallax, gradient-mesh, or glassmorphism effects — transparency is used only for soft status tints and scrims.

### Imagery
Claud is **chart-forward, not photo-forward.** There is no marketing photography or illustration in-product. The "imagery" is data: clean 2–2.5px line charts with dashed 3px gridlines (`var(--border)`), no axis lines, muted 11–12px tick labels, and tabular tooltips. The net-worth projection colors its line by a vertical gradient split at the zero baseline (green above, red below). The only brand graphic is the cloud-and-bars logomark.

---

## ICONOGRAPHY

Claud's iconography is deliberately minimal — text labels do most of the navigational work.

- **The sidebar tabs are text-only.** No nav icons. This keeps the rail calm and unambiguous.
- **Bespoke line icons for account types.** The product ships a small hand-built set (`AccountIcon`) — 24×24, `stroke="currentColor"`, **1.8 stroke width**, round caps/joins — for chequing (bank), savings (piggy), cash, investment (chart), credit card, mortgage (house), auto loan (car), student loan (cap), and a generic dollar. They draw in `currentColor` so they invert with the theme. This is a **Lucide-style** stroke language; if you need icons beyond the built-in set, **use [Lucide](https://lucide.dev) (1.5–2px stroke) as the closest match** and keep weights consistent.
- **Emoji as functional markers in Foresight only** (life events): 🏖️ 🏠 💼 🎓 👶 💵 💸 🏦, plus 📍 fallback. These render inside the chart's plan dots and the legend.
- **Unicode glyphs for micro-affordances:** `×` delete · `▾` caret · `⚠` needs-review · `↓` improvement insight · `🔒` plan-locked cell · `+` add.
- **No icon font, no sprite sheet, no PNG icons.** Everything is inline SVG or a system glyph.

> Substitution flagged: no third-party icon set is bundled. The account-type icons are original to the app and reproduced in spirit. For broader icon needs, Lucide is the recommended on-brand CDN set.

> Font note: Claud intentionally uses the **system UI font** — there are no font files to ship. If you want a single consistent webfont across platforms instead, that is a brand decision to confirm with the team (the closest neutral match would be a grotesk like *IBM Plex Sans* or *Source Sans 3*); by default, keep the system stack.

---

## INDEX

Root manifest and where to look.

| Path | What it is |
|---|---|
| `styles.css` | **Entry point.** Import-only manifest; consumers link this one file. |
| `tokens/colors.css` | Surfaces, text, accent, semantic (green/red/amber), brand cyan — dark + light. |
| `tokens/typography.css` | System font stack, type scale, weights, tracking. |
| `tokens/spacing.css` | Spacing scale, corner radii, layout widths, motion vars. |
| `tokens/elevation.css` | Shadow + scrim tokens. |
| `css/base.css` | Reset, body, `.muted/.pos/.neg`, brand wordmark, focus. |
| `css/components.css` | Shared class vocabulary (card, btn, chip, seg, badge, bar, avatar, status…). |
| `assets/` | Logomark SVGs: `claud-mark.svg` (adaptive), `-white.svg` (dark), `-color.svg` (cyan). |

### Components (`window.ClaudDesignSystem_de602a`)
| Group | Components |
|---|---|
| `components/buttons/` | **Button** (primary · ghost · danger · link; `sm`) |
| `components/forms/` | **Field · Input · Select · Chip · Segmented** |
| `components/display/` | **Card · Badge · ProgressBar · Avatar · StatValue** |
| `components/navigation/` | **Tabs · SideNav** |
| `components/brand/` | **Logo** |

Each directory carries a `<Name>.d.ts` (props + adherence), `<Name>.prompt.md` (usage), and an `@dsCard`-tagged `.html` preview.

### Foundation cards (`guidelines/`)
Colors (surfaces dark/light, accent, semantic), Type (display, body, tabular), Spacing (scale, radius, elevation), Brand (cloud color). Each renders in the Design System tab.

### UI kit
| Path | What it is |
|---|---|
| `ui_kits/claud-app/index.html` | **Interactive recreation** — Login → Dashboard (widget grid), Accounts, Transactions, Budget, and the dense **Foresight** projection (chart + editable budget table). Dark/light toggle in the user menu. |

The UI kit is self-contained (React + a small dependency-free SVG chart, the shared CSS vocabulary) — it does not depend on the compiled component bundle, so it renders anywhere.

---

## Using this system

Link the stylesheet and set a theme:

```html
<link rel="stylesheet" href="styles.css" />
<html data-theme="dark"> <!-- or "light" -->
```

Then either apply the class vocabulary directly (`.card`, `.btn.primary`, `.chip`, `.seg`, `.bar`, `.status.good`…) or mount the React components from `window.ClaudDesignSystem_de602a`. Stay inside the three-signal color rule: **indigo for brand/UI, green/red for meaning, amber only for review.** Keep numbers tabular and signed. Prefer borders over shadows. Let the data be the loudest thing on the screen.
