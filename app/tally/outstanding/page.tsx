'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useReceivablesAgeingQuery, usePayablesAgeingQuery } from '@/hooks/useBankingQueries';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';
import { fmtDate } from '@/lib/reports/formatters';

type TabKey = 'receivables' | 'payables';

export default function TallyOutstandingPage() {
  const [tab, setTab] = useState<TabKey>('receivables');
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();

  const { data: recv = [], isFetching: recvLoad } = useReceivablesAgeingQuery(asOn);
  const { data: pay = [], isFetching: payLoad } = usePayablesAgeingQuery(asOn);

  const recvTotal = useMemo(() => recv.reduce((s, r) => s + Number(r.total_due ?? 0), 0), [recv]);
  const payTotal = useMemo(() => pay.reduce((s, r) => s + Number(r.total_due ?? 0), 0), [pay]);

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Receivables',
          rows: recv.map((r) => ({
            Farmer: r.farmer_name,
            Mobile: r.mobile ?? '',
            '0-30': r.bucket_0_30,
            '31-60': r.bucket_31_60,
            '61-90': r.bucket_61_90,
            '90+': r.bucket_90_plus,
            Total: r.total_due,
            Blocked: r.credit_blocked,
          })),
        },
        {
          name: 'Payables',
          rows: pay.map((r) => ({
            Supplier: r.supplier_name,
            Mobile: r.mobile ?? '',
            '0-30': r.bucket_0_30,
            '31-60': r.bucket_31_60,
            '61-90': r.bucket_61_90,
            '90+': r.bucket_90_plus,
            Total: r.total_due,
          })),
        },
      ]),
      `Outstanding_${asOn}.xlsx`
    );
  }, [recv, pay, asOn]);

  const exportPdf = useCallback(async () => {
    const recvRows = recv.map((r) => [
      r.farmer_name,
      formatTallyAmount(r.bucket_0_30),
      formatTallyAmount(r.bucket_31_60),
      formatTallyAmount(r.bucket_61_90),
      formatTallyAmount(r.bucket_90_plus),
      formatTallyAmount(r.total_due),
    ]);
    const payRows = pay.map((r) => [
      r.supplier_name,
      formatTallyAmount(r.bucket_0_30),
      formatTallyAmount(r.bucket_31_60),
      formatTallyAmount(r.bucket_61_90),
      formatTallyAmount(r.bucket_90_plus),
      formatTallyAmount(r.total_due),
    ]);

    const hdr = ['Party', '0-30', '31-60', '61-90', '90+', 'Total'];
    const b = await tallyTablePdfBlob({
      title: 'Outstanding — Receivables & Payables',
      subtitle: `As on ${fmtDate(asOn)}`,
      reportPeriod: `As on ${formatTallyDate(new Date(asOn + 'T12:00:00'))}`,
      headers: hdr,
      rows: [
        ['RECEIVABLES (Farmers)', '', '', '', '', ''],
        ...recvRows,
        ['Total receivables', '', '', '', '', formatTallyAmount(recvTotal)],
        ['', '', '', '', '', ''],
        ['PAYABLES (Suppliers)', '', '', '', '', ''],
        ...payRows,
        ['Total payables', '', '', '', '', formatTallyAmount(payTotal)],
      ],
      footerNote: `Receivables: ${recv.length} · Payables: ${pay.length}`,
    });
    triggerDownload(b, `Outstanding_${asOn}.pdf`);
  }, [recv, pay, asOn, recvTotal, payTotal]);

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
      { label: 'As On', shortcut: 'F2', onClick: () => document.getElementById('os-as-on')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel]);

  const loading = tab === 'receivables' ? recvLoad : payLoad;

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Outstanding
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] bg-white px-2 py-2">
        <label className="flex items-center gap-1 text-[12px]">
          As on
          <input
            id="os-as-on"
            type="date"
            value={asOn}
            onChange={(e) => setAsOn(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <div className="ml-2 flex gap-1">
          <button
            type="button"
            className={`px-3 py-1 text-[12px] ${tab === 'receivables' ? 'text-white' : 'bg-[#EEE] text-black'}`}
            style={tab === 'receivables' ? { background: '#1B5E20' } : undefined}
            onClick={() => setTab('receivables')}
          >
            Receivables ({recv.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-[12px] ${tab === 'payables' ? 'text-white' : 'bg-[#EEE] text-black'}`}
            style={tab === 'payables' ? { background: '#1B5E20' } : undefined}
            onClick={() => setTab('payables')}
          >
            Payables ({pay.length})
          </button>
        </div>
        <span className="text-[11px] text-[#666]">
          Recv total {formatTallyAmount(recvTotal)} · Pay total {formatTallyAmount(payTotal)}
        </span>
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">
          Reports
        </Link>
      </div>

      <div className="flex-1 overflow-auto border border-[#AAAAAA] bg-white m-2">
        {loading ? <div className="p-3">Loading…</div> : null}
        {!loading && tab === 'receivables' ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Farmer</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">0-30</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">31-60</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">61-90</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">90+</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Total</th>
              </tr>
            </thead>
            <tbody>
              {recv.map((r) => (
                <tr key={r.farmer_id} className="tabular-nums">
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {r.farmer_name}
                    {r.credit_blocked ? <span className="ml-1 text-[10px] text-red-700">Blocked</span> : null}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_0_30 ? formatTallyAmount(r.bucket_0_30) : '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_31_60 ? formatTallyAmount(r.bucket_31_60) : '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_61_90 ? formatTallyAmount(r.bucket_61_90) : '—'}</td>
                  <td
                    className="border border-[#AAAAAA] px-1 py-[2px] text-right font-medium"
                    style={r.bucket_90_plus > 0 ? { color: '#C62828' } : undefined}
                  >
                    {r.bucket_90_plus ? formatTallyAmount(r.bucket_90_plus) : '—'}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right font-semibold">{formatTallyAmount(r.total_due)}</td>
                </tr>
              ))}
              {recv.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-[#888]">
                    No receivables
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}

        {!loading && tab === 'payables' ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Supplier</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">0-30</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">31-60</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">61-90</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">90+</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Total</th>
              </tr>
            </thead>
            <tbody>
              {pay.map((r) => (
                <tr key={r.supplier_id} className="tabular-nums">
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.supplier_name}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_0_30 ? formatTallyAmount(r.bucket_0_30) : '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_31_60 ? formatTallyAmount(r.bucket_31_60) : '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{r.bucket_61_90 ? formatTallyAmount(r.bucket_61_90) : '—'}</td>
                  <td
                    className="border border-[#AAAAAA] px-1 py-[2px] text-right font-medium"
                    style={r.bucket_90_plus > 0 ? { color: '#C62828' } : undefined}
                  >
                    {r.bucket_90_plus ? formatTallyAmount(r.bucket_90_plus) : '—'}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right font-semibold">{formatTallyAmount(r.total_due)}</td>
                </tr>
              ))}
              {pay.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-[#888]">
                    No payables
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="px-3 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
