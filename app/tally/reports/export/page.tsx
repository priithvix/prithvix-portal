'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import {
  getCashFlow,
  getDayBook,
  getPurchaseRegister,
  getSalesRegister,
  getTrialBalance,
} from '@/lib/supabase/reports';
import { getGstAuditReport } from '@/lib/supabase/gst';
import { getPayablesAgeing, getReceivablesAgeing } from '@/lib/supabase/banking';
import { fyDates, listFYOptions, fmtDate, getFY } from '@/lib/reports/formatters';
import { tallyTablePdfBlob } from '@/lib/reports/tally-pdf-table';
import {
  appendLedgerStatementsSheet,
  applySheetColWidths,
  buildSalesPurchaseTrialDayCashStockSheets,
  fetchPlSummary,
  trialBalanceToBalanceSheet,
} from '@/lib/reports/year-end-export';
import { buildTallyXml, mapDbDrCr, type TallyLedger, type TallyVoucher } from '@/lib/reports/tally-xml';
import { formatTallyAmount } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';
import { supabase } from '@/lib/supabase/client';

/* ─── Ratio helpers (mirrors ratio-analysis/page.tsx logic) ─── */
function isLiab(name: string, group: string) {
  return /capital|loan|payable|creditor|gst|duty|provision|supplier|credit|outstanding|bank od|unpaid|tds|tax/i.test(`${group} ${name}`);
}
function liabSub(name: string, group: string): 'eq' | 'ltd' | 'cl' {
  const s = `${group} ${name}`.toLowerCase();
  if (/capital|partner|proprietor|reserve|retained|share/i.test(s)) return 'eq';
  if (/(long|term).*(loan|debt)/i.test(s)) return 'ltd';
  return 'cl';
}
function computeRatiosForExport(
  tb: import('@/lib/supabase/reports').TrialBalanceRow[],
  pl: { sales: number; purchases: number; gross: number }
) {
  let ca = 0, inv = 0, cash = 0, debtors = 0, cl = 0, ltd = 0, equity = 0, interest = 0;
  for (const r of tb) {
    const net = r.dr_total - r.cr_total;
    if (Math.abs(net) < 0.01) continue;
    const n = r.ledger_name, g = r.group_name ?? '';
    if (isLiab(n, g)) {
      const show = -net;
      const sub = liabSub(n, g);
      if (sub === 'eq') equity += show;
      else if (sub === 'ltd') ltd += show;
      else cl += show;
    } else {
      if (/stock|inventory/i.test(`${g} ${n}`)) inv += net;
      else if (/cash|bank/i.test(`${g} ${n}`)) cash += net;
      else if (/debtor|receivable/i.test(`${g} ${n}`)) debtors += net;
      if (!/fixed|building|equipment|vehicle|plant|furniture|land|motor/i.test(`${g} ${n}`) && net > 0)
        ca += net;
      if (/interest paid|finance cost|bank interest/i.test(`${g} ${n}`)) interest += net;
    }
  }
  const totalDebt = ltd + cl;
  const ce = equity + ltd;
  const ebit = pl.gross - interest;
  const revenue = pl.sales;
  const cogs = pl.purchases;
  const fmt = (v: number | null, unit: string) =>
    v == null ? 'N/A' : unit === 'x' ? `${v.toFixed(2)}x` : unit === '%' ? `${v.toFixed(1)}%` : unit === 'd' ? `${Math.round(v)} days` : v.toFixed(2);
  const status = (v: number | null, good: number, fair: number, dir: 'hi' | 'lo'): string => {
    if (v == null) return '—';
    if (dir === 'hi') return v >= good ? 'Good' : v >= fair ? 'Fair' : 'Poor';
    return v <= good ? 'Good' : v <= fair ? 'Fair' : 'Poor';
  };
  const rows = [
    { Category: 'Liquidity', Ratio: 'Current Ratio', raw: cl > 0 ? ca / cl : null, bench: '≥ 2.0', unit: 'x', g: 2, f: 1, dir: 'hi' as const },
    { Category: 'Liquidity', Ratio: 'Quick Ratio', raw: cl > 0 ? (ca - inv) / cl : null, bench: '≥ 1.0', unit: 'x', g: 1, f: 0.5, dir: 'hi' as const },
    { Category: 'Liquidity', Ratio: 'Cash Ratio', raw: cl > 0 ? cash / cl : null, bench: '≥ 0.5', unit: 'x', g: 0.5, f: 0.2, dir: 'hi' as const },
    { Category: 'Profitability', Ratio: 'Gross Profit %', raw: revenue > 0 ? (pl.gross / revenue) * 100 : null, bench: '≥ 20%', unit: '%', g: 20, f: 10, dir: 'hi' as const },
    { Category: 'Profitability', Ratio: 'Net Profit %', raw: revenue > 0 ? ((ebit) / revenue) * 100 : null, bench: '≥ 10%', unit: '%', g: 10, f: 5, dir: 'hi' as const },
    { Category: 'Profitability', Ratio: 'ROCE %', raw: ce > 0 ? (ebit / ce) * 100 : null, bench: '≥ 15%', unit: '%', g: 15, f: 8, dir: 'hi' as const },
    { Category: 'Solvency', Ratio: 'Debt-to-Equity', raw: equity > 0 ? totalDebt / equity : null, bench: '≤ 1.5', unit: 'x', g: 1, f: 1.5, dir: 'lo' as const },
    { Category: 'Solvency', Ratio: 'Interest Coverage', raw: interest > 0 ? ebit / interest : null, bench: '≥ 3.0', unit: 'x', g: 3, f: 1.5, dir: 'hi' as const },
    { Category: 'Efficiency', Ratio: 'Inventory Turnover', raw: inv > 0 ? cogs / inv : null, bench: '≥ 4.0', unit: 'x', g: 4, f: 2, dir: 'hi' as const },
    { Category: 'Efficiency', Ratio: 'Debtor Days', raw: revenue > 0 && debtors > 0 ? (debtors / revenue) * 365 : null, bench: '≤ 45 days', unit: 'd', g: 30, f: 60, dir: 'lo' as const },
  ];
  return rows.map((r) => ({
    Category: r.Category,
    Ratio: r.Ratio,
    Value: fmt(r.raw, r.unit),
    Benchmark: r.bench,
    Status: status(r.raw, r.g, r.f, r.dir),
  }));
}

const KEYS = {
  bs: 'balance_sheet',
  pl: 'profit_loss',
  tb: 'trial_balance',
  day: 'day_book',
  sal: 'sales_reg',
  pur: 'purchase_reg',
  led: 'ledger_all',
  cf: 'cash_flow',
  gst: 'gst_audit',
  os: 'outstanding',
  st: 'stock',
  ratio: 'ratio',
} as const;

const LAST_XML_KEY = 'prithvi_last_tally_xml_export';

function ExportAllReportPage() {
  const searchParams = useSearchParams();
  const fmtQuery = searchParams.get('format');
  const { session, dealer } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';
  const dealerSlug = session?.dealerId ?? '';

  const fys = useMemo(() => listFYOptions(), []);
  const [fy, setFy] = useState(() => getFY(new Date()));
  const [sel, setSel] = useState<Record<string, boolean>>(() => ({
    [KEYS.tb]: true,
    [KEYS.day]: true,
    [KEYS.sal]: true,
    [KEYS.pur]: true,
    [KEYS.cf]: true,
    [KEYS.led]: false,
    [KEYS.bs]: true,
    [KEYS.pl]: true,
    [KEYS.gst]: true,
    [KEYS.os]: true,
    [KEYS.st]: true,
    [KEYS.ratio]: false,
  }));
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'excel' | 'pdf_zip' | 'tally_xml'>(() =>
    fmtQuery === 'pdf' ? 'pdf_zip' : fmtQuery === 'xml' ? 'tally_xml' : 'excel'
  );
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [lastXml, setLastXml] = useState<string | null>(null);
  const setButtons = useTallySetButtons();

  const { start: fyStart, end: fyEnd } = useMemo(() => fyDates(fy), [fy]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_XML_KEY);
      if (v) setLastXml(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const q = fmtQuery;
    if (q === 'pdf') setMode('pdf_zip');
    else if (q === 'xml') setMode('tally_xml');
    else if (q === 'excel') setMode('excel');
  }, [fmtQuery]);

  const toggle = useCallback((k: string) => setSel((s) => ({ ...s, [k]: !s[k] })), []);
  const selectAll = () => setSel(Object.fromEntries(Object.values(KEYS).map((v) => [v, true])));
  const deselectAll = () => setSel(Object.fromEntries(Object.values(KEYS).map((v) => [v, false])));

  const estimateMb = useMemo(() => {
    let n = 0;
    for (const v of Object.values(sel)) if (v) n += 1;
    return Math.max(0.25, +(n * 0.35).toFixed(2));
  }, [sel]);

  const runExcel = useCallback(async () => {
    if (!dealerRowId || !dealerSlug) return;
    setBusy(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const book = utils.book_new();
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      await buildSalesPurchaseTrialDayCashStockSheets({
        dealerRowId,
        dealerSlug,
        fyStart,
        fyEnd,
        fmtDate,
        utils,
        book,
        keys: {
          sal: !!sel[KEYS.sal],
          pur: !!sel[KEYS.pur],
          tb: !!sel[KEYS.tb],
          day: !!sel[KEYS.day],
          cf: !!sel[KEYS.cf],
          st: !!sel[KEYS.st],
        },
      });

      if (sel[KEYS.bs] || sel[KEYS.pl]) {
        const tb = await getTrialBalance(dealerRowId, fyEnd);
        if (sel[KEYS.bs]) {
          const { liabLines, assetLines, liabTotal, assetTotal } = trialBalanceToBalanceSheet(tb);
          utils.book_append_sheet(
            book,
            utils.json_to_sheet([
              { Side: 'LIABILITIES', Ledger: '', Amount: '' },
              ...liabLines.map((r) => ({ Side: '', Ledger: r.n, Amount: r.a })),
              { Side: '', Ledger: 'TOTAL LIABILITIES', Amount: liabTotal },
              { Side: '', Ledger: '', Amount: '' },
              { Side: 'ASSETS', Ledger: '', Amount: '' },
              ...assetLines.map((r) => ({ Side: '', Ledger: r.n, Amount: r.a })),
              { Side: '', Ledger: 'TOTAL ASSETS', Amount: assetTotal },
            ]),
            'Balance Sheet'
          );
        }
        if (sel[KEYS.pl]) {
          const pl = await fetchPlSummary(dealerSlug, dealerRowId, iso(fyStart), iso(fyEnd));
          utils.book_append_sheet(
            book,
            utils.json_to_sheet([
              { Line: 'Sales (turnover)', Amount: pl.sales },
              { Line: 'Purchases', Amount: pl.purchases },
              { Line: 'Gross (Sales − Purchases)', Amount: pl.gross },
            ]),
            'Profit and Loss'
          );
        }
      }

      if (sel[KEYS.gst]) {
        const rows = await getGstAuditReport(dealerRowId, fy);
        utils.book_append_sheet(
          book,
          utils.json_to_sheet(
            rows.map((r) => ({
              Month: r.monthLabel,
              Taxable: r.taxable,
              CGST: r.cgst,
              SGST: r.sgst,
              TotalTax: r.totalTax,
              TotalITC: r.totalItc,
              Status: r.status,
            }))
          ),
          'GST Audit'
        );
      }

      if (sel[KEYS.os]) {
        const [rec, pay] = await Promise.all([
          getReceivablesAgeing(dealerSlug, fyEnd),
          getPayablesAgeing(dealerSlug, fyEnd),
        ]);
        utils.book_append_sheet(
          book,
          utils.json_to_sheet(
            rec.map((r) => ({
              Kind: 'Receivable',
              Party: r.farmer_name,
              Mobile: r.mobile ?? '',
              '0-30': r.bucket_0_30,
              '31-60': r.bucket_31_60,
              '61-90': r.bucket_61_90,
              '90+': r.bucket_90_plus,
              Total: r.total_due,
            }))
          ),
          'Outstanding AR'
        );
        utils.book_append_sheet(
          book,
          utils.json_to_sheet(
            pay.map((r) => ({
              Kind: 'Payable',
              Party: r.supplier_name,
              Mobile: r.mobile ?? '',
              '0-30': r.bucket_0_30,
              '31-60': r.bucket_31_60,
              '61-90': r.bucket_61_90,
              '90+': r.bucket_90_plus,
              Total: r.total_due,
            }))
          ),
          'Outstanding AP'
        );
      }

      if (sel[KEYS.ratio]) {
        const tbForRatio = await getTrialBalance(dealerRowId, fyEnd);
        const plForRatio = await fetchPlSummary(dealerSlug, dealerRowId, iso(fyStart), iso(fyEnd));
        const ratioRows = computeRatiosForExport(tbForRatio, plForRatio);
        utils.book_append_sheet(
          book,
          utils.json_to_sheet(ratioRows),
          'Ratio Analysis'
        );
      }

      if (sel[KEYS.led]) {
        await appendLedgerStatementsSheet(utils, book, dealerRowId, fyStart, fyEnd, fmtDate, 50);
      }

      applySheetColWidths(book, utils);
      writeFile(book, `PrithviX_${fy}_Export.xlsx`);
      setLastExport(`${new Date().toLocaleString('en-IN')} · Excel workbook`);
      playTallyAccept();
    } catch (e) {
      console.error(e);
      playTallyError();
    } finally {
      setBusy(false);
    }
  }, [dealerRowId, dealerSlug, fy, fyStart, fyEnd, sel]);

  const runPdfZip = useCallback(async () => {
    if (!dealerRowId || !dealerSlug) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const pushPdf = async (name: string, spec: Parameters<typeof tallyTablePdfBlob>[0]) => {
        const blob = await tallyTablePdfBlob(spec);
        zip.file(name, blob);
      };

      const pdfCells = (cells: (string | null | undefined)[]): string[] => cells.map((c) => (c == null ? '' : String(c)));

      if (sel[KEYS.tb]) {
        const rows = await getTrialBalance(dealerRowId, fyEnd);
        await pushPdf(`Trial_Balance_${fy}.pdf`, {
          title: 'Trial Balance',
          subtitle: `As on ${fmtDate(iso(fyEnd))}`,
          headers: ['Ledger', 'Group', 'Dr', 'Cr'],
          rows: rows.map((r) =>
            pdfCells([r.ledger_name, r.group_name, formatTallyAmount(r.dr_total), formatTallyAmount(r.cr_total)])
          ),
        });
      }
      if (sel[KEYS.day]) {
        const rows = await getDayBook(dealerRowId, fyStart, fyEnd);
        await pushPdf(`Day_Book_${fy}.pdf`, {
          title: 'Day Book',
          subtitle: `${fmtDate(iso(fyStart))} to ${fmtDate(iso(fyEnd))}`,
          headers: ['Date', 'Voucher', 'Type', 'Amount'],
          rows: rows.map((r) => [
            fmtDate(r.voucher_date),
            r.voucher_number ?? '',
            r.voucher_type ?? '',
            formatTallyAmount(r.total_amount),
          ]),
        });
      }
      if (sel[KEYS.sal]) {
        const rows = await getSalesRegister(dealerRowId, fyStart, fyEnd, null, null);
        await pushPdf(`Sales_Register_${fy}.pdf`, {
          title: 'Sales Register',
          subtitle: fmtDate(iso(fyStart)) + ' to ' + fmtDate(iso(fyEnd)),
          headers: ['Invoice', 'Date', 'Farmer', 'Taxable', 'Tax', 'Total'],
          rows: rows.slice(0, 500).map((r) => [
            r.invoice_number,
            fmtDate(r.invoice_date),
            r.farmer_name ?? '',
            formatTallyAmount(r.taxable_value),
            formatTallyAmount(r.total_tax),
            formatTallyAmount(r.invoice_value),
          ]),
        });
      }
      if (sel[KEYS.pur]) {
        const rows = await getPurchaseRegister(dealerRowId, fyStart, fyEnd, null);
        await pushPdf(`Purchase_Register_${fy}.pdf`, {
          title: 'Purchase Register',
          subtitle: fmtDate(iso(fyStart)) + ' to ' + fmtDate(iso(fyEnd)),
          headers: ['PI', 'Date', 'Supplier', 'Taxable', 'Tax', 'Total'],
          rows: rows.slice(0, 500).map((r) => [
            r.pi_number,
            fmtDate(r.invoice_date),
            r.supplier_name ?? '',
            formatTallyAmount(r.taxable_value),
            formatTallyAmount(r.total_tax),
            formatTallyAmount(r.invoice_value),
          ]),
        });
      }
      if (sel[KEYS.cf]) {
        const rows = await getCashFlow(dealerRowId, fyStart, fyEnd);
        await pushPdf(`Cash_Flow_${fy}.pdf`, {
          title: 'Cash Flow',
          subtitle: fy,
          headers: ['Section', 'Line', 'Amount'],
          rows: rows.map((r) => [r.section, r.line_item, formatTallyAmount(r.amount)]),
        });
      }
      if (sel[KEYS.bs] || sel[KEYS.pl]) {
        const tb = await getTrialBalance(dealerRowId, fyEnd);
        const { liabLines, assetLines, liabTotal, assetTotal } = trialBalanceToBalanceSheet(tb);
        const lines: string[][] = [
          ['LIABILITIES', '₹'],
          ...liabLines.map((r) => [r.n, formatTallyAmount(r.a)]),
          ['TOTAL LIABILITIES', formatTallyAmount(liabTotal)],
          ['', ''],
          ['ASSETS', '₹'],
          ...assetLines.map((r) => [r.n, formatTallyAmount(r.a)]),
          ['TOTAL ASSETS', formatTallyAmount(assetTotal)],
        ];
        await pushPdf(`Balance_Sheet_${fy}.pdf`, {
          title: 'Balance Sheet (from Trial Balance)',
          subtitle: `As on ${fmtDate(iso(fyEnd))}`,
          headers: ['', ''],
          rows: lines,
        });
        const pl = await fetchPlSummary(dealerSlug, dealerRowId, iso(fyStart), iso(fyEnd));
        await pushPdf(`Profit_Loss_${fy}.pdf`, {
          title: 'Profit & Loss (summary)',
          subtitle: `${fmtDate(iso(fyStart))} to ${fmtDate(iso(fyEnd))}`,
          headers: ['Line', 'Amount'],
          rows: [
            ['Sales', formatTallyAmount(pl.sales)],
            ['Purchases', formatTallyAmount(pl.purchases)],
            ['Gross', formatTallyAmount(pl.gross)],
          ],
        });
      }
      if (sel[KEYS.gst]) {
        const rows = await getGstAuditReport(dealerRowId, fy);
        await pushPdf(`GST_Audit_${fy}.pdf`, {
          title: 'GST Audit Summary',
          subtitle: fy,
          headers: ['Month', 'Taxable', 'CGST', 'SGST', 'Total tax'],
          rows: rows.map((r) => [
            r.monthLabel,
            formatTallyAmount(r.taxable),
            formatTallyAmount(r.cgst),
            formatTallyAmount(r.sgst),
            formatTallyAmount(r.totalTax),
          ]),
        });
      }
      if (sel[KEYS.os]) {
        const [rec, pay] = await Promise.all([
          getReceivablesAgeing(dealerSlug, fyEnd),
          getPayablesAgeing(dealerSlug, fyEnd),
        ]);
        await pushPdf(`Outstanding_AR_${fy}.pdf`, {
          title: 'Receivables ageing',
          subtitle: `As on ${fmtDate(iso(fyEnd))}`,
          headers: ['Farmer', '0–30', '31–60', '61–90', '90+', 'Total'],
          rows: rec.slice(0, 400).map((r) => [
            r.farmer_name,
            formatTallyAmount(r.bucket_0_30),
            formatTallyAmount(r.bucket_31_60),
            formatTallyAmount(r.bucket_61_90),
            formatTallyAmount(r.bucket_90_plus),
            formatTallyAmount(r.total_due),
          ]),
        });
        await pushPdf(`Outstanding_AP_${fy}.pdf`, {
          title: 'Payables ageing',
          subtitle: `As on ${fmtDate(iso(fyEnd))}`,
          headers: ['Supplier', '0–30', '31–60', '61–90', '90+', 'Total'],
          rows: pay.slice(0, 400).map((r) => [
            r.supplier_name,
            formatTallyAmount(r.bucket_0_30),
            formatTallyAmount(r.bucket_31_60),
            formatTallyAmount(r.bucket_61_90),
            formatTallyAmount(r.bucket_90_plus),
            formatTallyAmount(r.total_due),
          ]),
        });
      }
      if (sel[KEYS.st]) {
        const { fetchStockExportRows } = await import('@/lib/reports/year-end-export');
        const stk = await fetchStockExportRows(dealerRowId);
        await pushPdf(`Stock_Summary_${fy}.pdf`, {
          title: 'Stock Summary',
          subtitle: dealer?.company_name ?? '',
          headers: ['Product', 'HSN', 'Qty', 'Unit'],
          rows: stk.slice(0, 400).map((r) => [r.product, r.hsn, String(r.qty), r.unit]),
        });
      }
      if (sel[KEYS.ratio]) {
        const tbForRatio = await getTrialBalance(dealerRowId, fyEnd);
        const plForRatio = await fetchPlSummary(dealerSlug, dealerRowId, iso(fyStart), iso(fyEnd));
        const ratioRows = computeRatiosForExport(tbForRatio, plForRatio);
        await pushPdf(`Ratio_Analysis_${fy}.pdf`, {
          title: 'Ratio Analysis',
          subtitle: `FY ${fy}`,
          headers: ['Category', 'Ratio', 'Value', 'Benchmark', 'Status'],
          rows: ratioRows.map((r) => [r.Category, r.Ratio, r.Value, r.Benchmark, r.Status]),
        });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `PrithviX_${fy}_Reports.zip`);
      setLastExport(`${new Date().toLocaleString('en-IN')} · PDF bundle (ZIP)`);
      playTallyAccept();
    } catch (e) {
      console.error(e);
      playTallyError();
    } finally {
      setBusy(false);
    }
  }, [dealerRowId, dealerSlug, dealer?.company_name, fy, fyStart, fyEnd, sel]);

  const exportTallyXml = useCallback(async () => {
    if (!dealerRowId || !dealer?.company_name) return;
    setBusy(true);
    try {
      const fromIso = fyStart.toISOString().slice(0, 10);
      const toIso = fyEnd.toISOString().slice(0, 10);

      const [{ data: voucherRows, error: evErr }, { data: ledgerRows, error: lgErr }] = await Promise.all([
        supabase.rpc('get_vouchers_for_tally_export', {
          p_dealer_uuid: dealerRowId,
          p_from: fromIso,
          p_to: toIso,
        }),
        supabase.rpc('get_ledgers_for_tally_export', {
          p_dealer_uuid: dealerRowId,
        }),
      ]);
      if (evErr) throw new Error(evErr.message);
      if (lgErr) throw new Error(lgErr.message);

      const voucherMap = new Map<string, TallyVoucher>();
      for (const row of (voucherRows ?? []) as Record<string, unknown>[]) {
        const vid = String(row.voucher_id ?? '');
        const vd = String(row.voucher_date ?? '').slice(0, 10).replace(/-/g, '');
        if (!voucherMap.has(vid)) {
          voucherMap.set(vid, {
            date: vd,
            voucherType: String(row.voucher_type ?? ''),
            voucherNumber: String(row.voucher_number ?? ''),
            narration: String(row.narration ?? ''),
            entries: [],
          });
        }
        const dc = mapDbDrCr(String(row.dr_cr ?? 'DR'));
        voucherMap.get(vid)!.entries.push({
          ledgerName: String(row.ledger_name ?? ''),
          drCr: dc,
          amount: Number(row.entry_amount ?? 0),
        });
      }

      const tallyLedgers: TallyLedger[] = ((ledgerRows ?? []) as Record<string, unknown>[]).map((r) => ({
        name: String(r.ledger_name ?? ''),
        parent: String(r.group_name ?? 'Primary'),
        openingBalance: Number(r.opening_balance ?? 0),
        drCr: String(r.balance_type ?? 'DR').toUpperCase().startsWith('C') ? 'Cr' : 'Dr',
        gstin: r.gstin != null ? String(r.gstin) : undefined,
        state: r.state_name != null ? String(r.state_name) : undefined,
      }));

      const xml = buildTallyXml(dealer.company_name, [...voucherMap.values()], tallyLedgers);
      saveAs(new Blob([xml], { type: 'text/xml;charset=utf-8' }), `PrithviX_Tally_${fy}.xml`);

      const stamp = new Date().toLocaleString('en-IN');
      try {
        localStorage.setItem(LAST_XML_KEY, stamp);
      } catch {
        /* ignore */
      }
      setLastXml(stamp);
      setLastExport(`${stamp} · Tally XML`);
      playTallyAccept();
    } catch (e) {
      console.error(e);
      playTallyError();
    } finally {
      setBusy(false);
    }
  }, [dealerRowId, dealer?.company_name, fy, fyStart, fyEnd]);

  const runExportSelected = useCallback(async () => {
    if (mode === 'excel') await runExcel();
    else if (mode === 'pdf_zip') await runPdfZip();
    else await exportTallyXml();
  }, [mode, runExcel, runPdfZip, exportTallyXml]);

  useHotkeys('alt+e', (e) => {
    e.preventDefault();
    void runExportSelected();
  });

  useHotkeys('alt+t', (e) => {
    e.preventDefault();
    void exportTallyXml();
  });

  useEffect(() => {
    setButtons([
      { label: 'Export Selected', shortcut: 'Alt+E', onClick: () => void runExportSelected() },
      { label: 'Tally XML', shortcut: 'Alt+T', onClick: () => void exportTallyXml() },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, runExportSelected, exportTallyXml]);

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Export All — Year-end Package
      </div>
      <div className="space-y-3 border-b border-[#AAAAAA] px-4 py-3">
        <label className="flex items-center gap-2">
          Financial Year
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-2 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            {fys.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-4 text-[12px]">
          <button type="button" className="border border-[#AAAAAA] bg-white px-3 py-[2px]" style={{ borderRadius: 0 }} onClick={selectAll}>
            Select All
          </button>
          <button type="button" className="border border-[#AAAAAA] bg-white px-3 py-[2px]" style={{ borderRadius: 0 }} onClick={deselectAll}>
            Deselect All
          </button>
        </div>
        <div className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 text-[12px]" style={{ border: '1px solid #AAAAAA', padding: 8 }}>
          {(
            [
              [KEYS.bs, 'Balance Sheet'],
              [KEYS.pl, 'Profit & Loss'],
              [KEYS.tb, 'Trial Balance'],
              [KEYS.day, 'Day Book (full year)'],
              [KEYS.sal, 'Sales Register'],
              [KEYS.pur, 'Purchase Register'],
              [KEYS.led, 'Ledger Statement — All accounts'],
              [KEYS.cf, 'Cash Flow Statement'],
              [KEYS.gst, 'GST Audit Report'],
              [KEYS.os, 'Outstanding Report'],
              [KEYS.st, 'Stock Summary'],
              [KEYS.ratio, 'Ratio Analysis'],
            ] as const
          ).map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(sel[k])} onChange={() => toggle(k)} disabled={mode === 'tally_xml'} />
              {lbl}
            </label>
          ))}
        </div>
        <div className="text-[13px]">
          <span className="mr-6">Format:</span>
          <label className="mr-6">
            <input type="radio" name="m" checked={mode === 'excel'} onChange={() => setMode('excel')} /> Excel Workbook
          </label>
          <label className="mr-6">
            <input type="radio" name="m" checked={mode === 'pdf_zip'} onChange={() => setMode('pdf_zip')} /> PDF Bundle (ZIP)
          </label>
          <label>
            <input type="radio" name="m" checked={mode === 'tally_xml'} onChange={() => setMode('tally_xml')} /> Tally XML
          </label>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            className="border border-[#AAAAAA] bg-[#1B5E20] px-4 py-[4px] text-white disabled:opacity-50"
            style={{ borderRadius: 0 }}
            onClick={() => void runExportSelected()}
          >
            {busy ? 'Exporting…' : 'Export Selected'}
          </button>
          <span className="text-[12px] text-[#555]">Estimated size ≈ {estimateMb} MB</span>
        </div>
        {lastExport ? <div className="text-[12px] text-[#444]">Last: {lastExport}</div> : null}

        <div className="border-t border-[#AAAAAA] pt-4 text-[12px] text-[#444]">
          <p>Tally Prime XML — exports posted vouchers + ledger masters for CA import (Gateway → Import → Data).</p>
          <button
            type="button"
            className="mt-2 border border-[#AAAAAA] bg-white px-4 py-[2px]"
            style={{ borderRadius: 0 }}
            disabled={busy}
            onClick={() => void exportTallyXml()}
          >
            Export Tally XML
          </button>
          <div className="mt-1 text-[11px] text-[#666]">Last Tally XML: {lastXml ?? 'Never'}</div>
        </div>

        <Link href="/tally/reports" className="inline-block pt-4 text-[#0D47A1] underline">
          Back to Reports
        </Link>
      </div>
    </div>
  );
}

export default function ExportPageShell() {
  return (
    <Suspense fallback={<div className="bg-[#FFF8E7] p-4 text-[13px]">Loading export…</div>}>
      <ExportAllReportPage />
    </Suspense>
  );
}
