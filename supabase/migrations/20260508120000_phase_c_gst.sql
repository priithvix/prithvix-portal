/**
 * PrithviX Phase C — GST (GSTR-1, GSTR-3B, GSTR-2B, HSN, Audit)
 *
 * Tenant key: dealers.id (UUID) as dealer_id on GST tables (matches Phase B purchases).
 * Sales/farmers use dealers.dealer_id (business slug) — RPCs resolve slug from dealers.id.
 *
 * Run after Phase B. Optional: ADD gst_return_periods before first use.
 */

ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS state_code TEXT;

-- ── gst_return_periods ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_return_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  return_period    TEXT NOT NULL,
  financial_year   TEXT NOT NULL,
  gstr1_status     TEXT NOT NULL DEFAULT 'DRAFT',
  gstr3b_status    TEXT NOT NULL DEFAULT 'DRAFT',
  gstr1_filed_on   TIMESTAMPTZ,
  gstr3b_filed_on  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, return_period)
);

CREATE INDEX IF NOT EXISTS idx_gst_periods_dealer ON public.gst_return_periods(dealer_id, return_period);

-- ── gstr1_records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gstr1_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  return_period   TEXT NOT NULL,
  invoice_id      TEXT,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  invoice_type    TEXT NOT NULL,
  customer_name   TEXT,
  customer_gstin  TEXT,
  customer_state  TEXT,
  supply_type     TEXT,
  taxable_value   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cess            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_tax       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  invoice_value   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  hsn_code        TEXT,
  gst_rate        NUMERIC(7, 4) NOT NULL DEFAULT 0,
  irn             TEXT,
  is_amended      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gstr1_dealer_period ON public.gstr1_records(dealer_id, return_period);
CREATE INDEX IF NOT EXISTS idx_gstr1_invoice_type ON public.gstr1_records(invoice_type);

-- ── gstr3b_summary ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gstr3b_summary (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id             UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  return_period         TEXT NOT NULL,
  taxable_outward       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_outward_igst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_outward_cgst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_outward_sgst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  nil_rated_value       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_igst              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_cgst              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_sgst              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  exempt_inward         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_payable_igst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_payable_cgst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_payable_sgst      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_utilized_igst     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_utilized_cgst     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_utilized_sgst     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cash_paid_igst        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cash_paid_cgst        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cash_paid_sgst        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  interest_paid         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  late_fee_paid         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'DRAFT',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, return_period)
);

CREATE INDEX IF NOT EXISTS idx_gstr3b_dealer_period ON public.gstr3b_summary(dealer_id, return_period);

-- ── gstr2b_records ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gstr2b_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  return_period    TEXT NOT NULL,
  supplier_gstin   TEXT NOT NULL,
  supplier_name    TEXT,
  invoice_number   TEXT NOT NULL,
  invoice_date     DATE,
  invoice_type     TEXT,
  taxable_value    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cess             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_tax        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itc_available    BOOLEAN NOT NULL DEFAULT TRUE,
  recon_status     TEXT NOT NULL DEFAULT 'UNMATCHED',
  matched_pi_id    UUID REFERENCES public.purchase_invoices(id),
  mismatch_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gstr2b_dealer_period ON public.gstr2b_records(dealer_id, return_period);
CREATE INDEX IF NOT EXISTS idx_gstr2b_recon ON public.gstr2b_records(recon_status);

-- ── hsn_summary ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hsn_summary (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  return_period    TEXT NOT NULL,
  direction        TEXT NOT NULL,
  hsn_code         TEXT NOT NULL,
  description      TEXT,
  uom              TEXT NOT NULL DEFAULT 'BAG',
  total_quantity   NUMERIC(14, 3) NOT NULL DEFAULT 0,
  taxable_value    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cess             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, return_period, direction, hsn_code)
);

CREATE INDEX IF NOT EXISTS idx_hsn_dealer_period ON public.hsn_summary(dealer_id, return_period);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.gst_return_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr1_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr3b_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gstr2b_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gst_periods_dealer_access" ON public.gst_return_periods;
CREATE POLICY "gst_periods_dealer_access" ON public.gst_return_periods
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "gstr1_dealer_access" ON public.gstr1_records;
CREATE POLICY "gstr1_dealer_access" ON public.gstr1_records
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "gstr3b_dealer_access" ON public.gstr3b_summary;
CREATE POLICY "gstr3b_dealer_access" ON public.gstr3b_summary
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "gstr2b_dealer_access" ON public.gstr2b_records;
CREATE POLICY "gstr2b_dealer_access" ON public.gstr2b_records
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "hsn_dealer_access" ON public.hsn_summary;
CREATE POLICY "hsn_dealer_access" ON public.hsn_summary
  FOR ALL USING (
    dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );

-- ── generate_hsn_summary (must exist before generate_gstr1) ───────────────────
CREATE OR REPLACE FUNCTION public.generate_hsn_summary(
  p_dealer_id UUID,
  p_period    TEXT,
  p_direction TEXT
) RETURNS VOID AS $$
DECLARE
  v_month   INTEGER;
  v_year    INTEGER;
  v_start   DATE;
  v_end     DATE;
  v_slug    TEXT;
BEGIN
  v_month := SPLIT_PART(p_period, '-', 1)::INTEGER;
  v_year  := SPLIT_PART(p_period, '-', 2)::INTEGER;
  v_start := make_date(v_year, v_month, 1);
  v_end   := (v_start + INTERVAL '1 month - 1 day')::DATE;

  SELECT d.dealer_id INTO v_slug FROM public.dealers d WHERE d.id = p_dealer_id;
  IF v_slug IS NULL THEN RAISE EXCEPTION 'Dealer not found'; END IF;

  DELETE FROM public.hsn_summary
  WHERE dealer_id = p_dealer_id AND return_period = p_period AND direction = p_direction;

  IF upper(p_direction) = 'OUTWARD' THEN
    INSERT INTO public.hsn_summary (
      dealer_id, return_period, direction, hsn_code, description,
      uom, total_quantity, taxable_value, igst, cgst, sgst, cess
    )
    SELECT
      p_dealer_id,
      p_period,
      'OUTWARD',
      COALESCE(pm.hsn_code, '0000'),
      MAX(COALESCE(pm.product_name, t.elem->>'itemName', t.elem->>'item_name', '—')),
      MAX(COALESCE(t.elem->>'unit', 'BAG')),
      SUM(
        COALESCE(NULLIF(TRIM(t.elem->>'quantity'), '')::NUMERIC, 0)
        * CASE WHEN COALESCE(s.subtotal, 0) > 0 THEN (s.final_amount / s.subtotal) ELSE 1 END
      ),
      SUM(
        COALESCE(
          NULLIF(TRIM(t.elem->>'lineTotalExGst'), '')::NUMERIC,
          NULLIF(TRIM(t.elem->>'line_total_ex_gst'), '')::NUMERIC,
          0
        )
        * CASE WHEN COALESCE(s.subtotal, 0) > 0 THEN (s.final_amount / s.subtotal) ELSE 1 END
      ),
      SUM(
        CASE
          WHEN (
            fm.state_code IS NOT NULL AND ds.state_code IS NOT NULL
            AND fm.state_code <> ds.state_code
          )
          THEN COALESCE(
            NULLIF(TRIM(t.elem->>'lineGstAmount'), '')::NUMERIC,
            NULLIF(TRIM(t.elem->>'line_gst_amount'), '')::NUMERIC,
            0
          )
          ELSE 0
        END
        * CASE WHEN COALESCE(s.subtotal, 0) > 0 THEN (s.final_amount / s.subtotal) ELSE 1 END
      ),
      SUM(
        CASE
          WHEN (
            fm.state_code IS NULL OR ds.state_code IS NULL OR fm.state_code = ds.state_code
          )
          THEN ROUND(
            COALESCE(
              NULLIF(TRIM(t.elem->>'lineGstAmount'), '')::NUMERIC,
              NULLIF(TRIM(t.elem->>'line_gst_amount'), '')::NUMERIC,
              0
            ) / 2,
            2
          )
          ELSE 0
        END
        * CASE WHEN COALESCE(s.subtotal, 0) > 0 THEN (s.final_amount / s.subtotal) ELSE 1 END
      ),
      SUM(
        CASE
          WHEN (
            fm.state_code IS NULL OR ds.state_code IS NULL OR fm.state_code = ds.state_code
          )
          THEN COALESCE(
            NULLIF(TRIM(t.elem->>'lineGstAmount'), '')::NUMERIC,
            NULLIF(TRIM(t.elem->>'line_gst_amount'), '')::NUMERIC,
            0
          )
          - ROUND(
            COALESCE(
              NULLIF(TRIM(t.elem->>'lineGstAmount'), '')::NUMERIC,
              NULLIF(TRIM(t.elem->>'line_gst_amount'), '')::NUMERIC,
              0
            ) / 2,
            2
          )
          ELSE 0
        END
        * CASE WHEN COALESCE(s.subtotal, 0) > 0 THEN (s.final_amount / s.subtotal) ELSE 1 END
      ),
      0
    FROM public.sales s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.items, '[]'::JSONB)) AS t(elem)
    LEFT JOIN public.farmers fm ON fm.id = s.farmer_id AND fm.dealer_id = v_slug
    LEFT JOIN public.dealers ds ON ds.id = p_dealer_id
    LEFT JOIN public.product_master pm
      ON pm.id = (NULLIF(TRIM(t.elem->>'productId'), ''))::UUID
    WHERE s.dealer_id = v_slug
      AND COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_start AND v_end
    GROUP BY COALESCE(pm.hsn_code, '0000');

  ELSE
    INSERT INTO public.hsn_summary (
      dealer_id, return_period, direction, hsn_code, description,
      uom, total_quantity, taxable_value, igst, cgst, sgst, cess
    )
    SELECT
      p_dealer_id,
      p_period,
      'INWARD',
      COALESCE(pii.hsn_code, '0000'),
      MAX(pii.product_name),
      MAX(COALESCE(pii.unit, 'BAG')),
      SUM(pii.quantity),
      SUM(pii.amount - pii.gst_amount),
      SUM(pii.igst_amount),
      SUM(pii.cgst_amount),
      SUM(pii.sgst_amount),
      0
    FROM public.purchase_invoice_items pii
    JOIN public.purchase_invoices pi ON pi.id = pii.pi_id
    WHERE pi.dealer_id = p_dealer_id
      AND pi.invoice_date BETWEEN v_start AND v_end
      AND COALESCE(pi.status, '') <> 'CANCELLED'
    GROUP BY COALESCE(pii.hsn_code, '0000');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── generate_gstr1 ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_gstr1(
  p_dealer_id UUID,
  p_period    TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_month    INTEGER;
  v_year     INTEGER;
  v_start    DATE;
  v_end      DATE;
  v_count    INTEGER := 0;
  v_slug     TEXT;
  v_d_state  TEXT;
  v_g1_stat  TEXT;
  r_sale     RECORD;
  v_ex_gst   NUMERIC;
  v_gst_ln   NUMERIC;
  v_ratio    NUMERIC;
  v_taxable  NUMERIC;
  v_cgst     NUMERIC;
  v_sgst     NUMERIC;
  v_igst     NUMERIC;
  v_half     NUMERIC;
  intra      BOOLEAN;
  v_gst_rate NUMERIC;
  items      JSONB;
  idx        INT;
  n          INT;
  jelem      JSONB;
BEGIN
  v_month := SPLIT_PART(p_period, '-', 1)::INTEGER;
  v_year  := SPLIT_PART(p_period, '-', 2)::INTEGER;
  v_start := make_date(v_year, v_month, 1);
  v_end   := (v_start + INTERVAL '1 month - 1 day')::DATE;

  SELECT d.dealer_id, d.state_code, COALESCE(gp.gstr1_status, 'DRAFT')
  INTO v_slug, v_d_state, v_g1_stat
  FROM public.dealers d
  LEFT JOIN public.gst_return_periods gp
    ON gp.dealer_id = d.id AND gp.return_period = p_period
  WHERE d.id = p_dealer_id;

  IF v_slug IS NULL THEN RAISE EXCEPTION 'Dealer not found'; END IF;

  IF v_g1_stat IN ('FILED', 'FROZEN') THEN
    RAISE EXCEPTION 'GSTR-1 is filed for this period';
  END IF;

  DELETE FROM public.gstr1_records
  WHERE dealer_id = p_dealer_id AND return_period = p_period;

  FOR r_sale IN
    SELECT
      s.*,
      fm.full_name  AS f_name,
      fm.gstin      AS f_gstin,
      fm.state_code AS f_state
    FROM public.sales s
    LEFT JOIN public.farmers fm ON fm.id = s.farmer_id AND fm.dealer_id = v_slug
    WHERE s.dealer_id = v_slug
      AND COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_start AND v_end
  LOOP
    v_ratio := CASE WHEN COALESCE(r_sale.subtotal, 0) > 0
      THEN (r_sale.final_amount / r_sale.subtotal) ELSE 1 END;
    v_taxable := 0;
    v_cgst := 0;
    v_sgst := 0;
    v_igst := 0;

    intra := (
      r_sale.f_state IS NULL
      OR v_d_state IS NULL
      OR r_sale.f_state = v_d_state
    );

    items := COALESCE(r_sale.items, '[]'::JSONB);
    n := COALESCE(jsonb_array_length(items), 0);
    FOR idx IN 0 .. GREATEST(n - 1, 0)
    LOOP
      EXIT WHEN idx >= n;
      jelem := items->idx;

      v_ex_gst := ROUND(
        COALESCE(
          NULLIF(TRIM(jelem->>'lineTotalExGst'), '')::NUMERIC,
          NULLIF(TRIM(jelem->>'line_total_ex_gst'), '')::NUMERIC,
          0
        ) * v_ratio,
        2
      );
      v_gst_ln := ROUND(
        COALESCE(
          NULLIF(TRIM(jelem->>'lineGstAmount'), '')::NUMERIC,
          NULLIF(TRIM(jelem->>'line_gst_amount'), '')::NUMERIC,
          0
        ) * v_ratio,
        2
      );

      IF intra THEN
        v_half := ROUND(v_gst_ln / 2, 2);
        v_cgst := v_cgst + v_half;
        v_sgst := v_sgst + (v_gst_ln - v_half);
      ELSE
        v_igst := v_igst + v_gst_ln;
      END IF;

      v_taxable := v_taxable + v_ex_gst;
    END LOOP;

    v_gst_rate := CASE
      WHEN v_taxable > 0 THEN ROUND((v_cgst + v_sgst + v_igst) / v_taxable * 100, 4)
      ELSE 0
    END;

    INSERT INTO public.gstr1_records (
      dealer_id, return_period, invoice_id, invoice_number, invoice_date,
      invoice_type, customer_name, customer_gstin, customer_state, supply_type,
      taxable_value, cgst, sgst, igst, cess, total_tax, invoice_value,
      hsn_code, gst_rate
    ) VALUES (
      p_dealer_id,
      p_period,
      r_sale.id,
      'SAL/' || r_sale.id::TEXT,
      COALESCE(
        r_sale.sale_date,
        (r_sale.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
      ),
      CASE
        WHEN r_sale.f_gstin IS NOT NULL AND btrim(r_sale.f_gstin) <> '' THEN 'B2B'
        WHEN COALESCE(r_sale.final_amount, 0) >= 250000 THEN 'B2C_LARGE'
        ELSE 'B2C_SMALL'
      END,
      r_sale.f_name,
      r_sale.f_gstin,
      r_sale.f_state,
      CASE WHEN intra THEN 'INTRA' ELSE 'INTER' END,
      v_taxable,
      v_cgst,
      v_sgst,
      v_igst,
      0,
      v_cgst + v_sgst + v_igst,
      COALESCE(r_sale.final_amount, 0),
      NULL,
      v_gst_rate
    );

    v_count := v_count + 1;
  END LOOP;

  PERFORM public.generate_hsn_summary(p_dealer_id, p_period, 'OUTWARD');

  INSERT INTO public.gst_return_periods (
    dealer_id, return_period, financial_year
  ) VALUES (
    p_dealer_id,
    p_period,
    CASE
      WHEN v_month >= 4 THEN v_year::TEXT || '-' || LPAD(((v_year + 1) % 100)::TEXT, 2, '0')
      ELSE (v_year - 1)::TEXT || '-' || LPAD((v_year % 100)::TEXT, 2, '0')
    END
  )
  ON CONFLICT (dealer_id, return_period) DO NOTHING;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── reconcile_gstr2b ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_gstr2b(
  p_dealer_id UUID,
  p_period    TEXT
) RETURNS TABLE(matched INT, mismatched INT, missing_in_books INT) AS $$
DECLARE
  v_matched   INT := 0;
  v_mismatch  INT := 0;
  v_missing   INT := 0;
  v_rec       RECORD;
  v_pi        RECORD;
BEGIN
  UPDATE public.gstr2b_records
  SET
    recon_status = 'UNMATCHED',
    matched_pi_id = NULL,
    mismatch_reason = NULL
  WHERE dealer_id = p_dealer_id AND return_period = p_period;

  FOR v_rec IN
    SELECT * FROM public.gstr2b_records
    WHERE dealer_id = p_dealer_id AND return_period = p_period
  LOOP
    SELECT pi.* INTO v_pi
    FROM public.purchase_invoices pi
    JOIN public.suppliers s ON s.id = pi.supplier_id
    WHERE pi.dealer_id = p_dealer_id
      AND s.gstin IS NOT NULL
      AND replace(upper(trim(s.gstin)), ' ', '') = replace(upper(trim(v_rec.supplier_gstin)), ' ', '')
      AND (
        replace(upper(trim(COALESCE(pi.supplier_inv_no, ''))), ' ', '') =
          replace(upper(trim(v_rec.invoice_number)), ' ', '')
        OR replace(upper(trim(pi.pi_number)), ' ', '') =
          replace(upper(trim(v_rec.invoice_number)), ' ', '')
      )
    LIMIT 1;

    IF FOUND THEN
      IF ABS(COALESCE(v_pi.tax_amount, 0) - COALESCE(v_rec.total_tax, 0)) <= 1 THEN
        UPDATE public.gstr2b_records
        SET recon_status = 'MATCHED', matched_pi_id = v_pi.id, mismatch_reason = NULL
        WHERE id = v_rec.id;
        v_matched := v_matched + 1;
      ELSE
        UPDATE public.gstr2b_records
        SET
          recon_status = 'MISMATCH',
          matched_pi_id = v_pi.id,
          mismatch_reason =
            'Tax: books ₹' || COALESCE(v_pi.tax_amount::TEXT, '0')
            || ' vs 2B ₹' || COALESCE(v_rec.total_tax::TEXT, '0')
        WHERE id = v_rec.id;
        v_mismatch := v_mismatch + 1;
      END IF;
    ELSE
      UPDATE public.gstr2b_records
      SET recon_status = 'MISSING_IN_BOOKS', matched_pi_id = NULL
      WHERE id = v_rec.id;
      v_missing := v_missing + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_mismatch, v_missing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── compute_gstr3b ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_gstr3b(
  p_dealer_id UUID,
  p_period    TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  o_taxable NUMERIC;
  o_igst    NUMERIC;
  o_cgst    NUMERIC;
  o_sgst    NUMERIC;
  i_igst    NUMERIC;
  i_cgst    NUMERIC;
  i_sgst    NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(taxable_value), 0),
    COALESCE(SUM(igst), 0),
    COALESCE(SUM(cgst), 0),
    COALESCE(SUM(sgst), 0)
  INTO o_taxable, o_igst, o_cgst, o_sgst
  FROM public.gstr1_records
  WHERE dealer_id = p_dealer_id AND return_period = p_period;

  SELECT
    COALESCE(SUM(CASE WHEN recon_status IN ('MATCHED', 'MISMATCH') THEN igst ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN recon_status IN ('MATCHED', 'MISMATCH') THEN cgst ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN recon_status IN ('MATCHED', 'MISMATCH') THEN sgst ELSE 0 END), 0)
  INTO i_igst, i_cgst, i_sgst
  FROM public.gstr2b_records
  WHERE dealer_id = p_dealer_id AND return_period = p_period;

  INSERT INTO public.gstr3b_summary (
    dealer_id,
    return_period,
    taxable_outward,
    tax_outward_igst,
    tax_outward_cgst,
    tax_outward_sgst,
    itc_igst,
    itc_cgst,
    itc_sgst,
    itc_utilized_igst,
    itc_utilized_cgst,
    itc_utilized_sgst,
    tax_payable_igst,
    tax_payable_cgst,
    tax_payable_sgst,
    cash_paid_igst,
    cash_paid_cgst,
    cash_paid_sgst
  ) VALUES (
    p_dealer_id,
    p_period,
    o_taxable,
    o_igst,
    o_cgst,
    o_sgst,
    i_igst,
    i_cgst,
    i_sgst,
    LEAST(o_igst, i_igst),
    LEAST(o_cgst, i_cgst),
    LEAST(o_sgst, i_sgst),
    GREATEST(o_igst - i_igst, 0),
    GREATEST(o_cgst - i_cgst, 0),
    GREATEST(o_sgst - i_sgst, 0),
    GREATEST(o_igst - LEAST(o_igst, i_igst), 0),
    GREATEST(o_cgst - LEAST(o_cgst, i_cgst), 0),
    GREATEST(o_sgst - LEAST(o_sgst, i_sgst), 0)
  )
  ON CONFLICT (dealer_id, return_period)
  DO UPDATE SET
    taxable_outward       = EXCLUDED.taxable_outward,
    tax_outward_igst       = EXCLUDED.tax_outward_igst,
    tax_outward_cgst       = EXCLUDED.tax_outward_cgst,
    tax_outward_sgst       = EXCLUDED.tax_outward_sgst,
    itc_igst               = EXCLUDED.itc_igst,
    itc_cgst               = EXCLUDED.itc_cgst,
    itc_sgst               = EXCLUDED.itc_sgst,
    itc_utilized_igst      = EXCLUDED.itc_utilized_igst,
    itc_utilized_cgst      = EXCLUDED.itc_utilized_cgst,
    itc_utilized_sgst      = EXCLUDED.itc_utilized_sgst,
    tax_payable_igst       = EXCLUDED.tax_payable_igst,
    tax_payable_cgst       = EXCLUDED.tax_payable_cgst,
    tax_payable_sgst       = EXCLUDED.tax_payable_sgst,
    cash_paid_igst         = EXCLUDED.cash_paid_igst,
    cash_paid_cgst         = EXCLUDED.cash_paid_cgst,
    cash_paid_sgst         = EXCLUDED.cash_paid_sgst,
    updated_at             = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.generate_gstr1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_hsn_summary(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_gstr2b(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_gstr3b(UUID, TEXT) TO authenticated;
