'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useSalesRegisterQuery, usePurchaseRegisterQuery, usePurchaseGstByRateQuery } from '@/hooks/useReportsQueries';
import { fyDates, listFYOptions, fmtDate, getFY } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload, getCompanyConfig } from '@/lib/reports/tally-pdf-table';

/* ─── GSTR-9 is the Annual Return — aggregates 12 months of GSTR-1 + GSTR-3B ── */

const FYS = listFYOptions();

type GstRateRow = { rate: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number };

function splitByRate(rows: { taxable_value: number; igst: number; cgst: number; sgst: number; invoice_value: number }[]): GstRateRow[] {
  const map = new Map<number, GstRateRow>();
  for (const r of rows) {
    const tax = r.cgst + r.sgst + r.igst;
    const taxable = r.taxable_value;
    if (taxable < 0.01) continue;
    const rate = taxable > 0 ? Math.round((tax / taxable) * 100) : 0;
    const key = [0, 3, 5, 12, 18, 28].reduce((closest, candidate) => Math.abs(candidate - rate) < Math.abs(closest - rate) ? candidate : closest, 0);
    if (!map.has(key)) map.set(key, { rate: key, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });
    const row = map.get(key)!;
    row.taxable += taxable;
    row.igst += r.igst;
    row.cgst += r.cgst;
    row.sgst += r.sgst;
  }
  return [...map.values()].sort((a, b) => a.rate - b.rate);
}

export default function Gstr9Page() {
  const [fy, setFy] = useState(() => getFY(new Date()));
  const { session, dealer } = useAuth();
  const setButtons = useTallySetButtons();

  const { start: fyStart, end: fyEnd } = useMemo(() => fyDates(fy), [fy]);
  const fromIso = fyStart.toISOString().slice(0, 10);
  const toIso = fyEnd.toISOString().slice(0, 10);

  const { data: sales = [], isFetching: loadSales } = useSalesRegisterQuery(fromIso, toIso);
  const { data: purchases = [], isFetching: loadPur } = usePurchaseRegisterQuery(fromIso, toIso);
  const { data: purByRate = [], isFetching: loadPurRate } = usePurchaseGstByRateQuery(fromIso, toIso);

  const isFetching = loadSales || loadPur || loadPurRate;

  /* ── Aggregate outward supplies (Table 4 of GSTR-9) ── */
  const outward = useMemo(() => splitByRate(sales), [sales]);
  const outTotal = useMemo(() => ({
    taxable: sales.reduce((s, r) => s + r.taxable_value, 0),
    igst: sales.reduce((s, r) => s + r.igst, 0),
    cgst: sales.reduce((s, r) => s + r.cgst, 0),
    sgst: sales.reduce((s, r) => s + r.sgst, 0),
    total: sales.reduce((s, r) => s + r.invoice_value, 0),
  }), [sales]);

  /* ── Aggregate inward supplies / ITC (Table 6 of GSTR-9) ── */
  const inward = useMemo(() => {
    const byRate: GstRateRow[] = purByRate.map((r) => ({
      rate: r.gst_rate,
      taxable: r.taxable_value,
      igst: r.igst,
      cgst: r.cgst,
      sgst: r.sgst,
      cess: 0,
    }));
    return byRate.sort((a, b) => a.rate - b.rate);
  }, [purByRate]);

  const inTotal = useMemo(() => ({
    taxable: purchases.reduce((s, r) => s + r.taxable_value, 0),
    igst: purchases.reduce((s, r) => s + r.igst, 0),
    cgst: purchases.reduce((s, r) => s + r.cgst, 0),
    sgst: purchases.reduce((s, r) => s + r.sgst, 0),
    total: purchases.reduce((s, r) => s + r.invoice_value, 0),
  }), [purchases]);

  /* ── Tax payable / ITC ── */
  const taxPayable = {
    igst: outTotal.igst - inTotal.igst,
    cgst: outTotal.cgst - inTotal.cgst,
    sgst: outTotal.sgst - inTotal.sgst,
    total: (outTotal.igst + outTotal.cgst + outTotal.sgst) - (inTotal.igst + inTotal.cgst + inTotal.sgst),
  };

  /* ── Exports ── */
  const exportExcel = useCallback(() => {
    const rows: Record<string, string | number>[] = [];
    rows.push({ Table: 'GSTR-9 Annual Return', FY: fy, Company: dealer?.company_name ?? '', GSTIN: getCompanyConfig().gstin ?? '' });
    rows.push({ Table: '' });
    rows.push({ Table: 'TABLE 4 — OUTWARD TAXABLE SUPPLIES' });
    rows.push({ Table: 'Rate %', Taxable: 'Taxable (₹)', IGST: 'IGST (₹)', CGST: 'CGST (₹)', SGST: 'SGST (₹)' });
    for (const r of outward) rows.push({ Table: `${r.rate}%`, Taxable: r.taxable, IGST: r.igst, CGST: r.cgst, SGST: r.sgst });
    rows.push({ Table: 'TOTAL', Taxable: outTotal.taxable, IGST: outTotal.igst, CGST: outTotal.cgst, SGST: outTotal.sgst });
    rows.push({ Table: '' });
    rows.push({ Table: 'TABLE 6 — ITC AVAILED ON INWARD SUPPLIES' });
    rows.push({ Table: 'Rate %', Taxable: 'Taxable (₹)', IGST: 'IGST (₹)', CGST: 'CGST (₹)', SGST: 'SGST (₹)' });
    for (const r of inward) rows.push({ Table: `${r.rate}%`, Taxable: r.taxable, IGST: r.igst, CGST: r.cgst, SGST: r.sgst });
    rows.push({ Table: 'TOTAL ITC', Taxable: inTotal.taxable, IGST: inTotal.igst, CGST: inTotal.cgst, SGST: inTotal.sgst });
    rows.push({ Table: '' });
    rows.push({ Table: 'TABLE 9 — TAX PAYABLE & PAID' });
    rows.push({ Table: 'Net Tax Payable', IGST: taxPayable.igst, CGST: taxPayable.cgst, SGST: taxPayable.sgst, Total: taxPayable.total });

    downloadWorkbook(workbookFromSheets([{ name: 'GSTR-9', rows }]), `GSTR9_${fy}.xlsx`);
  }, [outward, outTotal, inward, inTotal, taxPayable, fy, dealer?.company_name]);

  const exportPdf = useCallback(async () => {
    const cfg = getCompanyConfig();
    const pdfRows: string[][] = [];
    pdfRows.push(['TABLE 4 — OUTWARD TAXABLE SUPPLIES (Annual)', '', '', '', '']);
    pdfRows.push(['Rate', 'Taxable (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)']);
    for (const r of outward) pdfRows.push([`${r.rate}%`, formatTallyAmount(r.taxable), formatTallyAmount(r.igst), formatTallyAmount(r.cgst), formatTallyAmount(r.sgst)]);
    pdfRows.push(['TOTAL', formatTallyAmount(outTotal.taxable), formatTallyAmount(outTotal.igst), formatTallyAmount(outTotal.cgst), formatTallyAmount(outTotal.sgst)]);
    pdfRows.push(['', '', '', '', '']);
    pdfRows.push(['TABLE 6 — ITC ON INWARD SUPPLIES (Annual)', '', '', '', '']);
    for (const r of inward) pdfRows.push([`${r.rate}%`, formatTallyAmount(r.taxable), formatTallyAmount(r.igst), formatTallyAmount(r.cgst), formatTallyAmount(r.sgst)]);
    pdfRows.push(['TOTAL ITC', formatTallyAmount(inTotal.taxable), formatTallyAmount(inTotal.igst), formatTallyAmount(inTotal.cgst), formatTallyAmount(inTotal.sgst)]);
    pdfRows.push(['', '', '', '', '']);
    pdfRows.push(['TABLE 9 — NET TAX LIABILITY', '', '', '', '']);
    pdfRows.push(['Net Payable (Output − ITC)', '', formatTallyAmount(taxPayable.igst), formatTallyAmount(taxPayable.cgst), formatTallyAmount(taxPayable.sgst)]);

    const b = await tallyTablePdfBlob({
      title: 'GSTR-9 Annual Return',
      subtitle: `FY ${fy} · ${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      reportPeriod: `FY ${fy}`,
      companyName: cfg.companyName,
      gstin: cfg.gstin,
      address: cfg.address,
      headers: ['Particulars', 'Taxable (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)'],
      rows: pdfRows,
      footerNote: `GSTR-9 computed from Sales Register + Purchase Register · FY ${fy}`,
    });
    triggerDownload(b, `GSTR9_${fy}.pdf`);
  }, [outward, outTotal, inward, inTotal, taxPayable, fy, fromIso, toIso]);

  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });

  useEffect(() => {
    setButtons([
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Back', shortcut: 'Esc', onClick: () => history.back() },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel, exportPdf]);

  const RateTable = ({ rows, totals, label }: { rows: GstRateRow[]; totals: typeof outTotal; label: string }) => (
    <div className="border border-[#AAAAAA] bg-white">
      <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
        {label}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: '#1B5E20', color: '#FFF' }}>
            {['Rate', 'Taxable (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'Total Tax (₹)'].map((h) => (
              <th key={h} className="border border-[#2E7D32] px-2 py-1 text-right text-[11px] first:text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.rate} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }} className="border-b border-[#EEEEEE]">
              <td className="border border-[#EEEEEE] px-2 py-[3px] font-bold text-[12px]">{r.rate}%</td>
              <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.taxable)}</td>
              <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.igst)}</td>
              <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.cgst)}</td>
              <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.sgst)}</td>
              <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold">{formatTallyAmount(r.igst + r.cgst + r.sgst)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
            <td className="px-2 py-[4px] font-bold text-[12px]">TOTAL</td>
            <td className="px-2 py-[4px] text-right font-bold tabular-nums text-[12px]">{formatTallyAmount(totals.taxable)}</td>
            <td className="px-2 py-[4px] text-right font-bold tabular-nums text-[12px]">{formatTallyAmount(totals.igst)}</td>
            <td className="px-2 py-[4px] text-right font-bold tabular-nums text-[12px]">{formatTallyAmount(totals.cgst)}</td>
            <td className="px-2 py-[4px] text-right font-bold tabular-nums text-[12px]">{formatTallyAmount(totals.sgst)}</td>
            <td className="px-2 py-[4px] text-right font-bold tabular-nums text-[12px] text-[#1B5E20]">{formatTallyAmount(totals.igst + totals.cgst + totals.sgst)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        GSTR-9 — Annual Return
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          Financial Year
          <select value={fy} onChange={(e) => setFy(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0 }}>
            {FYS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <span className="text-[11px] text-[#666]">{fmtDate(fromIso)} to {fmtDate(toIso)}</span>
        <span className="text-[11px] text-[#666]">{sales.length} sales · {purchases.length} purchases</span>
        <Link href="/tally/gst" className="ml-auto text-[12px] text-[#0D47A1] underline">GST Menu</Link>
      </div>

      {isFetching ? (
        <div className="p-4 text-center text-[#888]">Loading annual data…</div>
      ) : (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {/* Header info */}
          <div className="border border-[#AAAAAA] bg-white px-4 py-3 grid grid-cols-2 gap-2 text-[12px]">
            <div><span className="text-[#888] mr-2">Company:</span><span className="font-semibold">{dealer?.company_name ?? '—'}</span></div>
            <div><span className="text-[#888] mr-2">GSTIN:</span><span className="font-semibold font-mono">{getCompanyConfig().gstin || '— (set in Settings F12)'}</span></div>
            <div><span className="text-[#888] mr-2">Period:</span><span className="font-semibold">FY {fy} · {fmtDate(fromIso)} to {fmtDate(toIso)}</span></div>
            <div><span className="text-[#888] mr-2">Return Type:</span><span className="font-semibold">GSTR-9 Annual Return</span></div>
          </div>

          {/* Table 4 — Outward supplies */}
          <RateTable rows={outward} totals={outTotal} label="Table 4 — Outward Taxable Supplies (Annual)" />

          {/* Table 6 — ITC */}
          <RateTable rows={inward} totals={inTotal} label="Table 6 — ITC Availed on Inward Supplies (Annual)" />

          {/* Table 9 — Net liability */}
          <div className="border border-[#AAAAAA] bg-white">
            <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
              Table 9 — Tax Payable & Paid (Net of ITC)
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                  {['Description', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'Total (₹)'].map((h) => (
                    <th key={h} className="border border-[#2E7D32] px-2 py-1 text-right text-[11px] first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Output Tax (from GSTR-1)', igst: outTotal.igst, cgst: outTotal.cgst, sgst: outTotal.sgst },
                  { label: 'ITC Available (from GSTR-2B)', igst: inTotal.igst, cgst: inTotal.cgst, sgst: inTotal.sgst },
                ].map((r, i) => (
                  <tr key={r.label} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }} className="border-b border-[#EEEEEE]">
                    <td className="border border-[#EEEEEE] px-2 py-[4px] text-[12px] font-medium">{r.label}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[4px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.igst)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[4px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.cgst)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[4px] text-right tabular-nums text-[12px]">{formatTallyAmount(r.sgst)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[4px] text-right tabular-nums text-[12px] font-semibold">{formatTallyAmount(r.igst + r.cgst + r.sgst)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: taxPayable.total > 0 ? '#FFF3E0' : '#E8F5E9', borderTop: '2px solid #1B5E20' }}>
                  <td className="px-2 py-[5px] font-bold text-[13px]">NET TAX PAYABLE</td>
                  <td className={`px-2 py-[5px] text-right font-bold tabular-nums text-[13px] ${taxPayable.igst > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>{formatTallyAmount(Math.abs(taxPayable.igst))}</td>
                  <td className={`px-2 py-[5px] text-right font-bold tabular-nums text-[13px] ${taxPayable.cgst > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>{formatTallyAmount(Math.abs(taxPayable.cgst))}</td>
                  <td className={`px-2 py-[5px] text-right font-bold tabular-nums text-[13px] ${taxPayable.sgst > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>{formatTallyAmount(Math.abs(taxPayable.sgst))}</td>
                  <td className={`px-2 py-[5px] text-right font-bold tabular-nums text-[14px] ${taxPayable.total > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>
                    {taxPayable.total > 0 ? formatTallyAmount(taxPayable.total) : `ITC Surplus: ${formatTallyAmount(Math.abs(taxPayable.total))}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Disclaimer */}
          <div className="border border-[#E0E0E0] bg-[#FFFDE7] px-3 py-2 text-[11px] text-[#666]">
            <strong>Note:</strong> GSTR-9 figures are auto-computed from your Sales Register and Purchase Register.
            Verify against monthly GSTR-1/3B filed returns before submitting to the GST portal.
            Nil-rated, exempt, and non-GST supplies should be added manually if applicable.
          </div>

          <div className="text-[11px] text-[#888]">
            {dealer?.company_name} · GSTR-9 FY {fy} · Alt+E Excel · Alt+P PDF
          </div>
        </div>
      )}
    </div>
  );
}
