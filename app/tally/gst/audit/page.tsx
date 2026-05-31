'use client';

import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotkeys } from 'react-hotkeys-hook';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { getGstAuditReport, type GstAuditMonth } from '@/lib/supabase/gst';
import { formatTallyAmount } from '@/lib/tally-format';

function recentFyLabels(): string[] {
  const d = new Date();
  let y = d.getFullYear();
  if (d.getMonth() < 3) y -= 1;
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ys = y - i;
    out.push(`${ys}-${String((ys + 1) % 100).padStart(2, '0')}`);
  }
  return out;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, marginBottom: 8 },
  table: { width: '100%', marginTop: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#999' },
  cell: { flex: 1, padding: 4 },
  head: { fontWeight: 'bold', backgroundColor: '#EEE' },
});

function AuditPdfDoc({ fy, dealerName, rows }: { fy: string; dealerName: string; rows: GstAuditMonth[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>GST Audit Summary — FY {fy}</Text>
        <Text style={{ marginBottom: 6 }}>{dealerName}</Text>
        <Text style={{ marginBottom: 4, fontWeight: 'bold' }}>Outward supplies (from GSTR-1 cache)</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.head]}>
            <Text style={styles.cell}>Month</Text>
            <Text style={styles.cell}>Taxable</Text>
            <Text style={styles.cell}>CGST</Text>
            <Text style={styles.cell}>SGST</Text>
            <Text style={styles.cell}>Total tax</Text>
          </View>
          {rows.map((r) => (
            <View key={r.period} style={styles.row}>
              <Text style={styles.cell}>{r.monthLabel}</Text>
              <Text style={styles.cell}>{formatTallyAmount(r.taxable)}</Text>
              <Text style={styles.cell}>{formatTallyAmount(r.cgst)}</Text>
              <Text style={styles.cell}>{formatTallyAmount(r.sgst)}</Text>
              <Text style={styles.cell}>{formatTallyAmount(r.totalTax)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export default function GstAuditPage() {
  const { session, dealer } = useAuth();
  const dealerRowId = session?.dealerRowId;
  const { financialYear, openPeriodSelector } = useGstPeriodContext();
  const setButtons = useTallySetButtons();
  const [fy, setFy] = useState(financialYear);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['gst-audit', dealerRowId, fy],
    queryFn: () => (dealerRowId ? getGstAuditReport(dealerRowId, fy) : []),
    enabled: !!dealerRowId && !!fy,
  });

  const exportPdf = useCallback(async () => {
    const blob = await pdf(
      <AuditPdfDoc fy={fy} dealerName={dealer?.company_name ?? 'Dealer'} rows={rows} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Audit_${fy}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fy, dealer?.company_name, rows]);

  const exportXlsx = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const outward = rows.map((r) => ({
      Month: r.monthLabel,
      Taxable: r.taxable,
      CGST: r.cgst,
      SGST: r.sgst,
      TotalTax: r.totalTax,
    }));
    const itc = rows.map((r) => ({
      Month: r.monthLabel,
      IGST_ITC: r.itcIgst,
      CGST_ITC: r.itcCgst,
      SGST_ITC: r.itcSgst,
      Total_ITC: r.totalItc,
    }));
    const fil = rows.map((r) => ({
      Month: r.monthLabel,
      GSTR1: r.gstr1,
      GSTR3B: r.gstr3b,
      Status: r.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outward), 'Outward');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itc), 'ITC');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fil), 'Filing');
    XLSX.writeFile(wb, `GST_Audit_${fy}.xlsx`);
  }, [fy, rows]);

  useHotkeys('alt+e', () => void exportPdf(), { enableOnFormTags: true }, [exportPdf]);

  useEffect(() => {
    setFy(financialYear);
  }, [financialYear]);

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriodSelector },
      { label: 'Export PDF', shortcut: 'Alt+E', onClick: exportPdf },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriodSelector, exportPdf]);

  const totTaxable = rows.reduce((a, r) => a + r.taxable, 0);
  const totCgst = rows.reduce((a, r) => a + r.cgst, 0);
  const totSgst = rows.reduce((a, r) => a + r.sgst, 0);
  const totTT = rows.reduce((a, r) => a + r.totalTax, 0);

  return (
    <div className="text-[13px] text-black">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] px-2 py-1 text-white"
        style={{ background: '#1B5E20' }}
      >
        <span className="font-semibold">GST Audit Report</span>
        <label className="flex items-center gap-1 text-[12px]">
          FY
          <select
            className="border border-[#AAAAAA] bg-white px-1 py-0.5 text-black"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
          >
            {recentFyLabels().map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-[11px]">Alt+E: Export PDF</span>
      </div>
      <div className="m-3 space-y-4 border border-[#AAAAAA] bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="border border-[#AAAAAA] px-3 py-1 hover:bg-[#FFEB3B]" onClick={exportPdf}>
            Export PDF
          </button>
          <button type="button" className="border border-[#AAAAAA] px-3 py-1" onClick={exportXlsx}>
            Export Excel
          </button>
        </div>
        {isLoading ? <p>Loading…</p> : null}
        <section>
          <h2 className="mb-1 text-[12px] font-semibold">Outward supplies summary</h2>
          <div className="overflow-auto">
            <AuditTable
              rows={rows}
              cols={[
                ['Month', 'monthLabel'],
                ['Taxable', 'taxable'],
                ['CGST', 'cgst'],
                ['SGST', 'sgst'],
                ['Total Tax', 'totalTax'],
              ]}
            />
            <table className="mt-1 w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
              <tbody>
                <tr style={{ background: '#F0F0F0', fontWeight: 600 }}>
                  <td className="border border-[#AAAAAA] px-2 py-1">TOTAL</td>
                  <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                    {formatTallyAmount(totTaxable)}
                  </td>
                  <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                    {formatTallyAmount(totCgst)}
                  </td>
                  <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                    {formatTallyAmount(totSgst)}
                  </td>
                  <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                    {formatTallyAmount(totTT)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-1 text-[12px] font-semibold">ITC claimed summary (from GSTR-3B cache)</h2>
          <div className="overflow-auto">
            <AuditTable
              rows={rows}
              cols={[
                ['Month', 'monthLabel'],
                ['IGST ITC', 'itcIgst'],
                ['CGST ITC', 'itcCgst'],
                ['SGST ITC', 'itcSgst'],
                ['Total ITC', 'totalItc'],
              ]}
            />
          </div>
        </section>
        <section>
          <h2 className="mb-1 text-[12px] font-semibold">Filing status</h2>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
              <thead>
                <tr style={{ background: '#F5F5F5' }}>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">Month</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">GSTR-1</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">GSTR-3B</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period}>
                    <td className="border border-[#AAAAAA] px-2 py-1">{r.monthLabel}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1">{r.gstr1}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1">{r.gstr3b}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuditTable({
  rows,
  cols,
}: {
  rows: GstAuditMonth[];
  cols: [string, keyof GstAuditMonth][];
}) {
  return (
    <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
      <thead>
        <tr style={{ background: '#F5F5F5' }}>
          {cols.map(([h]) => (
            <th key={h} className="border border-[#AAAAAA] px-2 py-1 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.period}>
            {cols.map(([label, key], colIdx) => (
              <td
                key={label}
                className={`border border-[#AAAAAA] px-2 py-1 tabular-nums ${colIdx === 0 ? 'text-left' : 'text-right'}`}
              >
                {colIdx === 0
                  ? String(r[key] ?? '—')
                  : typeof r[key] === 'number'
                    ? formatTallyAmount(r[key] as number)
                    : String(r[key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
