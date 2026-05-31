'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useDayBookQuery } from '@/hooks/useReportsQueries';
import { fyDates, fmtDate, getFY } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

const VOUCHER_TYPES = [
  { code: '', label: 'All Types' },
  { code: 'SAL', label: 'Sales' },
  { code: 'PUR', label: 'Purchase' },
  { code: 'RCT', label: 'Receipt' },
  { code: 'PMT', label: 'Payment' },
  { code: 'JNL', label: 'Journal' },
  { code: 'CNT', label: 'Contra' },
  { code: 'CRN', label: 'Credit Note' },
  { code: 'DBN', label: 'Debit Note' },
];

const TYPE_COLOR: Record<string, { bg: string; fg: string }> = {
  SAL: { bg: '#E8F5E9', fg: '#1B5E20' },
  PUR: { bg: '#E3F2FD', fg: '#0D47A1' },
  RCT: { bg: '#F3E5F5', fg: '#6A1B9A' },
  PMT: { bg: '#FFF3E0', fg: '#E65100' },
  JNL: { bg: '#F1F8E9', fg: '#558B2F' },
  CNT: { bg: '#E0F7FA', fg: '#006064' },
  CRN: { bg: '#FCE4EC', fg: '#880E4F' },
  DBN: { bg: '#FBE9E7', fg: '#BF360C' },
};

function defaultFYRangeIso() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  const to = today > end ? end : today;
  return { fromIso: start.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
}

export default function TallyVouchersPage() {
  const init = defaultFYRangeIso();
  const [fromIso, setFromIso] = useState(init.fromIso);
  const [toIso, setToIso] = useState(init.toIso);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();

  const { data: rows = [], isFetching, error } = useDayBookQuery(fromIso, toIso);

  const filtered = useMemo(() => {
    let r = rows;
    if (typeFilter) r = r.filter((x) => x.voucher_type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (x) =>
          (x.voucher_number ?? '').toLowerCase().includes(q) ||
          (x.narration ?? '').toLowerCase().includes(q) ||
          (x.voucher_type ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, typeFilter, search]);

  const totalAmount = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
    [filtered]
  );

  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Vouchers',
          rows: filtered.map((r) => ({
            Date: r.voucher_date,
            'Voucher #': r.voucher_number ?? '',
            Type: r.voucher_type ?? '',
            Narration: r.narration ?? '',
            Amount: r.total_amount,
          })),
        },
      ]),
      `Vouchers_${fromIso}_${toIso}.xlsx`
    );
  }, [filtered, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Voucher Register',
      subtitle: `${fmtDate(fromIso)} to ${fmtDate(toIso)}${typeFilter ? ` · ${typeFilter}` : ''}`,
      reportPeriod: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['Date', 'Voucher #', 'Type', 'Narration', 'Amount (₹)'],
      rows: [
        ...filtered.slice(0, 500).map((r) => [
          fmtDate(r.voucher_date ?? ''),
          r.voucher_number ?? '',
          r.voucher_type ?? '',
          (r.narration ?? '').slice(0, 70),
          formatTallyAmount(r.total_amount),
        ]),
        ['', '', '', 'TOTAL', formatTallyAmount(totalAmount)],
      ],
      footerNote: `${filtered.length} vouchers · Period: ${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
    });
    triggerDownload(b, `Vouchers_${fromIso}_${toIso}.pdf`);
  }, [filtered, fromIso, toIso, typeFilter, totalAmount]);

  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });
  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useHotkeys('alt+n', (e) => { e.preventDefault(); document.getElementById('voucher-search')?.focus(); });

  useEffect(() => {
    setButtons([
      { label: 'New SAL', shortcut: 'F8', onClick: () => { window.location.href = '/tally/voucher/new?type=SAL'; } },
      { label: 'New PMT', shortcut: 'F5', onClick: () => { window.location.href = '/tally/voucher/new?type=PMT'; } },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel]);

  const typeBadge = (code: string) => {
    const c = TYPE_COLOR[code] ?? { bg: '#F5F5F5', fg: '#333333' };
    return (
      <span
        className="inline-block min-w-[34px] px-1.5 py-[1px] text-center text-[10px] font-bold"
        style={{ background: c.bg, color: c.fg }}
      >
        {code || '—'}
      </span>
    );
  };

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title bar */}
      <div
        className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}
      >
        Voucher Register
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] bg-white px-2 py-2">
        <label className="flex items-center gap-1 text-[12px]">
          From
          <input
            type="date"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1 text-[12px]">
          To
          <input
            type="date"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px]"
          style={{ borderRadius: 0 }}
        >
          {VOUCHER_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
        </select>
        <input
          id="voucher-search"
          type="text"
          placeholder="Search narration / number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px]"
          style={{ borderRadius: 0, minWidth: 200 }}
        />
        <span className="text-[11px] text-[#666]">
          {filtered.length} vouchers · Total: {formatTallyAmount(totalAmount)}
        </span>
        <div className="ml-auto flex gap-2">
          <Link
            href="/tally/voucher/new?type=SAL"
            className="border border-[#1B5E20] bg-[#1B5E20] px-3 py-[3px] text-[12px] text-white hover:bg-[#2E7D32]"
            style={{ borderRadius: 0 }}
          >
            + New Voucher
          </Link>
          <Link
            href="/tally"
            className="text-[12px] text-[#0D47A1] underline"
          >
            Gateway
          </Link>
        </div>
      </div>

      {/* Voucher type quick filters */}
      <div className="flex flex-wrap gap-1 border-b border-[#DDDDDD] bg-[#F5F5F5] px-2 py-1">
        {VOUCHER_TYPES.map((t) => {
          const count = t.code ? rows.filter((r) => r.voucher_type === t.code).length : rows.length;
          const active = typeFilter === t.code;
          return (
            <button
              key={t.code}
              type="button"
              onClick={() => setTypeFilter(t.code)}
              className="px-2 py-[1px] text-[11px]"
              style={{
                background: active ? '#1B5E20' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#333333',
                border: '1px solid #AAAAAA',
                borderRadius: 0,
                fontWeight: active ? 700 : 400,
              }}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error ? <div className="p-2 text-[12px] text-red-700">{String(error)}</div> : null}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white m-2 border border-[#AAAAAA]">
        <table className="w-full border-collapse">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px] font-semibold">Date</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px] font-semibold">Voucher #</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px] font-semibold">Type</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px] font-semibold">Narration</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px] font-semibold">Amount (₹)</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px] font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr>
                <td colSpan={6} className="p-3 text-center text-[#888]">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-3 text-center text-[#888]">No vouchers found</td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr
                  key={r.voucher_id ?? i}
                  className="border-b border-[#EEEEEE] hover:bg-[#F0F4FF]"
                  style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                >
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">
                    {fmtDate(r.voucher_date ?? '')}
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] font-medium tabular-nums">
                    {r.voucher_number ?? '—'}
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px]">
                    {typeBadge(r.voucher_type ?? '')}
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] text-[#555]">
                    {(r.narration ?? '').slice(0, 100)}
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] tabular-nums">
                    {formatTallyAmount(r.total_amount)}
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                    <Link
                      href={`/tally/voucher/${r.voucher_id}`}
                      className="text-[11px] text-[#0D47A1] underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!isFetching && filtered.length > 0 ? (
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                <td colSpan={4} className="px-2 py-1 text-right text-[12px] font-semibold">
                  TOTAL ({filtered.length} vouchers)
                </td>
                <td className="px-2 py-1 text-right text-[12px] font-bold tabular-nums">
                  {formatTallyAmount(totalAmount)}
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Keyboard: Alt+P (PDF), Alt+E (Excel), F8 (New Sales), F5 (New Payment)
      </div>
    </div>
  );
}
