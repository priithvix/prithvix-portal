# PrithviX — Tally ↔ Business Engine Sync Rules

Use this playbook when changing anything that touches **data shared** between Business Engine and Tally Mode. The canonical agent overview remains **[`AGENTS.md`](../AGENTS.md)** at the repo root.

---

## THE CORE PRINCIPLE

Business Engine and Tally Mode are TWO UIs on ONE database. They must always show the same underlying data. There is NO separate "Tally database" and NO separate "Business Engine database". Every sync happens through shared Supabase tables — not through APIs, not through webhooks, not through duplicate tables.

---

## SYNC MAP — what must stay in sync

### 1. INVENTORY

```
Business Engine source:         Tally reads from:
─────────────────────────────────────────────────
product_master                → app/tally/inventory/items
product_skus                  → item details in Tally
sku_stock_balances            → Tally stock summary + stock journal
stock_transactions            → Tally stock movement history
inventory_batches             → Tally batch tracking
```

**Rule:** Tally inventory screens must NEVER have their own inventory tables. They must query `product_master`, `product_skus`, `sku_stock_balances`, `stock_transactions` directly — the same tables `InventoryContext.tsx` uses in Business Engine.

**On any stock movement (sale, purchase, adjustment):**

- Always write to `sku_stock_balances` (update qty)
- Always write to `stock_transactions` (insert movement row)
- This ensures BOTH modes see the correct stock level instantly

---

### 2. FARMERS ↔ PARTY LEDGERS

```
Business Engine:               Tally:
─────────────────────────────────────────────────
farmers table                 → ledgers table (group: Sundry Debtors)
farmer.name                   → ledger.name
farmer.id                     → ledger.party_ref_id
farmer's outstanding udhaar   → ledger's Dr balance
```

**Rule:** When a farmer is created or edited in Business Engine, call `ensure_party_ledger(farmer_id)` RPC to create/update their Tally ledger. A farmer must NEVER appear as "unknown party" in Tally vouchers or outstanding reports.

---

### 3. SALES ↔ VOUCHERS

```
Business Engine:               Tally:
─────────────────────────────────────────────────
sales table (new sale)        → vouchers table (SAL voucher)
sale_items                    → voucher_entries (Dr/Cr lines)
sale.total_amount             → voucher.amount
sale.gst_amount               → tax voucher_entries
sale.farmer_id                → party ledger (via ensure_party_ledger)
```

**Rule:** Every sale saved in Business Engine MUST auto-post a SAL voucher via `post_voucher` RPC. This is the auto-posting hook from Phase A. Do not remove or bypass it. After a BE sale, the Tally Day Book must show the SAL voucher immediately.

---

### 4. UDHAAR ↔ OUTSTANDING RECEIVABLES

```
Business Engine:               Tally:
─────────────────────────────────────────────────
credit_payments (repayments)  → RCT voucher (Receipt)
udhaar balance per farmer     → Dr balance on farmer's ledger
udhaar cleared                → voucher_entries balance reduces
```

**Rule:** When a farmer repays udhaar in Business Engine, auto-post an RCT (Receipt) voucher via `post_voucher` RPC. The farmer's outstanding in Tally must reduce by the repaid amount. Both the Business Engine udhaar page and Tally Outstanding must show identical balances for the same farmer.

---

### 5. PURCHASES ↔ INVENTORY + VOUCHERS

```
Tally action:                  Effect on shared tables:
─────────────────────────────────────────────────
GRN saved                     → sku_stock_balances += received qty
                              → stock_transactions (IN movement row)
Purchase Invoice saved        → vouchers table (PUR voucher)
                              → voucher_entries (Dr/Cr lines)
                              → supplier ledger balance increases
Debit Note raised             → sku_stock_balances -= returned qty
                              → DBN voucher posted
```

**Rule:** A GRN save is NEVER complete without updating inventory. A Purchase Invoice save is NEVER complete without posting a PUR voucher. Business Engine inventory view must reflect GRNs entered in Tally immediately.

---

### 6. SUPPLIERS ↔ CREDITOR LEDGERS

```
Tally:                         Shared:
─────────────────────────────────────────────────
suppliers table               → ledgers table (group: Sundry Creditors)
supplier.name                 → ledger.name
supplier.id                   → ledger.party_ref_id
supplier outstanding          → ledger's Cr balance
```

**Rule:** When a supplier is created in Tally Purchase module, auto-create their ledger under Sundry Creditors group. Same `ensure_party_ledger` pattern as farmers.

---

### 7. DAILY CLOSE ↔ CASH BOOK

```
Business Engine:               Tally:
─────────────────────────────────────────────────
daily_close cash total        → Cash-in-Hand ledger balance
daily_close entries           → Tally Cash Book (Day Book filtered
                                to Cash ledger)
```

**Rule:** Daily close in Business Engine must reconcile with Cash-in-Hand ledger balance in Tally. If the dealer does a daily close with ₹5,000 cash collected, the Tally Cash Book must reflect this.

---

## HOW TO IMPLEMENT ANY SYNC FEATURE

When building a feature that touches shared data, follow this:

```
Step 1: Identify which shared table(s) hold this data
Step 2: Write/read ONLY those tables — no new duplicate tables
Step 3: If it's a financial transaction → call post_voucher RPC
Step 4: If it's a stock movement → update sku_stock_balances
        AND insert into stock_transactions
Step 5: If it's a party (farmer/supplier) → call ensure_party_ledger
Step 6: Verify the change appears in BOTH modes before marking done
```

---

## KEY RPCs FOR SYNC — USE THESE

```
post_voucher(payload)           Post any accounting voucher
ensure_party_ledger(party_id)   Create/sync ledger for farmer or supplier
next_voucher_number(type, fy)   Get next SAL/PUR/RCT number
get_outstanding(type)           Get receivables or payables balances
```

---

## WHAT NEVER TO DO

- NEVER create `tally_inventory_*` tables — use the shared inventory tables
- NEVER create `be_vouchers` or any BE-side accounting table — use vouchers table
- NEVER save a sale without calling post_voucher
- NEVER save a GRN without updating sku_stock_balances
- NEVER create a farmer without calling ensure_party_ledger
- NEVER show different stock numbers in BE and Tally for the same SKU
- NEVER show different outstanding for the same farmer in BE and Tally
- NEVER use a text slug as dealer_id — always use the UUID from dealers table

---

## VERIFY SYNC IS WORKING

After building any feature, test this manually:

```
Inventory sync:
  1. Add stock in BE inventory → check Tally stock summary shows same qty

Sales sync:
  1. Create sale in BE → check Tally Day Book shows SAL voucher
  2. Check farmer's ledger in Tally shows Dr balance = udhaar in BE

Udhaar sync:
  1. Record repayment in BE udhaar → check Tally Outstanding reduces
  2. Check RCT voucher appears in Tally Day Book

Purchase sync:
  1. Create GRN in Tally → check BE inventory shows increased stock
  2. Check PUR voucher in Tally Day Book
```
