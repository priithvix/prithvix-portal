/**
 * PrithviX Phase F+G — Tally XML RPCs, bank dedupe, agri differentiators.
 * Run after Phases A–E.
 */

-- ═══════════════════════════════════════════════════════════════════════════
-- GAP 1 — Duplicate bank import protection (ref_number may be NULL)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_line_no_ref
  ON public.bank_statement_lines (dealer_id, bank_account_id, txn_date, debit, credit)
  WHERE ref_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_line_with_ref
  ON public.bank_statement_lines (dealer_id, bank_account_id, txn_date, ref_number, debit, credit)
  WHERE ref_number IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase F — Tally XML export RPCs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_vouchers_for_tally_export(
  p_dealer_uuid UUID,
  p_from        DATE,
  p_to          DATE
) RETURNS TABLE(
  voucher_id      UUID,
  voucher_date    DATE,
  voucher_type    TEXT,
  voucher_number  TEXT,
  narration       TEXT,
  total_amount    NUMERIC,
  ledger_name     TEXT,
  dr_cr           TEXT,
  entry_amount    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.voucher_date,
    v.voucher_type,
    v.voucher_number,
    COALESCE(v.narration, ''),
    v.total_amount,
    l.name,
    ve.dr_cr,
    ve.amount
  FROM public.vouchers v
  JOIN public.voucher_entries ve ON ve.voucher_id = v.id
  JOIN public.ledgers l ON l.id = ve.ledger_id
  WHERE public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED'
  ORDER BY v.voucher_date, v.voucher_number, ve.dr_cr, ve.id;
$$;

ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS balance_type TEXT DEFAULT 'DR';
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.get_ledgers_for_tally_export(
  p_dealer_uuid UUID
) RETURNS TABLE(
  ledger_name     TEXT,
  group_name      TEXT,
  opening_balance NUMERIC,
  balance_type    TEXT,
  gstin           TEXT,
  state_name      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.name::TEXT,
    COALESCE(g.group_name::TEXT, g.group_code::TEXT, '')::TEXT,
    COALESCE(l.opening_balance, 0)::NUMERIC,
    COALESCE(NULLIF(trim(l.balance_type::TEXT), ''), 'DR')::TEXT,
    l.gstin::TEXT,
    NULL::TEXT
  FROM public.ledgers l
  LEFT JOIN public.ledger_groups g ON g.id = l.ledger_group_id
  WHERE l.dealer_id = p_dealer_uuid
    AND COALESCE(l.is_active, TRUE) = TRUE
  ORDER BY g.group_name, l.name;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase G1 — Schemes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agri_schemes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
  scheme_name      TEXT NOT NULL,
  scheme_type      TEXT NOT NULL,
  state_code       TEXT,
  description      TEXT,
  benefit_type     TEXT,
  benefit_amount   NUMERIC(14,2),
  eligibility      TEXT,
  deadline_date    DATE,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agri_scheme_global_name
  ON public.agri_schemes (scheme_name)
  WHERE dealer_id IS NULL;

CREATE TABLE IF NOT EXISTS public.farmer_scheme_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  farmer_id         TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  scheme_id         UUID NOT NULL REFERENCES public.agri_schemes(id) ON DELETE CASCADE,
  enrollment_date   DATE DEFAULT CURRENT_DATE,
  status            TEXT DEFAULT 'ENROLLED',
  benefit_received  NUMERIC(14,2) DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (farmer_id, scheme_id)
);

ALTER TABLE public.agri_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_scheme_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agri_schemes_access" ON public.agri_schemes;
CREATE POLICY "agri_schemes_access" ON public.agri_schemes
  FOR ALL USING (
    dealer_id IS NULL
    OR dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "farmer_scheme_enrollments_access" ON public.farmer_scheme_enrollments;
CREATE POLICY "farmer_scheme_enrollments_access" ON public.farmer_scheme_enrollments
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

INSERT INTO public.agri_schemes (dealer_id, scheme_name, scheme_type, description, benefit_type, benefit_amount)
SELECT NULL, v.scheme_name, v.scheme_type, v.description, v.benefit_type, v.benefit_amount
FROM (VALUES
  ('PM-KISAN', 'CENTRAL', 'Pradhan Mantri Kisan Samman Nidhi — ₹6,000/year in 3 instalments', 'CASH', 6000::NUMERIC),
  ('DBT Fertilizer', 'CENTRAL', 'Direct Benefit Transfer for subsidised fertilizer', 'SUBSIDY', NULL),
  ('PMFBY', 'CENTRAL', 'Pradhan Mantri Fasal Bima Yojana — crop insurance', 'INSURANCE', NULL),
  ('Kisan Credit Card', 'BANK', 'Short-term crop loan at subsidised interest rate', 'CREDIT', NULL),
  ('Soil Health Card', 'CENTRAL', 'Free soil testing + recommendation card', 'SUBSIDY', NULL)
) AS v(scheme_name, scheme_type, description, benefit_type, benefit_amount)
WHERE NOT EXISTS (
  SELECT 1 FROM public.agri_schemes s WHERE s.dealer_id IS NULL AND s.scheme_name = v.scheme_name
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase G2 — Crop cycles + sales link
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.crop_cycles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  farmer_id        TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  crop_name        TEXT NOT NULL,
  season           TEXT NOT NULL,
  sowing_date      DATE,
  expected_harvest DATE NOT NULL,
  actual_harvest   DATE,
  plot_area_acres  NUMERIC(8,2),
  plot_location    TEXT,
  status           TEXT DEFAULT 'ACTIVE',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crop_cycles_access" ON public.crop_cycles;
CREATE POLICY "crop_cycles_access" ON public.crop_cycles
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS crop_cycle_id UUID REFERENCES public.crop_cycles(id);
    ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date_override DATE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_sale_crop_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.crop_cycle_id IS NOT NULL THEN
      SELECT cc.expected_harvest INTO NEW.due_date
      FROM public.crop_cycles cc
      WHERE cc.id = NEW.crop_cycle_id;
    ELSIF NEW.due_date_override IS NOT NULL THEN
      NEW.due_date := NEW.due_date_override;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_crop_due_date ON public.sales;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales'
  ) THEN
    CREATE TRIGGER trg_sale_crop_due_date
      BEFORE INSERT OR UPDATE ON public.sales
      FOR EACH ROW
      EXECUTE PROCEDURE public.set_sale_crop_due_date();
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase G3 — Batches + traceability
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES public.product_master(id) ON DELETE CASCADE,
  batch_number       TEXT NOT NULL,
  manufacture_date   DATE,
  expiry_date        DATE NOT NULL,
  quantity_received  NUMERIC(10,3) NOT NULL,
  quantity_remaining NUMERIC(10,3) NOT NULL,
  grn_id             UUID REFERENCES public.grns(id),
  supplier_id        UUID REFERENCES public.suppliers(id),
  cost_price         NUMERIC(14,2),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dealer_id, product_id, batch_number)
);

CREATE TABLE IF NOT EXISTS public.sale_traceability (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  sales_invoice_id   TEXT NOT NULL,
  sales_item_id      TEXT,
  farmer_id          TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES public.product_master(id) ON DELETE CASCADE,
  batch_id           UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  batch_number       TEXT NOT NULL,
  quantity           NUMERIC(10,3) NOT NULL,
  sale_date          DATE NOT NULL,
  crop_cycle_id      UUID REFERENCES public.crop_cycles(id),
  plot_location      TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales'
  ) THEN
    ALTER TABLE public.sale_traceability
      ADD CONSTRAINT sale_traceability_sales_invoice_id_fkey
      FOREIGN KEY (sales_invoice_id) REFERENCES public.sales(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.get_expiring_batches(
  p_dealer_id UUID,
  p_days_ahead INTEGER DEFAULT 30
) RETURNS TABLE(
  product_name    TEXT,
  batch_number    TEXT,
  expiry_date     DATE,
  days_remaining  INTEGER,
  quantity        NUMERIC,
  estimated_value NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.product_name::TEXT,
    pb.batch_number::TEXT,
    pb.expiry_date,
    (pb.expiry_date - CURRENT_DATE)::INTEGER,
    pb.quantity_remaining,
    ROUND(pb.quantity_remaining * COALESCE(pb.cost_price, 0), 2)
  FROM public.product_batches pb
  JOIN public.product_master p ON p.id = pb.product_id
  WHERE pb.dealer_id = p_dealer_id
    AND pb.quantity_remaining > 0
    AND pb.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + p_days_ahead
  ORDER BY pb.expiry_date;
$$;

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_traceability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_batches_access" ON public.product_batches;
CREATE POLICY "product_batches_access" ON public.product_batches
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "sale_traceability_access" ON public.sale_traceability;
CREATE POLICY "sale_traceability_access" ON public.sale_traceability
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase G4 — WhatsApp inbox
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS wa_access_token TEXT;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  wa_message_id    TEXT UNIQUE,
  from_number      TEXT NOT NULL,
  farmer_id        TEXT REFERENCES public.farmers(id),
  message_text     TEXT NOT NULL,
  message_type     TEXT DEFAULT 'text',
  parsed_order     JSONB,
  status           TEXT DEFAULT 'RECEIVED',
  order_id         TEXT,
  received_at      TIMESTAMPTZ DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_access" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_access" ON public.whatsapp_messages
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );
