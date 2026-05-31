<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# PrithviX — Master Cursor Rules

**Single source of truth** for how PrithviX works. This file is loaded as workspace agent guidance (`CLAUDE.md` → `@AGENTS.md`). Cursor **Rules** also mirror it via [`.cursor/rules/prithvix-master.mdc`](.cursor/rules/prithvix-master.mdc) (`alwaysApply: true`). For chats without workspace rules attached, paste this document first, then your task.

---

## 🧠 WHAT THIS PROJECT IS

PrithviX is an agri-retail ERP for Indian agri dealers — people who sell fertilizer, seeds, and pesticides to farmers. It has two UI modes on one shared Supabase backend:

- **Business Engine** — dealer-facing CRM + retail ops (farmers, sales, udhaar, inventory, compliance, AI agronomist, WhatsApp)
- **Tally Mode** — faithful Tally Prime replica for accountants/CAs (vouchers, ledgers, GST returns, financial reports)

Both modes are the SAME app, SAME database, SAME dealer tenant. They are navigation modes, not separate applications.

---

## 🗂️ PROJECT STRUCTURE

```
prithvix-web/
├── app/
│   ├── (app)/          → Business Engine routes
│   ├── tally/          → Tally Mode routes
│   ├── workspace/      → Mode picker (after login)
│   └── login/          → Auth
├── components/
│   ├── shell/          → Business Engine shell (Sidebar, topbar)
│   └── tally/          → Tally Mode shell (TallyShell, tabs, keyboard)
├── contexts/
│   ├── DataContext.tsx       → Global dealer data
│   ├── SalesContext.tsx      → Sales state
│   └── InventoryContext.tsx  → Inventory state (shared by BOTH modes)
├── hooks/
│   ├── useReportsQueries.ts  → Tally financial reports
│   ├── useBankingQueries.ts  → Banking data
│   ├── usePurchaseQueries.ts → Purchase module
│   └── use-gst.ts            → GST returns
├── lib/
│   ├── tally-format.ts       → formatTallyAmount, formatTallyDate
│   ├── tally-sounds.ts       → playTallyClick, playTallyError, playTallyAccept
│   ├── gst/                  → GSTR builders + parsers
│   └── reports/              → PDF + Excel generators
└── middleware.ts             → Enforces workspace mode lock
```

---

## ⚡ THE GOLDEN RULES — NEVER BREAK THESE

### Rule 1 — ONE DATABASE, TWO UIs

Both Business Engine and Tally Mode read and write to the SAME Supabase tables. NEVER create a separate table for Tally that duplicates a Business Engine table. If the data already exists somewhere, READ it — don't duplicate it.

### Rule 2 — INVENTORY IS ALREADY SHARED

The canonical inventory tables are:

- `product_master` — product catalog
- `product_skus` — SKUs per product
- `sku_stock_balances` — current stock levels
- `stock_transactions` — every stock movement

Business Engine uses `InventoryContext.tsx` to load these. Tally inventory screens (`app/tally/inventory/*`) query these SAME tables. When you build or fix any inventory feature, use these tables in BOTH modes. NEVER create `tally_inventory_*` tables.

### Rule 3 — FARMERS = SUNDRY DEBTORS

Every farmer in the `farmers` table is also a ledger (Sundry Debtor) in Tally. The link is `ensure_party_ledger` RPC which auto-creates a ledger row for a farmer if one doesn't exist.

- Business Engine farmer → `farmers` table
- Tally ledger → `ledgers` table, group = Sundry Debtors
- The `ensure_party_ledger` RPC bridges them
- NEVER show a farmer in Tally as "unknown party"

### Rule 4 — SALES AUTO-POST TO VOUCHERS

When a sale is created in Business Engine, it MUST auto-post a SAL voucher in the accounting tables via the `post_voucher` RPC. This is done via auto-posting hooks in Phase A. If you touch sale creation code, verify the auto-post hook is still firing. The voucher must appear in Tally Day Book immediately after a Business Engine sale.

### Rule 5 — UDHAAR = OUTSTANDING RECEIVABLES

Business Engine udhaar (credit) and Tally Outstanding Receivables show the SAME underlying data. Udhaar is stored in `credit_payments` and `sales` tables. Tally Outstanding reads from `voucher_entries` (Dr balance on party ledger). These must be in sync. If a farmer pays udhaar in Business Engine → the corresponding voucher entry balance must reduce in Tally Outstanding.

### Rule 6 — PURCHASES UPDATE INVENTORY

When a GRN (Goods Receipt Note) is created in Tally Purchase module → it MUST increase stock in `sku_stock_balances` and create a row in `stock_transactions`. This is the inventory addition on purchase flow. NEVER let a GRN save without updating inventory tables.

### Rule 7 — DEALER KEY IS ALWAYS UUID

All table rows are scoped by `dealer_id` which is the UUID from the `dealers` table (NOT the slug string). Always filter by:

```ts
const { data: { user } } = await supabase.auth.getUser()
// dealer_id is the UUID — get it from dealers table via user.id
```

NEVER mix dealer slug (text) and dealer UUID in the same query. If you see a query using a text slug where a UUID is expected, fix it.

**In this web app**, session helpers typically expose the same UUID as `session.dealerRowId` (from `dealers.id`). Prefer that on the client when already resolved — still never pass the text slug where the column stores UUID.

### Rule 8 — TALLY VISUAL RULES (never violate)

All code inside `app/tally/*` and `components/tally/*` must follow:

- Background: `#FFF8E7` (cream) — NOT white, NOT Business Engine bg
- Font: Inter, 13px, `font-feature-settings: 'tnum' 1`
- Borders: `1px solid #AAAAAA` — hard borders, NO shadows, NO rounded corners
- Active field: `#FFEB3B` yellow background
- Selected row: `#0D47A1` blue, white text
- Green accent: `#1B5E20`
- Yellow bar: `#FFD700`
- NO shadcn `<Button>`, `<Card>`, `<Input>` inside Tally — use raw HTML with tally CSS classes (`tally-input`, `tally-button-bar-btn`, etc.)
- NO animations, NO toast notifications, NO skeleton loaders in Tally
- NO Geist font in Tally
- Sound: call `playTallyError()` on errors, `playTallyClick()` on navigation, `playTallyAccept()` on successful save

### Rule 9 — BUSINESS ENGINE VISUAL RULES (never violate)

All code inside `app/(app)/*` and `components/shell/*` must follow:

- Font: Geist
- Design: Linear/Vercel inspired, modern SaaS
- Dark mode + light mode via next-themes
- shadcn/ui components are fine here
- Framer Motion animations are fine here
- Sonner toasts are fine here
- Indian currency: `₹1,23,456` via `toLocaleString('en-IN')`

### Rule 10 — NEVER TOUCH THESE WITHOUT ASKING

- Supabase schema migrations (add columns, create tables) — ASK FIRST
- RLS policies — ASK FIRST
- `middleware.ts` workspace mode enforcement — ASK FIRST
- `post_voucher` RPC logic — ASK FIRST
- Auth flow (`app/login`, `app/workspace`) — ASK FIRST

---

## 🔄 DATA SYNC RULES — HOW MODES STAY IN SYNC

These are the exact sync flows. Implement ALL new features following these patterns:

```
BUSINESS ENGINE ACTION          →    TALLY EFFECT
─────────────────────────────────────────────────────
New sale created                →    SAL voucher auto-posted (post_voucher RPC)
Udhaar payment received         →    RCT voucher auto-posted
Farmer created/edited           →    ensure_party_ledger RPC creates/updates ledger
Stock received (inventory add)  →    GRN in Tally purchase + sku_stock_balances++
Stock sold (inventory deduct)   →    SAL voucher + sku_stock_balances--
Daily close                     →    Cash balance in Tally Cash Book

TALLY ACTION                    →    BUSINESS ENGINE EFFECT
─────────────────────────────────────────────────────
Journal entry posted            →    Ledger balances update (visible in BE ledger view)
Purchase invoice saved          →    sku_stock_balances++ (via GRN link)
Credit Note raised              →    Farmer outstanding reduces in BE udhaar view
Bank reconciliation done        →    Bank ledger balance updates
```

---

## 📎 Detailed Tally ↔ Business Engine sync playbook

For **table-by-table sync maps**, farmers/suppliers ↔ ledgers, purchases & daily close, implementation steps, RPC reminders, and **manual verification** — read **[`docs/prithvix-tally-be-sync.md`](docs/prithvix-tally-be-sync.md)** whenever you change shared data between modes.

---

## 📐 HOW TO BUILD ANY NEW FEATURE

Follow this checklist for EVERY new feature:

```
[ ] 1. Does this data already exist in another table? → Use it, don't duplicate
[ ] 2. Does this affect inventory? → Update sku_stock_balances + stock_transactions
[ ] 3. Does this affect a party (farmer/supplier)? → Use/create ledger via ensure_party_ledger
[ ] 4. Does this affect accounting? → Post a voucher via post_voucher RPC
[ ] 5. Is this a Tally screen? → Follow Rule 8 visual rules exactly
[ ] 6. Is this a Business Engine screen? → Follow Rule 9 visual rules
[ ] 7. Does the feature need a keyboard shortcut in Tally? → Add to TallyKeyboardProvider
[ ] 8. Does the feature need audio feedback? → Add playTallyClick/Error/Accept
[ ] 9. Filter by dealer_id UUID (Rule 7) — not slug
[ ] 10. pnpm typecheck must pass after your changes
```

---

## 🗄️ KEY DATABASE TABLES — REFERENCE

```
ACCOUNTING (Phase A):
  vouchers              — every accounting entry
  voucher_entries       — Dr/Cr lines per voucher
  ledgers               — chart of accounts leaf nodes
  ledger_groups         — chart of accounts groups
  financial_years       — April-March FY tracking
  voucher_number_series — SAL/2025-26/00124 numbering

INVENTORY (shared):
  product_master        — product catalog
  product_skus          — SKUs per product
  sku_stock_balances    — current stock qty per SKU per dealer
  stock_transactions    — every stock movement (in/out)
  inventory_batches     — batch/expiry tracking

FARMERS & SALES (Business Engine):
  farmers               — farmer CRM profiles
  sales                 — all sales transactions
  sale_items            — line items per sale
  credit_payments       — udhaar repayments

PURCHASE (Tally Phase B):
  suppliers             — supplier master
  purchase_orders       — POs
  goods_receipt_notes   — GRNs
  purchase_invoices     — supplier bills

GST:
  gst_return_periods    — monthly GST filing status
  gstr1_records         — outward supply records
  gstr3b_summary        — monthly return summary
  gstr2b_records        — ITC from supplier filings

BANKING:
  bank_accounts         — bank account ledgers
  cheque_register       — issued/received cheques
  pdc_entries           — post-dated cheques

COMPLIANCE (Business Engine):
  form_n_register       — fertilizer movement register
  seed_register         — seed statutory register
  pesticide_register    — pesticide statutory register
```

---

## 🔌 KEY RPCs — USE THESE, DON'T REWRITE THEM

```sql
post_voucher(payload)          — posts any voucher with Dr/Cr entries
next_voucher_number(type, fy)  — generates SAL/2025-26/00124 style number
ensure_party_ledger(farmer_id) — creates ledger for farmer if not exists
get_trial_balance(fy_id)       — returns all ledger balances
get_outstanding(type)          — receivables or payables with ageing
```

---

## 📦 TECH STACK — LOCKED, DO NOT SUGGEST CHANGES

```
Framework:    Next.js 15 App Router + React 19 + TypeScript strict
Styling:      Tailwind v4 + shadcn/ui (Business Engine only)
Database:     Supabase (Postgres + Auth + Storage + RLS)
Data fetch:   TanStack React Query v5
State:        Zustand (compliance store)
Forms:        React Hook Form + Zod
PDF:          @react-pdf/renderer
Charts:       Recharts
Maps:         @vis.gl/react-google-maps
QR:           @yudiel/react-qr-scanner
Hotkeys:      react-hotkeys-hook
Animations:   framer-motion (Business Engine only)
Toasts:       sonner (Business Engine only)
Math:         mathjs (Tally calculator)
Excel:        xlsx (SheetJS)
Deploy:       Vercel
```

---

## 🚫 WHAT NEVER TO DO

- NEVER create duplicate tables for Tally data that exists in BE tables
- NEVER use text slug as dealer_id where UUID is expected
- NEVER add shadcn Button/Card/Input inside `app/tally/*`
- NEVER add animations/shadows/gradients inside `app/tally/*`
- NEVER add Sonner toasts inside `app/tally/*`
- NEVER use Geist font inside `app/tally/*`
- NEVER skip the post_voucher RPC when a financial transaction is saved
- NEVER skip updating sku_stock_balances when stock moves
- NEVER change Supabase schema without explicit approval
- NEVER modify middleware.ts workspace enforcement without explicit approval
- NEVER suggest replacing Supabase, Next.js, or any locked stack item
- NEVER mix Dr/Cr conventions — Debit increases assets/expenses, Credit increases liabilities/income (standard double-entry)

---

## ✅ BEFORE MARKING ANY TASK DONE

Run these checks every time:

```bash
pnpm typecheck      # must pass with zero errors
pnpm build          # must succeed
```

Then verify:

- [ ] Feature works in the correct mode (BE or Tally)
- [ ] Data appears correctly in the OTHER mode too
- [ ] dealer_id filtering is correct (UUID, not slug)
- [ ] No console errors in browser
- [ ] Tally screens still look like Tally (cream bg, hard borders)
- [ ] Business Engine screens still look modern (no Tally styles bleeding in)

---

## 🎯 HOW TO USE THIS FILE

1. Open Cursor Agent (Agent mode) with this workspace — rules load from `AGENTS.md` + `.cursor/rules/prithvix-master.mdc`.
2. If rules are not attached, paste **this entire `AGENTS.md`** first, then your task prompt.
3. `@` mention the specific files you want edited.
4. For large changes: ask the agent to read these rules fully, propose a plan, and wait for approval.

The rules above override generic improvisation when they conflict.
