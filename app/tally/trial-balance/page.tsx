'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTrialBalanceQuery } from '@/hooks/useReportsQueries';
import { formatTallyAmount } from '@/lib/tally-format';
import { fmtDate } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

export default function TrialBalanceReportPage() {
  const [asOnIso, setAsOnIso] = useState(() => new Date().toISOString().slice(0, 10));
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';

  const { data: rows = [], isFetching, error } = useTrialBalanceQuery(asOnIso);

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Trial Balance',
          rows: rows.map((r) => ({
            Ledger: r.ledger_name,
            Group: r.group_name ?? '',
            'Dr Total': r.dr_total,
            'Cr Total': r.cr_total,
            Net: r.dr_total - r.cr_total,
          })),
        },
      ]),
      `TrialBalance_${asOnIso}.xlsx`
    );
  }, [rows, asOnIso]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Trial Balance',
      subtitle: `As on ${fmtDate(asOnIso)}`,
      headers: ['Ledger', 'Group', 'Dr', 'Cr', 'Net'],
      rows: rows.map((r) => [
        r.ledger_name,
        r.group_name ?? '—',
        formatTallyAmount(r.dr_total),
        formatTallyAmount(r.cr_total),
        formatTallyAmount(r.dr_total - r.cr_total),
      ]),
    });
    triggerDownload(b, `TrialBalance_${asOnIso}.pdf`);
  }, [rows, asOnIso]);

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
      { label: 'Period', shortcut: 'F2', onClick: () => document.getElementById('tb-as-on')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel, exportPdf]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const r of rows) {
      dr += r.dr_total;
      cr += r.cr_total;
    }
    return { dr, cr };
  }, [rows]);

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Trial Balance
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-2">
          As on
          <input
            id="tb-as-on"
            type="date"
            value={asOnIso}
            disabled={!dealerId}
            onChange={(e) => setAsOnIso(e.target.value)}
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
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Ledger</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Group</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Dr</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Cr</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Net</th>
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
                <tr key={r.ledger_id} style={{ background: '#FFF8E7' }}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.ledger_name}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-[11px] text-[#555]">{r.group_name ?? '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.dr_total)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.cr_total)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {formatTallyAmount(r.dr_total - r.cr_total)}
                  </td>
                </tr>
              ))
            )}
            <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
              <td colSpan={2} className="border border-[#AAAAAA] px-1 py-[2px]">
                TOTAL
              </td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.dr)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.cr)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                {formatTallyAmount(totals.dr - totals.cr)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
