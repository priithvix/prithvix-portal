/**
 * Business Engine ↔ Tally sync helpers (Phase D extension).
 * - ensure_farmer_party_ledger: creates Sundry Debtor ledger + farmers.ledger_id
 * - post_be_sale_voucher: mirrors BE retail sale into vouchers / voucher_entries (SAL)
 */

CREATE OR REPLACE FUNCTION public.ensure_farmer_party_ledger(
  p_dealer_tenant TEXT,
  p_farmer_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_name TEXT;
  v_existing UUID;
  v_gid UUID;
  v_lid UUID;
BEGIN
  v_uid := public._dealer_uuid_from_tenant_key(p_dealer_tenant);

  SELECT full_name, ledger_id INTO v_name, v_existing
  FROM public.farmers
  WHERE id = p_farmer_id AND dealer_id = p_dealer_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farmer % not found for dealer tenant', p_farmer_id;
  END IF;

  IF v_existing IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.ledgers WHERE id = v_existing AND dealer_id = v_uid) THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT id INTO v_gid FROM public.ledger_groups
  WHERE dealer_id = v_uid AND group_code IN ('SUNDRY_DEBTORS', 'SUNDRY_DR', 'SD')
  ORDER BY CASE group_code WHEN 'SUNDRY_DEBTORS' THEN 0 WHEN 'SUNDRY_DR' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_gid IS NULL THEN
    INSERT INTO public.ledger_groups (dealer_id, group_code, group_name)
    VALUES (v_uid, 'SUNDRY_DEBTORS', 'Sundry Debtors')
    RETURNING id INTO v_gid;
  END IF;

  INSERT INTO public.ledgers (dealer_id, ledger_group_id, name, ledger_code)
  VALUES (
    v_uid,
    v_gid,
    LEFT(COALESCE(v_name, 'Farmer'), 120),
    'PARTY_' || REPLACE(COALESCE(p_farmer_id, 'X'), '_', '') || '_' || SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
  )
  RETURNING id INTO v_lid;

  UPDATE public.farmers SET ledger_id = v_lid WHERE id = p_farmer_id AND dealer_id = p_dealer_tenant;

  RETURN v_lid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.post_be_sale_voucher(
  p_dealer_tenant TEXT,
  p_sale_id TEXT,
  p_farmer_id TEXT,
  p_sale_date DATE,
  p_final_amount NUMERIC,
  p_paid_amount NUMERIC,
  p_narration TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_party UUID;
  v_sales UUID;
  v_cash UUID;
  v_fy TEXT;
  y INT;
  m INT;
  v_number TEXT;
  v_vid UUID;
  v_existing UUID;
  v_bal NUMERIC;
  v_paid NUMERIC;
  v_final NUMERIC;
BEGIN
  v_final := COALESCE(p_final_amount, 0);
  v_paid := COALESCE(p_paid_amount, 0);
  IF v_final <= 0 THEN RAISE EXCEPTION 'Sale amount must be positive'; END IF;

  SELECT id INTO v_existing FROM public.vouchers
  WHERE dealer_id = p_dealer_tenant
    AND voucher_type = 'SAL'
    AND reference = p_sale_id
    AND status = 'POSTED'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_uid := public._dealer_uuid_from_tenant_key(p_dealer_tenant);

  SELECT id INTO v_sales FROM public.ledgers
  WHERE dealer_id = v_uid AND ledger_code = 'SALES'
  LIMIT 1;
  IF v_sales IS NULL THEN
    SELECT id INTO v_sales FROM public.ledgers
    WHERE dealer_id = v_uid AND UPPER(name) LIKE '%SALES%'
    ORDER BY name
    LIMIT 1;
  END IF;
  IF v_sales IS NULL THEN
    RAISE EXCEPTION 'Sales ledger not found — create a ledger with ledger_code SALES';
  END IF;

  SELECT id INTO v_cash FROM public.ledgers
  WHERE dealer_id = v_uid AND ledger_code IN ('CASH_IN_HAND', 'CASH', 'CASH_ON_HAND')
  ORDER BY CASE ledger_code WHEN 'CASH_IN_HAND' THEN 0 WHEN 'CASH' THEN 1 ELSE 2 END
  LIMIT 1;

  v_party := public.ensure_farmer_party_ledger(p_dealer_tenant, p_farmer_id);

  v_bal := GREATEST(0, v_final - v_paid);

  y := EXTRACT(YEAR FROM p_sale_date)::INT;
  m := EXTRACT(MONTH FROM p_sale_date)::INT;
  IF m >= 4 THEN
    v_fy := y::TEXT || '-' || LPAD(((y + 1) % 100)::TEXT, 2, '0');
  ELSE
    v_fy := (y - 1)::TEXT || '-' || LPAD((y % 100)::TEXT, 2, '0');
  END IF;

  v_number := public.next_doc_number(v_uid, 'SAL', v_fy);

  INSERT INTO public.vouchers (
    dealer_id, voucher_type, voucher_number, voucher_date,
    narration, total_amount, status, reference, meta
  ) VALUES (
    p_dealer_tenant,
    'SAL',
    v_number,
    p_sale_date,
    COALESCE(NULLIF(TRIM(p_narration), ''), 'Retail sale (Business Engine)'),
    v_final,
    'POSTED',
    p_sale_id,
    jsonb_build_object('sale_id', p_sale_id, 'farmer_id', p_farmer_id, 'source', 'business_engine')
  )
  RETURNING id INTO v_vid;

  IF v_paid >= v_final THEN
    IF v_cash IS NULL THEN
      RAISE EXCEPTION 'Cash ledger not found — add ledger_code CASH_IN_HAND or CASH';
    END IF;
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_cash, 'DR', v_final);
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_sales, 'CR', v_final);
  ELSIF v_paid <= 0 THEN
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_party, 'DR', v_final);
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_sales, 'CR', v_final);
  ELSE
    IF v_cash IS NULL THEN
      RAISE EXCEPTION 'Cash ledger not found for partial cash sale';
    END IF;
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_cash, 'DR', v_paid);
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_party, 'DR', v_bal);
    INSERT INTO public.voucher_entries (voucher_id, ledger_id, dr_cr, amount)
    VALUES (v_vid, v_sales, 'CR', v_final);
  END IF;

  RETURN v_vid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_farmer_party_ledger(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_be_sale_voucher(TEXT, TEXT, TEXT, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
