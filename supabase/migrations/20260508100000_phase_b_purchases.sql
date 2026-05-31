/**
 * PrithviX Phase B — Purchases & Suppliers (run in Supabase SQL Editor).
 *
 * Schema notes (this web app uses `dealers`, not `shops`):
 * - All tenant FKs use `dealer_id` → `public.dealers(id)`.
 * - Product lines reference `public.product_master(id)` (TEXT ids in mobile/web schema).
 * - `ledgers`, `vouchers`, `voucher_entries`, `financial_years` must exist (Phase A)
 *   for `post_purchase_invoice` to succeed. If missing, comment out those functions or
 *   run Phase A migrations first.
 * - `post_grn` updates `sku_stock_balances` / `stock_transactions` (existing inventory model).
 *   Requires `grn_items.sku_id` when posting stock; optional until SKUs are chosen in UI.
 *
 * Review RLS if staff access dealers via a join table other than `dealers.user_id`.
 */

-- ── doc_sequences ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doc_sequences (
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  doc_key   TEXT NOT NULL,
  last_seq  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dealer_id, doc_key)
);

-- ── suppliers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  gstin           TEXT,
  state_code      TEXT,
  pan             TEXT,
  mobile          TEXT,
  email           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  pincode         TEXT,
  bank_name       TEXT,
  bank_account    TEXT,
  bank_ifsc       TEXT,
  credit_days     INTEGER DEFAULT 30,
  credit_limit    NUMERIC(14,2) DEFAULT 0,
  opening_balance NUMERIC(14,2) DEFAULT 0,
  balance_type    TEXT DEFAULT 'CR',
  ledger_id       UUID REFERENCES public.ledgers(id),
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_dealer_id ON public.suppliers(dealer_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON public.suppliers(gstin);

-- ── purchase orders ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id),
  po_number       TEXT NOT NULL,
  po_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES public.product_master(id),
  sku_id          TEXT REFERENCES public.product_skus(id),
  product_name    TEXT NOT NULL,
  hsn_code        TEXT,
  quantity        NUMERIC(10,3) NOT NULL,
  unit            TEXT DEFAULT 'Bag',
  rate            NUMERIC(14,2) NOT NULL,
  gst_rate        NUMERIC(5,2) DEFAULT 0,
  gst_amount      NUMERIC(14,2) DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL,
  received_qty    NUMERIC(10,3) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_dealer_id ON public.purchase_orders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON public.purchase_order_items(po_id);

-- ── GRNs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id),
  po_id           UUID REFERENCES public.purchase_orders(id),
  grn_number      TEXT NOT NULL,
  grn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number  TEXT,
  lr_number       TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grn_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id          UUID NOT NULL REFERENCES public.grns(id) ON DELETE CASCADE,
  po_item_id      UUID REFERENCES public.purchase_order_items(id),
  product_id      TEXT REFERENCES public.product_master(id),
  sku_id          TEXT REFERENCES public.product_skus(id),
  product_name    TEXT NOT NULL,
  hsn_code        TEXT,
  quantity        NUMERIC(10,3) NOT NULL,
  unit            TEXT DEFAULT 'Bag',
  rate            NUMERIC(14,2) NOT NULL,
  gst_rate        NUMERIC(5,2) DEFAULT 0,
  cgst_amount     NUMERIC(14,2) DEFAULT 0,
  sgst_amount     NUMERIC(14,2) DEFAULT 0,
  igst_amount     NUMERIC(14,2) DEFAULT 0,
  gst_amount      NUMERIC(14,2) DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL,
  batch_number    TEXT,
  expiry_date     DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grns_dealer_id ON public.grns(dealer_id);
CREATE INDEX IF NOT EXISTS idx_grns_supplier_id ON public.grns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON public.grn_items(grn_id);

-- ── purchase invoices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES public.suppliers(id),
  grn_id          UUID REFERENCES public.grns(id),
  voucher_id      UUID REFERENCES public.vouchers(id),
  pi_number       TEXT NOT NULL,
  supplier_inv_no TEXT,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'UNPAID',
  subtotal        NUMERIC(14,2) DEFAULT 0,
  cgst_amount     NUMERIC(14,2) DEFAULT 0,
  sgst_amount     NUMERIC(14,2) DEFAULT 0,
  igst_amount     NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  round_off       NUMERIC(5,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  paid_amount     NUMERIC(14,2) DEFAULT 0,
  balance_due     NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_id           UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  grn_item_id     UUID REFERENCES public.grn_items(id),
  product_id      TEXT REFERENCES public.product_master(id),
  sku_id          TEXT REFERENCES public.product_skus(id),
  product_name    TEXT NOT NULL,
  hsn_code        TEXT,
  quantity        NUMERIC(10,3) NOT NULL,
  unit            TEXT DEFAULT 'Bag',
  rate            NUMERIC(14,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  gst_rate        NUMERIC(5,2) DEFAULT 0,
  cgst_amount     NUMERIC(14,2) DEFAULT 0,
  sgst_amount     NUMERIC(14,2) DEFAULT 0,
  igst_amount     NUMERIC(14,2) DEFAULT 0,
  gst_amount      NUMERIC(14,2) DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL,
  batch_number    TEXT,
  expiry_date     DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_dealer_id ON public.purchase_invoices(dealer_id);
CREATE INDEX IF NOT EXISTS idx_pi_supplier_id ON public.purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pi_items_pi_id ON public.purchase_invoice_items(pi_id);

-- ── RLS (owner dealers.user_id = auth.uid(); extend for staff if needed) ─────
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_dealer_access" ON public.suppliers;
CREATE POLICY "suppliers_dealer_access" ON public.suppliers
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_dealer_access" ON public.purchase_orders;
CREATE POLICY "po_dealer_access" ON public.purchase_orders
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poi_dealer_access" ON public.purchase_order_items;
CREATE POLICY "poi_dealer_access" ON public.purchase_order_items
  FOR ALL USING (
    po_id IN (
      SELECT id FROM public.purchase_orders
      WHERE dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
    )
  );

ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grn_dealer_access" ON public.grns;
CREATE POLICY "grn_dealer_access" ON public.grns
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grni_dealer_access" ON public.grn_items;
CREATE POLICY "grni_dealer_access" ON public.grn_items
  FOR ALL USING (
    grn_id IN (
      SELECT id FROM public.grns
      WHERE dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
    )
  );

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pi_dealer_access" ON public.purchase_invoices;
CREATE POLICY "pi_dealer_access" ON public.purchase_invoices
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pii_dealer_access" ON public.purchase_invoice_items;
CREATE POLICY "pii_dealer_access" ON public.purchase_invoice_items
  FOR ALL USING (
    pi_id IN (
      SELECT id FROM public.purchase_invoices
      WHERE dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
    )
  );

ALTER TABLE public.doc_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docseq_dealer_access" ON public.doc_sequences;
CREATE POLICY "docseq_dealer_access" ON public.doc_sequences
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

-- ── next_doc_number ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_dealer_id UUID,
  p_prefix    TEXT,
  p_fy        TEXT
) RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
  v_key TEXT;
BEGIN
  v_key := p_prefix || '/' || p_fy;
  INSERT INTO public.doc_sequences (dealer_id, doc_key, last_seq)
  VALUES (p_dealer_id, v_key, 1)
  ON CONFLICT (dealer_id, doc_key)
  DO UPDATE SET last_seq = public.doc_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '/' || p_fy || '/' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── post_grn (stock via sku_stock_balances when sku_id set) ───────────────────
CREATE OR REPLACE FUNCTION public.post_grn(p_grn_id UUID)
RETURNS VOID AS $$
DECLARE
  v_grn public.grns%ROWTYPE;
  v_item public.grn_items%ROWTYPE;
  v_new NUMERIC;
BEGIN
  SELECT * INTO v_grn FROM public.grns WHERE id = p_grn_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;
  IF v_grn.status = 'POSTED' THEN
    RAISE EXCEPTION 'GRN already posted';
  END IF;

  FOR v_item IN SELECT * FROM public.grn_items WHERE grn_id = p_grn_id LOOP
    IF v_item.sku_id IS NOT NULL THEN
      SELECT COALESCE(quantity_base, 0) INTO v_new
      FROM public.sku_stock_balances
      WHERE dealer_id = v_grn.dealer_id AND sku_id = v_item.sku_id;

      v_new := COALESCE(v_new, 0) + v_item.quantity;

      INSERT INTO public.sku_stock_balances (dealer_id, sku_id, quantity_base)
      VALUES (v_grn.dealer_id, v_item.sku_id, v_item.quantity)
      ON CONFLICT (dealer_id, sku_id)
      DO UPDATE SET quantity_base = public.sku_stock_balances.quantity_base + EXCLUDED.quantity_base;
    END IF;
  END LOOP;

  UPDATE public.grns SET status = 'POSTED', updated_at = now() WHERE id = p_grn_id;

  UPDATE public.purchase_order_items poi
  SET received_qty = received_qty + gi.quantity
  FROM public.grn_items gi
  WHERE gi.grn_id = p_grn_id AND gi.po_item_id = poi.id;

  UPDATE public.purchase_orders po
  SET status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.purchase_order_items poi2
      WHERE poi2.po_id = po.id AND poi2.received_qty < poi2.quantity
    ) THEN 'RECEIVED'
    ELSE 'PARTIAL'
  END,
  updated_at = now()
  WHERE po.id = (SELECT po_id FROM public.grns WHERE id = p_grn_id AND po_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── post_purchase_invoice (requires Phase A voucher tables + ledger codes) ───
CREATE OR REPLACE FUNCTION public.post_purchase_invoice(p_pi_id UUID)
RETURNS UUID AS $$
DECLARE
  v_pi        public.purchase_invoices%ROWTYPE;
  v_supplier  public.suppliers%ROWTYPE;
  v_voucher_id UUID;
  v_number    TEXT;
  v_fy        TEXT;
  y           INT;
  m           INT;
BEGIN
  SELECT * INTO v_pi FROM public.purchase_invoices WHERE id = p_pi_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PI not found'; END IF;
  IF v_pi.voucher_id IS NOT NULL THEN RAISE EXCEPTION 'PI already posted'; END IF;

  SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_pi.supplier_id;

  y := EXTRACT(YEAR FROM v_pi.invoice_date)::INT;
  m := EXTRACT(MONTH FROM v_pi.invoice_date)::INT;
  IF m >= 4 THEN
    v_fy := y::TEXT || '-' || LPAD(((y + 1) % 100)::TEXT, 2, '0');
  ELSE
    v_fy := (y - 1)::TEXT || '-' || LPAD((y % 100)::TEXT, 2, '0');
  END IF;

  v_number := public.next_doc_number(v_pi.dealer_id, 'PUR', v_fy);

  INSERT INTO public.vouchers (
    dealer_id, voucher_type, voucher_number, voucher_date,
    narration, total_amount, status, reference, meta
  ) VALUES (
    v_pi.dealer_id, 'PUR', v_number, v_pi.invoice_date,
    'Purchase from ' || v_supplier.name || ' | Inv: ' || COALESCE(v_pi.supplier_inv_no, v_pi.pi_number),
    v_pi.total_amount, 'POSTED', v_pi.id::TEXT, jsonb_build_object('purchase_invoice_id', p_pi_id)
  ) RETURNING id INTO v_voucher_id;

  INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
  SELECT v_voucher_id, id, 'DR', v_pi.subtotal
  FROM public.ledgers WHERE dealer_id = v_pi.dealer_id AND ledger_code = 'PURCHASES'
  LIMIT 1;

  IF v_pi.cgst_amount > 0 THEN
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    SELECT v_voucher_id, id, 'DR', v_pi.cgst_amount
    FROM public.ledgers WHERE dealer_id = v_pi.dealer_id AND ledger_code = 'INPUT_CGST' LIMIT 1;
  END IF;

  IF v_pi.sgst_amount > 0 THEN
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    SELECT v_voucher_id, id, 'DR', v_pi.sgst_amount
    FROM public.ledgers WHERE dealer_id = v_pi.dealer_id AND ledger_code = 'INPUT_SGST' LIMIT 1;
  END IF;

  IF v_pi.igst_amount > 0 THEN
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    SELECT v_voucher_id, id, 'DR', v_pi.igst_amount
    FROM public.ledgers WHERE dealer_id = v_pi.dealer_id AND ledger_code = 'INPUT_IGST' LIMIT 1;
  END IF;

  IF v_supplier.ledger_id IS NOT NULL THEN
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_voucher_id, v_supplier.ledger_id, 'CR', v_pi.total_amount);
  END IF;

  UPDATE public.purchase_invoices SET voucher_id = v_voucher_id, updated_at = now() WHERE id = p_pi_id;

  RETURN v_voucher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
