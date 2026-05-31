'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useDayBookQuery } from '@/hooks/useReportsQueries';
import { fyDates, getFY } from '@/lib/reports/formatters';
import { fmtDate } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

function defaultFYRangeIso() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  const to = today > end ? end : today;
  return { fromIso: start.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
}

export default function DayBookReportPage() {
  const init = defaultFYRangeIso();
  const [fromIso, setFromIso] = useState(init.fromIso);
  const [toIso, setToIso] = useState(init.toIso);
  const setButtons = useTallySetButtons();
  const { dealer, session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';

  const { data: rows = [], isFetching, error } = useDayBookQuery(fromIso, toIso);

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Day Book',
          rows: rows.map((r) => ({
            Date: r.voucher_date,
            Number: r.voucher_number ?? '',
            Type: r.voucher_type ?? '',
            Narration: r.narration ?? '',
            Amount: r.total_amount,
          })),
        },
      ]),
      `DayBook_${fromIso}_${toIso}.xlsx`
    );
  }, [rows, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Day Book',
      subtitle: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Date', 'Voucher', 'Type', 'Narration', 'Amount'],
      rows: rows.slice(0, 400).map((r) => [
        fmtDate(r.voucher_date!),
        r.voucher_number ?? '',
        r.voucher_type ?? '',
        (r.narration ?? '').slice(0, 80),
        formatTallyAmount(r.total_amount),
      ]),
      footerNote: rows.length > 400 ? `${rows.length} rows · truncated in PDF · use Excel for all` : undefined,
    });
    triggerDownload(b, `DayBook_${fromIso}_${toIso}.pdf`);
  }, [rows, fromIso, toIso]);

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
      { label: 'Period', shortcut: 'F2', onClick: () => document.getElementById('db-from')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel]);

  const amtTotal = useMemo(() => rows.reduce((s, r) => s + r.total_amount, 0), [rows]);

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Day Book
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-1">
          From
          <input
            id="db-from"
            type="date"
            disabled={!dealerId}
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
            disabled={!dealerId}
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

      <div className="overflow-auto p-2">
        <table className="w-full border-collapse" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr className="text-white" style={{ background: '#1B5E20' }}>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Date</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Voucher</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Type</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Narration</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr>
                <td colSpan={5} className="border px-2 py-3 text-center">
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.voucher_id} style={{ background: '#FFF8E7' }}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] whitespace-nowrap tabular-nums">
                    {fmtDate(r.voucher_date ?? '')}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] font-mono text-[11px]">{r.voucher_number}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.voucher_type}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-[12px]">{r.narration}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.total_amount)}</td>
                </tr>
              ))
            )}
            <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
              <td colSpan={4} className="border border-[#AAAAAA] px-1 py-[2px]">
                TOTAL ({rows.length} vouchers)
              </td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(amtTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
