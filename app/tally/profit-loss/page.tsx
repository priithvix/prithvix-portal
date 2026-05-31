'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTrialBalanceQuery } from '@/hooks/useReportsQueries';
import { fyDates, fmtDate, getFY } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';
import type { TrialBalanceRow } from '@/lib/supabase/reports';

/* ─── Ledger classification ─────────────────────────────────────────
   Heuristic classification matching the same logic as Ratio Analysis
   and Balance Sheet so all three reports are consistent.
────────────────────────────────────────────────────────────────────── */

function classify(name: string, group: string) {
  const s = `${group} ${name}`.toLowerCase();

  // INCOME
  if (/sales|turnover|revenue|income|receipts|service income|other income|discount received|interest received|rent received/i.test(s))
    return 'income';

  // COST OF GOODS SOLD
  if (/purchase|cogs|direct material|raw material|cost of goods|trading stock|opening stock|closing stock|freight inward/i.test(s))
    return 'cogs';

  // OPERATING EXPENSES
  if (/salary|wages|staff|payroll/i.test(s)) return 'opex_staff';
  if (/rent|lease|office rent/i.test(s)) return 'opex_rent';
  if (/electric|utility|water|power/i.test(s)) return 'opex_util';
  if (/depreciation|amortisation|amortization/i.test(s)) return 'opex_depr';
  if (/repair|maintenance|servicing/i.test(s)) return 'opex_repair';
  if (/travel|conveyance|vehicle|fuel/i.test(s)) return 'opex_travel';
  if (/printing|stationery/i.test(s)) return 'opex_print';
  if (/audit|legal|professional|consultancy/i.test(s)) return 'opex_prof';
  if (/insurance/i.test(s)) return 'opex_insur';
  if (/telephone|internet|communication/i.test(s)) return 'opex_comm';
  if (/advertisement|marketing|promotion/i.test(s)) return 'opex_mktg';
  if (/bank charge|service charge|processing fee/i.test(s)) return 'opex_bank';
  if (/discount allowed|discount given/i.test(s)) return 'opex_disc';
  if (/expense|cost|charges|miscellaneous|general|admin|selling/i.test(s)) return 'opex_misc';

  // FINANCE COSTS
  if (/interest paid|finance cost|bank interest|interest expense|loan interest/i.test(s))
    return 'finance';

  // TAX PROVISIONS
  if (/income tax|tax provision|deferred tax|current tax/i.test(s)) return 'tax_prov';

  return null; // not a P&L item
}

const OPEX_LABELS: Record<string, string> = {
  opex_staff: 'Salaries & Wages',
  opex_rent: 'Rent & Lease',
  opex_util: 'Electricity & Utilities',
  opex_depr: 'Depreciation & Amortisation',
  opex_repair: 'Repairs & Maintenance',
  opex_travel: 'Travel & Conveyance',
  opex_print: 'Printing & Stationery',
  opex_prof: 'Audit, Legal & Professional',
  opex_insur: 'Insurance',
  opex_comm: 'Telephone & Internet',
  opex_mktg: 'Advertisement & Marketing',
  opex_bank: 'Bank Charges',
  opex_disc: 'Discount Allowed',
  opex_misc: 'Other Expenses',
};

interface PlLine { name: string; amount: number }

interface PlData {
  income: PlLine[];
  cogs: PlLine[];
  opex: Record<string, PlLine[]>;
  finance: PlLine[];
  taxProv: PlLine[];
  // computed
  totalIncome: number;
  totalCogs: number;
  grossProfit: number;
  totalOpex: number;
  ebitda: number;
  ebit: number;
  totalFinance: number;
  pbt: number;
  totalTax: number;
  pat: number;
}

function buildPL(rows: TrialBalanceRow[], asOnIso: string, fromIso: string): PlData {
  // We work from trial balance. For an income statement we need the
  // period movements, not cumulative balances. Supabase RPC returns
  // cumulative values up to asOn; we subtract opening-balance (fromIso-1).
  // Since we only have asOn query, we use the full trial balance and
  // classify ledgers into P&L vs Balance Sheet. Only P&L ledgers contribute.

  const income: PlLine[] = [];
  const cogs: PlLine[] = [];
  const opexMap: Record<string, PlLine[]> = {};
  const finance: PlLine[] = [];
  const taxProv: PlLine[] = [];

  for (const r of rows) {
    const net = r.dr_total - r.cr_total;
    if (Math.abs(net) < 0.01) continue;
    const cat = classify(r.ledger_name, r.group_name ?? '');
    if (!cat) continue;

    if (cat === 'income') {
      // income ledgers normally have credit balance (net < 0)
      income.push({ name: r.ledger_name, amount: -net });
    } else if (cat === 'cogs') {
      cogs.push({ name: r.ledger_name, amount: net > 0 ? net : -net });
    } else if (cat.startsWith('opex_')) {
      if (!opexMap[cat]) opexMap[cat] = [];
      opexMap[cat].push({ name: r.ledger_name, amount: net > 0 ? net : Math.abs(net) });
    } else if (cat === 'finance') {
      finance.push({ name: r.ledger_name, amount: net > 0 ? net : Math.abs(net) });
    } else if (cat === 'tax_prov') {
      taxProv.push({ name: r.ledger_name, amount: net > 0 ? net : Math.abs(net) });
    }
  }

  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalCogs = cogs.reduce((s, r) => s + r.amount, 0);
  const grossProfit = totalIncome - totalCogs;
  const totalOpex = Object.values(opexMap).flat().reduce((s, r) => s + r.amount, 0);
  const ebitda = grossProfit - totalOpex;
  // Treat depreciation as deduction from EBITDA for EBIT
  const depAmt = (opexMap['opex_depr'] ?? []).reduce((s, r) => s + r.amount, 0);
  const ebit = ebitda - depAmt;
  const totalFinance = finance.reduce((s, r) => s + r.amount, 0);
  const pbt = ebit - totalFinance;
  const totalTax = taxProv.reduce((s, r) => s + r.amount, 0);
  const pat = pbt - totalTax;

  return { income, cogs, opex: opexMap, finance, taxProv, totalIncome, totalCogs, grossProfit, totalOpex, ebitda, ebit, totalFinance, pbt, totalTax, pat };
}

function defaultRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  return {
    fromIso: start.toISOString().slice(0, 10),
    toIso: (today > end ? end : today).toISOString().slice(0, 10),
  };
}

/* ─── Row components ────────────────────────────────────────────── */
function LineRow({ label, amount, indent = false, bold = false, highlight = false, neg = false }:
  { label: string; amount: number; indent?: boolean; bold?: boolean; highlight?: boolean; neg?: boolean }) {
  return (
    <tr className="border-b border-[#EEEEEE]" style={highlight ? { background: '#E8F5E9' } : undefined}>
      <td className={`px-3 py-[3px] ${indent ? 'pl-6' : ''} ${bold ? 'font-semibold' : ''} text-[12px]`}>
        {label}
      </td>
      <td className={`px-3 py-[3px] text-right tabular-nums text-[12px] ${bold ? 'font-semibold' : ''} ${neg ? 'text-[#B71C1C]' : amount < 0 ? 'text-[#B71C1C]' : ''}`}>
        {formatTallyAmount(Math.abs(amount))}
        {amount < 0 && !neg ? <span className="text-[9px] ml-0.5">(Dr)</span> : null}
      </td>
    </tr>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={2} className="px-3 py-[4px] text-[11px] font-bold uppercase tracking-wide"
        style={{ background: '#F0F0F0', color: '#333', borderBottom: '1px solid #AAAAAA', borderTop: '1px solid #AAAAAA' }}>
        {title}
      </td>
    </tr>
  );
}

function TotalRow({ label, amount, green = false }: { label: string; amount: number; green?: boolean }) {
  return (
    <tr style={{ background: green && amount > 0 ? '#E8F5E9' : amount < 0 ? '#FFEBEE' : '#F5F5F5', borderTop: '2px solid #1B5E20' }}>
      <td className="px-3 py-[5px] font-bold text-[13px]">{label}</td>
      <td className={`px-3 py-[5px] text-right tabular-nums font-bold text-[14px] ${amount < 0 ? 'text-[#B71C1C]' : green ? 'text-[#1B5E20]' : ''}`}>
        {amount < 0 ? `(${formatTallyAmount(Math.abs(amount))})` : formatTallyAmount(amount)}
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function ProfitLossPage() {
  const { fromIso: defFrom, toIso: defTo } = defaultRange();
  const [fromIso, setFromIso] = useState(defFrom);
  const [toIso, setToIso] = useState(defTo);
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();

  // We use Trial Balance "as on" toIso to get full period movements
  const { data: rows = [], isFetching, error } = useTrialBalanceQuery(toIso);

  const pl = useMemo(() => buildPL(rows, toIso, fromIso), [rows, toIso, fromIso]);

  const exportExcel = useCallback(() => {
    const exRows: { Section: string; Line: string; Amount: number }[] = [];
    exRows.push({ Section: 'Income', Line: 'INCOME', Amount: 0 });
    pl.income.forEach((r) => exRows.push({ Section: 'Income', Line: r.name, Amount: r.amount }));
    exRows.push({ Section: 'Income', Line: 'Total Income', Amount: pl.totalIncome });
    pl.cogs.forEach((r) => exRows.push({ Section: 'COGS', Line: r.name, Amount: -r.amount }));
    exRows.push({ Section: 'COGS', Line: 'GROSS PROFIT', Amount: pl.grossProfit });
    Object.entries(pl.opex).forEach(([, lines]) => lines.forEach((r) => exRows.push({ Section: 'OpEx', Line: r.name, Amount: -r.amount })));
    exRows.push({ Section: 'OpEx', Line: 'EBITDA', Amount: pl.ebitda });
    pl.finance.forEach((r) => exRows.push({ Section: 'Finance', Line: r.name, Amount: -r.amount }));
    exRows.push({ Section: 'Finance', Line: 'PBT', Amount: pl.pbt });
    pl.taxProv.forEach((r) => exRows.push({ Section: 'Tax', Line: r.name, Amount: -r.amount }));
    exRows.push({ Section: 'Tax', Line: 'PAT (Net Profit)', Amount: pl.pat });
    downloadWorkbook(workbookFromSheets([{ name: 'P&L', rows: exRows }]), `PL_${fromIso}_${toIso}.xlsx`);
  }, [pl, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const pdfRows: string[][] = [];
    pdfRows.push(['INCOME', '']);
    pl.income.forEach((r) => pdfRows.push([`  ${r.name}`, formatTallyAmount(r.amount)]));
    pdfRows.push(['Total Income', formatTallyAmount(pl.totalIncome)]);
    pdfRows.push(['', '']);
    pdfRows.push(['COST OF GOODS SOLD', '']);
    pl.cogs.forEach((r) => pdfRows.push([`  ${r.name}`, `(${formatTallyAmount(r.amount)})`]));
    pdfRows.push(['Gross Profit', formatTallyAmount(pl.grossProfit)]);
    pdfRows.push(['', '']);
    pdfRows.push(['OPERATING EXPENSES', '']);
    Object.entries(pl.opex).forEach(([key, lines]) => {
      if (lines.length > 0) {
        pdfRows.push([`  ${OPEX_LABELS[key] ?? key}`, formatTallyAmount(lines.reduce((s, r) => s + r.amount, 0))]);
      }
    });
    pdfRows.push(['Total OpEx', `(${formatTallyAmount(pl.totalOpex)})`]);
    pdfRows.push(['EBITDA', formatTallyAmount(pl.ebitda)]);
    pdfRows.push(['', '']);
    if (pl.finance.length > 0) {
      pl.finance.forEach((r) => pdfRows.push([`  Finance Cost: ${r.name}`, `(${formatTallyAmount(r.amount)})`]));
    }
    pdfRows.push(['Profit Before Tax (PBT)', formatTallyAmount(pl.pbt)]);
    if (pl.taxProv.length > 0) {
      pl.taxProv.forEach((r) => pdfRows.push([`  ${r.name}`, `(${formatTallyAmount(r.amount)})`]));
    }
    pdfRows.push(['Net Profit (PAT)', pl.pat < 0 ? `(${formatTallyAmount(Math.abs(pl.pat))})` : formatTallyAmount(pl.pat)]);

    const b = await tallyTablePdfBlob({
      title: 'Profit & Loss Statement',
      subtitle: `For the period ${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      reportPeriod: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Particulars', 'Amount (₹)'],
      rows: pdfRows,
    });
    triggerDownload(b, `PL_${fromIso}_${toIso}.pdf`);
  }, [pl, fromIso, toIso]);

  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });
  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: () => document.getElementById('pl-from')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel]);

  const hasOpex = Object.values(pl.opex).some((arr) => arr.length > 0);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title */}
      <div className="border-b py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Profit &amp; Loss Statement
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-1 text-[12px]">
          From
          <input id="pl-from" type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <label className="flex items-center gap-1 text-[12px]">
          To
          <input type="date" value={toIso} onChange={(e) => setToIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <span className="text-[11px] text-[#666]">
          Derived from Trial Balance heuristic classification · Ledger-level breakdowns below
        </span>
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">Reports</Link>
      </div>

      {error ? <div className="p-2 text-red-700">{error instanceof Error ? error.message : String(error)}</div> : null}
      {isFetching ? <div className="px-3 py-1 text-[12px] text-[#888]">Computing P&L…</div> : null}

      {/* ── P&L TABLE ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-3">
        <div className="mx-auto max-w-2xl">
          {/* KPI row */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Gross Profit', val: pl.grossProfit },
              { label: 'EBITDA', val: pl.ebitda },
              { label: 'PBT', val: pl.pbt },
              { label: 'Net Profit (PAT)', val: pl.pat },
            ].map(({ label, val }) => (
              <div key={label} className="border px-3 py-2 text-center"
                style={{ border: '1px solid #AAAAAA', background: val >= 0 ? '#E8F5E9' : '#FFEBEE' }}>
                <div className="text-[11px] text-[#666]">{label}</div>
                <div className={`text-[16px] font-bold tabular-nums ${val < 0 ? 'text-[#B71C1C]' : 'text-[#1B5E20]'}`}>
                  {val < 0 ? `(${formatTallyAmount(Math.abs(val))})` : formatTallyAmount(val)}
                </div>
                {pl.totalIncome > 0 ? (
                  <div className="text-[10px] text-[#888]">{((val / pl.totalIncome) * 100).toFixed(1)}%</div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Main P&L Table */}
          <table className="w-full border-collapse" style={{ border: '1px solid #AAAAAA' }}>
            <tbody>
              {/* INCOME */}
              <SectionHeader title="A — Income" />
              {pl.income.length > 0
                ? pl.income.map((r) => <LineRow key={r.name} label={r.name} amount={r.amount} indent />)
                : <tr><td colSpan={2} className="px-6 py-1 text-[11px] text-[#888]">No income ledgers classified</td></tr>}
              <TotalRow label="Total Income (A)" amount={pl.totalIncome} green />

              {/* COGS */}
              <SectionHeader title="B — Cost of Goods Sold" />
              {pl.cogs.length > 0
                ? pl.cogs.map((r) => <LineRow key={r.name} label={r.name} amount={r.amount} indent neg />)
                : <tr><td colSpan={2} className="px-6 py-1 text-[11px] text-[#888]">No COGS ledgers classified</td></tr>}
              <TotalRow label="Gross Profit (A − B)" amount={pl.grossProfit} green />

              {/* OPERATING EXPENSES */}
              {hasOpex ? (
                <>
                  <SectionHeader title="C — Operating Expenses" />
                  {Object.entries(pl.opex).map(([key, lines]) =>
                    lines.length > 0 ? (
                      <tr key={key} className="border-b border-[#EEEEEE]">
                        <td className="px-3 py-[3px] pl-6 text-[12px]">
                          {OPEX_LABELS[key] ?? key}
                          <span className="ml-2 text-[10px] text-[#888]">
                            ({lines.map((l) => l.name).join(', ').slice(0, 60)})
                          </span>
                        </td>
                        <td className="px-3 py-[3px] text-right tabular-nums text-[12px]">
                          {formatTallyAmount(lines.reduce((s, r) => s + r.amount, 0))}
                        </td>
                      </tr>
                    ) : null
                  )}
                  <TotalRow label="Total Operating Expenses (C)" amount={pl.totalOpex} />
                  <TotalRow label="EBITDA (Gross − OpEx)" amount={pl.ebitda} green />
                </>
              ) : null}

              {/* FINANCE */}
              {pl.finance.length > 0 ? (
                <>
                  <SectionHeader title="D — Finance Costs" />
                  {pl.finance.map((r) => <LineRow key={r.name} label={r.name} amount={r.amount} indent neg />)}
                </>
              ) : null}
              <TotalRow label={`Profit Before Tax (EBIT${pl.finance.length > 0 ? ' − Finance' : ''})`} amount={pl.pbt} green />

              {/* TAX */}
              {pl.taxProv.length > 0 ? (
                <>
                  <SectionHeader title="E — Tax Provisions" />
                  {pl.taxProv.map((r) => <LineRow key={r.name} label={r.name} amount={r.amount} indent neg />)}
                </>
              ) : null}
              <TotalRow label="Net Profit (PAT)" amount={pl.pat} green />
            </tbody>
          </table>

          {pl.income.length === 0 && pl.cogs.length === 0 && !isFetching ? (
            <div className="mt-3 border border-[#AAAAAA] bg-[#FFFDE7] p-3 text-[12px]">
              <p className="font-semibold">No P&L ledgers found in Trial Balance.</p>
              <p className="mt-1 text-[#666]">
                This report auto-classifies ledgers using name/group heuristics. If no Sales, Purchase, or Expense ledgers appear in your trial balance, the P&L will be empty.
                Ensure vouchers are posted and ledger names follow standard accounting conventions.
              </p>
            </div>
          ) : null}

          <p className="mt-2 text-[11px] text-[#888]">
            Heuristic P&L — ledger classification uses name pattern matching. Map ledgers to groups in
            Chart of Accounts for GAAP-compliant reports. EBITDA = Gross Profit − Operating Expenses (excl. depreciation).
          </p>
          <div className="mt-1 text-[11px] text-[#888]">{dealer?.company_name}</div>
        </div>
      </div>
    </div>
  );
}
