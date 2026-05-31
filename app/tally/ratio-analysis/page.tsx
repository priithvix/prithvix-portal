'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTrialBalanceQuery } from '@/hooks/useReportsQueries';
import { fmtDate } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { supabase } from '@/lib/supabase/client';
import type { TrialBalanceRow } from '@/lib/supabase/reports';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

function isLiabilityRow(ledger: string, group: string) {
  const s = `${group} ${ledger}`.toLowerCase();
  return /capital|loan|payable|creditor|gst|duty|provision|supplier|credit|outstanding|bank od|unpaid|tds|tax/i.test(s);
}

function liabilitySubtype(name: string, group: string): 'equity' | 'ltd' | 'cl' {
  const s = `${group} ${name}`.toLowerCase();
  if (/capital|partner|proprietor|reserve|retained|p&l|profit|share|current account/i.test(s)) return 'equity';
  if (/(long|term).*(loan|debt|borrowing)|debenture|bond/i.test(s) && !/bank.od|overdraft|^od\b/i.test(s)) return 'ltd';
  return 'cl';
}

function isFixedAsset(name: string, group: string): boolean {
  const s = `${group} ${name}`.toLowerCase();
  return /fixed|building|equipment|vehicle|plant|furniture|computer|land\b|motor/i.test(s);
}

function isPlExpenseDebit(name: string, group: string): boolean {
  const s = `${group} ${name}`.toLowerCase();
  if (/sales|income|revenue|discount received|interest received/i.test(s)) return false;
  return /expense|wages|salary|rent|electric|depreciation|interest|charges|commission|printing|travel|legal|audit|insurance|fuel|repair|miscellaneous|bank charges|discount allowed|finance cost/i.test(s);
}

function isInterest(name: string, group: string): boolean {
  const s = `${group} ${name}`.toLowerCase();
  return /interest paid|finance cost|bank interest|interest expense/i.test(s);
}

type RatioRow = {
  name: string;
  value: number | null;
  display: string;
  benchmark: string;
  status: 'good' | 'fair' | 'poor';
  category: string;
};

function classify(status: 'good' | 'fair' | 'poor'): string {
  if (status === 'good') return 'Good';
  if (status === 'fair') return 'Fair';
  return 'Poor';
}

function deriveFromTrialBalance(rows: TrialBalanceRow[]) {
  let ca = 0;
  let fa = 0;
  let inv = 0;
  let cash = 0;
  let debtors = 0;
  let cl = 0;
  let ltd = 0;
  let equity = 0;
  let opExNoInt = 0;
  let interestExp = 0;

  for (const r of rows) {
    const net = r.dr_total - r.cr_total;
    if (Math.abs(net) < 0.01) continue;
    const name = r.ledger_name;
    const group = r.group_name ?? '';

    if (isLiabilityRow(name, group)) {
      const show = -net;
      const sub = liabilitySubtype(name, group);
      if (sub === 'equity') equity += show;
      else if (sub === 'ltd') ltd += show;
      else cl += show;
    } else if (isPlExpenseDebit(name, group) && net > 0) {
      if (isInterest(name, group)) interestExp += net;
      else opExNoInt += net;
    } else {
      const a = net;
      if (isFixedAsset(name, group)) fa += a;
      else {
        ca += a;
        const s = `${group} ${name}`.toLowerCase();
        if (/stock|inventory\b/i.test(s)) inv += a;
        if (/cash|^bank|bank account|petty/i.test(s)) cash += a;
        if (/debtor|receivable|sundry|customer|farmer|udhaar/i.test(s)) debtors += a;
      }
    }
  }

  const totalAssets = ca + fa;
  const ce = Math.max(totalAssets - cl, 0.01);
  const totalDebt = cl + ltd;
  return {
    ca: Math.max(ca, 0),
    cl: Math.max(cl, 0.01),
    inv: Math.max(inv, 0),
    cash: Math.max(cash, 0),
    debtors: Math.max(debtors, 0),
    equity: Math.max(equity, 0.01),
    ltd,
    totalDebt,
    totalAssets,
    ce,
    opExNoInt,
    interestExp,
  };
}

function buildRatios(
  t: ReturnType<typeof deriveFromTrialBalance>,
  revenue: number,
  cogs: number,
  gp: number
): RatioRow[] {
  const { ca, cl, inv, cash, debtors, equity, totalDebt, ce, opExNoInt, interestExp } = t;

  const currentRatio = ca / cl;
  const quickRatio = Math.max(ca - inv, 0) / cl;
  const cashRatio = cash / cl;

  const grossPct = revenue > 0 ? (gp / revenue) * 100 : null;
  const ebit = gp - opExNoInt;
  const np = ebit - interestExp;
  const netPct = revenue > 0 ? (np / revenue) * 100 : null;
  const roce = ce > 0 ? (ebit / ce) * 100 : null;

  const de = totalDebt / equity;

  const icr = interestExp > 0 ? ebit / interestExp : ebit > 0 ? 99 : null;

  const invDenom = inv > 0 ? inv : null;
  const turnover = invDenom && cogs > 0 ? cogs / invDenom : null;

  const debtorDays = revenue > 0 && debtors > 0 ? (debtors / revenue) * 365 : null;

  const rows: RatioRow[] = [];

  const pushNum = (
    name: string,
    value: number | null,
    display: string,
    benchmark: string,
    higherIsBetter: boolean,
    goodThr: number,
    fairThr: number,
    category: string
  ) => {
    let status: 'good' | 'fair' | 'poor' = 'poor';
    if (value == null || !Number.isFinite(value)) status = 'poor';
    else if (higherIsBetter) {
      if (value >= goodThr) status = 'good';
      else if (value >= fairThr) status = 'fair';
    } else {
      if (value <= goodThr) status = 'good';
      else if (value <= fairThr) status = 'fair';
    }
    rows.push({ name, value, display, benchmark, status, category });
  };

  pushNum('Current Ratio', currentRatio, currentRatio.toFixed(2), '≥ 2.0 (Good), ≥ 1.5 (Fair)', true, 2, 1.5, 'Liquidity');
  pushNum('Quick Ratio', quickRatio, quickRatio.toFixed(2), '≥ 1.0 (Good), ≥ 0.7 (Fair)', true, 1, 0.7, 'Liquidity');
  pushNum('Cash Ratio', cashRatio, cashRatio.toFixed(2), '≥ 0.2 (Good), ≥ 0.1 (Fair)', true, 0.2, 0.1, 'Liquidity');

  pushNum(
    'Gross Profit %',
    grossPct,
    grossPct != null ? `${grossPct.toFixed(1)}%` : '—',
    '≥ 20% (Good), ≥ 12% (Fair)',
    true,
    20,
    12,
    'Profitability'
  );
  pushNum(
    'Net Profit % (approx.)',
    netPct,
    netPct != null ? `${netPct.toFixed(1)}%` : '—',
    '≥ 8% (Good), ≥ 4% (Fair)',
    true,
    8,
    4,
    'Profitability'
  );
  pushNum('ROCE % (approx.)', roce, roce != null ? `${roce.toFixed(1)}%` : '—', '≥ 15% (Good), ≥ 10% (Fair)', true, 15, 10, 'Profitability');

  pushNum('Debt-to-Equity', de, de.toFixed(2), '≤ 1.0 (Good), ≤ 2.0 (Fair)', false, 1, 2, 'Solvency');

  pushNum(
    'Interest Coverage',
    icr,
    icr != null && icr >= 99 ? 'N/A' : icr != null ? icr.toFixed(2) : '—',
    '≥ 4.0 (Good), ≥ 2.5 (Fair)',
    true,
    4,
    2.5,
    'Solvency'
  );

  pushNum(
    'Inventory Turnover (×)',
    turnover,
    turnover != null ? turnover.toFixed(2) : '—',
    '≥ 6 (Good), ≥ 4 (Fair)',
    true,
    6,
    4,
    'Efficiency'
  );

  pushNum(
    'Debtor Days',
    debtorDays,
    debtorDays != null ? `${Math.round(debtorDays)} d` : '—',
    '≤ 45d (Good), ≤ 60d (Fair)',
    false,
    45,
    60,
    'Efficiency'
  );

  return rows;
}

export default function TallyRatioAnalysisPage() {
  const [asOnIso, setAsOnIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromIso, setFromIso] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toIso, setToIso] = useState(() => new Date().toISOString().slice(0, 10));

  const setButtons = useTallySetButtons();
  const { dealer, session } = useAuth();
  const slug = session?.dealerId ?? '';
  const rowId = session?.dealerRowId ?? '';

  const { data: tbRows = [], isFetching: tbLoad, error: tbErr } = useTrialBalanceQuery(asOnIso);

  const plQuery = useQuery({
    queryKey: ['ratio-pl', slug, rowId, fromIso, toIso],
    enabled: !!slug && !!rowId,
    queryFn: async () => {
      const { data: salesRows, error: e1 } = await supabase
        .from('sales')
        .select('final_amount')
        .eq('dealer_id', slug)
        .gte('sale_date', fromIso)
        .lte('sale_date', toIso)
        .in('status', ['paid', 'partial', 'pending']);
      if (e1) throw new Error(e1.message);
      const sales = (salesRows ?? []).reduce((s, r) => s + Number((r as { final_amount?: number }).final_amount ?? 0), 0);

      const { data: purRows, error: e2 } = await supabase
        .from('purchase_invoices')
        .select('total_amount')
        .eq('dealer_id', rowId)
        .gte('invoice_date', fromIso)
        .lte('invoice_date', toIso)
        .neq('status', 'CANCELLED');
      if (e2) throw new Error(e2.message);
      const purchases = (purRows ?? []).reduce((s, r) => s + Number((r as { total_amount?: number }).total_amount ?? 0), 0);

      return { sales, purchases };
    },
  });

  const derived = useMemo(() => deriveFromTrialBalance(tbRows), [tbRows]);
  const revenue = plQuery.data?.sales ?? 0;
  const cogs = plQuery.data?.purchases ?? 0;
  const gp = revenue - cogs;

  const ratioRows = useMemo(
    () => buildRatios(derived, revenue, cogs, gp),
    [derived, revenue, cogs, gp]
  );

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Ratios',
          rows: ratioRows.map((r) => ({
            Category: r.category,
            Ratio: r.name,
            Value: r.display,
            Benchmark: r.benchmark,
            Status: classify(r.status),
          })),
        },
      ]),
      `RatioAnalysis_${asOnIso}.xlsx`
    );
  }, [ratioRows, asOnIso]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Ratio Analysis',
      subtitle: `TB as on ${fmtDate(asOnIso)} · P&L ${fmtDate(fromIso)}–${fmtDate(toIso)}`,
      reportPeriod: `Trial Balance: ${fmtDate(asOnIso)} · Revenue period: ${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Ratio', 'Value', 'Benchmark', 'Status'],
      rows: ratioRows.map((r) => [r.name, r.display, r.benchmark, classify(r.status)]),
      footerNote: 'Approximate classifications from trial balance + simplified P&L',
    });
    triggerDownload(b, `RatioAnalysis_${asOnIso}.pdf`);
  }, [ratioRows, asOnIso, fromIso, toIso]);

  useHotkeys('alt+p', (e) => {
    e.preventDefault();
    void exportPdf();
  });
  useHotkeys('alt+e', (e) => {
    e.preventDefault();
    exportExcel();
  });

  useEffect(() => {
    setButtons([
      { label: 'As On', shortcut: 'F2', onClick: () => document.getElementById('ratio-as-on')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel]);

  const err = tbErr ?? plQuery.error;

  const badge = (s: RatioRow['status']) => {
    const bg = s === 'good' ? '#E8F5E9' : s === 'fair' ? '#FFF8E1' : '#FFEBEE';
    const fg = s === 'good' ? '#1B5E20' : s === 'fair' ? '#E65100' : '#B71C1C';
    return (
      <span className="inline-block min-w-[52px] px-1.5 py-0.5 text-center text-[11px] font-semibold" style={{ background: bg, color: fg }}>
        {classify(s)}
      </span>
    );
  };

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Ratio Analysis
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-1">
          TB as on
          <input
            id="ratio-as-on"
            type="date"
            value={asOnIso}
            onChange={(e) => setAsOnIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1">
          P&L from
          <input
            type="date"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1">
          to
          <input
            type="date"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <span className="text-[11px] text-[#666]">
          Revenue {formatTallyAmount(revenue)} · COGS {formatTallyAmount(cogs)} · GP {formatTallyAmount(gp)}
        </span>
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">
          Reports
        </Link>
      </div>

      {err ? <div className="p-2 text-red-700">{err instanceof Error ? err.message : String(err)}</div> : null}

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-collapse border border-[#AAAAAA] bg-white">
          <thead>
            <tr style={{ background: '#1B5E20', color: '#fff' }}>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Ratio</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">Value</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Benchmark</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-center">Status</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Category</th>
            </tr>
          </thead>
          <tbody>
            {ratioRows.map((r) => (
              <tr key={r.name} className="border-b border-[#EEEEEE]">
                <td className="border border-[#AAAAAA] px-2 py-1">{r.name}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{r.display}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-[11px] text-[#555]">{r.benchmark}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-center">{badge(r.status)}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-[11px]">{r.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tbLoad || plQuery.isFetching ? <p className="mt-2 text-[#666]">Loading…</p> : null}
      </div>

      <p className="px-3 pb-2 text-[10px] leading-snug text-[#888]">
        Ratios use heuristic ledger classification (same family as Balance Sheet). P&amp;L uses sales vs purchase invoices. For statutory filings, map ledgers to standard groups first.
      </p>
      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
