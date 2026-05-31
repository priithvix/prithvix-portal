import { supabase } from '@/lib/supabase/client';
import type { TrialBalanceRow } from '@/lib/supabase/reports';
import {
  getCashFlow,
  getDayBook,
  getLedgerPickList,
  getLedgerStatement,
  getPurchaseRegister,
  getSalesRegister,
  getTrialBalance,
} from '@/lib/supabase/reports';
import type * as XLSXNS from 'xlsx';

export function isLiabilityRow(ledger: string, group: string): boolean {
  const s = `${group} ${ledger}`.toLowerCase();
  return /capital|loan|payable|creditor|gst|duty|provision|supplier|credit|outstanding|bank od|unpaid|tds|tax/i.test(s);
}

export function trialBalanceToBalanceSheet(rows: TrialBalanceRow[]): {
  liabLines: { n: string; a: number }[];
  assetLines: { n: string; a: number }[];
  liabTotal: number;
  assetTotal: number;
} {
  const L: { n: string; a: number }[] = [];
  const A: { n: string; a: number }[] = [];
  let lsum = 0;
  let asum = 0;
  for (const r of rows) {
    const net = r.dr_total - r.cr_total;
    if (Math.abs(net) < 0.01) continue;
    const name = r.ledger_name;
    const group = r.group_name ?? '';
    const liab = isLiabilityRow(name, group);
    if (liab) {
      const show = -net;
      L.push({ n: name, a: show });
      lsum += show;
    } else {
      A.push({ n: name, a: net });
      asum += net;
    }
  }
  L.sort((a, b) => Math.abs(b.a) - Math.abs(a.a));
  A.sort((a, b) => Math.abs(b.a) - Math.abs(a.a));
  return { liabLines: L.slice(0, 80), assetLines: A.slice(0, 80), liabTotal: lsum, assetTotal: asum };
}

export async function fetchPlSummary(dealerSlug: string, dealerRowId: string, fromIso: string, toIso: string) {
  const [{ data: salesRows, error: e1 }, { data: purRows, error: e2 }] = await Promise.all([
    supabase
      .from('sales')
      .select('final_amount')
      .eq('dealer_id', dealerSlug)
      .gte('sale_date', fromIso)
      .lte('sale_date', toIso)
      .in('status', ['paid', 'partial', 'pending']),
    supabase
      .from('purchase_invoices')
      .select('total_amount')
      .eq('dealer_id', dealerRowId)
      .gte('invoice_date', fromIso)
      .lte('invoice_date', toIso)
      .neq('status', 'CANCELLED'),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const sales = (salesRows ?? []).reduce((s, r) => s + Number((r as { final_amount?: number }).final_amount ?? 0), 0);
  const purchases = (purRows ?? []).reduce((s, r) => s + Number((r as { total_amount?: number }).total_amount ?? 0), 0);
  return { sales, purchases, gross: sales - purchases };
}

export type StockExportRow = { product: string; hsn: string; unit: string; qty: number; rate: string; value: string };

/** SKU-level stock (matches Stock Summary screen). */
export async function fetchStockExportRows(dealerRowId: string): Promise<StockExportRow[]> {
  const { data: skus, error: e1 } = await supabase
    .from('product_skus')
    .select('id, display_label, unit_type, product_master(product_name, hsn_code)')
    .eq('dealer_id', dealerRowId);
  if (e1) throw new Error(e1.message);
  const { data: bal, error: e2 } = await supabase.from('sku_stock_balances').select('sku_id, quantity_base').eq('dealer_id', dealerRowId);
  if (e2) throw new Error(e2.message);
  const map = Object.fromEntries((bal ?? []).map((b) => [String((b as { sku_id: string }).sku_id), Number((b as { quantity_base: number }).quantity_base) || 0]));
  return (skus ?? []).map((s) => {
    const row = s as {
      id: string;
      display_label: string | null;
      unit_type: string | null;
      product_master: { product_name?: string; hsn_code?: string | null } | null;
    };
    const label = row.display_label || row.product_master?.product_name || row.id;
    const qty = map[row.id] ?? 0;
    return {
      product: label,
      hsn: row.product_master?.hsn_code ?? '',
      unit: row.unit_type || 'unit',
      qty,
      rate: '—',
      value: '—',
    };
  });
}

export async function appendLedgerStatementsSheet(
  utils: typeof XLSXNS.utils,
  book: XLSXNS.WorkBook,
  dealerRowId: string,
  from: Date,
  to: Date,
  fmtDate: (iso: string) => string,
  maxLedgers = 60
): Promise<void> {
  const picks = await getLedgerPickList(dealerRowId);
  const slice = picks.slice(0, maxLedgers);
  const flat: Record<string, string | number>[] = [];
  for (const p of slice) {
    const stmt = await getLedgerStatement(dealerRowId, p.id, from, to);
    for (const ln of stmt) {
      flat.push({
        Ledger: p.name,
        Date: fmtDate(ln.entry_date),
        'Voucher No': ln.voucher_number ?? '',
        Type: ln.voucher_type ?? '',
        Narration: ln.narration ?? '',
        Dr: ln.dr_amount,
        Cr: ln.cr_amount,
        Balance: ln.running_balance,
      });
    }
  }
  const ws = utils.json_to_sheet(flat.length ? flat : [{ Ledger: '—', Note: 'No ledger movement in range' }]);
  utils.book_append_sheet(book, ws, 'Ledgers');
}

/** Apply column widths (min ~18 chars) for every sheet in workbook */
export function applySheetColWidths(book: XLSXNS.WorkBook, utils: typeof XLSXNS.utils, wch = 18): void {
  for (const name of book.SheetNames) {
    const ws = book.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const range = utils.decode_range(ws['!ref']);
    ws['!cols'] = Array(range.e.c + 1).fill({ wch });
  }
}

export async function buildSalesPurchaseTrialDayCashStockSheets(args: {
  dealerRowId: string;
  dealerSlug: string;
  fyStart: Date;
  fyEnd: Date;
  fmtDate: (iso: string) => string;
  utils: typeof XLSXNS.utils;
  book: XLSXNS.WorkBook;
  keys: { sal: boolean; pur: boolean; tb: boolean; day: boolean; cf: boolean; st: boolean };
}): Promise<void> {
  const { dealerRowId, dealerSlug, fyStart, fyEnd, fmtDate, utils, book, keys } = args;

  if (keys.sal) {
    const rows = await getSalesRegister(dealerRowId, fyStart, fyEnd, null, null);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        rows.map((r) => ({
          'Invoice No': r.invoice_number,
          Date: fmtDate(r.invoice_date),
          Farmer: r.farmer_name ?? '',
          GSTIN: r.farmer_gstin ?? '',
          'Taxable Value': r.taxable_value,
          CGST: r.cgst,
          SGST: r.sgst,
          IGST: r.igst,
          'Total Tax': r.total_tax,
          'Invoice Value': r.invoice_value,
          Status: r.payment_status ?? '',
        }))
      ),
      'Sales Register'
    );
  }

  if (keys.pur) {
    const rows = await getPurchaseRegister(dealerRowId, fyStart, fyEnd, null);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        rows.map((r) => ({
          'PI Number': r.pi_number,
          Date: fmtDate(r.invoice_date),
          Supplier: r.supplier_name ?? '',
          GSTIN: r.supplier_gstin ?? '',
          'Taxable Value': r.taxable_value,
          'Input CGST': r.cgst,
          'Input SGST': r.sgst,
          'Input IGST': r.igst,
          'Total Tax': r.total_tax,
          'Invoice Value': r.invoice_value,
          Status: r.payment_status ?? '',
        }))
      ),
      'Purchase Register'
    );
  }

  if (keys.tb) {
    const rows = await getTrialBalance(dealerRowId, fyEnd);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        rows.map((r) => ({
          Account: r.ledger_name,
          Group: r.group_name,
          'Dr Balance': r.dr_total,
          'Cr Balance': r.cr_total,
        }))
      ),
      'Trial Balance'
    );
  }

  if (keys.day) {
    const rows = await getDayBook(dealerRowId, fyStart, fyEnd);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        rows.map((r) => ({
          Date: fmtDate(r.voucher_date),
          'Voucher No': r.voucher_number ?? '',
          Type: r.voucher_type ?? '',
          Narration: r.narration ?? '',
          Amount: r.total_amount,
        }))
      ),
      'Day Book'
    );
  }

  if (keys.cf) {
    const rows = await getCashFlow(dealerRowId, fyStart, fyEnd);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        rows.map((r) => ({
          Section: r.section,
          'Line Item': r.line_item,
          Amount: r.amount,
        }))
      ),
      'Cash Flow'
    );
  }

  if (keys.st) {
    const stk = await fetchStockExportRows(dealerRowId);
    utils.book_append_sheet(
      book,
      utils.json_to_sheet(
        stk.map((r) => ({
          Product: r.product,
          HSN: r.hsn,
          Unit: r.unit,
          Qty: r.qty,
          Rate: r.rate,
          Value: r.value,
        }))
      ),
      'Stock Summary'
    );
  }
}
