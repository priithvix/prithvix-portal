'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { usePurchaseRegisterQuery, usePurchaseGstByRateQuery } from '@/hooks/useReportsQueries';
import { useSuppliersQuery } from '@/hooks/usePurchaseQueries';
import { useAuth } from '@/contexts/AuthContext';
import { fmtDate, fyDates, getFY } from '@/lib/reports/formatters';
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

export default function PurchaseRegisterPage() {
  const { dealer } = useAuth();
  const router = useRouter();
  const d0 = defaultRange();
  const [fromIso, setFromIso] = useState(d0.fromIso);
  const [toIso, setToIso] = useState(d0.toIso);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const setButtons = useTallySetButtons();
  const { data: rows = [], isLoading, isError, error } = usePurchaseRegisterQuery(fromIso, toIso, supplierId);
  const { data: gstRows = [] } = usePurchaseGstByRateQuery(fromIso, toIso, supplierId);
  const { data: suppliers = [] } = useSuppliersQuery();

  const truncated = rows.length >= 1001;
  const displayRows = truncated ? rows.slice(0, 1000) : rows;

  useEffect(() => setSel(0), [rows, fromIso, toIso, supplierId]);

  const totals = useMemo(() => {
    let t = 0;
    let tax = 0;
    let val = 0;
    for (const r of displayRows) {
      t += r.taxable_value;
      tax += r.total_tax;
      val += r.invoice_value;
    }
    return { t, tax, val, n: displayRows.length };
  }, [displayRows]);

  const openPeriod = useCallback(() => document.getElementById('pur-from')?.focus(), []);

  const exportExcel = useCallback(() => {
    const wb = workbookFromSheets([
      {
        name: 'Purchase Register',
        rows: displayRows.map((r) => ({
          'PI No': r.pi_number,
          Date: fmtDate(r.invoice_date),
          Supplier: r.supplier_name ?? '',
          Taxable: r.taxable_value,
          Tax: r.total_tax,
          Total: r.invoice_value,
          Status: r.payment_status ?? '',
        })),
      },
      {
        name: 'ITC by rate',
        rows: gstRows.map((g) => ({
          'Rate %': g.gst_rate,
          Taxable: g.taxable_value,
          'Input CGST': g.cgst,
          'Input SGST': g.sgst,
          IGST: g.igst,
          'Total tax': g.total_tax,
        })),
      },
    ]);
    downloadWorkbook(wb, `Purchase_Register_${fromIso}_${toIso}.xlsx`);
  }, [displayRows, gstRows, fromIso, toIso]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Purchase Register',
      subtitle: `${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      headers: ['PI No', 'Date', 'Supplier', 'Taxable', 'Tax', 'Total'],
      rows: displayRows.map((r) => [
        r.pi_number,
        fmtDate(r.invoice_date),
        r.supplier_name ?? '—',
        formatTallyAmount(r.taxable_value),
        formatTallyAmount(r.total_tax),
        formatTallyAmount(r.invoice_value),
      ]),
      footerNote: truncated ? 'First 1000 rows' : undefined,
    });
    triggerDownload(b, `Purchase_Register_${fromIso}_${toIso}.pdf`);
  }, [displayRows, fromIso, toIso, truncated]);

  const exportCsv = useCallback(() => {
    const headers = ['PI No', 'Date', 'Supplier', 'Taxable', 'Tax', 'Total'];
    const csv = [
      headers.join(','),
      ...displayRows.map((r) =>
        [
          r.pi_number,
          r.invoice_date,
          `"${String(r.supplier_name ?? '').replace(/"/g, '""')}"`,
          r.taxable_value,
          r.total_tax,
          r.invoice_value,
        ].join(',')
      ),
    ].join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `Purchase_Register_${fromIso}_${toIso}.csv`);
  }, [displayRows, fromIso, toIso]);

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
      { label: 'Period', shortcut: 'F2', onClick: openPeriod },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Export CSV', shortcut: 'Alt+C', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel, exportCsv, openPeriod]);

  useHotkeys('ArrowUp', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    e.preventDefault();
    setSel((i) => Math.max(0, i - 1));
  });
  useHotkeys('ArrowDown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    e.preventDefault();
    setSel((i) => Math.min(displayRows.length - 1, i + 1));
  });
  useHotkeys('enter', () => {
    const t = document.activeElement as HTMLElement | null;
    if (t?.closest('input,select')) return;
    const r = displayRows[sel];
    if (r?.pi_id) router.push(`/tally/purchase/invoices/${r.pi_id}`);
  });

  return (
    <div className="p-0 text-[13px]" style={{ background: '#FFF8E7', fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] px-3 py-1 font-semibold text-white" style={{ background: '#1B5E20' }}>
        Purchase Register
      </div>
      <div className="flex flex-wrap gap-3 border-b border-[#AAAAAA] px-3 py-2">
        <label className="flex items-center gap-1">
          From
          <input
            id="pur-from"
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
        <label className="flex items-center gap-2">
          Supplier
          <select
            value={supplierId ?? ''}
            onChange={(e) => setSupplierId(e.target.value || null)}
            className="min-w-[10rem] border border-[#AAAAAA] bg-white px-1 py-[2px]"
            style={{ borderRadius: 0 }}
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-[11px] text-[#666]">Enter: open PI</span>
      </div>

      {isError ? <div className="p-2 text-red-700">{error instanceof Error ? error.message : String(error)}</div> : null}
      {truncated ? <div className="bg-amber-100 px-2 py-1 text-[11px]">Showing first 1000 records.</div> : null}

      <div className="overflow-auto p-2">
        <table className="w-full border-collapse text-[13px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr className="text-white" style={{ background: '#1B5E20' }}>
              {['PI No', 'Date', 'Supplier', 'Taxable', 'Tax', 'Total'].map((h) => (
                <th key={h} className="border border-[#AAAAAA] px-1 py-1 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="border px-2 py-3 text-center">
                  Loading…
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border px-2 py-3 text-center text-[#666]">
                  No rows
                </td>
              </tr>
            ) : (
              displayRows.map((r, i) => (
                <tr key={r.pi_id} style={{ background: i === sel ? '#0D47A1' : '#FFF8E7', color: i === sel ? '#FFF' : '#000' }}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.pi_number}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{fmtDate(r.invoice_date)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.supplier_name ?? '—'}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.taxable_value)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.total_tax)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(r.invoice_value)}</td>
                </tr>
              ))
            )}
            {!isLoading && displayRows.length > 0 ? (
              <tr style={{ fontWeight: 700, background: '#F0EAD6' }}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">TOTAL</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{totals.n}</td>
                <td />
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.t)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.tax)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(totals.val)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#AAAAAA] px-2 py-3">
        <div className="mb-2 font-semibold text-[#1B5E20]">ITC Summary (by GST rate)</div>
        <table className="w-full max-w-3xl border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr className="text-white" style={{ background: '#1B5E20' }}>
              <th className="border border-[#AAAAAA] px-1 py-1">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Taxable</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Input CGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Input SGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">IGST</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {gstRows.map((g) => (
              <tr key={String(g.gst_rate)}>
                <td className="border border-[#AAAAAA] px-1">{g.gst_rate}%</td>
                <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(g.taxable_value)}</td>
                <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(g.cgst)}</td>
                <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(g.sgst)}</td>
                <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(g.igst)}</td>
                <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(g.total_tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link href="/tally/reports" className="mt-4 inline-block text-[#0D47A1] underline">
          Back to Reports
        </Link>
      </div>
      <div className="px-2 pb-2 text-[11px] text-[#888]">{dealer?.company_name}</div>
    </div>
  );
}
