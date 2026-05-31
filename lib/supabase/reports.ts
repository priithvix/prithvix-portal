import { supabase } from '@/lib/supabase/client';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type SalesRegisterRow = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  farmer_name: string | null;
  farmer_gstin: string | null;
  farmer_state: string | null;
  supply_type: string | null;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  invoice_value: number;
  payment_status: string | null;
  voucher_number: string | null;
};

export type PurchaseRegisterRow = {
  pi_id: string;
  pi_number: string;
  invoice_date: string;
  supplier_inv_no: string | null;
  supplier_name: string | null;
  supplier_gstin: string | null;
  supply_type: string | null;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  invoice_value: number;
  payment_status: string | null;
  voucher_number: string | null;
};

export type LedgerStatementRow = {
  entry_date: string;
  voucher_number: string | null;
  voucher_type: string | null;
  narration: string | null;
  dr_amount: number;
  cr_amount: number;
  running_balance: number;
  balance_type: string | null;
};

export type CashFlowRow = {
  section: string;
  line_item: string;
  amount: number;
  is_subtotal: boolean;
};

export type ComparativeMonthRow = {
  month_label: string;
  current_sales: number;
  current_tax: number;
  prev_sales: number;
  prev_tax: number;
  growth_pct: number | null;
};

export type TrialBalanceRow = {
  ledger_id: string;
  ledger_name: string;
  group_name: string | null;
  dr_total: number;
  cr_total: number;
};

export type DayBookRow = {
  voucher_id: string;
  voucher_date: string;
  voucher_number: string | null;
  voucher_type: string | null;
  narration: string | null;
  total_amount: number;
  status: string | null;
};

export type PurchaseGstRateRow = {
  gst_rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
};

export type LedgerPickRow = {
  id: string;
  name: string;
  group_label: string;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function getSalesRegister(
  dealerRowId: string,
  from: Date,
  to: Date,
  partyId?: string | null,
  hsnCode?: string | null
): Promise<SalesRegisterRow[]> {
  const { data, error } = await supabase.rpc('get_sales_register', {
    p_dealer_uuid: dealerRowId,
    p_from: iso(from),
    p_to: iso(to),
    p_party_id: partyId ?? null,
    p_hsn_code: hsnCode ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    invoice_id: String(r.invoice_id ?? ''),
    invoice_number: String(r.invoice_number ?? ''),
    invoice_date: String(r.invoice_date ?? '').slice(0, 10),
    farmer_name: r.farmer_name != null ? String(r.farmer_name) : null,
    farmer_gstin: r.farmer_gstin != null ? String(r.farmer_gstin) : null,
    farmer_state: r.farmer_state != null ? String(r.farmer_state) : null,
    supply_type: r.supply_type != null ? String(r.supply_type) : null,
    taxable_value: n(r.taxable_value),
    cgst: n(r.cgst),
    sgst: n(r.sgst),
    igst: n(r.igst),
    total_tax: n(r.total_tax),
    invoice_value: n(r.invoice_value),
    payment_status: r.payment_status != null ? String(r.payment_status) : null,
    voucher_number: r.voucher_number != null ? String(r.voucher_number) : null,
  }));
}

export async function getPurchaseRegister(
  dealerRowId: string,
  from: Date,
  to: Date,
  supplierId?: string | null
): Promise<PurchaseRegisterRow[]> {
  const { data, error } = await supabase.rpc('get_purchase_register', {
    p_dealer_uuid: dealerRowId,
    p_from: iso(from),
    p_to: iso(to),
    p_supplier_id: supplierId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    pi_id: String(r.pi_id ?? ''),
    pi_number: String(r.pi_number ?? ''),
    invoice_date: String(r.invoice_date ?? '').slice(0, 10),
    supplier_inv_no: r.supplier_inv_no != null ? String(r.supplier_inv_no) : null,
    supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
    supplier_gstin: r.supplier_gstin != null ? String(r.supplier_gstin) : null,
    supply_type: r.supply_type != null ? String(r.supply_type) : null,
    taxable_value: n(r.taxable_value),
    cgst: n(r.cgst),
    sgst: n(r.sgst),
    igst: n(r.igst),
    total_tax: n(r.total_tax),
    invoice_value: n(r.invoice_value),
    payment_status: r.payment_status != null ? String(r.payment_status) : null,
    voucher_number: r.voucher_number != null ? String(r.voucher_number) : null,
  }));
}

export async function getPurchaseRegisterGstByRate(
  dealerRowId: string,
  from: Date,
  to: Date,
  supplierId?: string | null
): Promise<PurchaseGstRateRow[]> {
  const { data, error } = await supabase.rpc('get_purchase_register_gst_by_rate', {
    p_dealer_uuid: dealerRowId,
    p_from: iso(from),
    p_to: iso(to),
    p_supplier_id: supplierId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    gst_rate: n(r.gst_rate),
    taxable_value: n(r.taxable_value),
    cgst: n(r.cgst),
    sgst: n(r.sgst),
    igst: n(r.igst),
    total_tax: n(r.total_tax),
  }));
}

export async function getLedgerStatement(
  dealerRowId: string,
  ledgerId: string,
  from: Date,
  to: Date
): Promise<LedgerStatementRow[]> {
  const { data, error } = await supabase.rpc('get_ledger_statement', {
    p_dealer_uuid: dealerRowId,
    p_ledger_id: ledgerId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    entry_date: String(r.entry_date ?? '').slice(0, 10),
    voucher_number: r.voucher_number != null ? String(r.voucher_number) : null,
    voucher_type: r.voucher_type != null ? String(r.voucher_type) : null,
    narration: r.narration != null ? String(r.narration) : null,
    dr_amount: n(r.dr_amount),
    cr_amount: n(r.cr_amount),
    running_balance: n(r.running_balance),
    balance_type: r.balance_type != null ? String(r.balance_type) : null,
  }));
}

export async function getCashFlow(dealerRowId: string, from: Date, to: Date): Promise<CashFlowRow[]> {
  const { data, error } = await supabase.rpc('get_cash_flow', {
    p_dealer_uuid: dealerRowId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    section: String(r.section ?? ''),
    line_item: String(r.line_item ?? ''),
    amount: n(r.amount),
    is_subtotal: Boolean(r.is_subtotal),
  }));
}

export async function getComparativeMonthlySales(
  dealerRowId: string,
  fy: string,
  compareFy: string
): Promise<ComparativeMonthRow[]> {
  const { data, error } = await supabase.rpc('get_comparative_monthly_sales', {
    p_dealer_uuid: dealerRowId,
    p_fy: fy,
    p_compare_fy: compareFy,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    month_label: String(r.month_label ?? ''),
    current_sales: n(r.current_sales),
    current_tax: n(r.current_tax),
    prev_sales: n(r.prev_sales),
    prev_tax: n(r.prev_tax),
    growth_pct: r.growth_pct == null ? null : n(r.growth_pct),
  }));
}

export async function getComparativeMonthlyPurchases(
  dealerRowId: string,
  fy: string,
  compareFy: string
): Promise<ComparativeMonthRow[]> {
  const { data, error } = await supabase.rpc('get_comparative_monthly_purchases', {
    p_dealer_uuid: dealerRowId,
    p_fy: fy,
    p_compare_fy: compareFy,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    month_label: String(r.month_label ?? ''),
    current_sales: n(r.current_sales),
    current_tax: n(r.current_tax),
    prev_sales: n(r.prev_sales),
    prev_tax: n(r.prev_tax),
    growth_pct: r.growth_pct == null ? null : n(r.growth_pct),
  }));
}

export async function getTrialBalance(dealerRowId: string, asOn: Date): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.rpc('get_trial_balance', {
    p_dealer_uuid: dealerRowId,
    p_as_on: iso(asOn),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ledger_id: String(r.ledger_id ?? ''),
    ledger_name: String(r.ledger_name ?? ''),
    group_name: r.group_name != null ? String(r.group_name) : '',
    dr_total: n(r.dr_total),
    cr_total: n(r.cr_total),
  }));
}

export async function getDayBook(dealerRowId: string, from: Date, to: Date): Promise<DayBookRow[]> {
  const { data, error } = await supabase.rpc('get_day_book', {
    p_dealer_uuid: dealerRowId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    voucher_id: String(r.voucher_id ?? ''),
    voucher_date: String(r.voucher_date ?? '').slice(0, 10),
    voucher_number: r.voucher_number != null ? String(r.voucher_number) : null,
    voucher_type: r.voucher_type != null ? String(r.voucher_type) : null,
    narration: r.narration != null ? String(r.narration) : null,
    total_amount: n(r.total_amount),
    status: r.status != null ? String(r.status) : null,
  }));
}

export async function getLedgerPickList(dealerRowId: string): Promise<LedgerPickRow[]> {
  const [{ data: ledgers, error: e1 }, { data: groups, error: e2 }] = await Promise.all([
    supabase.from('ledgers').select('id, name, ledger_group_id').eq('dealer_id', dealerRowId).order('name'),
    supabase.from('ledger_groups').select('id, group_code, group_name').eq('dealer_id', dealerRowId),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const gmap = new Map<string, { code: string; name: string }>();
  for (const g of groups ?? []) {
    const row = g as { id: string; group_code?: string; group_name?: string };
    const label =
      (row.group_name && String(row.group_name).trim()) ||
      (row.group_code && String(row.group_code).trim()) ||
      '—';
    gmap.set(row.id, { code: row.group_code ?? '', name: label });
  }
  return (ledgers ?? []).map((row: { id: string; name: string; ledger_group_id?: string | null }) => ({
    id: row.id,
    name: row.name,
    group_label: row.ledger_group_id ? (gmap.get(row.ledger_group_id)?.name ?? '—') : '—',
  }));
}

export async function getVouchersForTallyExport(
  dealerRowId: string,
  from: Date,
  to: Date
): Promise<
  { voucher_number: string; voucher_type: string; voucher_date: string; total_amount: number; narration: string | null }[]
> {
  const { data: d } = await supabase.from('dealers').select('dealer_id').eq('id', dealerRowId).maybeSingle();
  const slug = (d?.dealer_id as string | undefined) ?? '';

  const sel = 'voucher_number, voucher_type, voucher_date, total_amount, narration';
  const merged: Record<string, unknown>[] = [];

  const rUuid = await supabase
    .from('vouchers')
    .select(sel)
    .gte('voucher_date', iso(from))
    .lte('voucher_date', iso(to))
    .eq('status', 'POSTED')
    .eq('dealer_id', dealerRowId);
  if (rUuid.error) throw new Error(rUuid.error.message);
  merged.push(...((rUuid.data ?? []) as Record<string, unknown>[]));

  if (slug && slug !== dealerRowId) {
    const rSlug = await supabase
      .from('vouchers')
      .select(sel)
      .gte('voucher_date', iso(from))
      .lte('voucher_date', iso(to))
      .eq('status', 'POSTED')
      .eq('dealer_id', slug);
    if (rSlug.error) throw new Error(rSlug.error.message);
    merged.push(...((rSlug.data ?? []) as Record<string, unknown>[]));
  }
  const map = new Map<string, Record<string, unknown>>();
  for (const r of merged as Record<string, unknown>[]) {
    const key = `${r.voucher_number}_${r.voucher_date}`;
    map.set(key, r);
  }
  return [...map.values()].map((r) => ({
    voucher_number: String(r.voucher_number ?? ''),
    voucher_type: String(r.voucher_type ?? ''),
    voucher_date: String(r.voucher_date ?? '').slice(0, 10),
    total_amount: n(r.total_amount),
    narration: r.narration != null ? String(r.narration) : null,
  }));
}

export async function getProductHsnCodes(dealerRowId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('product_master')
    .select('hsn_code')
    .eq('dealer_id', dealerRowId);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const h = String((r as { hsn_code?: string }).hsn_code ?? '').trim();
    if (h) set.add(h);
  }
  return [...set].sort();
}
