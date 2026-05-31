'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { useComputeGstr3b, useGstr3b } from '@/hooks/use-gst';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { getGstPeriod, markGstr3bFiled, saveGstr3bOverrides, type Gstr3bSummaryRow } from '@/lib/supabase/gst';
import { buildGstr3bPortalJson } from '@/lib/gst/gstr3b-json';
import { downloadJson } from '@/lib/gst/gstr1-json';

function numIn(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function Gstr3bPage() {
  const { session, dealer } = useAuth();
  const dealerRowId = session?.dealerRowId;
  const gstin = dealer?.gstin ?? '';
  const { selectedPeriod, openPeriodSelector } = useGstPeriodContext();
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<Partial<Gstr3bSummaryRow> | null>(null);

  const { data: row, isLoading } = useGstr3b(dealerRowId, selectedPeriod);
  const computeMut = useComputeGstr3b(dealerRowId, selectedPeriod);

  const periodRow = useQuery({
    queryKey: ['gst-period', dealerRowId, selectedPeriod],
    queryFn: () => (dealerRowId ? getGstPeriod(dealerRowId, selectedPeriod) : null),
    enabled: !!dealerRowId,
  });

  const filed = periodRow.data?.gstr3b_status === 'FILED';

  useEffect(() => {
    if (row) setDraft({ ...row });
  }, [row]);

  const d = draft;

  const onExport = useCallback(() => {
    if (!gstin || !row) {
      setStatus('Compute and set GSTIN in Profile to export.');
      return;
    }
    const payload = buildGstr3bPortalJson(gstin, selectedPeriod, { ...row, ...(draft ?? {}) } as Gstr3bSummaryRow);
    downloadJson(`GSTR3B_${gstin}_${selectedPeriod.replace('-', '')}.json`, payload);
    setStatus('GSTR-3B JSON downloaded.');
  }, [gstin, row, draft, selectedPeriod]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft?.id) throw new Error('Nothing to save');
      await saveGstr3bOverrides(draft.id, draft);
    },
    onSuccess: () => {
      setStatus('Overrides saved.');
      qc.invalidateQueries({ queryKey: ['gstr3b', dealerRowId, selectedPeriod] });
    },
    onError: (e: Error) => setStatus(e.message),
  });

  const markMut = useMutation({
    mutationFn: () => {
      if (!dealerRowId) throw new Error('Unauthenticated');
      return markGstr3bFiled(dealerRowId, selectedPeriod);
    },
    onSuccess: () => {
      setStatus('GSTR-3B marked Filed.');
      qc.invalidateQueries({ queryKey: ['gst-period', dealerRowId, selectedPeriod] });
    },
    onError: (e: Error) => setStatus(e.message),
  });

  const onMarkFiled = () => {
    if (!window.confirm('Mark GSTR-3B as Filed? Yes / No')) return;
    markMut.mutate();
  };

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriodSelector },
      { label: 'Compute', shortcut: 'Alt+C', onClick: () => computeMut.mutate() },
      { label: 'Export', shortcut: 'Alt+E', onClick: onExport },
      { label: 'Mark Filed', shortcut: 'Alt+F', onClick: onMarkFiled },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriodSelector, computeMut, onExport, onMarkFiled]);

  useHotkeys('alt+c', () => computeMut.mutate(), { enableOnFormTags: true }, [computeMut]);
  useHotkeys('alt+e', onExport, { enableOnFormTags: true }, [onExport]);
  useHotkeys('alt+f', onMarkFiled, { enableOnFormTags: true }, [onMarkFiled]);

  const cashHighlight = useMemo(() => {
    if (!d) return { ig: false, cg: false, sg: false };
    return {
      ig: d.cash_paid_igst != null && Number(d.cash_paid_igst) > 0,
      cg: d.cash_paid_cgst != null && Number(d.cash_paid_cgst) > 0,
      sg: d.cash_paid_sgst != null && Number(d.cash_paid_sgst) > 0,
    };
  }, [d]);

  if (!d && isLoading) {
    return <div className="p-4 text-[13px]">Loading…</div>;
  }

  if (!d) {
    return (
      <div className="p-4 text-[13px]">
        <button
          type="button"
          className="border border-[#AAAAAA] bg-white px-3 py-1"
          onClick={() => computeMut.mutate()}
        >
          Compute from Data
        </button>
      </div>
    );
  }

  const setn = (k: keyof Gstr3bSummaryRow, v: string) => {
    setDraft((prev) => (prev ? { ...prev, [k]: numIn(v) } : prev));
  };

  return (
    <div className="text-[13px] text-black">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] px-2 py-1 text-white"
        style={{ background: '#1B5E20' }}
      >
        <span className="font-semibold">GSTR-3B — Monthly Return</span>
        <span className="tabular-nums">Period: {selectedPeriod}</span>
        <span className="font-mono text-[12px]">GSTIN: {gstin || '—'}</span>
        <span className="ml-auto text-[11px]">F2: Period</span>
      </div>
      {status ? <div className="bg-[#FFEB3B] px-2 py-1 text-[12px]">{status}</div> : null}
      {filed ? <div className="bg-[#FFCDD2] px-2 py-1 text-[12px]">Filed — overrides may still be saved to summary row.</div> : null}

      <div className="m-3 space-y-3 border border-[#AAAAAA] bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-[#AAAAAA] px-3 py-1 hover:bg-[#FFEB3B]"
            onClick={() => computeMut.mutate()}
            disabled={computeMut.isPending}
          >
            Compute from Data
          </button>
          <button type="button" className="border border-[#AAAAAA] px-3 py-1" onClick={() => saveMut.mutate()}>
            Save overrides
          </button>
          <button type="button" className="border border-[#AAAAAA] px-3 py-1" onClick={onExport}>
            Export JSON
          </button>
          <button type="button" className="border border-[#AAAAAA] px-3 py-1" onClick={onMarkFiled}>
            Mark as Filed
          </button>
        </div>

        <p className="text-[12px] font-semibold">
          3.1 Details of outward supplies (summary from GSTR-1 cache)
        </p>
        <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr style={{ background: '#F5F5F5' }}>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Nature</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">Taxable</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">IGST</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">CGST</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">SGST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#AAAAAA] px-2 py-1">(a) Outward taxable</td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.taxable_outward ?? '')}
                  onChange={(e) => setn('taxable_outward', e.target.value)}
                />
              </td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.tax_outward_igst ?? '')}
                  onChange={(e) => setn('tax_outward_igst', e.target.value)}
                />
              </td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.tax_outward_cgst ?? '')}
                  onChange={(e) => setn('tax_outward_cgst', e.target.value)}
                />
              </td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.tax_outward_sgst ?? '')}
                  onChange={(e) => setn('tax_outward_sgst', e.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-[12px] font-semibold">4. Eligible ITC (from GSTR-2B matched / mismatch rows)</p>
        <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr style={{ background: '#F5F5F5' }}>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">(2) All other ITC</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">IGST</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">CGST</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">SGST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#AAAAAA] px-2 py-1">Books (editable)</td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.itc_igst ?? '')}
                  onChange={(e) => setn('itc_igst', e.target.value)}
                />
              </td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.itc_cgst ?? '')}
                  onChange={(e) => setn('itc_cgst', e.target.value)}
                />
              </td>
              <td className="border border-[#AAAAAA] px-1">
                <input
                  className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                  value={String(d.itc_sgst ?? '')}
                  onChange={(e) => setn('itc_sgst', e.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-[12px] font-semibold">6. Payment of Tax</p>
        <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
          <thead>
            <tr style={{ background: '#F5F5F5' }}>
              <th className="border border-[#AAAAAA] px-2 py-1 text-left">Head</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">Payable</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">ITC Used</th>
              <th className="border border-[#AAAAAA] px-2 py-1 text-right">Cash</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['IGST', 'tax_payable_igst', 'itc_utilized_igst', 'cash_paid_igst', cashHighlight.ig],
                ['CGST', 'tax_payable_cgst', 'itc_utilized_cgst', 'cash_paid_cgst', cashHighlight.cg],
                ['SGST', 'tax_payable_sgst', 'itc_utilized_sgst', 'cash_paid_sgst', cashHighlight.sg],
              ] as const
            ).map(([label, py, itc, cash, hi]) => (
              <tr key={label}>
                <td className="border border-[#AAAAAA] px-2 py-1">{label}</td>
                <td className="border border-[#AAAAAA] px-1">
                  <input
                    className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                    value={String((d as Record<string, unknown>)[py] ?? '')}
                    onChange={(e) => setn(py as keyof Gstr3bSummaryRow, e.target.value)}
                  />
                </td>
                <td className="border border-[#AAAAAA] px-1">
                  <input
                    className="w-full border border-[#AAAAAA] px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                    value={String((d as Record<string, unknown>)[itc] ?? '')}
                    onChange={(e) => setn(itc as keyof Gstr3bSummaryRow, e.target.value)}
                  />
                </td>
                <td
                  className="border border-[#AAAAAA] px-1"
                  style={{ background: hi ? '#FFEB3B' : undefined }}
                >
                  <input
                    className="w-full border border-[#AAAAAA] bg-transparent px-1 text-right tabular-nums outline-none focus:bg-[#FFEB3B]"
                    value={String((d as Record<string, unknown>)[cash] ?? '')}
                    onChange={(e) => setn(cash as keyof Gstr3bSummaryRow, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] text-[#555555]">
          Tax payable = output − ITC (non-negative). Cash columns highlight when &gt; 0. Values are editable before
          filing; Compute refreshes from GSTR-1 + 2B.
        </p>
      </div>
    </div>
  );
}
