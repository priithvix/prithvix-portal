import { supabase } from '@/lib/supabase/client';
import type { ParsedBankLine } from '@/lib/banking/csv-parser';
import { getFinancialYearLabel } from '@/lib/tally-format';

export type SettlementInput = {
  invoice_id: string;
  invoice_type: 'SALE' | 'PURCHASE';
  amount: number;
};

export type BankAccountRow = {
  id: string;
  dealer_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string | null;
  branch: string | null;
  account_type: string;
  ledger_id: string | null;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
  is_primary: boolean;
};

export type ChequeFilters = {
  bankAccountId?: string;
  direction?: 'ISSUED' | 'RECEIVED';
  /** YYYY-MM (month) optional */
  month?: string;
  isPdc?: boolean;
};

export type ChequeRow = {
  id: string;
  dealer_id: string;
  bank_account_id: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  direction: string;
  party_name: string;
  party_id: string | null;
  party_type: string | null;
  narration: string | null;
  voucher_id: string | null;
  status: string;
  is_pdc: boolean;
  clearing_date: string | null;
  bank_ref: string | null;
  bounce_reason: string | null;
  reversal_voucher_id: string | null;
};

export type ReceivablesAgeingRow = {
  farmer_id: string;
  farmer_name: string;
  mobile: string | null;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_due: number;
  oldest_due_date: string | null;
  credit_limit: number;
  credit_blocked: boolean;
};

export type PayablesAgeingRow = {
  supplier_id: string;
  supplier_name: string;
  mobile: string | null;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_due: number;
  oldest_due_date: string | null;
};

export type SaleOutstandingRow = {
  id: string;
  farmer_id: string;
  invoice_date: string;
  due_date: string | null;
  final_amount: number;
  balance_due: number;
  status: string;
};

export async function getBankAccounts(dealerId: string): Promise<BankAccountRow[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('account_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as BankAccountRow[];
}

export async function upsertBankAccount(
  dealerId: string,
  payload: Omit<BankAccountRow, 'dealer_id'> & Partial<Pick<BankAccountRow, 'id'>>
): Promise<void> {
  const row = { ...payload, dealer_id: dealerId, updated_at: new Date().toISOString() };
  const id = payload.id;
  if (id) {
    const { error } = await supabase.from('bank_accounts').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('bank_accounts').insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function getCheques(dealerId: string, filters: ChequeFilters): Promise<ChequeRow[]> {
  let q = supabase.from('cheques').select('*').eq('dealer_id', dealerId).order('cheque_date', { ascending: false });
  if (filters.bankAccountId) q = q.eq('bank_account_id', filters.bankAccountId);
  if (filters.direction) q = q.eq('direction', filters.direction);
  if (filters.isPdc !== undefined) q = q.eq('is_pdc', filters.isPdc);
  if (filters.month) {
    const [y, m] = filters.month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0); // last day prev month hack — use exclusive next month for simpler
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    q = q.gte('cheque_date', start).lte('cheque_date', endStr);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChequeRow[];
}

export async function createCheque(
  dealerId: string,
  input: Omit<ChequeRow, 'dealer_id' | 'id' | 'updated_at'>
): Promise<ChequeRow> {
  const { data, error } = await supabase.from('cheques').insert({ ...input, dealer_id: dealerId }).select('*').single();
  if (error) throw new Error(error.message);
  return data as ChequeRow;
}

export async function updateChequeStatus(
  id: string,
  status: string,
  meta?: { clearing_date?: string; bank_ref?: string; bounce_reason?: string }
): Promise<void> {
  const { error } = await supabase
    .from('cheques')
    .update({
      status,
      clearing_date: meta?.clearing_date ?? null,
      bank_ref: meta?.bank_ref ?? null,
      bounce_reason: meta?.bounce_reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countOverduePdc(dealerId: string, asOf: Date): Promise<number> {
  const iso = asOf.toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('cheques')
    .select('id', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('is_pdc', true)
    .eq('direction', 'RECEIVED')
    .eq('status', 'PENDING')
    .lt('cheque_date', iso);
  if (error) {
    console.warn('[banking] count overdue pdc', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function importBankStatementLines(
  dealerId: string,
  bankAccountId: string,
  batchId: string,
  lines: ParsedBankLine[]
): Promise<number> {
  if (lines.length === 0) return 0;
  const { count } = await supabase
    .from('bank_statement_lines')
    .select('id', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('import_batch_id', batchId);
  if ((count ?? 0) > 0) return 0;

  const payload = lines.map((l) => ({
    dealer_id: dealerId,
    bank_account_id: bankAccountId,
    txn_date: l.txn_date,
    value_date: l.value_date ?? null,
    description: l.description,
    ref_number: l.ref_number ?? null,
    debit: l.debit,
    credit: l.credit,
    balance: l.balance ?? null,
    recon_status: 'UNMATCHED',
    import_batch_id: batchId,
  }));
  const { error } = await supabase.from('bank_statement_lines').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

export async function autoMatchBankStatement(
  dealerId: string,
  bankAccountId: string,
  batchId: string
): Promise<{ matched: number; unmatched: number }> {
  const { data, error } = await supabase.rpc('auto_match_bank_statement', {
    p_dealer_id: dealerId,
    p_bank_acc_id: bankAccountId,
    p_batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { matched: number; unmatched: number };
  return { matched: Number(row?.matched ?? 0), unmatched: Number(row?.unmatched ?? 0) };
}

export async function getUnmatchedLines(dealerId: string, bankAccountId: string) {
  const { data, error } = await supabase
    .from('bank_statement_lines')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('recon_status', 'UNMATCHED')
    .order('txn_date');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function linkBankLineToVoucher(lineId: string, voucherId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_statement_lines')
    .update({ recon_status: 'MATCHED', matched_voucher_id: voucherId })
    .eq('id', lineId);
  if (error) throw new Error(error.message);
}

export async function markBankStatementLineManual(lineId: string): Promise<void> {
  const { error } = await supabase.from('bank_statement_lines').update({ recon_status: 'MANUAL' }).eq('id', lineId);
  if (error) throw new Error(error.message);
}

export async function getUnclearedIssuedCheques(dealerId: string, bankAccountId: string): Promise<ChequeRow[]> {
  const { data, error } = await supabase
    .from('cheques')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('direction', 'ISSUED')
    .in('status', ['PENDING', 'PRESENTED'])
    .order('cheque_date');
  if (error) throw new Error(error.message);
  return (data ?? []) as ChequeRow[];
}

export async function getReceivablesAgeing(dealerId: string, asOn: Date): Promise<ReceivablesAgeingRow[]> {
  const { data, error } = await supabase.rpc('get_receivables_ageing', {
    p_dealer_id: dealerId,
    p_as_on: asOn.toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReceivablesAgeingRow[];
}

export async function getPayablesAgeing(dealerId: string, asOn: Date): Promise<PayablesAgeingRow[]> {
  const { data, error } = await supabase.rpc('get_payables_ageing', {
    p_dealer_id: dealerId,
    p_as_on: asOn.toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PayablesAgeingRow[];
}

export async function settleBills(voucherId: string, settlements: SettlementInput[]): Promise<void> {
  const payload = settlements.map((s) => ({
    invoice_id: s.invoice_id,
    invoice_type: s.invoice_type,
    amount: s.amount,
  }));
  const { error } = await supabase.rpc('settle_bills', {
    p_voucher_id: voucherId,
    p_settlements: payload,
  });
  if (error) throw new Error(error.message);
}

export async function postFarmerPaymentReceiptRpc(args: {
  dealerId: string;
  farmerId: string;
  amount: number;
  bankLedgerId: string;
  partyLedgerId: string;
  voucherDate: string;
  narration?: string;
  settlements: SettlementInput[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('post_farmer_payment_receipt', {
    p_dealer_id: args.dealerId,
    p_farmer_id: args.farmerId,
    p_amount: args.amount,
    p_bank_ledger_id: args.bankLedgerId,
    p_party_ledger_id: args.partyLedgerId,
    p_voucher_date: args.voucherDate,
    p_narration: args.narration ?? '',
    p_settlements: args.settlements.map((s) => ({
      invoice_id: s.invoice_id,
      invoice_type: s.invoice_type,
      amount: s.amount,
    })),
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function postSupplierPaymentVoucherRpc(args: {
  dealerId: string;
  supplierId: string;
  supplierName?: string;
  amount: number;
  bankLedgerId: string;
  partyLedgerId: string;
  voucherDate: string;
  narration?: string;
  settlements: SettlementInput[];
  createChequeMeta?: {
    bank_account_id: string;
    cheque_number: string;
    cheque_date: string;
    narration?: string;
  };
}): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const partyName = args.supplierName ?? '';
  const { data, error } = await supabase.rpc('post_supplier_payment_voucher', {
    p_dealer_id: args.dealerId,
    p_supplier_id: args.supplierId,
    p_amount: args.amount,
    p_bank_ledger_id: args.bankLedgerId,
    p_party_ledger_id: args.partyLedgerId,
    p_voucher_date: args.voucherDate,
    p_narration: args.narration ?? '',
    p_settlements: args.settlements.map((s) => ({
      invoice_id: s.invoice_id,
      invoice_type: s.invoice_type,
      amount: s.amount,
    })),
  });
  if (error) throw new Error(error.message);
  const vchId = String(data);
  if (args.createChequeMeta) {
    await createCheque(args.dealerId, {
      bank_account_id: args.createChequeMeta.bank_account_id,
      cheque_number: args.createChequeMeta.cheque_number,
      cheque_date: args.createChequeMeta.cheque_date,
      amount: args.amount,
      direction: 'ISSUED',
      party_name: partyName,
      party_id: args.supplierId,
      party_type: 'SUPPLIER',
      narration: args.createChequeMeta.narration ?? null,
      voucher_id: vchId,
      status: 'PENDING',
      is_pdc: args.createChequeMeta.cheque_date > today,
      clearing_date: null,
      bank_ref: null,
      bounce_reason: null,
      reversal_voucher_id: null,
    });
  }
  return vchId;
}

export async function blockFarmer(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('farmers')
    .update({ credit_blocked: true, block_reason: reason })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function unblockFarmer(id: string): Promise<void> {
  const { error } = await supabase.from('farmers').update({ credit_blocked: false, block_reason: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function computeOverdueInterest(dealerId: string, asOn: Date): Promise<number> {
  const { data, error } = await supabase.rpc('compute_overdue_interest', {
    p_dealer_id: dealerId,
    p_as_on: asOn.toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function listComputedInterest(dealerId: string) {
  const { data, error } = await supabase
    .from('overdue_interest')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('status', 'COMPUTED')
    .order('to_date');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Running bank book rows from vouchers touching this ledger — optional bank filter by ledger list */
export async function getBankBook(
  dealerId: string,
  bankLedgerId: string,
  from: string,
  to: string
): Promise<
  Array<{
    voucher_id: string;
    voucher_date: string;
    voucher_number: string;
    narration: string | null;
    dr: number;
    cr: number;
    voucher_type: string | null;
  }>
> {
  const { data: ev, error } = await supabase
    .from('voucher_entries')
    .select('voucher_id, amount, dr_cr')
    .eq('ledger_id', bankLedgerId);
  if (error) throw new Error(error.message);
  const voucherIds = [...new Set((ev ?? []).map((r) => (r as Record<string, unknown>).voucher_id as string))];
  if (voucherIds.length === 0) return [];

  const { data: vouchers, error: vErr } = await supabase
    .from('vouchers')
    .select('id, voucher_date, voucher_number, narration, voucher_type')
    .eq('dealer_id', dealerId)
    .in('id', voucherIds)
    .gte('voucher_date', from)
    .lte('voucher_date', to)
    .order('voucher_date');
  if (vErr) throw new Error(vErr.message);
  const vmap = new Map((vouchers ?? []).map((v) => [String((v as Record<string, unknown>).id), v as Record<string, unknown>]));

  type Line = {
    voucher_id: string;
    voucher_date: string;
    voucher_number: string;
    narration: string | null;
    dr: number;
    cr: number;
    voucher_type: string | null;
  };
  const acc = new Map<string, Line>();

  for (const row of ev ?? []) {
    const voucherId = String((row as Record<string, unknown>).voucher_id);
    const v = vmap.get(voucherId);
    if (!v) continue;
    const amt = Number((row as Record<string, unknown>).amount ?? 0);
    const dc = String((row as Record<string, unknown>).dr_cr);
    const vd = String(v.voucher_date ?? '').slice(0, 10);
    if (vd < from.slice(0, 10) || vd > to.slice(0, 10)) continue;
    const cur = acc.get(voucherId);
    if (!cur) {
      acc.set(voucherId, {
        voucher_id: voucherId,
        voucher_date: vd,
        voucher_number: String(v.voucher_number ?? ''),
        narration: (v.narration as string | null) ?? '',
        voucher_type: (v.voucher_type as string) ?? null,
        dr: dc === 'DR' ? amt : 0,
        cr: dc === 'CR' ? amt : 0,
      });
    } else {
      cur.dr += dc === 'DR' ? amt : 0;
      cur.cr += dc === 'CR' ? amt : 0;
    }
  }

  return [...acc.values()].sort((a, b) => a.voucher_date.localeCompare(b.voucher_date));
}

export async function openingBalanceBankLedger(dealerId: string, ledgerId: string, asOnInclusive: string): Promise<number> {
  const { data: ev } = await supabase.from('voucher_entries').select('voucher_id, amount, dr_cr').eq('ledger_id', ledgerId);
  const voucherIds = [...new Set((ev ?? []).map((r) => (r as Record<string, unknown>).voucher_id as string))];
  if (!voucherIds.length) return 0;

  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('id, voucher_date')
    .eq('dealer_id', dealerId)
    .in('id', voucherIds)
    .lt('voucher_date', asOnInclusive.slice(0, 10));

  const before = new Set((vouchers ?? []).map((v) => String((v as Record<string, unknown>).id)));
  let bal = 0;
  for (const row of ev ?? []) {
    const vid = String((row as Record<string, unknown>).voucher_id);
    if (!before.has(vid)) continue;
    const amt = Number((row as Record<string, unknown>).amount ?? 0);
    const dc = String((row as Record<string, unknown>).dr_cr);
    bal += dc === 'DR' ? amt : -amt;
  }
  return Math.round(bal * 100) / 100;
}

export async function getFarmerOutstandingSales(dealerId: string, farmerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sales')
    .select('balance_due')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .in('status', ['pending', 'partial']);
  if (error || !data) return 0;
  return data.reduce((s, r) => s + Number((r as { balance_due: number }).balance_due ?? 0), 0);
}

export async function getFarmerCreditRow(farmerId: string) {
  const { data, error } = await supabase
    .from('farmers')
    .select('credit_blocked, credit_limit, interest_rate, ledger_id, block_reason')
    .eq('id', farmerId)
    .maybeSingle();
  if (error) return null;
  return data as {
    credit_blocked: boolean;
    credit_limit: number;
    interest_rate: number;
    ledger_id: string | null;
    block_reason: string | null;
  } | null;
}

export async function getFarmerSaleOutstandings(dealerId: string, farmerId: string): Promise<SaleOutstandingRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, farmer_id, sale_date, due_date, final_amount, balance_due, status')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .in('status', ['pending', 'partial'])
    .gt('balance_due', 0)
    .order('sale_date');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      farmer_id: String(row.farmer_id),
      invoice_date: String(row.sale_date ?? '').slice(0, 10),
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : null,
      final_amount: Number(row.final_amount ?? 0),
      balance_due: Number(row.balance_due ?? 0),
      status: String(row.status ?? ''),
    };
  });
}

export async function getSupplierPiOutstandings(dealerId: string, supplierId: string) {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, pi_number, invoice_date, due_date, total_amount, balance_due, status')
    .eq('dealer_id', dealerId)
    .eq('supplier_id', supplierId)
    .in('status', ['UNPAID', 'PARTIAL'])
    .gt('balance_due', 0)
    .order('invoice_date');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Last imported batch summary — best-effort from latest rows */
export async function getLastBankImportSummary(dealerId: string, bankAccountId: string) {
  const { data, error } = await supabase
    .from('bank_statement_lines')
    .select('import_batch_id, txn_date')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const bid = String((data as Record<string, unknown>).import_batch_id ?? '');
  if (!bid) return null;
  const { data: lines, error: err2 } = await supabase
    .from('bank_statement_lines')
    .select('debit,credit')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('import_batch_id', bid);
  if (err2 || !lines) return null;
  const dr = lines.reduce((s, l) => s + Number((l as Record<string, unknown>).debit ?? 0), 0);
  const cr = lines.reduce((s, l) => s + Number((l as Record<string, unknown>).credit ?? 0), 0);
  const date = String((data as Record<string, unknown>).txn_date ?? '').slice(0, 10);
  return {
    batch_id: bid,
    txn_sample_date: date,
    count: lines.length,
    total_dr: dr,
    total_cr: cr,
  };
}

export type BankRecSummary = {
  bank_statement_balance: number | null;
  books_balance_net: number;
  uncleared_cheques_total: number;
  unmatched_bank_dr: number;
  unmatched_bank_cr: number;
  deposits_in_transit: number;
  difference: number;
};

/** Reconciliation approximation: books = opening + Σ(DR−CR); bank from last statement balance if any */
export async function getBankReconciliation(
  dealerId: string,
  bankAccountId: string,
  ledgerId: string | null,
  asOn: string
): Promise<BankRecSummary> {
  const day = asOn.slice(0, 10);

  let bank_bal: number | null = null;
  const { data: stmtRows } = await supabase
    .from('bank_statement_lines')
    .select('balance, txn_date, created_at')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .lte('txn_date', day)
    .order('txn_date', { ascending: false })
    .limit(120);
  const sorted = [...(stmtRows ?? [])].sort((a, b) => {
    const da = String((a as Record<string, unknown>).txn_date ?? '');
    const db = String((b as Record<string, unknown>).txn_date ?? '');
    if (da !== db) return db.localeCompare(da);
    const ta = String((a as Record<string, unknown>).created_at ?? '');
    const tb = String((b as Record<string, unknown>).created_at ?? '');
    return tb.localeCompare(ta);
  });
  for (const raw of sorted) {
    const b = (raw as Record<string, unknown>).balance;
    if (typeof b === 'number' || (b != null && String(b).trim() !== '' && !Number.isNaN(Number(b)))) {
      bank_bal = typeof b === 'number' ? b : Number(b);
      break;
    }
  }

  let booksNet = 0;
  if (ledgerId) {
    const { data: ev } = await supabase.from('voucher_entries').select('voucher_id, amount, dr_cr').eq('ledger_id', ledgerId);
    const voucherIds = [...new Set((ev ?? []).map((r) => (r as Record<string, unknown>).voucher_id as string))];
    if (voucherIds.length) {
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('id, voucher_date')
        .eq('dealer_id', dealerId)
        .in('id', voucherIds)
        .lte('voucher_date', day);
      const ok = new Set((vouchers ?? []).map((v) => String((v as Record<string, unknown>).id)));
      let bal = 0;
      for (const row of ev ?? []) {
        const vid = String((row as Record<string, unknown>).voucher_id);
        if (!ok.has(vid)) continue;
        const amt = Number((row as Record<string, unknown>).amount ?? 0);
        const dc = String((row as Record<string, unknown>).dr_cr);
        bal += dc === 'DR' ? amt : -amt;
      }
      booksNet = Math.round(bal * 100) / 100;
    }
  }

  const { data: uncleared } = await supabase
    .from('cheques')
    .select('amount')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('direction', 'ISSUED')
    .in('status', ['PENDING', 'PRESENTED']);
  const uch = (uncleared ?? []).reduce((s, r) => s + Number((r as Record<string, unknown>).amount ?? 0), 0);

  const { data: unmatched } = await supabase
    .from('bank_statement_lines')
    .select('debit, credit')
    .eq('dealer_id', dealerId)
    .eq('bank_account_id', bankAccountId)
    .eq('recon_status', 'UNMATCHED')
    .lte('txn_date', day);
  const udr = (unmatched ?? []).reduce((s, r) => s + Number((r as Record<string, unknown>).debit ?? 0), 0);
  const ucr = (unmatched ?? []).reduce((s, r) => s + Number((r as Record<string, unknown>).credit ?? 0), 0);

  const depositsInTransit = ucr;
  const diff = bank_bal !== null ? Math.round((bank_bal + depositsInTransit - uch - booksNet) * 100) / 100 : 0;

  return {
    bank_statement_balance: bank_bal !== null ? bank_bal : null,
    books_balance_net: booksNet,
    uncleared_cheques_total: uch,
    unmatched_bank_dr: udr,
    unmatched_bank_cr: ucr,
    deposits_in_transit: depositsInTransit,
    difference: bank_bal !== null ? diff : 0,
  };
}

async function getInterestIncomeLedgerId(dealerRowId: string): Promise<string> {
  const tryCodes = ['INTEREST_INCOME', 'INDIRECT_INCOME', 'OTHER_INCOME', 'INCOME'];
  for (const code of tryCodes) {
    const { data } = await supabase.from('ledgers').select('id').eq('dealer_id', dealerRowId).eq('ledger_code', code).maybeSingle();
    if (data && (data as { id: string }).id) return (data as { id: string }).id;
  }
  const { data: byName } = await supabase
    .from('ledgers')
    .select('id')
    .eq('dealer_id', dealerRowId)
    .ilike('name', '%interest%')
    .limit(1)
    .maybeSingle();
  if (byName && (byName as { id: string }).id) return (byName as { id: string }).id;
  throw new Error('Interest income ledger not found. Add a ledger with ledger_code INTEREST_INCOME.');
}

async function resolvePartyLedgerFromInterest(row: {
  party_type: string;
  party_id: string;
}): Promise<string | null> {
  const pt = String(row.party_type || '').toUpperCase();
  const pid = String(row.party_id || '');
  if (pt === 'FARMER') {
    const { data } = await supabase.from('farmers').select('ledger_id').eq('id', pid).maybeSingle();
    const lid = (data as { ledger_id?: string | null } | null)?.ledger_id;
    return lid ?? null;
  }
  if (pt === 'SUPPLIER') {
    const { data } = await supabase.from('suppliers').select('ledger_id').eq('id', pid).maybeSingle();
    const lid = (data as { ledger_id?: string | null } | null)?.ledger_id;
    return lid ?? null;
  }
  return null;
}

/**
 * Reverse accounting entries for a bounced cheque via JNL (uses voucher linked on cheque row).
 * `dealerSlug` = session.dealerId (tenant TEXT); `dealerRowId` = dealers.id for next_doc_number.
 */
export async function postBouncedChequeReversal(
  chequeId: string,
  dealerSlug: string,
  dealerRowId: string
): Promise<{ reversal_voucher_id: string; voucher_number: string }> {
  const { data: cheque, error: chErr } = await supabase.from('cheques').select('*').eq('id', chequeId).single();
  if (chErr || !cheque) throw new Error(chErr?.message ?? 'Cheque not found');

  const voucherId = (cheque as ChequeRow).voucher_id;
  if (!voucherId) throw new Error('No voucher linked to this cheque');

  const { data: entries, error: enErr } = await supabase.from('voucher_entries').select('*').eq('voucher_id', voucherId);
  if (enErr) throw new Error(enErr.message);
  if (!entries?.length) throw new Error('No voucher entries for linked voucher');

  const { data: origVoucher } = await supabase.from('vouchers').select('total_amount').eq('id', voucherId).maybeSingle();
  const totalAmt = Number((origVoucher as { total_amount?: number } | null)?.total_amount ?? (cheque as ChequeRow).amount ?? 0);

  const fy = getFinancialYearLabel(new Date());
  const { data: seqData, error: seqErr } = await supabase.rpc('next_doc_number', {
    p_dealer_id: dealerRowId,
    p_prefix: 'JNL',
    p_fy: fy,
  });
  if (seqErr) throw new Error(seqErr.message);
  const voucherNumber = String(seqData);

  const narration = `Bounced cheque reversal — Chq No ${(cheque as ChequeRow).cheque_number} — ${(cheque as ChequeRow).party_name}`;

  const { data: reversalVoucher, error: vErr } = await supabase
    .from('vouchers')
    .insert({
      dealer_id: dealerSlug,
      voucher_type: 'JNL',
      voucher_number: voucherNumber,
      voucher_date: new Date().toISOString().slice(0, 10),
      narration,
      total_amount: totalAmt,
      status: 'POSTED',
      reference: chequeId,
      meta: {
        cheque_bounce_reversal: chequeId,
        original_voucher_id: voucherId,
      },
    })
    .select('id')
    .single();
  if (vErr || !reversalVoucher) throw new Error(vErr?.message ?? 'Failed to create reversal voucher');

  const revId = String((reversalVoucher as { id: string }).id);
  const reversedEntries = (entries as Record<string, unknown>[]).map((e) => ({
    voucher_id: revId,
    ledger_id: e.ledger_id as string,
    dr_cr: String(e.dr_cr) === 'DR' ? 'CR' : 'DR',
    amount: Number(e.amount ?? 0),
  }));

  const { error: insErr } = await supabase.from('voucher_entries').insert(reversedEntries);
  if (insErr) throw new Error(insErr.message);

  const { error: upErr } = await supabase
    .from('cheques')
    .update({
      status: 'BOUNCED',
      bounce_reason: `Cheque bounced — reversed via JNL ${voucherNumber}`,
      reversal_voucher_id: revId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chequeId);
  if (upErr) throw new Error(upErr.message);

  return { reversal_voucher_id: revId, voucher_number: voucherNumber };
}

/** Post journal vouchers for selected COMPUTED overdue_interest rows. */
export async function postOverdueInterest(
  interestIds: string[],
  dealerSlug: string,
  dealerRowId: string
): Promise<number> {
  if (!interestIds.length) return 0;

  const { data: interests, error } = await supabase
    .from('overdue_interest')
    .select('*')
    .in('id', interestIds)
    .eq('dealer_id', dealerSlug)
    .eq('status', 'COMPUTED');
  if (error) throw new Error(error.message);
  const rows = interests ?? [];
  if (!rows.length) return 0;

  const incomeLedgerId = await getInterestIncomeLedgerId(dealerRowId);
  let posted = 0;

  for (const raw of rows as Record<string, unknown>[]) {
    const partyLedger = await resolvePartyLedgerFromInterest({
      party_type: String(raw.party_type ?? ''),
      party_id: String(raw.party_id ?? ''),
    });
    if (!partyLedger) continue;

    const interestAmt = Number(raw.interest_amount ?? 0);
    if (interestAmt <= 0) continue;

    const fy = getFinancialYearLabel(new Date());
    const { data: seqData, error: seqErr } = await supabase.rpc('next_doc_number', {
      p_dealer_id: dealerRowId,
      p_prefix: 'JNL',
      p_fy: fy,
    });
    if (seqErr) throw new Error(seqErr.message);
    const voucherNumber = String(seqData);

    const narration = `Interest on overdue — ${String(raw.overdue_days ?? '')} days @ ${String(raw.interest_rate ?? '')}%`;

    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .insert({
        dealer_id: dealerSlug,
        voucher_type: 'JNL',
        voucher_number: voucherNumber,
        voucher_date: new Date().toISOString().slice(0, 10),
        narration,
        total_amount: interestAmt,
        status: 'POSTED',
        reference: String(raw.invoice_id ?? ''),
        meta: { overdue_interest_id: raw.id, invoice_id: raw.invoice_id },
      })
      .select('id')
      .single();
    if (vErr || !voucher) throw new Error(vErr?.message ?? 'Interest voucher failed');

    const vid = String((voucher as { id: string }).id);

    const { error: eErr } = await supabase.from('voucher_entries').insert([
      { voucher_id: vid, ledger_id: partyLedger, dr_cr: 'DR', amount: interestAmt },
      { voucher_id: vid, ledger_id: incomeLedgerId, dr_cr: 'CR', amount: interestAmt },
    ]);
    if (eErr) throw new Error(eErr.message);

    const { error: uErr } = await supabase.from('overdue_interest').update({ status: 'POSTED', voucher_id: vid }).eq('id', raw.id);
    if (uErr) throw new Error(uErr.message);
    posted += 1;
  }

  return posted;
}
