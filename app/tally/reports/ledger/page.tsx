'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { TallyLedgerPicker } from '@/components/tally/TallyLedgerPicker';
import { useLedgerPickListQuery, useLedgerStatementQuery } from '@/hooks/useReportsQueries';
import { useAuth } from '@/contexts/AuthContext';
import { fyDates, getFY } from '@/lib/reports/formatters';
import { fmtDate } from '@/lib/reports/formatters';
import { workbookFromSheets, downloadWorkbook } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';
import { formatTallyAmount } from '@/lib/tally-format';

function defaultRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  const to = today > end ? end : today;
  return { fromIso: start.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
}

export default function LedgerStatementPage() {
  const { dealer } = useAuth();
  const setButtons = useTallySetButtons();
  const d0 = defaultRange();
  const [fromIso, setFromIso] = useState(d0.fromIso);
  const [toIso, setToIso] = useState(d0.toIso);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const { data: ledgers = [] } = useLedgerPickListQuery();
  const { data: lines = [], isLoading, error } = useLedgerStatementQuery(ledgerId, fromIso, toIso);

  const openPeriod = useCallback(() => document.getElementById('led-from')?.focus(), []);

  const exportExcel = useCallback(() => {
    const lg = ledgers.find((x) => x.id === ledgerId);
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Ledger',
          rows: lines.map((r) => ({
            Date: r.entry_date,
            Voucher: r.voucher_number ?? '',
            Type: r.voucher_type ?? '',
            Narration: r.narration ?? '',
            Dr: r.dr_amount,
            Cr: r.cr_amount,
            Balance: r.running_balance,
            'Dr/Cr': r.balance_type ?? '',
          })),
        },
      ]),
      `${lg?.name ?? 'Ledger'}_${fromIso}_${toIso}.xlsx`
    );
  }, [lines, ledgerId, ledgers, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const lg = ledgers.find((x) => x.id === ledgerId);
    const b = await tallyTablePdfBlob({
      title: `Ledger Statement — ${lg?.name ?? ''}`,
      subtitle: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Date', 'Particulars', 'Dr', 'Cr', 'Balance'],
      rows: lines.map((r) => [
        fmtDate(r.entry_date),
        [r.voucher_number, r.narration].filter(Boolean).join(' ') || '—',
        formatTallyAmount(r.dr_amount),
        formatTallyAmount(r.cr_amount),
        `${formatTallyAmount(r.running_balance)} ${r.balance_type ?? ''}`,
      ]),
    });
    triggerDownload(b, `Ledger_${fromIso}_${toIso}.pdf`);
  }, [lines, ledgerId, ledgers, fromIso, toIso]);

  const exportCsv = useCallback(() => {
    const csv = [
      ['Date', 'Dr', 'Cr', 'Balance', 'BalType'].join(','),
      ...lines.map((r) =>
        [r.entry_date, r.dr_amount, r.cr_amount, r.running_balance, r.balance_type ?? ''].join(',')
      ),
    ].join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `Ledger_${fromIso}_${toIso}.csv`);
  }, [lines, fromIso, toIso]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    openPeriod();
  });
  useHotkeys('alt+p', (e) => {
    e.preventDefault();
    if (ledgerId) void exportPdf();
  });
  useHotkeys('alt+e', (e) => {
    e.preventDefault();
    if (ledgerId) exportExcel();
  });
  useHotkeys('alt+c', (e) => {
    e.preventDefault();
    if (ledgerId) exportCsv();
  });

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriod },
      { label: 'Print Statement', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Export CSV', shortcut: 'Alt+C', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel, exportCsv, openPeriod]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const r of lines) {
      dr += r.dr_amount;
      cr += r.cr_amount;
    }
    const last = lines[lines.length - 1];
    return { dr, cr, closing: last };
  }, [lines]);

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20', borderColor: '#0D3D0F' }}>
        Ledger Statement
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex flex-col text-[11px] text-[#555]">
          Ledger
          <TallyLedgerPicker ledgers={ledgers} valueId={ledgerId} onChange={(r) => setLedgerId(r?.id ?? null)} />
        </label>
        <label className="flex items-center gap-1">
          From
          <input
            id="led-from"
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

      <div className="overflow-auto p-2">
        <table className="w-full border-collapse" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr className="text-white" style={{ background: '#1B5E20' }}>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Date</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Particulars</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Dr</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Cr</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {!ledgerId ? (
              <tr>
                <td colSpan={5} className="border px-2 py-3 text-center text-[#666]">
                  Select a ledger
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={5} className="border px-2 py-3 text-center">
                  Loading…
                </td>
              </tr>
            ) : (
              lines.map((r, i) => (
                <tr key={`${r.entry_date}_${i}`} style={{ background: '#FFF8E7' }}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{fmtDate(r.entry_date)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {[r.voucher_number, r.voucher_type, r.narration].filter(Boolean).join(' · ')}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.dr_amount)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.cr_amount)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {formatTallyAmount(r.running_balance)} {r.balance_type}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ledgerId && lines.length > 0 ? (
        <div className="border-t border-[#AAAAAA] px-3 py-2 text-[12px]">
          Total Dr: ₹{formatTallyAmount(totals.dr)} · Total Cr: ₹{formatTallyAmount(totals.cr)} · Closing: ₹
          {totals.closing ? formatTallyAmount(totals.closing.running_balance) : '0.00'}{' '}
          {totals.closing?.balance_type ?? ''}
        </div>
      ) : null}
      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
