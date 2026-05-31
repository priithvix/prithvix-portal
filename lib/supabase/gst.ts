import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import type { Gstr2bParsedRecord } from '@/lib/gst/gstr2b-parser';
import { periodsInFinancialYear } from '@/lib/gst/period-utils';

export type GstReturnPeriodRow = {
  id: string;
  dealer_id: string;
  return_period: string;
  financial_year: string;
  gstr1_status: string;
  gstr3b_status: string;
  gstr1_filed_on: string | null;
  gstr3b_filed_on: string | null;
};

export type Gstr1RecordRow = {
  id: string;
  dealer_id: string;
  return_period: string;
  invoice_id: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  customer_name: string | null;
  customer_gstin: string | null;
  customer_state: string | null;
  supply_type: string | null;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_tax: number;
  invoice_value: number;
  hsn_code: string | null;
  gst_rate: number;
  irn: string | null;
  is_amended: boolean;
};

export type Gstr3bSummaryRow = {
  id: string;
  dealer_id: string;
  return_period: string;
  taxable_outward: number;
  tax_outward_igst: number;
  tax_outward_cgst: number;
  tax_outward_sgst: number;
  nil_rated_value: number;
  itc_igst: number;
  itc_cgst: number;
  itc_sgst: number;
  exempt_inward: number;
  tax_payable_igst: number;
  tax_payable_cgst: number;
  tax_payable_sgst: number;
  itc_utilized_igst: number;
  itc_utilized_cgst: number;
  itc_utilized_sgst: number;
  cash_paid_igst: number;
  cash_paid_cgst: number;
  cash_paid_sgst: number;
  interest_paid: number;
  late_fee_paid: number;
  status: string;
};

export type Gstr2bRecordRow = {
  id: string;
  dealer_id: string;
  return_period: string;
  supplier_gstin: string;
  supplier_name: string | null;
  invoice_number: string;
  invoice_date: string | null;
  invoice_type: string | null;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total_tax: number;
  itc_available: boolean;
  recon_status: string;
  matched_pi_id: string | null;
  mismatch_reason: string | null;
};

export type HsnSummaryRow = {
  id: string;
  dealer_id: string;
  return_period: string;
  direction: string;
  hsn_code: string;
  description: string | null;
  uom: string;
  total_quantity: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
};

function mapNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getGstPeriod(
  dealerId: string,
  period: string
): Promise<GstReturnPeriodRow | null> {
  const { data, error } = await supabase
    .from('gst_return_periods')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('return_period', period)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as GstReturnPeriodRow | null;
}

export async function generateGstr1(dealerId: string, period: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_gstr1', {
    p_dealer_id: dealerId,
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : Number(data);
}

export async function getGstr1Records(dealerId: string, period: string): Promise<Gstr1RecordRow[]> {
  const { data, error } = await supabase
    .from('gstr1_records')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('return_period', period)
    .order('invoice_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    taxable_value: mapNum((r as Record<string, unknown>).taxable_value),
    cgst: mapNum((r as Record<string, unknown>).cgst),
    sgst: mapNum((r as Record<string, unknown>).sgst),
    igst: mapNum((r as Record<string, unknown>).igst),
    cess: mapNum((r as Record<string, unknown>).cess),
    total_tax: mapNum((r as Record<string, unknown>).total_tax),
    invoice_value: mapNum((r as Record<string, unknown>).invoice_value),
    gst_rate: mapNum((r as Record<string, unknown>).gst_rate),
  })) as Gstr1RecordRow[];
}

export async function markGstr1Filed(dealerId: string, period: string): Promise<void> {
  await ensureGstReturnPeriodRow(dealerId, period, inferFinancialYearFromPeriod(period));
  const { error } = await supabase
    .from('gst_return_periods')
    .update({
      gstr1_status: 'FILED',
      gstr1_filed_on: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('dealer_id', dealerId)
    .eq('return_period', period);
  if (error) throw new Error(error.message);
}

export async function computeGstr3b(dealerId: string, period: string): Promise<string> {
  const { data, error } = await supabase.rpc('compute_gstr3b', {
    p_dealer_id: dealerId,
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}

export async function getGstr3bSummary(
  dealerId: string,
  period: string
): Promise<Gstr3bSummaryRow | null> {
  const { data, error } = await supabase
    .from('gstr3b_summary')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('return_period', period)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Gstr3bSummaryRow | null) ?? null;
}

export async function saveGstr3bOverrides(
  id: string,
  overrides: Partial<Gstr3bSummaryRow>
): Promise<void> {
  const allowed = [
    'taxable_outward',
    'tax_outward_igst',
    'tax_outward_cgst',
    'tax_outward_sgst',
    'nil_rated_value',
    'itc_igst',
    'itc_cgst',
    'itc_sgst',
    'exempt_inward',
    'tax_payable_igst',
    'tax_payable_cgst',
    'tax_payable_sgst',
    'itc_utilized_igst',
    'itc_utilized_cgst',
    'itc_utilized_sgst',
    'cash_paid_igst',
    'cash_paid_cgst',
    'cash_paid_sgst',
    'interest_paid',
    'late_fee_paid',
  ] as const;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in overrides && overrides[k] !== undefined) patch[k] = overrides[k];
  }
  const { error } = await supabase.from('gstr3b_summary').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markGstr3bFiled(dealerId: string, period: string): Promise<void> {
  await ensureGstReturnPeriodRow(dealerId, period, inferFinancialYearFromPeriod(period));
  const { error } = await supabase
    .from('gst_return_periods')
    .update({
      gstr3b_status: 'FILED',
      gstr3b_filed_on: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('dealer_id', dealerId)
    .eq('return_period', period);
  if (error) throw new Error(error.message);

  const { error: e2 } = await supabase
    .from('gstr3b_summary')
    .update({ status: 'FILED', updated_at: new Date().toISOString() })
    .eq('dealer_id', dealerId)
    .eq('return_period', period);
  if (e2) throw new Error(e2.message);
}

export async function uploadGstr2bRecords(
  dealerId: string,
  period: string,
  records: Gstr2bParsedRecord[]
): Promise<number> {
  const { error: delErr } = await supabase
    .from('gstr2b_records')
    .delete()
    .eq('dealer_id', dealerId)
    .eq('return_period', period);
  if (delErr) throw new Error(delErr.message);
  if (records.length === 0) return 0;
  const rows = records.map((r) => ({
    dealer_id: dealerId,
    return_period: period,
    supplier_gstin: r.supplier_gstin,
    supplier_name: r.supplier_name,
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    invoice_type: r.invoice_type,
    taxable_value: r.taxable_value,
    igst: r.igst,
    cgst: r.cgst,
    sgst: r.sgst,
    cess: r.cess,
    total_tax: r.total_tax,
    recon_status: 'UNMATCHED',
  }));
  const { error: insErr } = await supabase.from('gstr2b_records').insert(rows);
  if (insErr) throw new Error(insErr.message);
  return records.length;
}

export async function reconcileGstr2b(
  dealerId: string,
  period: string
): Promise<{ matched: number; mismatched: number; missing_in_books: number }> {
  const { data, error } = await supabase.rpc('reconcile_gstr2b', {
    p_dealer_id: dealerId,
    p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const o = row as Record<string, unknown> | null;
  return {
    matched: Number(o?.matched ?? 0),
    mismatched: Number(o?.mismatched ?? 0),
    missing_in_books: Number(o?.missing_in_books ?? 0),
  };
}

export async function getGstr2bRecords(
  dealerId: string,
  period: string,
  statusFilter?: string
): Promise<Gstr2bRecordRow[]> {
  let q = supabase
    .from('gstr2b_records')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('return_period', period);
  if (statusFilter) q = q.eq('recon_status', statusFilter);
  const { data, error } = await q.order('invoice_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Gstr2bRecordRow[];
}

export async function getHsnSummary(
  dealerId: string,
  period: string,
  direction: 'OUTWARD' | 'INWARD'
): Promise<HsnSummaryRow[]> {
  const { data, error } = await supabase
    .from('hsn_summary')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('return_period', period)
    .eq('direction', direction)
    .order('hsn_code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as HsnSummaryRow[];
}

export async function regenerateHsnSummary(
  dealerId: string,
  period: string,
  direction: 'OUTWARD' | 'INWARD'
): Promise<void> {
  const { error } = await supabase.rpc('generate_hsn_summary', {
    p_dealer_id: dealerId,
    p_period: period,
    p_direction: direction,
  });
  if (error) throw new Error(error.message);
}

export type GstAuditMonth = {
  period: string;
  monthLabel: string;
  taxable: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  itcIgst: number;
  itcCgst: number;
  itcSgst: number;
  totalItc: number;
  gstr1: string;
  gstr3b: string;
  status: string;
};

export async function getGstAuditReport(
  dealerId: string,
  fyLabel: string
): Promise<GstAuditMonth[]> {
  const months = periodsInFinancialYear(fyLabel);
  const [g1, g3, gp] = await Promise.all([
    supabase.from('gstr1_records').select('*').eq('dealer_id', dealerId),
    supabase.from('gstr3b_summary').select('*').eq('dealer_id', dealerId),
    supabase.from('gst_return_periods').select('*').eq('dealer_id', dealerId),
  ]);
  if (g1.error) throw new Error(g1.error.message);
  if (g3.error) throw new Error(g3.error.message);
  if (gp.error) throw new Error(gp.error.message);

  const r1 = (g1.data ?? []) as Record<string, unknown>[];
  const r3 = (g3.data ?? []) as Record<string, unknown>[];
  const rp = (gp.data ?? []) as Record<string, unknown>[];

  return months.map((period) => {
    const monthParts = period.split('-');
    const mm = monthParts[0];
    const yyyy = monthParts[1];
    const monthLabel = format(new Date(Number(yyyy), Number(mm) - 1, 1), 'MMM-yyyy');

    const rows = r1.filter((r) => r.return_period === period);
    const taxable = rows.reduce((s, r) => s + mapNum(r.taxable_value), 0);
    const cgst = rows.reduce((s, r) => s + mapNum(r.cgst), 0);
    const sgst = rows.reduce((s, r) => s + mapNum(r.sgst), 0);
    const igst = rows.reduce((s, r) => s + mapNum(r.igst), 0);
    const totalTax = cgst + sgst + igst;

    const s3 = r3.find((r) => r.return_period === period);
    const itcIgst = mapNum(s3?.itc_igst);
    const itcCgst = mapNum(s3?.itc_cgst);
    const itcSgst = mapNum(s3?.itc_sgst);
    const totalItc = itcIgst + itcCgst + itcSgst;

    const pRow = rp.find((r) => r.return_period === period);
    const gstr1s = String(pRow?.gstr1_status ?? '—');
    const gstr3bs = String(pRow?.gstr3b_status ?? '—');
    const ok = gstr1s === 'FILED' && gstr3bs === 'FILED';
    const status = ok ? 'Complete' : '⚠ Pending';

    return {
      period,
      monthLabel,
      taxable,
      cgst,
      sgst,
      totalTax,
      itcIgst,
      itcCgst,
      itcSgst,
      totalItc,
      gstr1: gstr1s,
      gstr3b: gstr3bs,
      status,
    };
  });
}

export async function acceptGstr2bTaxToPi(
  gstr2bRecordId: string,
  piId: string,
  booksTax: { igst: number; cgst: number; sgst: number; tax_amount: number },
  twob: { igst: number; cgst: number; sgst: number; total_tax: number }
): Promise<void> {
  const pi = await getPurchaseInvoiceForCompare(piId);
  const subtotal = pi ? mapNum(pi.subtotal) : 0;
  const newTotal = subtotal + twob.total_tax;

  const { error } = await supabase
    .from('purchase_invoices')
    .update({
      igst_amount: twob.igst,
      cgst_amount: twob.cgst,
      sgst_amount: twob.sgst,
      tax_amount: twob.total_tax,
      total_amount: newTotal,
      balance_due: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', piId);
  if (error) throw new Error(error.message);

  const { error: e2 } = await supabase
    .from('gstr2b_records')
    .update({
      recon_status: 'MATCHED',
      matched_pi_id: piId,
      mismatch_reason:
        'Accepted 2B (was books ₹' +
        String(booksTax.tax_amount) +
        '); amended PI taxes to match portal.',
    })
    .eq('id', gstr2bRecordId);
  if (e2) throw new Error(e2.message);
}

export async function keepBooksGstr2bDifference(gstr2bRecordId: string): Promise<void> {
  const { error } = await supabase
    .from('gstr2b_records')
    .update({
      recon_status: 'ACCEPTED_DIFF',
      mismatch_reason: 'Dealer accepted book values; difference noted for CA review.',
    })
    .eq('id', gstr2bRecordId);
  if (error) throw new Error(error.message);
}

export async function getPurchaseInvoiceForCompare(piId: string) {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, tax_amount, cgst_amount, sgst_amount, igst_amount, subtotal, total_amount')
    .eq('id', piId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    tax_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    subtotal: number;
    total_amount: number;
  } | null;
}

function inferFinancialYearFromPeriod(period: string): string {
  const [mmRaw, yyyyRaw] = period.split('-');
  const m = Number(mmRaw);
  const y = Number(yyyyRaw);
  if (!m || !y) return '';
  if (m >= 4) return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

export async function ensureGstReturnPeriodRow(
  dealerId: string,
  period: string,
  financialYear: string
): Promise<void> {
  const { error } = await supabase.from('gst_return_periods').upsert(
    {
      dealer_id: dealerId,
      return_period: period,
      financial_year: financialYear,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dealer_id,return_period' }
  );
  if (error) throw new Error(error.message);
}
