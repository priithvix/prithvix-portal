/**
 * Ensures every dealer has minimal Chart-of-Accounts lines required by
 * post_be_sale_voucher + RCT helpers: SALES and CASH_IN_HAND ledgers.
 * Safe to run repeatedly (idempotent).
 */

CREATE OR REPLACE FUNCTION public.ensure_default_be_sale_ledgers(p_dealer_uuid UUID)
RETURNS VOID AS $$
DECLARE
  v_gid_sales UUID;
  v_gid_cash  UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id = p_dealer_uuid) THEN
    RAISE EXCEPTION 'Dealer not found: %', p_dealer_uuid;
  END IF;

  INSERT INTO public.ledger_groups (dealer_id, group_code, group_name)
  VALUES (p_dealer_uuid, 'PX_SALES_GRP', 'Sales Accounts')
  ON CONFLICT (dealer_id, group_code) DO NOTHING;

  INSERT INTO public.ledger_groups (dealer_id, group_code, group_name)
  VALUES (p_dealer_uuid, 'PX_CASH_GRP', 'Cash-in-hand')
  ON CONFLICT (dealer_id, group_code) DO NOTHING;

  SELECT id INTO v_gid_sales
  FROM public.ledger_groups
  WHERE dealer_id = p_dealer_uuid AND group_code = 'PX_SALES_GRP'
  LIMIT 1;

  SELECT id INTO v_gid_cash
  FROM public.ledger_groups
  WHERE dealer_id = p_dealer_uuid AND group_code = 'PX_CASH_GRP'
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM public.ledgers WHERE dealer_id = p_dealer_uuid AND ledger_code = 'SALES'
  ) THEN
    INSERT INTO public.ledgers (dealer_id, ledger_group_id, name, ledger_code)
    VALUES (p_dealer_uuid, v_gid_sales, 'Sales', 'SALES');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ledgers WHERE dealer_id = p_dealer_uuid AND ledger_code = 'CASH_IN_HAND'
  ) THEN
    INSERT INTO public.ledgers (dealer_id, ledger_group_id, name, ledger_code)
    VALUES (p_dealer_uuid, v_gid_cash, 'Cash-in-hand', 'CASH_IN_HAND');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_default_be_sale_ledgers(UUID) TO authenticated;

-- Backfill existing dealers (no-op if ledgers already present)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.dealers LOOP
    PERFORM public.ensure_default_be_sale_ledgers(r.id);
  END LOOP;
END $$;
