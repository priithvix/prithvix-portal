'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useCashFlowQuery } from '@/hooks/useReportsQueries';
import { useAuth } from '@/contexts/AuthContext';
import { fyDates, getFY, fmtAcc, fmtDate } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

function defaultFYRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  return { fromIso: start.toISOString().slice(0, 10), toIso: end.toISOString().slice(0, 10) };
}

const SECTION_TITLE: Record<string, string> = {
  OPERATING: 'A. CASH FLOW FROM OPERATING ACTIVITIES',
  INVESTING: 'B. CASH FLOW FROM INVESTING ACTIVITIES',
  FINANCING: 'C. CASH FLOW FROM FINANCING ACTIVITIES',
  SUMMARY: 'SUMMARY',
};

export default function CashFlowReportPage() {
  const r = defaultFYRange();
  const [fromIso, setFromIso] = useState(r.fromIso);
  const [toIso, setToIso] = useState(r.toIso);
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();
  const { data: lines = [], isLoading, error } = useCashFlowQuery(fromIso, toIso);

  const openPeriod = useCallback(() => document.getElementById('cf-from')?.focus(), []);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Cash Flow Statement (Indirect)',
      subtitle: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Section', 'Line', 'Amount'],
      rows: lines.map((row) => [row.section, row.line_item, fmtAcc(row.amount)]),
    });
    triggerDownload(b, `Cashflow_${fromIso}_${toIso}.pdf`);
  }, [lines, fromIso, toIso]);

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'CashFlow',
          rows: lines.map((row) => ({
            Section: row.section,
            Line: row.line_item,
            Amount: row.amount,
            Subtotal: row.is_subtotal,
          })),
        },
      ]),
      `Cashflow_${fromIso}_${toIso}.xlsx`
    );
  }, [lines, fromIso, toIso]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    openPeriod();
  });
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
      { label: 'Period', shortcut: 'F2', onClick: openPeriod },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel, openPeriod]);

  let prevSection = '';
  const rendered = lines.map((row, idx) => {
    const hdr = row.section !== prevSection;
    if (hdr) prevSection = row.section;
    return (
      <div key={`${row.section}_${idx}_${row.line_item}`}>
        {hdr ? (
          <div className="mb-2 font-semibold tracking-wide text-[#1B5E20]">{SECTION_TITLE[row.section] ?? row.section}</div>
        ) : null}
        <div
          className="flex justify-between border-b border-[#AAAAAA] py-[4px]"
          style={{
            fontWeight: row.is_subtotal ? 700 : 400,
            borderTopWidth: row.is_subtotal ? 1 : 0,
            borderTopColor: '#888',
            borderTopStyle: 'solid',
          }}
        >
          <span>{row.line_item}</span>
          <span className={`tabular-nums ${row.amount < 0 ? 'text-[#D32F2F]' : ''}`}>₹{fmtAcc(row.amount)}</span>
        </div>
      </div>
    );
  });

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Cash Flow Statement · Indirect
      </div>
      <div className="flex flex-wrap gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-1">
          From
          <input
            id="cf-from"
            type="date"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1">
          To
          <input
            type="date"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">
          Reports
        </Link>
      </div>

      {error ? <div className="p-2 text-red-700">{error instanceof Error ? error.message : String(error)}</div> : null}
      <div className="p-3">
        {isLoading ? (
          <p className="text-[#666]">Loading…</p>
        ) : (
          <div className="space-y-4">{rendered}</div>
        )}
      </div>
      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
