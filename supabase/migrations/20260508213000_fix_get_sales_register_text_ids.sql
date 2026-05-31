-- Align get_sales_register with TEXT farmer_id / product_master.id (Phase B/G).
-- Fixes: "operator does not exist: text = uuid" from OR branches and product join.

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
    AND (p_party_id IS NULL OR s.farmer_id = p_party_id::TEXT)
    AND (
      p_hsn_code IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(s.items, '[]'::JSONB)) elem
        LEFT JOIN public.product_master pm ON pm.id = COALESCE(
          NULLIF(TRIM(elem->>'productId'), ''),
          NULLIF(TRIM(elem->>'product_id'), '')
        )
        WHERE COALESCE(NULLIF(trim(elem->>'hsnCode'), ''), NULLIF(trim(elem->>'hsn_code'), ''), trim(pm.hsn_code::TEXT)) = p_hsn_code
      )
    )
  ORDER BY COALESCE(s.sale_date, (s.created_at AT TIME ZONE 'Asia/Kolkata')::DATE), s.id
  LIMIT 1001;
END;
$$;
