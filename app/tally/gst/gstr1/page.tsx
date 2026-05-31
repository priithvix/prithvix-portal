'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { useGstPeriod, useGstr1, useGenerateGstr1, useHsnSummary } from '@/hooks/use-gst';
import type { Gstr1RecordRow } from '@/lib/supabase/gst';
import { markGstr1Filed } from '@/lib/supabase/gst';
import { buildGstr1PortalJson, downloadJson } from '@/lib/gst/gstr1-json';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

type InnerTab = 'b2b' | 'b2cl' | 'b2cs' | 'cdnr' | 'nil' | 'hsn';

export default function Gstr1Page() {
  const { session, dealer } = useAuth();
  const dealerRowId = session?.dealerRowId;
  const gstin = dealer?.gstin ?? '';
  const { selectedPeriod, financialYear, openPeriodSelector } = useGstPeriodContext();
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();
  const [tab, setTab] = useState<InnerTab>('b2b');
  const [status, setStatus] = useState('');

  const periodRow = useGstPeriod(dealerRowId, selectedPeriod);
  const { data: rows = [], isLoading } = useGstr1(dealerRowId, selectedPeriod);
  const genMut = useGenerateGstr1(dealerRowId, selectedPeriod);
  const { data: hsnRows = [] } = useHsnSummary(dealerRowId, selectedPeriod, 'OUTWARD');

  const filed = periodRow.data?.gstr1_status === 'FILED' || periodRow.data?.gstr1_status === 'FROZEN';

  const markFiledMut = useMutation({
    mutationFn: () => {
      if (!dealerRowId) throw new Error('Unauthenticated');
      return markGstr1Filed(dealerRowId, selectedPeriod);
    },
    onSuccess: () => {
      setStatus('GSTR-1 marked as Filed.');
      qc.invalidateQueries({ queryKey: ['gst-period', dealerRowId, selectedPeriod] });
    },
    onError: (e: Error) => setStatus(e.message),
  });

  const filtered = useMemo(() => {
    switch (tab) {
      case 'b2b':
        return rows.filter((r) => r.invoice_type === 'B2B');
      case 'b2cl':
        return rows.filter((r) => r.invoice_type === 'B2C_LARGE');
      case 'b2cs':
        return rows.filter((r) => r.invoice_type === 'B2C_SMALL');
      case 'cdnr':
        return [];
      case 'nil':
        return rows.filter((r) => Number(r.total_tax) === 0);
      case 'hsn':
        return [];
      default:
        return rows;
    }
  }, [rows, tab]);

  const b2csAgg = useMemo(() => {
    const m = new Map<
      string,
      { pos: string; sply: string; txval: number; iamt: number; camt: number; samt: number; rt: number }
    >();
    for (const r of rows.filter((x) => x.invoice_type === 'B2C_SMALL')) {
      const pos = String(r.customer_state ?? '96');
      const key = `${pos}|${r.gst_rate}`;
      const cur =
        m.get(key) ?? {
          pos,
          sply: r.supply_type === 'INTER' ? 'INTER' : 'INTRA',
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          rt: Number(r.gst_rate) || 0,
        };
      cur.txval += r.taxable_value;
      cur.iamt += r.igst;
      cur.camt += r.cgst;
      cur.samt += r.sgst;
      m.set(key, cur);
    }
    return [...m.values()];
  }, [rows]);

  const summary = useMemo(() => {
    const b2b = rows.filter((r) => r.invoice_type === 'B2B').length;
    const l = rows.filter((r) => r.invoice_type === 'B2C_LARGE').length;
    const s = rows.filter((r) => r.invoice_type === 'B2C_SMALL').length;
    const ttax = rows.reduce((a, r) => a + r.total_tax, 0);
    const ttx = rows.reduce((a, r) => a + r.taxable_value, 0);
    return { b2b, l, s, ttax, ttx };
  }, [rows]);

  const onExport = useCallback(() => {
    if (!gstin) {
      setStatus('Set dealer GSTIN in Profile to export JSON.');
      return;
    }
    const payload = buildGstr1PortalJson({ gstin, period: selectedPeriod, records: rows });
    const fn = `GSTR1_${gstin}_${selectedPeriod.replace('-', '')}.json`;
    downloadJson(fn, payload);
    setStatus('JSON downloaded.');
  }, [gstin, rows, selectedPeriod]);

  const onMarkFiled = useCallback(() => {
    if (!window.confirm('Mark GSTR-1 as Filed for this period? Regeneration will be blocked. Yes or No')) {
      return;
    }
    markFiledMut.mutate();
  }, [markFiledMut]);

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriodSelector },
      { label: 'Export', shortcut: 'Alt+E', onClick: onExport },
      { label: 'Mark Filed', shortcut: 'Alt+F', onClick: onMarkFiled },
      { label: 'Generate', shortcut: 'Alt+G', onClick: () => {
        if (filed) return;
        genMut.mutate(undefined, {
          onSuccess: (n) => setStatus(`Generated ${n} invoice(s).`),
          onError: (e: Error) => setStatus(e.message),
        });
      } },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriodSelector, onExport, onMarkFiled, genMut, filed]);

  useHotkeys('alt+e', onExport, { enableOnFormTags: true }, [onExport]);
  useHotkeys('alt+f', onMarkFiled, { enableOnFormTags: true }, [onMarkFiled]);
  useHotkeys(
    'alt+g',
    () => {
      if (filed) return;
      genMut.mutate(undefined, {
        onSuccess: (n) => setStatus(`Generated ${n} invoice(s).`),
        onError: (e: Error) => setStatus(e.message),
      });
    },
    { enableOnFormTags: true },
    [filed, genMut]
  );

  return (
    <div className="min-h-0 p-0 text-[13px] text-black" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#AAAAAA] px-2 py-1 text-white"
        style={{ background: '#1B5E20' }}
      >
        <span className="font-semibold">GSTR-1 — Outward Supplies</span>
        <span className="tabular-nums text-[12px] opacity-90">
          Period: {selectedPeriod} · FY {financialYear}
        </span>
        <span className="text-[12px] opacity-90">
          Status: {periodRow.data?.gstr1_status ?? 'DRAFT'}
          {filed ? ' 🔒' : ''}
        </span>
        <span className="ml-auto text-[11px]">F2: Period</span>
      </div>
      {status ? (
        <div className="border-b border-[#AAAAAA] bg-[#FFEB3B] px-2 py-[3px] text-[12px] text-black">{status}</div>
      ) : null}

      <div className="m-3 border border-[#AAAAAA] bg-white p-2">
        <div className="mb-2 text-[12px]">
          B2B: {summary.b2b} · B2C Large: {summary.l} · B2C Small: {summary.s} · Taxable ₹
          {formatTallyAmount(summary.ttx)} · Tax ₹{formatTallyAmount(summary.ttax)}
        </div>

        {!filed && rows.length === 0 && !isLoading ? (
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className="border border-[#AAAAAA] bg-white px-3 py-1 hover:bg-[#FFEB3B]"
              onClick={() =>
                genMut.mutate(undefined, {
                  onSuccess: (n) => setStatus(`Generated ${n} invoice(s).`),
                  onError: (e: Error) => setStatus(e.message),
                })
              }
              disabled={genMut.isPending}
            >
              Generate GSTR-1
            </button>
          </div>
        ) : null}

        {!filed && rows.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="border border-[#AAAAAA] bg-white px-3 py-1 hover:bg-[#FFEB3B]"
              onClick={() =>
                genMut.mutate(undefined, {
                  onSuccess: (n) => setStatus(`Refreshed ${n} invoice(s).`),
                  onError: (e: Error) => setStatus(e.message),
                })
              }
              disabled={genMut.isPending}
            >
              Generate / Refresh
            </button>
            <button
              type="button"
              className="border border-[#AAAAAA] bg-white px-3 py-1"
              onClick={onExport}
            >
              Export JSON
            </button>
            <button type="button" className="border border-[#AAAAAA] bg-white px-3 py-1" onClick={onMarkFiled}>
              Mark as Filed
            </button>
          </div>
        ) : null}

        {filed ? (
          <p className="mb-2 text-[12px] text-[#B71C1C]">This period is filed — regeneration disabled.</p>
        ) : null}

        <div className="mb-2 flex flex-wrap gap-1">
          {(
            [
              ['b2b', 'B2B'],
              ['b2cl', 'B2C Large'],
              ['b2cs', 'B2C Small'],
              ['cdnr', 'Credit Notes'],
              ['nil', 'Nil Rated'],
              ['hsn', 'HSN'],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              className="border px-2 py-[2px] text-[12px]"
              style={{
                borderColor: '#AAAAAA',
                background: tab === k ? '#1B5E20' : '#FFF8E7',
                color: tab === k ? '#FFFFFF' : '#000000',
              }}
              onClick={() => setTab(k)}
            >
              {lab}
            </button>
          ))}
        </div>

        {tab === 'b2cs' ? (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
              <thead>
                <tr style={{ background: '#F5F5F5' }}>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">POS</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">Supply</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">Rate %</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">Taxable</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">IGST</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">CGST</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">SGST</th>
                </tr>
              </thead>
              <tbody>
                {b2csAgg.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-[#AAAAAA] px-2 py-1">{r.pos}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right">{r.sply}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{r.rt}</td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                      {formatTallyAmount(r.txval)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                      {formatTallyAmount(r.iamt)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                      {formatTallyAmount(r.camt)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                      {formatTallyAmount(r.samt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'hsn' ? (
          <HsnInner rows={hsnRows} />
        ) : tab === 'cdnr' ? (
          <p className="text-[12px] text-[#666666]">No credit / debit notes linked in Phase C.</p>
        ) : (
          <InvoiceTable rows={filtered} showB2bCols={tab === 'b2b'} />
        )}
      </div>
    </div>
  );
}

function InvoiceTable({ rows, showB2bCols }: { rows: Gstr1RecordRow[]; showB2bCols: boolean }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
        <thead>
          <tr style={{ background: '#F5F5F5' }}>
            <th className="border border-[#AAAAAA] px-2 py-1 text-left">Invoice No</th>
            {showB2bCols ? (
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Receiver GSTIN</th>
            ) : null}
            <th className="border border-[#AAAAAA] px-2 py-1 text-left">Date</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">Taxable</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">IGST</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="border border-[#AAAAAA] px-2 py-1 font-mono text-[11px]">{r.invoice_number}</td>
              {showB2bCols ? (
                <td className="border border-[#AAAAAA] px-2 py-1 font-mono text-[11px]">
                  {r.customer_gstin ?? '—'}
                </td>
              ) : null}
              <td className="border border-[#AAAAAA] px-2 py-1 whitespace-nowrap">
                {formatTallyDate(r.invoice_date)}
              </td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {formatTallyAmount(r.taxable_value)}
              </td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {r.igst > 0 ? formatTallyAmount(r.igst) : '—'}
              </td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {formatTallyAmount(r.invoice_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HsnInner({
  rows,
}: {
  rows: { hsn_code: string; description: string | null; uom: string; total_quantity: number; taxable_value: number; igst: number; cgst: number; sgst: number }[];
}) {
  const tq = rows.reduce((a, r) => a + Number(r.total_quantity), 0);
  const tv = rows.reduce((a, r) => a + Number(r.taxable_value), 0);
  const tax = rows.reduce((a, r) => a + r.igst + r.cgst + r.sgst, 0);
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
        <thead>
          <tr style={{ background: '#F5F5F5' }}>
            <th className="border border-[#AAAAAA] px-2 py-1 text-left">HSN</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-left">Description</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-left">UOM</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">Qty</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">Taxable</th>
            <th className="border border-[#AAAAAA] px-2 py-1 text-right">Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hsn_code}>
              <td className="border border-[#AAAAAA] px-2 py-1 font-mono">{r.hsn_code}</td>
              <td className="border border-[#AAAAAA] px-2 py-1">{r.description ?? '—'}</td>
              <td className="border border-[#AAAAAA] px-2 py-1">{r.uom}</td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {Number(r.total_quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {formatTallyAmount(Number(r.taxable_value))}
              </td>
              <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                {formatTallyAmount(r.igst + r.cgst + r.sgst)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#F0F0F0', fontWeight: 600 }}>
            <td className="border border-[#AAAAAA] px-2 py-1" colSpan={3}>
              TOTAL
            </td>
            <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
              {tq.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
              {formatTallyAmount(tv)}
            </td>
            <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{formatTallyAmount(tax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
