'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useSalesRegisterQuery, useProductHsnCodesQuery } from '@/hooks/useReportsQueries';
import type { SalesRegisterRow } from '@/lib/supabase/reports';
import { fmt, fmtDate } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';
import { fyDates, getFY } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import Link from 'next/link';

function bucketSalesGst(rows: SalesRegisterRow[]) {
  const m = new Map<
    number,
    { taxable: number; cgst: number; sgst: number; igst: number; tax: number }
  >();
  for (const r of rows) {
    const rateRaw = r.taxable_value > 0.009 ? (r.total_tax / r.taxable_value) * 100 : 0;
    const rate = Math.round(rateRaw * 10) / 10;
    const b = m.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    b.taxable += r.taxable_value;
    b.cgst += r.cgst;
    b.sgst += r.sgst;
    b.igst += r.igst;
    b.tax += r.total_tax;
    m.set(rate, b);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function defaultFYRangeIso() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  const to = today > end ? end : today;
  return { fromIso: start.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10), fyLabel: fy };
}

export default function SalesRegisterReportPage() {
  const { dealer } = useAuth();
  const { farmers } = useData();
  const setButtons = useTallySetButtons();
  const defRange = defaultFYRangeIso();
  const [fromIso, setFromIso] = useState(defRange.fromIso);
  const [toIso, setToIso] = useState(defRange.toIso);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [hsn, setHsn] = useState<string | ''>('');
  const [sel, setSel] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: rows = [], isLoading, isError, error } = useSalesRegisterQuery(fromIso, toIso, partyId, hsn || null);
  const { data: hsnCodes = [] } = useProductHsnCodesQuery();

  const truncated = rows.length >= 1001;

  useEffect(() => {
    setSel(0);
  }, [rows, fromIso, toIso, partyId, hsn]);

  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    let total = 0;
    const slice = truncated ? rows.slice(0, 1000) : rows;
    for (const r of slice) {
      taxable += r.taxable_value;
      tax += r.total_tax;
      total += r.invoice_value;
    }
    return {
      taxable,
      tax,
      total,
      count: slice.length,
    };
  }, [rows, truncated]);

  const gstBuckets = useMemo(
    () => bucketSalesGst(truncated ? rows.slice(0, 1000) : rows),
    [rows, truncated]
  );

  const gstSum = useMemo(() => {
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const [, g] of gstBuckets) {
      cgst += g.cgst;
      sgst += g.sgst;
      igst += g.igst;
    }
    return { cgst, sgst, igst };
  }, [gstBuckets]);

  const exportExcel = useCallback(() => {
    const slice = truncated ? rows.slice(0, 1000) : rows;
    const main = slice.map((r) => ({
      'Invoice No': r.invoice_number,
      Date: fmtDate(r.invoice_date),
      Farmer: r.farmer_name ?? '',
      Taxable: r.taxable_value,
      Tax: r.total_tax,
      Total: r.invoice_value,
      Status: r.payment_status ?? '',
      CGST: r.cgst,
      SGST: r.sgst,
      IGST: r.igst,
    }));
    const gstSheet = gstBuckets.map(([rate, g]) => ({
      'Rate %': rate,
      Taxable: g.taxable,
      CGST: g.cgst,
      SGST: g.sgst,
      IGST: g.igst,
      Total: g.tax,
    }));
    const wb = workbookFromSheets([
      { name: 'Sales Register', rows: main },
      { name: 'GST Summary', rows: gstSheet },
    ]);
    downloadWorkbook(wb, `Sales_Register_${fromIso}_${toIso}.xlsx`);
  }, [rows, truncated, gstBuckets, fromIso, toIso]);

  const exportCsv = useCallback(() => {
    const slice = truncated ? rows.slice(0, 1000) : rows;
    const headers = [
      'Invoice No',
      'Date',
      'Farmer',
      'Taxable',
      'Tax',
      'Total',
      'Status',
    ];
    const lines = [
      headers.join(','),
      ...slice.map((r) =>
        [
          r.invoice_number,
          r.invoice_date,
          `"${String(r.farmer_name ?? '').replace(/"/g, '""')}"`,
          r.taxable_value,
          r.total_tax,
          r.invoice_value,
          r.payment_status ?? '',
        ].join(',')
      ),
    ];
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `Sales_Register_${fromIso}_${toIso}.csv`);
  }, [rows, truncated, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const slice = truncated ? rows.slice(0, 1000) : rows;
    const subtitle = `${fmtDate(fromIso)} to ${fmtDate(toIso)}`;
    const b = await tallyTablePdfBlob({
      title: 'Sales Register',
      subtitle,
      headers: ['Invoice', 'Date', 'Farmer', 'Taxable', 'Tax', 'Total'],
      rows: slice.map((r) => [
        r.invoice_number,
        fmtDate(r.invoice_date),
        r.farmer_name ?? '—',
        formatTallyAmount(r.taxable_value),
        formatTallyAmount(r.total_tax),
        formatTallyAmount(r.invoice_value),
      ]),
      footerNote: truncated ? 'Showing first 1000 rows · export Excel for full set' : undefined,
    });
    triggerDownload(b, `Sales_Register_${fromIso}_${toIso}.pdf`);
  }, [rows, truncated, fromIso, toIso]);

  const openPeriod = useCallback(() => {
    document.getElementById('sales-reg-from')?.focus();
  }, []);

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
  useHotkeys('alt+c', (e) => {
    e.preventDefault();
    exportCsv();
  });

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: () => openPeriod() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Export CSV', shortcut: 'Alt+C', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel, exportCsv, openPeriod]);

  const navigate = useCallback(
    (dir: number) => {
      const slice = truncated ? rows.slice(0, 1000) : rows;
      if (slice.length === 0) return;
      setSel((i) => Math.max(0, Math.min(slice.length - 1, i + dir)));
    },
    [rows, truncated]
  );

  useHotkeys('ArrowUp', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    e.preventDefault();
    navigate(-1);
  });
  useHotkeys('ArrowDown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    e.preventDefault();
    navigate(1);
  });
  useHotkeys('enter', () => {
    const t = document.activeElement as HTMLElement | null;
    if (t?.closest('input,select,textarea')) return;
    const slice = truncated ? rows.slice(0, 1000) : rows;
    if (slice[sel]) setDetailOpen(true);
  });

  const displayRows = truncated ? rows.slice(0, 1000) : rows;
  const current = displayRows[sel];

  return (
    <div className="p-0" style={{ background: '#FFF8E7', fontSize: 13, fontFeatureSettings: "'tnum' 1" }}>
      <div className="px-3 py-1 font-semibold tracking-wide text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Sales Register
      </div>
      <div className="flex flex-wrap gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-1">
          <span className="text-[11px]" style={{ color: '#444' }}>
            From
          </span>
          <input
            id="sales-reg-from"
            type="date"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[11px]" style={{ color: '#444' }}>
            To
          </span>
          <input
            type="date"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: '#444' }}>
            Party
          </span>
          <select
            value={partyId ?? ''}
            onChange={(e) => setPartyId(e.target.value || null)}
            className="min-w-[8rem] border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            <option value="">All farmers</option>
            {(farmers ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: '#444' }}>
            HSN
          </span>
          <select
            value={hsn}
            onChange={(e) => setHsn(e.target.value)}
            className="min-w-[6rem] border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            <option value="">All</option>
            {hsnCodes.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-[11px] text-[#666]">F2: Period · Alt+P PDF · Alt+E Excel · Alt+C CSV</span>
      </div>

      {isError ? (
        <div className="p-3 text-red-700">{error instanceof Error ? error.message : String(error ?? 'Failed to load')}</div>
      ) : null}
      {truncated ? (
        <div className="border-b border-amber-600 bg-amber-100 px-3 py-1 text-[12px] text-amber-900">
          Showing first 1000 invoices — use Export for full data.
        </div>
      ) : null}

      <div className="overflow-auto p-2">
        <table className="w-full border-collapse text-[13px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Invoice No</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Date</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Farmer</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Taxable</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Tax</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="border border-[#AAAAAA] px-2 py-4 text-center text-[#666]">
                  Loading…
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-[#AAAAAA] px-2 py-4 text-center text-[#666]">
                  No rows
                </td>
              </tr>
            ) : (
              displayRows.map((r, i) => (
                <tr
                  key={r.invoice_id}
                  className={i === sel ? 'text-white' : ''}
                  style={i === sel ? { background: '#0D47A1' } : { background: '#FFF8E7' }}
                  onMouseDown={() => setSel(i)}
                >
                  <td className="border border-[#AAAAAA] px-1 py-[2px] font-mono text-[11px]">{r.invoice_number}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{fmtDate(r.invoice_date)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.farmer_name ?? '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.taxable_value)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.total_tax)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.invoice_value)}</td>
                </tr>
              ))
            )}
            {!isLoading && displayRows.length > 0 ? (
              <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">TOTAL</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{totals.count} invoices</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]" />
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.taxable)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.tax)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.total)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#AAAAAA] px-2 pb-4 pt-3">
        <div className="mb-2 text-[13px] font-semibold" style={{ color: '#1B5E20' }}>
          GST Summary
        </div>
        <table className="w-full max-w-3xl border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Taxable</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">CGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">SGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">IGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Total tax</th>
            </tr>
          </thead>
          <tbody>
            {gstBuckets.map(([rate, g]) => (
              <tr key={rate}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{rate}%</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(g.taxable)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{g.cgst > 0 ? formatTallyAmount(g.cgst) : '—'}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{g.sgst > 0 ? formatTallyAmount(g.sgst) : '—'}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{g.igst > 0 ? formatTallyAmount(g.igst) : '—'}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(g.tax)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
              <td className="border border-[#AAAAAA] px-1 py-[2px]">TOTAL</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.taxable)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(gstSum.cgst)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(gstSum.sgst)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(gstSum.igst)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.tax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {detailOpen && current ? (
        <DetailModal sale={current} shopName={dealer?.company_name ?? ''} onClose={() => setDetailOpen(false)} />
      ) : null}
    </div>
  );
}

function DetailModal({ sale, shopName, onClose }: { sale: SalesRegisterRow; shopName: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="max-w-md border bg-[#FFF8E7] p-4 text-[13px]"
        style={{
          border: '1px solid #AAAAAA',
          borderRadius: 0,
          fontFeatureSettings: "'tnum' 1",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 font-semibold text-[#1B5E20]">{shopName}</div>
        <div>Sale: {sale.invoice_number}</div>
        <div>Date: {fmtDate(sale.invoice_date)}</div>
        <div>Farmer: {sale.farmer_name ?? '—'}</div>
        <div>Taxable: ₹{fmt(sale.taxable_value)} · Tax: ₹{fmt(sale.total_tax)}</div>
        <div className="mt-3 font-semibold">Total ₹{fmt(sale.invoice_value)}</div>
        <div className="mt-4 flex gap-4">
          <Link href="/invoice" className="text-[#0D47A1] underline">
            View in Invoice centre
          </Link>
          <button type="button" className="border border-[#AAAAAA] bg-white px-2 py-[2px]" style={{ borderRadius: 0 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
