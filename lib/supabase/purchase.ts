import { supabase } from '@/lib/supabase/client';
import { getFinancialYearLabel, roundMoney } from '@/lib/tally-format';

export type POStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
export type GRNStatus = 'DRAFT' | 'POSTED';
export type PIStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export type SupplierRow = {
  id: string;
  dealer_id: string;
  name: string;
  gstin: string | null;
  state_code: string | null;
  pan: string | null;
  mobile: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  pincode: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  credit_days: number;
  credit_limit: number;
  opening_balance: number;
  balance_type: string;
  ledger_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type POLineInput = {
  product_id: string | null;
  sku_id: string | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  gst_amount: number;
  amount: number;
};

export type PurchaseOrderRow = {
  id: string;
  dealer_id: string;
  supplier_id: string;
  po_number: string;
  po_date: string;
  expected_date: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  suppliers?: { name: string } | null;
};

export type GRNLineInput = {
  po_item_id: string | null;
  product_id: string | null;
  sku_id: string | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  amount: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  ordered_qty?: number | null;
};

export type PILineInput = {
  grn_item_id: string | null;
  product_id: string | null;
  sku_id: string | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  rate: number;
  discount_pct: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  amount: number;
  batch_number?: string | null;
  expiry_date?: string | null;
};

/** Next PO/GRN/PI document number — requires `next_doc_number` RPC in DB. */
export async function fetchNextDocNumber(
  dealerId: string,
  prefix: 'PO' | 'GRN' | 'PI',
  fy: string
): Promise<string> {
  const { data, error } = await supabase.rpc('next_doc_number', {
    p_dealer_id: dealerId,
    p_prefix: prefix,
    p_fy: fy,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

async function tryCreateCreditorLedger(dealerId: string, supplierName: string): Promise<string | null> {
  const codes = ['SUNDRY_CREDITORS', 'SUNDRY_CREDIT', 'SC'];
  for (const code of codes) {
    const g = await supabase
      .from('ledger_groups')
      .select('id')
      .eq('dealer_id', dealerId)
      .eq('group_code', code)
      .maybeSingle();
    if (!g.error && g.data?.id) {
      const ins = await supabase
        .from('ledgers')
        .insert({
          dealer_id: dealerId,
          name: supplierName,
          ledger_code: `SC_${supplierName.slice(0, 12).replace(/\s+/g, '_')}_${Date.now().toString(36)}`,
          ledger_group_id: g.data.id,
        })
        .select('id')
        .single();
      if (!ins.error && ins.data?.id) return ins.data.id as string;
    }
  }

  const insBare = await supabase
    .from('ledgers')
    .insert({
      dealer_id: dealerId,
      name: supplierName,
      ledger_code: `SC_${Date.now().toString(36)}`,
    })
    .select('id')
    .single();
  if (!insBare.error && insBare.data?.id) return insBare.data.id as string;
  return null;
}

export async function getSuppliers(dealerId: string): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierRow[];
}

export async function getSupplier(id: string): Promise<SupplierRow | null> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SupplierRow) ?? null;
}

export async function getSupplierUnpaidMap(dealerId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('supplier_id, balance_due, status')
    .eq('dealer_id', dealerId)
    .in('status', ['UNPAID', 'PARTIAL']);
  if (error) {
    console.warn('[purchase]', error.message);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const sid = row.supplier_id as string;
    const bal = Number(row.balance_due) || 0;
    map[sid] = (map[sid] ?? 0) + bal;
  }
  return map;
}

export type SupplierInput = Partial<SupplierRow> & { name: string; dealer_id: string };

export async function upsertSupplier(input: SupplierInput & { id?: string }): Promise<SupplierRow> {
  const payload = {
    dealer_id: input.dealer_id,
    name: input.name,
    gstin: input.gstin || null,
    state_code: input.state_code || null,
    pan: input.pan || null,
    mobile: input.mobile || null,
    email: input.email || null,
    address_line1: input.address_line1 || null,
    address_line2: input.address_line2 || null,
    city: input.city || null,
    pincode: input.pincode || null,
    bank_name: input.bank_name || null,
    bank_account: input.bank_account || null,
    bank_ifsc: input.bank_ifsc || null,
    credit_days: input.credit_days ?? 30,
    credit_limit: input.credit_limit ?? 0,
    opening_balance: input.opening_balance ?? 0,
    balance_type: input.balance_type ?? 'CR',
    notes: input.notes ?? null,
    is_active: input.is_active ?? true,
  };

  let ledgerId = input.ledger_id ?? null;

  if (input.id) {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as SupplierRow;
  }

  if (!ledgerId) {
    ledgerId = await tryCreateCreditorLedger(input.dealer_id, input.name);
  }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...payload, ledger_id: ledgerId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as SupplierRow;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getPurchaseOrders(dealerId: string, from?: string, to?: string) {
  let q = supabase
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .eq('dealer_id', dealerId)
    .order('po_date', { ascending: false });
  if (from) q = q.gte('po_date', from);
  if (to) q = q.lte('po_date', to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as PurchaseOrderRow[];
}

export async function getPurchaseOrder(id: string) {
  const { data: header, error: hErr } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(*)')
    .eq('id', id)
    .single();
  if (hErr) throw new Error(hErr.message);
  const { data: lines, error: lErr } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('po_id', id);
  if (lErr) throw new Error(lErr.message);
  return { order: header, items: lines ?? [] };
}

export async function createPurchaseOrder(args: {
  dealerId: string;
  supplierId: string;
  poDate: Date;
  expectedDate?: Date | null;
  notes?: string;
  status: POStatus;
  items: POLineInput[];
  userId?: string | null;
}) {
  const fy = getFinancialYearLabel(args.poDate);
  const po_number = await fetchNextDocNumber(args.dealerId, 'PO', fy);
  let subtotal = 0;
  let tax_amount = 0;
  let total_amount = 0;
  for (const it of args.items) {
    subtotal += roundMoney(it.quantity * it.rate);
    tax_amount += roundMoney(it.gst_amount);
    total_amount += roundMoney(it.amount);
  }
  subtotal = roundMoney(subtotal);
  tax_amount = roundMoney(tax_amount);
  total_amount = roundMoney(total_amount);

  const { data: row, error } = await supabase
    .from('purchase_orders')
    .insert({
      dealer_id: args.dealerId,
      supplier_id: args.supplierId,
      po_number,
      po_date: args.poDate.toISOString().slice(0, 10),
      expected_date: args.expectedDate ? args.expectedDate.toISOString().slice(0, 10) : null,
      status: args.status,
      subtotal,
      tax_amount,
      total_amount,
      notes: args.notes ?? null,
      created_by: args.userId ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const poId = row!.id as string;

  if (args.items.length) {
    const { error: iErr } = await supabase.from('purchase_order_items').insert(
      args.items.map((it) => ({
        po_id: poId,
        product_id: it.product_id,
        sku_id: it.sku_id,
        product_name: it.product_name,
        hsn_code: it.hsn_code,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        gst_rate: it.gst_rate,
        gst_amount: it.gst_amount,
        amount: it.amount,
      }))
    );
    if (iErr) throw new Error(iErr.message);
  }
  return poId;
}

export async function updatePOStatus(id: string, status: POStatus) {
  const { error } = await supabase.from('purchase_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getGRNs(dealerId: string) {
  const { data, error } = await supabase
    .from('grns')
    .select('*, suppliers(name), purchase_orders(po_number)')
    .eq('dealer_id', dealerId)
    .order('grn_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getGRN(id: string) {
  const { data: header, error: hErr } = await supabase
    .from('grns')
    .select('*, suppliers(*), purchase_orders(po_number)')
    .eq('id', id)
    .single();
  if (hErr) throw new Error(hErr.message);
  const { data: lines, error: lErr } = await supabase.from('grn_items').select('*').eq('grn_id', id);
  if (lErr) throw new Error(lErr.message);
  return { grn: header, items: lines ?? [] };
}

export async function createGRN(args: {
  dealerId: string;
  supplierId: string;
  poId?: string | null;
  grnDate: Date;
  vehicleNumber?: string;
  lrNumber?: string;
  notes?: string;
  items: GRNLineInput[];
  userId?: string | null;
}) {
  const fy = getFinancialYearLabel(args.grnDate);
  const grn_number = await fetchNextDocNumber(args.dealerId, 'GRN', fy);
  let subtotal = 0;
  let tax_amount = 0;
  let total_amount = 0;
  for (const it of args.items) {
    subtotal += roundMoney(it.quantity * it.rate);
    tax_amount += roundMoney(it.gst_amount);
    total_amount += roundMoney(it.amount);
  }

  const { data: row, error } = await supabase
    .from('grns')
    .insert({
      dealer_id: args.dealerId,
      supplier_id: args.supplierId,
      po_id: args.poId ?? null,
      grn_number,
      grn_date: args.grnDate.toISOString().slice(0, 10),
      vehicle_number: args.vehicleNumber ?? null,
      lr_number: args.lrNumber ?? null,
      notes: args.notes ?? null,
      status: 'DRAFT',
      subtotal: roundMoney(subtotal),
      tax_amount: roundMoney(tax_amount),
      total_amount: roundMoney(total_amount),
      created_by: args.userId ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const grnId = row!.id as string;

  if (args.items.length) {
    const { error: iErr } = await supabase.from('grn_items').insert(
      args.items.map((it) => ({
        grn_id: grnId,
        po_item_id: it.po_item_id,
        product_id: it.product_id,
        sku_id: it.sku_id,
        product_name: it.product_name,
        hsn_code: it.hsn_code,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        gst_rate: it.gst_rate,
        cgst_amount: it.cgst_amount,
        sgst_amount: it.sgst_amount,
        igst_amount: it.igst_amount,
        gst_amount: it.gst_amount,
        amount: it.amount,
        batch_number: it.batch_number ?? null,
        expiry_date: it.expiry_date ?? null,
      }))
    );
    if (iErr) throw new Error(iErr.message);
  }
  return grnId;
}

export async function postGRN(grnId: string) {
  const { error } = await supabase.rpc('post_grn', { p_grn_id: grnId });
  if (error) throw new Error(error.message);
}

export async function getPurchaseInvoices(dealerId: string) {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*, suppliers(name)')
    .eq('dealer_id', dealerId)
    .order('invoice_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getPurchaseInvoice(id: string) {
  const { data: header, error: hErr } = await supabase
    .from('purchase_invoices')
    .select('*, suppliers(*)')
    .eq('id', id)
    .single();
  if (hErr) throw new Error(hErr.message);
  const { data: lines, error: lErr } = await supabase
    .from('purchase_invoice_items')
    .select('*')
    .eq('pi_id', id);
  if (lErr) throw new Error(lErr.message);
  return { invoice: header, items: lines ?? [] };
}

export async function createPurchaseInvoice(args: {
  dealerId: string;
  supplierId: string;
  grnId?: string | null;
  invoiceDate: Date;
  dueDate: Date | null;
  supplierInvNo?: string;
  notes?: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  round_off: number;
  total_amount: number;
  balance_due: number;
  items: PILineInput[];
  userId?: string | null;
}) {
  const fy = getFinancialYearLabel(args.invoiceDate);
  const pi_number = await fetchNextDocNumber(args.dealerId, 'PI', fy);
  const { data: row, error } = await supabase
    .from('purchase_invoices')
    .insert({
      dealer_id: args.dealerId,
      supplier_id: args.supplierId,
      grn_id: args.grnId ?? null,
      pi_number,
      supplier_inv_no: args.supplierInvNo ?? null,
      invoice_date: args.invoiceDate.toISOString().slice(0, 10),
      due_date: args.dueDate ? args.dueDate.toISOString().slice(0, 10) : null,
      status: 'UNPAID',
      subtotal: args.subtotal,
      cgst_amount: args.cgst_amount,
      sgst_amount: args.sgst_amount,
      igst_amount: args.igst_amount,
      tax_amount: args.tax_amount,
      round_off: args.round_off,
      total_amount: args.total_amount,
      paid_amount: 0,
      balance_due: args.balance_due,
      notes: args.notes ?? null,
      created_by: args.userId ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const piId = row!.id as string;

  if (args.items.length) {
    const { error: iErr } = await supabase.from('purchase_invoice_items').insert(
      args.items.map((it) => ({
        pi_id: piId,
        grn_item_id: it.grn_item_id,
        product_id: it.product_id,
        sku_id: it.sku_id,
        product_name: it.product_name,
        hsn_code: it.hsn_code,
        quantity: it.quantity,
        unit: it.unit,
        rate: it.rate,
        discount_pct: it.discount_pct,
        gst_rate: it.gst_rate,
        cgst_amount: it.cgst_amount,
        sgst_amount: it.sgst_amount,
        igst_amount: it.igst_amount,
        gst_amount: it.gst_amount,
        amount: it.amount,
        batch_number: it.batch_number ?? null,
        expiry_date: it.expiry_date ?? null,
      }))
    );
    if (iErr) throw new Error(iErr.message);
  }
  return piId;
}

export async function postPurchaseInvoice(piId: string) {
  const { data, error } = await supabase.rpc('post_purchase_invoice', { p_pi_id: piId });
  if (error) throw new Error(error.message);
  return data as string;
}

export type LedgerRow = {
  voucher_date: string;
  particulars: string;
  dr: number | null;
  cr: number | null;
  voucher_id: string | null;
  pi_id: string | null;
};

export async function getSupplierLedger(
  supplier: SupplierRow,
  from: string,
  to: string
): Promise<{ rows: LedgerRow[]; opening: number; closing: number; openingType: 'DR' | 'CR' }> {
  const openingType = (supplier.balance_type === 'DR' ? 'DR' : 'CR') as 'DR' | 'CR';
  const ob = Number(supplier.opening_balance) || 0;

  if (!supplier.ledger_id) {
    return { rows: [], opening: ob, closing: ob, openingType };
  }

  const { data: entries, error } = await supabase
    .from('voucher_entries')
    .select('amount, dr_cr, vouchers(voucher_date, narration, id, reference)')
    .eq('ledger_id', supplier.ledger_id);

  if (error) {
    console.warn('[supplier ledger]', error.message);
    return { rows: [], opening: ob, closing: ob, openingType };
  }

  const rows: LedgerRow[] = [];
  for (const v of entries ?? []) {
    const raw = v as Record<string, unknown>;
    const vch = raw.vouchers as Record<string, unknown> | null;
    if (!vch?.voucher_date) continue;
    const vd = String(vch.voucher_date);
    if (vd < from || vd > to) continue;
    const amt = Number(raw.amount) || 0;
    const drcr = String(raw.dr_cr);
    rows.push({
      voucher_date: vd,
      particulars: String(vch.narration ?? ''),
      dr: drcr === 'DR' ? amt : null,
      cr: drcr === 'CR' ? amt : null,
      voucher_id: vch.id ? String(vch.id) : null,
      pi_id: vch.reference ? String(vch.reference) : null,
    });
  }

  rows.sort((a, b) => a.voucher_date.localeCompare(b.voucher_date));

  let bal = ob * (openingType === 'DR' ? 1 : -1);
  for (const r of rows) {
    bal += (r.dr ?? 0) - (r.cr ?? 0);
  }
  const closing = Math.abs(bal);

  return { rows, opening: ob, closing, openingType };
}

export type PayablesBucketRow = {
  supplier_id: string;
  supplier_name: string;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90p: number;
};

export async function getPayablesDashboard(dealerId: string, asOn: Date): Promise<PayablesBucketRow[]> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('supplier_id, balance_due, due_date, suppliers(name)')
    .eq('dealer_id', dealerId)
    .in('status', ['UNPAID', 'PARTIAL'])
    .gt('balance_due', 0);
  if (error) {
    console.warn('[payables]', error.message);
    return [];
  }

  const bucketMap = new Map<string, PayablesBucketRow>();
  const today = asOn.getTime();

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const sid = String(row.supplier_id);
    const bal = Number(row.balance_due) || 0;
    const dueRaw = row.due_date as string | null;
    if (!dueRaw || bal <= 0) continue;
    const due = new Date(dueRaw).getTime();
    const daysOverdue = Math.floor((today - due) / (86400 * 1000));
    const sup = (row.suppliers as { name?: string } | null)?.name ?? '—';

    let b = bucketMap.get(sid);
    if (!b) {
      b = { supplier_id: sid, supplier_name: sup, b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0 };
      bucketMap.set(sid, b);
    }
    if (daysOverdue < 0) b.b0_30 += bal;
    else if (daysOverdue <= 30) b.b0_30 += bal;
    else if (daysOverdue <= 60) b.b31_60 += bal;
    else if (daysOverdue <= 90) b.b61_90 += bal;
    else b.b90p += bal;
  }

  return [...bucketMap.values()].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
}
