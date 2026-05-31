'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useComparativePurchasesQuery, useComparativeSalesQuery } from '@/hooks/useReportsQueries';
import { listFYOptions, fmt, fmtPct, getFY } from '@/lib/reports/formatters';
import { workbookFromSheets, downloadWorkbook } from '@/lib/reports/excel-export';

type Metric = 'sales' | 'purchases' | 'taxCol' | 'taxPaid';

function priorFY(label: string): string {
  const start = parseInt(label.split('-')[0] ?? '0', 10);
  const p = start - 1;
  return `${p}-${String(p + 1).slice(-2)}`;
}

export default function ComparativeReportPage() {
  const fys = useMemo(() => listFYOptions(), []);
  const curFY = useMemo(() => getFY(new Date()), []);
  const [fy, setFy] = useState(curFY);
  const [compareFy, setCompareFy] = useState(() => priorFY(curFY));
  const [metric, setMetric] = useState<Metric>('sales');
  const setButtons = useTallySetButtons();

  const salesQ = useComparativeSalesQuery(fy, compareFy);
  const purchaseQ = useComparativePurchasesQuery(fy, compareFy);

  const usePurchase = metric === 'purchases' || metric === 'taxPaid';
  const rows = (usePurchase ? purchaseQ.data : salesQ.data) ?? [];

  const display = rows.map((r) => {
    const money =
      metric === 'taxCol' || metric === 'taxPaid'
        ? { cur: r.current_tax, prev: r.prev_tax }
        : { cur: r.current_sales, prev: r.prev_sales };
    const growth =
      money.prev > 0.009 ? Math.round((((money.cur - money.prev) / money.prev) * 100) * 10) / 10 : null;
    return { label: r.month_label, ...money, growth };
  });

  const totalCur = display.reduce((s, r) => s + r.cur, 0);
  const totalPrev = display.reduce((s, r) => s + r.prev, 0);
  const totalGrowth = totalPrev > 0.009 ? Math.round((((totalCur - totalPrev) / totalPrev) * 100) * 10) / 10 : null;

  const exportExcel = useCallback(() => {
    const labelTitle =
      metric === 'sales'
        ? 'Sales'
        : metric === 'purchases'
          ? 'Purchases'
          : metric === 'taxCol'
            ? 'Tax collected'
            : 'Tax paid';
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Compare',
          rows: [
            { Metric: labelTitle, FY_Current: fy, FY_Prior: compareFy },
            ...display.map((r) => ({
              Month: r.label,
              Current: r.cur,
              Previous: r.prev,
              'Growth %': r.growth ?? '',
            })),
            { Month: 'TOTAL', Current: totalCur, Previous: totalPrev, 'Growth %': totalGrowth ?? '' },
          ],
        },
      ]),
      `Comparative_${fy}_vs_${compareFy}.xlsx`
    );
  }, [display, fy, compareFy, metric, totalCur, totalPrev, totalGrowth]);

  useHotkeys('alt+e', (e) => {
    e.preventDefault();
    exportExcel();
  });
  useHotkeys('alt+u', (e) => {
    e.preventDefault();
    setMetric('purchases');
  });
  useHotkeys('alt+s', (e) => {
    e.preventDefault();
    setMetric('sales');
  });

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2' },
      { label: 'Sales', shortcut: 'Alt+S', onClick: () => setMetric('sales') },
      { label: 'Purchases', shortcut: 'Alt+U', onClick: () => setMetric('purchases') },
      { label: 'Export', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel]);

  const busy = salesQ.isLoading || purchaseQ.isLoading;
  const err = salesQ.error ?? purchaseQ.error;

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Comparative Report
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-2">
          Compare
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            <option value="sales">Sales</option>
            <option value="purchases">Purchases</option>
            <option value="taxCol">Tax collected</option>
            <option value="taxPaid">Tax paid</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          FY
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            {fys.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <span>vs</span>
        <label className="flex items-center gap-1">
          <select
            value={compareFy}
            onChange={(e) => setCompareFy(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            {fys.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {metric === 'taxCol' || metric === 'taxPaid' ? (
          <span className="text-[11px] text-[#888]">MoM outstanding comparison: use Banking → Receivables.</span>
        ) : null}
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">
          Reports
        </Link>
      </div>

      {err ? <div className="p-2 text-red-700">{err instanceof Error ? err.message : String(err)}</div> : null}

      <div className="overflow-auto p-2">
        <table className="w-full max-w-4xl border-collapse" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr className="text-white" style={{ background: '#1B5E20' }}>
              <th className="border border-[#AAAAAA] px-1 py-1">Month</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">{fy}</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">{compareFy}</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr>
                <td colSpan={4} className="border px-2 py-3 text-center">
                  Loading…
                </td>
              </tr>
            ) : (
              display.map((r) => (
                <tr key={r.label} style={{ background: '#FFF8E7' }}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.label}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{fmt(r.cur)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{fmt(r.prev)}</td>
                  <td
                    className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums"
                    style={{
                      color: r.growth == null ? '#666' : r.growth >= 0 ? '#1B5E20' : '#D32F2F',
                    }}
                  >
                    {r.growth == null ? '—' : fmtPct(r.growth)}
                  </td>
                </tr>
              ))
            )}
            {!busy ? (
              <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">TOTAL</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{fmt(totalCur)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{fmt(totalPrev)}</td>
                <td
                  className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums"
                  style={{ color: totalGrowth == null ? '#666' : totalGrowth >= 0 ? '#1B5E20' : '#D32F2F' }}
                >
                  {totalGrowth == null ? '—' : fmtPct(totalGrowth)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[11px] text-[#666]">Alt+S Sales · Alt+U Purchases · Alt+E Export</div>
    </div>
  );
}
