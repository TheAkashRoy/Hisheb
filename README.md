# Hisheb

An offline-first, Splitwise-style expense splitter. Installable PWA, built with React + Vite. All data lives in the browser (localStorage) — no account, no server.

## Features

- **Groups** with an icon, currency and members (trips, flatmates, etc.)
- **Add expenses** — description, amount, category, date, who paid
- **Split modes** — equally, or by exact amounts (with live "adds up" check)
- **Balances** — per-member net position in each group
- **Debt simplification** — greedy minimum-cash-flow so people make the fewest payments (toggle per group)
- **Settle up** — record payments, with tap-to-fill suggestions
- **Activity feed** — expenses + payments as a timeline, globally and per group
- **People** manager — lightweight name labels on this device
- **Overall summary** — what you owe / are owed across all groups, per currency
- **Backup / restore** — export & import a JSON file
- **PWA** — installable, works fully offline, light/dark theme

## Develop

```bash
npm install
npm run icons   # regenerate PWA icons from public/icon.svg (needs sharp)
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Project layout

```
src/
  lib/            money math, balance/simplify algorithms, formatting, categories
  components/      Avatar, TopBar, BottomNav, Sheet, Toast, EmptyState
  pages/          Dashboard, GroupDetail, GroupForm, ExpenseForm, SettleUp, Activity, People, Account
  store.js        zustand store (persisted) + selectors + sample data
  hooks.js        derived ledger hooks (memoised)
```

## Notes

- Money is stored as integer cents everywhere; splits always reconcile to the total.
- Each group has its own currency; there is no FX conversion, balances are kept per currency.
