# ClaudBudget — Monetization Notes

_Saved 2026-06-20. Working reference for how to make money without ads, without selling data, and without gutting the free experience._

## The core idea

Free users don't generate income directly — not unless you run ads or sell data, both of which corrode the trust a budgeting app runs on. So the real goal isn't "make money from free users," it's:

> Make free users **cheap to serve**, and convert a **slice** of them to paid.

Free is your funnel and your word-of-mouth. Revenue comes from the minority whose needs grow past the free tier.

## Two things that decide your safest model

1. **Marginal cost per free user.** If the app is mostly local/manual (statement import is already local-only), each free user costs ~nothing → you can afford a big free tier and a one-time price is safe. If you start paying a bank-sync API (Plaid/Teller/MX) at ~$0.30–$2+/user/month, free users become a liability and a one-time fee bleeds you on anyone who sticks around.
2. **What you gate.** Don't remove core budgeting. Gate along axes that scale with how much someone *relies* on the app — those correlate with willingness to pay:
   - **Scale** — number of accounts, depth of history
   - **Automation** — rules, recurring detection, scheduled/auto import, bank sync
   - **Convenience** — cloud sync/backup across devices, export, multi-currency
   - **Depth** — forecasting, net worth, goals, custom reports

A free user with manual entry, a few accounts, and basic reports is fully functional and gets hooked — then upgrades as life gets more complex. You're letting them grow into Pro, not crippling them.

## Recommended pricing model: hybrid

Offer **both**:

- A **monthly / annual subscription** (covers ongoing costs from most users), and
- A one-time **"lifetime"** option priced at roughly **2–3 years of the sub**.

Why the lifetime tier matters: anti-subscription sentiment is strong in personal finance (the YNAB price-hike backlash, Mint's shutdown). A lifetime option is a genuine marketing edge — not just a price point — and gives you an early cash injection at launch. It's only safe if your per-user cost is near zero, which loops back to the open question below.

## Feature gating list

`✓` = included · `—` = not included · limits noted inline.

| Feature | Free | Pro | Gating axis / why |
|---|---|---|---|
| Manual transaction entry & editing | ✓ | ✓ | Core — never gate |
| Default categories & monthly budgets | ✓ | ✓ | Core — never gate |
| Current-month spending summary | ✓ | ✓ | Core — never gate |
| Basic icon set | ✓ | ✓ | Core — never gate |
| Accounts | Up to 3 | Unlimited | Scale |
| Transaction history | 12 months | Unlimited | Scale |
| Statement import (CSV/PDF) | Manual upload | Manual + scheduled | Automation (cheap — keep generous to hook users) |
| Auto-categorization rules | — | ✓ | Automation |
| Recurring / subscription detection | — | ✓ | Automation |
| Live bank sync (if you add it) | — | ✓ | Automation — also where you recover the API cost |
| Cloud sync & backup (multi-device) | — | ✓ | Convenience |
| Data & report export (CSV/Excel/PDF) | — | ✓ | Convenience |
| Multi-currency | — | ✓ | Convenience |
| Cash-flow forecasting / projections | — | ✓ | Depth |
| Net-worth tracking | — | ✓ | Depth |
| Savings goals | — | ✓ | Depth |
| Custom reports & charts | — | ✓ | Depth |
| Household / shared budget (multi-user) | — | ✓ | Scale + Depth |
| Priority support | — | ✓ | Support |

## À la carte extras (one-time, separate from Pro)

Zero marginal cost, pure margin, and they don't pressure anyone:

- **Premium icon packs** — you already have a custom icon system.
- **Themes / color schemes / alternate app icons.**
- **Tip jar / pay-what-you-want** — some users just want to support an indie tool.

## Open question that decides the rest

**Does the app pay per-user costs for bank syncing, or is it basically free to run per user?**

- **Free to run** → big free tier + lifetime option are both safe; lean into the anti-subscription angle.
- **Per-user API cost** → keep anything that triggers that cost (live sync) strictly Pro, and lean toward recurring revenue so long-lived users don't run you at a loss.
