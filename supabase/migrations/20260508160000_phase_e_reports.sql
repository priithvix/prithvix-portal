/**
 * PrithviX Phase E — Reports & MIS RPCs
 *
 * Tenant FK: dealers.id (UUID). Sales/farmers use dealers.dealer_id (business slug TEXT).
 * Vouchers historically may store dealer_id as slug TEXT or UUID TEXT — matching uses slug + uuid.
 */

ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS account_type TEXT;

-- ── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._dealer_slug_from_uuid(p_dealer_uuid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealer_id FROM public.dealers WHERE id = p_dealer_uuid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._vouchers_match_dealer(v_dealer TEXT, p_dealer_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v_dealer IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dealers d
      WHERE d.id = p_dealer_uuid
        AND (
          d.dealer_id::TEXT = v_dealer::TEXT
          OR d.id::TEXT = v_dealer::TEXT
        )
    );
$$;

COMMENT ON FUNCTION public._vouchers_match_dealer(TEXT, UUID) IS
  'Matches voucher.dealer_id (slug or UUID string) against dealers row.';

-- Explode GST from sales.items JSON + ratio (aligned with generate_gstr1 logic)
DROP FUNCTION IF EXISTS public._sale_line_gst_totals(RECORD, TEXT);
CREATE OR REPLACE FUNCTION public._sale_line_gst_totals(
  p_items          JSONB,
  p_subtotal       NUMERIC,
  p_final_amount   NUMERIC,
  p_farmer_state   TEXT,
  p_dealer_state   TEXT
)
RETURNS TABLE (
  taxable_value NUMERIC,
  cgst NUMERIC,
  sgst NUMERIC,
  igst NUMERIC,
  total_tax NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ratio     NUMERIC;
  items       JSONB;
  intra       BOOLEAN;
  n           INT;
  idx         INT;
  jelem       JSONB;
  v_ex_gst    NUMERIC;
  v_gst_ln    NUMERIC;
  v_half      NUMERIC;
  v_taxable   NUMERIC := 0;
  v_cgst      NUMERIC := 0;
  v_sgst      NUMERIC := 0;
  v_igst      NUMERIC := 0;
BEGIN
  v_ratio := CASE
    WHEN COALESCE(p_subtotal, 0) > 0 THEN (COALESCE(p_final_amount, 0) / p_subtotal)
    ELSE 1
  END;
  intra := (
    COALESCE(p_farmer_state, '') IS NULL
    OR trim(COALESCE(p_farmer_state, '')) = ''
    OR COALESCE(p_dealer_state, '') IS NULL
    OR p_farmer_state = p_dealer_state
  );

  items := COALESCE(p_items, '[]'::JSONB);
  n := COALESCE(jsonb_array_length(items), 0);
  FOR idx IN 0 .. GREATEST(n - 1, 0) LOOP
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

    v_taxable := v_taxable + v_ex_gst;

    IF intra THEN
      v_half := ROUND(v_gst_ln / 2, 2);
      v_cgst := v_cgst + v_half;
      v_sgst := v_sgst + (v_gst_ln - v_half);
    ELSE
      v_igst := v_igst + v_gst_ln;
    END IF;
  END LOOP;

  taxable_value := ROUND(v_taxable, 2);
  cgst := ROUND(v_cgst, 2);
  sgst := ROUND(v_sgst, 2);
  igst := ROUND(v_igst, 2);
  total_tax := ROUND(v_cgst + v_sgst + v_igst, 2);
  RETURN NEXT;
END;
$$;

-- ── Sales Register ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_sales_register(UUID, DATE, DATE, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_sales_register(
  p_dealer_uuid UUID,
  p_from        DATE,
  p_to          DATE,
  p_party_id    UUID DEFAULT NULL,
  p_hsn_code    TEXT DEFAULT NULL
)
RETURNS TABLE (
  invoice_id      UUID,
  invoice_number  TEXT,
  invoice_date    DATE,
  farmer_name     TEXT,
  farmer_gstin    TEXT,
  farmer_state    TEXT,
  supply_type     TEXT,
  taxable_value   NUMERIC,
  cgst            NUMERIC,
  sgst            NUMERIC,
  igst            NUMERIC,
  total_tax       NUMERIC,
  invoice_value   NUMERIC,
  payment_status  TEXT,
  voucher_number  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug   TEXT;
  v_state  TEXT;
BEGIN
  v_slug := public._dealer_slug_from_uuid(p_dealer_uuid);
  IF v_slug IS NULL THEN RETURN; END IF;

  SELECT d.state_code INTO v_state FROM public.dealers d WHERE d.id = p_dealer_uuid;

  RETURN QUERY
  SELECT
    s.id,
    'SAL/' || s.id::TEXT,
    COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE),
    COALESCE(f.full_name, ''),
    COALESCE(f.gstin, ''),
    f.state_code,
    CASE
      WHEN f.state_code IS NULL OR trim(COALESCE(f.state_code::TEXT, '')) = ''
        OR COALESCE(v_state, '') IS NULL OR f.state_code = v_state
      THEN 'INTRA'
      ELSE 'INTER'
    END,
    g.taxable_value,
    g.cgst,
    g.sgst,
    g.igst,
    g.total_tax,
    COALESCE(s.final_amount, 0),
    UPPER(COALESCE(s.status, '')),
    v.voucher_number
  FROM public.sales s
  LEFT JOIN public.farmers f
    ON f.id = s.farmer_id AND (f.dealer_id::TEXT = v_slug::TEXT OR f.dealer_id::TEXT = p_dealer_uuid::TEXT)
  CROSS JOIN LATERAL (
    SELECT * FROM public._sale_line_gst_totals(s.items, s.subtotal, s.final_amount, f.state_code::TEXT, v_state)
  ) g
  LEFT JOIN public.vouchers v
    ON v.voucher_type = 'SAL'
      AND (
        v.reference = s.id::TEXT
        OR v.meta ->> 'sale_id' = s.id::TEXT
      )
      AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
  WHERE s.dealer_id::TEXT = v_slug::TEXT
    AND COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN p_from AND p_to
    AND COALESCE(LOWER(s.status), '') NOT IN ('cancelled', 'void', 'voided')
    AND (p_party_id IS NULL OR s.farmer_id = p_party_id)
    AND (
      p_hsn_code IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(s.items, '[]'::JSONB)) elem
        LEFT JOIN public.product_master pm ON pm.id = COALESCE(
          NULLIF(TRIM(elem->>'productId'), '')::UUID,
          NULLIF(TRIM(elem->>'product_id'), '')::UUID
        )
        WHERE COALESCE(NULLIF(trim(elem->>'hsnCode'), ''), NULLIF(trim(elem->>'hsn_code'), ''), trim(pm.hsn_code::TEXT)) = p_hsn_code
      )
    )
  ORDER BY COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE), s.id
  LIMIT 1001;
END;
$$;

-- ── Purchase Register ───────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_purchase_register(UUID, DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.get_purchase_register(
  p_dealer_uuid UUID,
  p_from        DATE,
  p_to          DATE,
  p_supplier_id UUID DEFAULT NULL
)
RETURNS TABLE (
  pi_id           UUID,
  pi_number       TEXT,
  invoice_date    DATE,
  supplier_inv_no TEXT,
  supplier_name   TEXT,
  supplier_gstin  TEXT,
  supply_type     TEXT,
  taxable_value   NUMERIC,
  cgst            NUMERIC,
  sgst            NUMERIC,
  igst            NUMERIC,
  total_tax       NUMERIC,
  invoice_value   NUMERIC,
  payment_status  TEXT,
  voucher_number  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state TEXT;
BEGIN
  SELECT d.state_code INTO v_state FROM public.dealers d WHERE d.id = p_dealer_uuid;

  RETURN QUERY
  SELECT
    pi.id,
    pi.pi_number,
    pi.invoice_date,
    COALESCE(pi.supplier_inv_no, ''),
    s.name,
    COALESCE(s.gstin, ''),
    CASE
      WHEN COALESCE(s.state_code::TEXT, '') <> '' AND COALESCE(v_state::TEXT, '') <> '' AND s.state_code IS DISTINCT FROM v_state
      THEN 'INTER'
      ELSE 'INTRA'
    END,
    pi.subtotal,
    pi.cgst_amount,
    pi.sgst_amount,
    pi.igst_amount,
    pi.tax_amount,
    pi.total_amount,
    UPPER(COALESCE(pi.status, '')),
    v.voucher_number
  FROM public.purchase_invoices pi
  LEFT JOIN public.suppliers s ON s.id = pi.supplier_id AND s.dealer_id = pi.dealer_id
  LEFT JOIN public.vouchers v
    ON v.voucher_type = 'PUR'
      AND (
        v.reference = pi.id::TEXT
        OR v.meta ->> 'purchase_invoice_id' = pi.id::TEXT
      )
      AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
  WHERE pi.dealer_id = p_dealer_uuid
    AND pi.invoice_date BETWEEN p_from AND p_to
    AND COALESCE(UPPER(pi.status), '') <> 'CANCELLED'
    AND (p_supplier_id IS NULL OR pi.supplier_id = p_supplier_id)
  ORDER BY pi.invoice_date, pi.pi_number
  LIMIT 1001;
END;
$$;

-- ── Ledger Statement ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_ledger_statement(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_ledger_statement(
  p_dealer_uuid UUID,
  p_ledger_id   UUID,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE (
  entry_date      DATE,
  voucher_number  TEXT,
  voucher_type    TEXT,
  narration       TEXT,
  dr_amount       NUMERIC,
  cr_amount       NUMERIC,
  running_balance NUMERIC,
  balance_type    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening NUMERIC := 0;
  v_slug    TEXT;
BEGIN
  v_slug := public._dealer_slug_from_uuid(p_dealer_uuid);
  IF v_slug IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(
      SUM(CASE WHEN ve.dr_cr = 'DR' THEN ve.amount ELSE -ve.amount END),
      0
    )
  INTO v_opening
  FROM public.voucher_entries ve
  JOIN public.vouchers v ON v.id = ve.voucher_id
  WHERE ve.ledger_id = p_ledger_id
    AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date < p_from
    AND v.status = 'POSTED';

  RETURN QUERY
  WITH movements AS (
    SELECT
      0::BIGINT AS sort_key,
      p_from AS vd,
      'Opening'::TEXT AS vnum,
      ''::TEXT AS vtype,
      'Opening Balance'::TEXT AS nar,
      CASE WHEN v_opening > 0 THEN v_opening::NUMERIC ELSE 0::NUMERIC END AS ddr,
      CASE WHEN v_opening < 0 THEN ABS(v_opening)::NUMERIC ELSE 0::NUMERIC END AS ccr,
      TRUE AS opening_row
    UNION ALL
    SELECT
      ROW_NUMBER() OVER (ORDER BY v.voucher_date, v.voucher_number, v.id, ve.id)::BIGINT AS sort_key,
      v.voucher_date AS vd,
      v.voucher_number AS vnum,
      v.voucher_type AS vtype,
      COALESCE(v.narration, '') AS nar,
      (CASE WHEN ve.dr_cr = 'DR' THEN ve.amount ELSE 0 END)::NUMERIC AS ddr,
      (CASE WHEN ve.dr_cr = 'CR' THEN ve.amount ELSE 0 END)::NUMERIC AS ccr,
      FALSE AS opening_row
    FROM public.voucher_entries ve
    JOIN public.vouchers v ON v.id = ve.voucher_id
    WHERE ve.ledger_id = p_ledger_id
      AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
      AND v.voucher_date BETWEEN p_from AND p_to
      AND v.status = 'POSTED'
  ),
  calc AS (
    SELECT
      m.*,
      v_opening
        + SUM(
          CASE WHEN m.opening_row THEN 0 ELSE m.ddr - m.ccr END
        )
        OVER (ORDER BY m.sort_key ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rs
    FROM movements m
  )
  SELECT
    c.vd,
    CASE WHEN c.opening_row THEN 'Opening'::TEXT ELSE c.vnum END,
    CASE WHEN c.opening_row THEN ''::TEXT ELSE c.vtype END,
    c.nar::TEXT,
    c.ddr::NUMERIC,
    c.ccr::NUMERIC,
    ABS(c.rs)::NUMERIC,
    CASE WHEN c.rs >= 0 THEN 'DR' ELSE 'CR' END
  FROM calc c
  ORDER BY c.sort_key;
END;
$$;

-- ── Cash Flow ─────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_cash_flow(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_cash_flow(
  p_dealer_uuid UUID,
  p_from DATE,
  p_to   DATE
)
RETURNS TABLE (
  section TEXT,
  line_item TEXT,
  amount NUMERIC,
  is_subtotal BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_profit   NUMERIC;
  v_depreciation NUMERIC := 0;
  v_ar_change    NUMERIC;
  v_inv_change   NUMERIC;
  v_ap_change    NUMERIC;
  v_operating    NUMERIC;
  v_capex        NUMERIC := 0;
  v_investing    NUMERIC;
  v_loans_in     NUMERIC := 0;
  v_loans_out    NUMERIC := 0;
  v_financing    NUMERIC;
  v_opening_cash NUMERIC;
  v_closing_cash NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(CASE
      WHEN COALESCE(lg.account_type, '') IN ('INCOME', 'DIRECT_INCOME', 'INDIRECT_INCOME')
        THEN CASE WHEN ve.dr_cr = 'CR' THEN ve.amount ELSE -ve.amount END
      WHEN COALESCE(lg.account_type, '') IN ('EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE')
        THEN CASE WHEN ve.dr_cr = 'DR' THEN -ve.amount ELSE ve.amount END
      ELSE 0
    END), 0)
  INTO v_net_profit
  FROM public.voucher_entries ve
  JOIN public.vouchers v ON v.id = ve.voucher_id
  JOIN public.ledgers lg ON lg.id = ve.ledger_id
  WHERE lg.dealer_id = p_dealer_uuid
    AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED';

  SELECT
    COALESCE(SUM(
      CASE WHEN v.voucher_type = 'SAL' THEN v.total_amount
           WHEN v.voucher_type = 'RCT' THEN -v.total_amount
           ELSE 0 END
    ), 0)
  INTO v_ar_change
  FROM public.vouchers v
  WHERE public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED'
    AND v.voucher_type IN ('SAL', 'RCT');

  SELECT COALESCE(SUM(CASE WHEN v.voucher_type = 'PUR' THEN v.total_amount ELSE 0 END), 0)
  INTO v_inv_change
  FROM public.vouchers v
  WHERE public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED';

  SELECT
    COALESCE(SUM(CASE WHEN v.voucher_type = 'PUR' THEN v.total_amount
                        WHEN v.voucher_type = 'PMT' THEN -v.total_amount
                        ELSE 0 END), 0)
  INTO v_ap_change
  FROM public.vouchers v
  WHERE public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED'
    AND v.voucher_type IN ('PUR', 'PMT');

  v_operating := v_net_profit - v_ar_change - v_inv_change + v_ap_change + v_depreciation;
  v_investing := -v_capex;
  v_financing := v_loans_in - v_loans_out;

  SELECT COALESCE(SUM(
    CASE WHEN ve.dr_cr = 'DR' THEN ve.amount ELSE -ve.amount END
  ), 0)
  INTO v_opening_cash
  FROM public.voucher_entries ve
  JOIN public.vouchers v ON v.id = ve.voucher_id
  JOIN public.ledgers lg ON lg.id = ve.ledger_id
  WHERE lg.dealer_id = p_dealer_uuid
    AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date < p_from
    AND v.status = 'POSTED'
    AND COALESCE(lg.account_type, '') IN ('CASH', 'BANK');

  v_closing_cash := v_opening_cash + v_operating + v_investing + v_financing;

  RETURN QUERY VALUES ('OPERATING', 'Net Profit / (Loss)', v_net_profit, FALSE);
  RETURN QUERY VALUES ('OPERATING', 'Add: Depreciation', v_depreciation, FALSE);
  RETURN QUERY VALUES ('OPERATING', 'Decrease / (Increase) in Trade Receivables', -v_ar_change, FALSE);
  RETURN QUERY VALUES ('OPERATING', 'Decrease / (Increase) in Inventory', -v_inv_change, FALSE);
  RETURN QUERY VALUES ('OPERATING', 'Increase / (Decrease) in Trade Payables', v_ap_change, FALSE);
  RETURN QUERY VALUES ('OPERATING', 'Net Cash from Operating Activities', v_operating, TRUE);

  RETURN QUERY VALUES ('INVESTING', 'Purchase of Fixed Assets', -v_capex, FALSE);
  RETURN QUERY VALUES ('INVESTING', 'Net Cash from Investing Activities', v_investing, TRUE);

  RETURN QUERY VALUES ('FINANCING', 'Loans Received', v_loans_in, FALSE);
  RETURN QUERY VALUES ('FINANCING', 'Loans Repaid', -v_loans_out, FALSE);
  RETURN QUERY VALUES ('FINANCING', 'Net Cash from Financing Activities', v_financing, TRUE);

  RETURN QUERY VALUES ('SUMMARY', 'Opening Cash & Bank Balance', v_opening_cash, FALSE);
  RETURN QUERY VALUES ('SUMMARY', 'Net Change in Cash', v_operating + v_investing + v_financing, FALSE);
  RETURN QUERY VALUES ('SUMMARY', 'Closing Cash & Bank Balance', v_closing_cash, TRUE);
END;
$$;

-- ── Comparative FY (month buckets) ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_comparative_sales(TEXT, UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_comparative_sales(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_comparative_monthly_sales(
  p_dealer_uuid UUID,
  p_fy          TEXT,
  p_compare_fy  TEXT
)
RETURNS TABLE (
  month_label   TEXT,
  current_sales NUMERIC,
  current_tax   NUMERIC,
  prev_sales    NUMERIC,
  prev_tax      NUMERIC,
  growth_pct    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months TEXT[] := ARRAY['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
  v_labels TEXT[] := ARRAY['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  v_curr_year INT;
  v_prev_year INT;
  i INT;
  v_from DATE;
  v_to DATE;
  v_pfrom DATE;
  v_pto DATE;
  v_csales NUMERIC;
  v_ctax NUMERIC;
  v_psales NUMERIC;
  v_ptax NUMERIC;
  v_slug TEXT;
BEGIN
  v_slug := public._dealer_slug_from_uuid(p_dealer_uuid);
  IF v_slug IS NULL THEN RETURN; END IF;

  v_curr_year := SPLIT_PART(p_fy, '-', 1)::INT;
  v_prev_year := SPLIT_PART(p_compare_fy, '-', 1)::INT;

  FOR i IN 1 .. 12 LOOP
    IF v_months[i]::INT >= 4 THEN
      v_from := MAKE_DATE(v_curr_year, v_months[i]::INT, 1);
    ELSE
      v_from := MAKE_DATE(v_curr_year + 1, v_months[i]::INT, 1);
    END IF;
    v_to := (v_from + INTERVAL '1 month - 1 day')::DATE;

    IF v_months[i]::INT >= 4 THEN
      v_pfrom := MAKE_DATE(v_prev_year, v_months[i]::INT, 1);
    ELSE
      v_pfrom := MAKE_DATE(v_prev_year + 1, v_months[i]::INT, 1);
    END IF;
    v_pto := (v_pfrom + INTERVAL '1 month - 1 day')::DATE;

    SELECT COALESCE(SUM(si.final_amount), 0)::NUMERIC INTO v_csales
    FROM public.sales si
    WHERE si.dealer_id::TEXT = v_slug::TEXT
      AND COALESCE(si.sale_date, (si.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_from AND v_to
      AND COALESCE(LOWER(si.status), '') NOT IN ('cancelled', 'void', 'voided');

    SELECT COALESCE(SUM(g.total_tax), 0)::NUMERIC INTO v_ctax
    FROM public.sales si
    LEFT JOIN public.farmers f
      ON f.id = si.farmer_id AND (f.dealer_id::TEXT = v_slug::TEXT OR f.dealer_id::TEXT = p_dealer_uuid::TEXT)
    CROSS JOIN LATERAL public._sale_line_gst_totals(
      si.items,
      si.subtotal,
      si.final_amount,
      f.state_code::TEXT,
      (SELECT state_code::TEXT FROM public.dealers WHERE id = p_dealer_uuid)
    ) g
    WHERE si.dealer_id::TEXT = v_slug::TEXT
      AND COALESCE(si.sale_date, (si.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_from AND v_to
      AND COALESCE(LOWER(si.status), '') NOT IN ('cancelled', 'void', 'voided');

    SELECT COALESCE(SUM(si.final_amount), 0)::NUMERIC INTO v_psales
    FROM public.sales si
    WHERE si.dealer_id::TEXT = v_slug::TEXT
      AND COALESCE(si.sale_date, (si.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_pfrom AND v_pto
      AND COALESCE(LOWER(si.status), '') NOT IN ('cancelled', 'void', 'voided');

    SELECT COALESCE(SUM(g.total_tax), 0)::NUMERIC INTO v_ptax
    FROM public.sales si
    LEFT JOIN public.farmers f
      ON f.id = si.farmer_id AND (f.dealer_id::TEXT = v_slug::TEXT OR f.dealer_id::TEXT = p_dealer_uuid::TEXT)
    CROSS JOIN LATERAL public._sale_line_gst_totals(
      si.items,
      si.subtotal,
      si.final_amount,
      f.state_code::TEXT,
      (SELECT state_code::TEXT FROM public.dealers WHERE id = p_dealer_uuid)
    ) g
    WHERE si.dealer_id::TEXT = v_slug::TEXT
      AND COALESCE(si.sale_date, (si.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) BETWEEN v_pfrom AND v_pto
      AND COALESCE(LOWER(si.status), '') NOT IN ('cancelled', 'void', 'voided');

    month_label := v_labels[i];
    current_sales := v_csales;
    current_tax := v_ctax;
    prev_sales := v_psales;
    prev_tax := v_ptax;
    growth_pct := CASE
      WHEN v_psales > 0 THEN ROUND(((v_csales - v_psales) / v_psales) * 100, 1)
      ELSE NULL
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_comparative_monthly_purchases(
  p_dealer_uuid UUID,
  p_fy          TEXT,
  p_compare_fy  TEXT
)
RETURNS TABLE (
  month_label   TEXT,
  current_sales NUMERIC,
  current_tax   NUMERIC,
  prev_sales    NUMERIC,
  prev_tax      NUMERIC,
  growth_pct    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months TEXT[] := ARRAY['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
  v_labels TEXT[] := ARRAY['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  v_curr_year INT;
  v_prev_year INT;
  i INT;
  v_from DATE;
  v_to DATE;
  v_pfrom DATE;
  v_pto DATE;
  v_c NUMERIC;
  v_ct NUMERIC;
  v_p NUMERIC;
  v_pt NUMERIC;
BEGIN
  v_curr_year := SPLIT_PART(p_fy, '-', 1)::INT;
  v_prev_year := SPLIT_PART(p_compare_fy, '-', 1)::INT;

  FOR i IN 1 .. 12 LOOP
    IF v_months[i]::INT >= 4 THEN
      v_from := MAKE_DATE(v_curr_year, v_months[i]::INT, 1);
    ELSE
      v_from := MAKE_DATE(v_curr_year + 1, v_months[i]::INT, 1);
    END IF;
    v_to := (v_from + INTERVAL '1 month - 1 day')::DATE;

    IF v_months[i]::INT >= 4 THEN
      v_pfrom := MAKE_DATE(v_prev_year, v_months[i]::INT, 1);
    ELSE
      v_pfrom := MAKE_DATE(v_prev_year + 1, v_months[i]::INT, 1);
    END IF;
    v_pto := (v_pfrom + INTERVAL '1 month - 1 day')::DATE;

    SELECT COALESCE(SUM(pi.total_amount), 0), COALESCE(SUM(pi.tax_amount), 0)
    INTO v_c, v_ct
    FROM public.purchase_invoices pi
    WHERE pi.dealer_id = p_dealer_uuid
      AND pi.invoice_date BETWEEN v_from AND v_to
      AND COALESCE(UPPER(pi.status), '') <> 'CANCELLED';

    SELECT COALESCE(SUM(pi.total_amount), 0), COALESCE(SUM(pi.tax_amount), 0)
    INTO v_p, v_pt
    FROM public.purchase_invoices pi
    WHERE pi.dealer_id = p_dealer_uuid
      AND pi.invoice_date BETWEEN v_pfrom AND v_pto
      AND COALESCE(UPPER(pi.status), '') <> 'CANCELLED';

    month_label := v_labels[i];
    current_sales := v_c;
    current_tax := v_ct;
    prev_sales := v_p;
    prev_tax := v_pt;
    growth_pct := CASE WHEN v_p > 0 THEN ROUND(((v_c - v_p) / v_p) * 100, 1) ELSE NULL END;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Trial balance (as on date)
DROP FUNCTION IF EXISTS public.get_trial_balance(UUID, DATE);

CREATE OR REPLACE FUNCTION public.get_trial_balance(
  p_dealer_uuid UUID,
  p_as_on DATE
)
RETURNS TABLE (
  ledger_id     UUID,
  ledger_name   TEXT,
  group_name    TEXT,
  dr_total      NUMERIC,
  cr_total      NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.name,
    COALESCE(g.group_name::TEXT, g.group_code::TEXT, '')::TEXT,
    COALESCE(SUM(CASE WHEN ve.dr_cr = 'DR' THEN ve.amount ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN ve.dr_cr = 'CR' THEN ve.amount ELSE 0 END), 0)::NUMERIC
  FROM public.ledgers l
  LEFT JOIN public.ledger_groups g ON g.id = l.ledger_group_id
  LEFT JOIN public.voucher_entries ve ON ve.ledger_id = l.id
  LEFT JOIN public.vouchers v ON v.id = ve.voucher_id
    AND public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.status = 'POSTED'
    AND v.voucher_date <= p_as_on
  WHERE l.dealer_id = p_dealer_uuid
  GROUP BY l.id, l.name, g.group_name, g.group_code
  HAVING
    COALESCE(SUM(CASE WHEN ve.dr_cr = 'DR' THEN ve.amount ELSE 0 END), 0) > 0
    OR COALESCE(SUM(CASE WHEN ve.dr_cr = 'CR' THEN ve.amount ELSE 0 END), 0) > 0
  ORDER BY l.name;
$$;

-- Day book
DROP FUNCTION IF EXISTS public.get_day_book(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_day_book(
  p_dealer_uuid UUID,
  p_from DATE,
  p_to   DATE
)
RETURNS TABLE (
  voucher_id      UUID,
  voucher_date    DATE,
  voucher_number  TEXT,
  voucher_type    TEXT,
  narration       TEXT,
  total_amount    NUMERIC,
  status          TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.voucher_date,
    v.voucher_number,
    v.voucher_type,
    COALESCE(v.narration, ''),
    v.total_amount,
    COALESCE(v.status, '')
  FROM public.vouchers v
  WHERE public._vouchers_match_dealer(v.dealer_id::TEXT, p_dealer_uuid)
    AND v.voucher_date BETWEEN p_from AND p_to
    AND v.status = 'POSTED'
  ORDER BY v.voucher_date, v.voucher_number;
$$;

-- GST rate summary lines (purchase)
DROP FUNCTION IF EXISTS public.get_purchase_register_gst_by_rate(UUID, DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.get_purchase_register_gst_by_rate(
  p_dealer_uuid UUID,
  p_from        DATE,
  p_to          DATE,
  p_supplier_id UUID DEFAULT NULL
)
RETURNS TABLE (
  gst_rate      NUMERIC,
  taxable_value NUMERIC,
  cgst          NUMERIC,
  sgst          NUMERIC,
  igst          NUMERIC,
  total_tax     NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(pii.gst_rate, 0)::NUMERIC,
    COALESCE(SUM(pii.amount - pii.gst_amount), 0)::NUMERIC,
    COALESCE(SUM(pii.cgst_amount), 0)::NUMERIC,
    COALESCE(SUM(pii.sgst_amount), 0)::NUMERIC,
    COALESCE(SUM(pii.igst_amount), 0)::NUMERIC,
    COALESCE(SUM(pii.gst_amount), 0)::NUMERIC
  FROM public.purchase_invoice_items pii
  JOIN public.purchase_invoices pi ON pi.id = pii.pi_id
  WHERE pi.dealer_id = p_dealer_uuid
    AND pi.invoice_date BETWEEN p_from AND p_to
    AND COALESCE(UPPER(pi.status), '') <> 'CANCELLED'
    AND (p_supplier_id IS NULL OR pi.supplier_id = p_supplier_id)
  GROUP BY COALESCE(pii.gst_rate, 0)
  ORDER BY COALESCE(pii.gst_rate, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_register(UUID, DATE, DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_register(UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ledger_statement(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparative_monthly_sales(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparative_monthly_purchases(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_balance(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_day_book(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_register_gst_by_rate(UUID, DATE, DATE, UUID) TO authenticated;
