ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS meta JSONB;

/**
 * PrithviX Phase D — Banking, receivables/payables ageing, bill settlement, statements.
 *
 * Tenant key: dealers.dealer_id (TEXT slug) matching `session.dealerId` in the web app
 * (`sales`, `farmers`, `suppliers`, `purchase_invoices` use this column).
 *
 * Receivables ageing uses existing `sales` rows (credit `pending` / `partial`).
 * Purchases ageing uses `purchase_invoices`.
 *
 * Requires: dealers, farmers, suppliers, vouchers, voucher_entries, ledgers, next_doc_number (Phase B).
 */

-- ── farmers credit / debtor link ────────────────────────────────────────────
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_blocked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS block_reason TEXT,
  ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES public.ledgers(id);

-- ── bank_accounts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  ifsc_code       TEXT,
  branch          TEXT,
  account_type    TEXT DEFAULT 'CURRENT',
  ledger_id       UUID REFERENCES public.ledgers(id),
  opening_balance NUMERIC(14,2) DEFAULT 0,
  opening_date    DATE DEFAULT CURRENT_DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  is_primary      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_dealer ON public.bank_accounts(dealer_id);

-- ── cheques ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cheques (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       TEXT NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  cheque_number   TEXT NOT NULL,
  cheque_date     DATE NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  direction       TEXT NOT NULL,
  party_name      TEXT NOT NULL,
  party_id        TEXT,
  party_type      TEXT,
  narration       TEXT,
  voucher_id      UUID REFERENCES public.vouchers(id),
  status          TEXT NOT NULL DEFAULT 'PENDING',
  is_pdc          BOOLEAN DEFAULT FALSE,
  clearing_date   DATE,
  bank_ref        TEXT,
  bounce_reason   TEXT,
  reversal_voucher_id UUID REFERENCES public.vouchers(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cheques_dealer ON public.cheques(dealer_id);
CREATE INDEX IF NOT EXISTS idx_cheques_bank_acc ON public.cheques(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_cheques_status ON public.cheques(status);
CREATE INDEX IF NOT EXISTS idx_cheques_date ON public.cheques(cheque_date);
CREATE INDEX IF NOT EXISTS idx_cheques_pdc ON public.cheques(is_pdc, cheque_date) WHERE is_pdc = TRUE;

-- ── bank_statement_lines ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          TEXT NOT NULL,
  bank_account_id    UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  txn_date           DATE NOT NULL,
  value_date         DATE,
  description        TEXT NOT NULL,
  ref_number         TEXT,
  debit              NUMERIC(14,2) DEFAULT 0,
  credit             NUMERIC(14,2) DEFAULT 0,
  balance            NUMERIC(14,2),
  recon_status       TEXT DEFAULT 'UNMATCHED',
  matched_voucher_id UUID REFERENCES public.vouchers(id),
  import_batch_id    TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsl_dealer_bank ON public.bank_statement_lines(dealer_id, bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bsl_date ON public.bank_statement_lines(txn_date);
CREATE INDEX IF NOT EXISTS idx_bsl_recon ON public.bank_statement_lines(recon_status);

-- ── bill_settlements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_settlements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          TEXT NOT NULL,
  payment_voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  invoice_id         TEXT NOT NULL,
  invoice_type       TEXT NOT NULL,
  settled_amount     NUMERIC(14,2) NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_settlements_voucher ON public.bill_settlements(payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_bill_settlements_invoice ON public.bill_settlements(invoice_id);

-- ── overdue_interest ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.overdue_interest (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        TEXT NOT NULL,
  invoice_id       TEXT NOT NULL,
  invoice_type     TEXT NOT NULL,
  party_id         TEXT NOT NULL,
  party_type       TEXT NOT NULL,
  overdue_days     INTEGER NOT NULL,
  overdue_amount   NUMERIC(14,2) NOT NULL,
  interest_rate    NUMERIC(5,2) NOT NULL,
  interest_amount  NUMERIC(14,2) NOT NULL,
  from_date        DATE NOT NULL,
  to_date          DATE NOT NULL,
  voucher_id       UUID REFERENCES public.vouchers(id),
  status           TEXT DEFAULT 'COMPUTED',
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overdue_interest_dealer ON public.overdue_interest(dealer_id);
CREATE INDEX IF NOT EXISTS idx_overdue_interest_invoice ON public.overdue_interest(invoice_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_accounts_dealer_access" ON public.bank_accounts;
CREATE POLICY "bank_accounts_dealer_access" ON public.bank_accounts
  FOR ALL USING (
    dealer_id IN (SELECT d.dealer_id FROM public.dealers d WHERE d.user_id = auth.uid())
  );

ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cheques_dealer_access" ON public.cheques;
CREATE POLICY "cheques_dealer_access" ON public.cheques
  FOR ALL USING (
    dealer_id IN (SELECT d.dealer_id FROM public.dealers d WHERE d.user_id = auth.uid())
  );

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_statement_lines_dealer_access" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_dealer_access" ON public.bank_statement_lines
  FOR ALL USING (
    dealer_id IN (SELECT d.dealer_id FROM public.dealers d WHERE d.user_id = auth.uid())
  );

ALTER TABLE public.bill_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_settlements_dealer_access" ON public.bill_settlements;
CREATE POLICY "bill_settlements_dealer_access" ON public.bill_settlements
  FOR ALL USING (
    dealer_id IN (SELECT d.dealer_id FROM public.dealers d WHERE d.user_id = auth.uid())
  );

ALTER TABLE public.overdue_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overdue_interest_dealer_access" ON public.overdue_interest;
CREATE POLICY "overdue_interest_dealer_access" ON public.overdue_interest
  FOR ALL USING (
    dealer_id IN (SELECT d.dealer_id FROM public.dealers d WHERE d.user_id = auth.uid())
  );

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── Receivables ageing (from `sales`) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_receivables_ageing(
  p_dealer_id TEXT,
  p_as_on     DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  farmer_id       TEXT,
  farmer_name     TEXT,
  mobile          TEXT,
  bucket_0_30     NUMERIC,
  bucket_31_60    NUMERIC,
  bucket_61_90    NUMERIC,
  bucket_90_plus  NUMERIC,
  total_due       NUMERIC,
  oldest_due_date DATE,
  credit_limit    NUMERIC,
  credit_blocked  BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id::TEXT,
    f.full_name::TEXT,
    f.mobile::TEXT,
    COALESCE(SUM(CASE
      WHEN (p_as_on - (
        COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30))))
      )) BETWEEN 0 AND 30
      THEN s.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN (p_as_on - (
        COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30))))
      )) BETWEEN 31 AND 60
      THEN s.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN (p_as_on - (
        COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30))))
      )) BETWEEN 61 AND 90
      THEN s.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN (p_as_on - (
        COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30))))
      )) > 90
      THEN s.balance_due ELSE 0 END), 0),
    COALESCE(SUM(s.balance_due), 0),
    MIN(COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30))))),
    f.credit_limit,
    f.credit_blocked
  FROM public.farmers f
  JOIN public.sales s ON s.farmer_id = f.id AND s.dealer_id = f.dealer_id
  WHERE f.dealer_id = p_dealer_id
    AND s.status IN ('pending', 'partial')
    AND s.balance_due > 0
    AND COALESCE(s.due_date::DATE, (s.sale_date::DATE + MAKE_INTERVAL(days => COALESCE(f.credit_days, 30)))) <= p_as_on
  GROUP BY f.id, f.full_name, f.mobile, f.credit_limit, f.credit_blocked
  HAVING COALESCE(SUM(s.balance_due), 0) > 0
  ORDER BY COALESCE(SUM(s.balance_due), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Payables ageing ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_payables_ageing(
  p_dealer_id TEXT,
  p_as_on     DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  supplier_id     TEXT,
  supplier_name   TEXT,
  mobile          TEXT,
  bucket_0_30     NUMERIC,
  bucket_31_60    NUMERIC,
  bucket_61_90    NUMERIC,
  bucket_90_plus  NUMERIC,
  total_due       NUMERIC,
  oldest_due_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id::TEXT,
    s.name::TEXT,
    s.mobile::TEXT,
    COALESCE(SUM(CASE WHEN (p_as_on - pi.due_date) BETWEEN 0 AND 30  THEN pi.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (p_as_on - pi.due_date) BETWEEN 31 AND 60 THEN pi.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (p_as_on - pi.due_date) BETWEEN 61 AND 90 THEN pi.balance_due ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN (p_as_on - pi.due_date) > 90 THEN pi.balance_due ELSE 0 END), 0),
    COALESCE(SUM(pi.balance_due), 0),
    MIN(pi.due_date)
  FROM public.suppliers s
  JOIN public.purchase_invoices pi ON pi.supplier_id = s.id
  WHERE s.dealer_id = p_dealer_id
    AND pi.status IN ('UNPAID', 'PARTIAL')
    AND pi.balance_due > 0
    AND pi.due_date IS NOT NULL
    AND pi.due_date <= p_as_on
  GROUP BY s.id, s.name, s.mobile
  HAVING COALESCE(SUM(pi.balance_due), 0) > 0
  ORDER BY COALESCE(SUM(pi.balance_due), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Settle bills (transactional) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_bills(
  p_voucher_id    UUID,
  p_settlements   JSONB
) RETURNS VOID AS $$
DECLARE
  v_item    JSONB;
  v_dealer  TEXT;
  v_amt     NUMERIC;
  v_inv     TEXT;
  v_type    TEXT;
  v_paid    NUMERIC;
  v_total   NUMERIC;
  v_new_paid NUMERIC;
  v_bal     NUMERIC;
BEGIN
  SELECT dealer_id::TEXT INTO v_dealer FROM public.vouchers WHERE id = p_voucher_id;
  IF v_dealer IS NULL THEN
    RAISE EXCEPTION 'Voucher not found';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_settlements) LOOP
    v_amt := (v_item->>'amount')::NUMERIC;
    v_inv := v_item->>'invoice_id';
    v_type := v_item->>'invoice_type';

    IF v_amt IS NULL OR v_amt <= 0 THEN
      RAISE EXCEPTION 'Invalid settlement amount';
    END IF;

    INSERT INTO public.bill_settlements (
      dealer_id, payment_voucher_id, invoice_id, invoice_type, settled_amount
    ) VALUES (
      v_dealer,
      p_voucher_id,
      v_inv,
      v_type,
      v_amt
    );

    IF v_type = 'SALE' THEN
      SELECT paid_amount, final_amount INTO v_paid, v_total
      FROM public.sales WHERE id = v_inv AND dealer_id = v_dealer;
      IF NOT FOUND THEN RAISE EXCEPTION 'Sale invoice not found'; END IF;

      v_new_paid := v_paid + v_amt;
      v_bal := v_total - v_new_paid;

      UPDATE public.sales
      SET paid_amount = v_new_paid,
          balance_due = GREATEST(0, v_bal),
          status = CASE WHEN v_bal <= 0 THEN 'paid' ELSE 'partial' END,
          updated_at = now()
      WHERE id = v_inv AND dealer_id = v_dealer;

    ELSIF v_type = 'PURCHASE' THEN
      SELECT paid_amount, total_amount INTO v_paid, v_total
      FROM public.purchase_invoices WHERE id::TEXT = v_inv AND dealer_id = v_dealer;
      IF NOT FOUND THEN RAISE EXCEPTION 'Purchase invoice not found'; END IF;

      v_new_paid := v_paid + v_amt;
      v_bal := v_total - v_new_paid;

      UPDATE public.purchase_invoices
      SET paid_amount = v_new_paid,
          balance_due = GREATEST(0, v_bal),
          status = CASE WHEN v_bal <= 0 THEN 'PAID' ELSE 'PARTIAL' END,
          updated_at = now()
      WHERE id::TEXT = v_inv AND dealer_id = v_dealer;
    ELSE
      RAISE EXCEPTION 'Unknown invoice_type %', v_type;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Resolve dealers.id (UUID) from business slug for next_doc_number ───────
CREATE OR REPLACE FUNCTION public._dealer_uuid_from_tenant_key(p TEXT)
RETURNS UUID AS $$
DECLARE v UUID;
BEGIN
  SELECT id INTO v FROM public.dealers WHERE dealer_id::TEXT = p::TEXT LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  BEGIN
    v := p::UUID;
    IF EXISTS (SELECT 1 FROM public.dealers WHERE id = v) THEN RETURN v; END IF;
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
  RAISE EXCEPTION 'Unknown dealer tenant key %', p;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ── Post farmer receipt RCT + allocations (minimal double-entry) ─────────────
CREATE OR REPLACE FUNCTION public.post_farmer_payment_receipt(
  p_dealer_id        TEXT,
  p_farmer_id        TEXT,
  p_amount           NUMERIC,
  p_bank_ledger_id   UUID,
  p_party_ledger_id  UUID,
  p_voucher_date     DATE DEFAULT CURRENT_DATE,
  p_narration        TEXT DEFAULT '',
  p_settlements      JSONB DEFAULT '[]'::JSONB
) RETURNS UUID AS $$
DECLARE
  v_uid           UUID;
  v_voucher_id    UUID;
  v_number        TEXT;
  v_fy            TEXT;
  y               INT;
  m               INT;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_bank_ledger_id IS NULL OR p_party_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Bank ledger and party ledger are required';
  END IF;

  v_uid := public._dealer_uuid_from_tenant_key(p_dealer_id);

  y := EXTRACT(YEAR FROM p_voucher_date)::INT;
  m := EXTRACT(MONTH FROM p_voucher_date)::INT;
  IF m >= 4 THEN
    v_fy := y::TEXT || '-' || LPAD(((y + 1) % 100)::TEXT, 2, '0');
  ELSE
    v_fy := (y - 1)::TEXT || '-' || LPAD((y % 100)::TEXT, 2, '0');
  END IF;

  v_number := public.next_doc_number(v_uid, 'RCT', v_fy);

  INSERT INTO public.vouchers (
    dealer_id, voucher_type, voucher_number, voucher_date,
    narration, total_amount, status, reference, meta
  ) VALUES (
    p_dealer_id, 'RCT', v_number, p_voucher_date,
    COALESCE(p_narration, ''), p_amount, 'POSTED',
    p_farmer_id,
    COALESCE(jsonb_build_object('farmer_id', p_farmer_id, 'tenant', p_dealer_id), '{}'::jsonb)
  ) RETURNING id INTO v_voucher_id;

  INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
  VALUES (v_voucher_id, p_bank_ledger_id, 'DR', p_amount);

  INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
  VALUES (v_voucher_id, p_party_ledger_id, 'CR', p_amount);

  IF jsonb_array_length(COALESCE(p_settlements, '[]'::JSONB)) > 0 THEN
    PERFORM public.settle_bills(v_voucher_id, p_settlements);
  END IF;

  RETURN v_voucher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Post supplier payment PMT + allocations ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_supplier_payment_voucher(
  p_dealer_id        TEXT,
  p_supplier_id      UUID,
  p_amount           NUMERIC,
  p_bank_ledger_id   UUID,
  p_party_ledger_id  UUID,
  p_voucher_date     DATE DEFAULT CURRENT_DATE,
  p_narration        TEXT DEFAULT '',
  p_settlements      JSONB DEFAULT '[]'::JSONB
) RETURNS UUID AS $$
DECLARE
  v_uid           UUID;
  v_voucher_id    UUID;
  v_number        TEXT;
  v_fy            TEXT;
  y               INT;
  m               INT;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  v_uid := public._dealer_uuid_from_tenant_key(p_dealer_id);

  y := EXTRACT(YEAR FROM p_voucher_date)::INT;
  m := EXTRACT(MONTH FROM p_voucher_date)::INT;
  IF m >= 4 THEN
    v_fy := y::TEXT || '-' || LPAD(((y + 1) % 100)::TEXT, 2, '0');
  ELSE
    v_fy := (y - 1)::TEXT || '-' || LPAD((y % 100)::TEXT, 2, '0');
  END IF;

  v_number := public.next_doc_number(v_uid, 'PMT', v_fy);

  INSERT INTO public.vouchers (
    dealer_id, voucher_type, voucher_number, voucher_date,
    narration, total_amount, status, reference, meta
  ) VALUES (
    p_dealer_id, 'PMT', v_number, p_voucher_date,
    COALESCE(p_narration, 'Supplier payment'), p_amount, 'POSTED',
    p_supplier_id::TEXT,
    jsonb_build_object('supplier_id', p_supplier_id, 'tenant', p_dealer_id)
  ) RETURNING id INTO v_voucher_id;

  INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
  VALUES (v_voucher_id, p_party_ledger_id, 'DR', p_amount);

  INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
  VALUES (v_voucher_id, p_bank_ledger_id, 'CR', p_amount);

  IF jsonb_array_length(COALESCE(p_settlements, '[]'::JSONB)) > 0 THEN
    PERFORM public.settle_bills(v_voucher_id, p_settlements);
  END IF;

  RETURN v_voucher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.compute_overdue_interest(
  p_dealer_id TEXT,
  p_as_on     DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  v_inv       RECORD;
  v_count     INTEGER := 0;
  v_days      INTEGER;
  v_interest  NUMERIC;
  v_rate      NUMERIC;
  v_due       DATE;
BEGIN
  DELETE FROM public.overdue_interest
  WHERE dealer_id = p_dealer_id AND status = 'COMPUTED';

  FOR v_inv IN
    SELECT si.id AS sale_id,
           si.balance_due,
           si.due_date,
           si.sale_date,
           f.id AS farmer_id,
           COALESCE(f.credit_days, 30) AS credit_days,
           f.interest_rate
    FROM public.sales si
    JOIN public.farmers f ON f.id = si.farmer_id AND f.dealer_id = si.dealer_id
    WHERE si.dealer_id = p_dealer_id
      AND si.status IN ('pending', 'partial')
      AND si.balance_due > 0
      AND COALESCE(f.interest_rate, 0) > 0
  LOOP
    v_due := COALESCE(
      v_inv.due_date::DATE,
      (v_inv.sale_date::DATE + MAKE_INTERVAL(days => v_inv.credit_days))
    );
    IF v_due >= p_as_on THEN CONTINUE; END IF;

    v_days     := (p_as_on - v_due);
    v_rate     := v_inv.interest_rate;
    v_interest := ROUND((v_inv.balance_due * v_rate * v_days) / (100 * 365), 2);

    IF v_interest > 0 THEN
      INSERT INTO public.overdue_interest (
        dealer_id, invoice_id, invoice_type, party_id, party_type,
        overdue_days, overdue_amount, interest_rate, interest_amount,
        from_date, to_date, status
      ) VALUES (
        p_dealer_id, v_inv.sale_id::TEXT, 'SALE', v_inv.farmer_id::TEXT, 'FARMER',
        v_days, v_inv.balance_due, v_rate, v_interest,
        v_due, p_as_on, 'COMPUTED'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.auto_match_bank_statement(
  p_dealer_id     TEXT,
  p_bank_acc_id   UUID,
  p_batch_id      TEXT
) RETURNS TABLE(matched INT, unmatched INT) AS $$
DECLARE
  v_line      public.bank_statement_lines%ROWTYPE;
  v_vid       UUID;
  v_matched   INT := 0;
  v_unmatched INT := 0;
BEGIN
  FOR v_line IN
    SELECT * FROM public.bank_statement_lines
    WHERE dealer_id::TEXT = p_dealer_id::TEXT
      AND bank_account_id = p_bank_acc_id
      AND import_batch_id::TEXT = p_batch_id::TEXT
      AND recon_status = 'UNMATCHED'
  LOOP
    v_vid := NULL;
    SELECT v.id INTO v_vid
    FROM public.vouchers v
    WHERE v.dealer_id::TEXT = p_dealer_id::TEXT
      AND v.total_amount = CASE
            WHEN v_line.credit > 0 THEN v_line.credit
            ELSE v_line.debit
          END::NUMERIC
      AND v.voucher_date BETWEEN v_line.txn_date - 3 AND v_line.txn_date + 3
      AND (
        (v_line.credit > 0 AND v.voucher_type = 'RCT') OR
        (v_line.debit > 0 AND v.voucher_type = 'PMT')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.bank_statement_lines bsl2
        WHERE bsl2.matched_voucher_id = v.id
      )
    ORDER BY ABS(EXTRACT(EPOCH FROM (v.voucher_date - v_line.txn_date)))
    LIMIT 1;

    IF v_vid IS NOT NULL THEN
      UPDATE public.bank_statement_lines
      SET recon_status = 'MATCHED', matched_voucher_id = v_vid
      WHERE id = v_line.id;
      v_matched := v_matched + 1;
      v_vid := NULL;
    ELSE
      v_unmatched := v_unmatched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_unmatched;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;