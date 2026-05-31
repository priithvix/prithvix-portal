'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { useHsnSummary, useRegenerateHsn } from '@/hooks/use-gst';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { describeHsn } from '@/lib/gst/hsn-codes';
import { formatTallyAmount } from '@/lib/tally-format';

export default function HsnSummaryPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId;
  const { selectedPeriod, openPeriodSelector } = useGstPeriodContext();
  const setButtons = useTallySetButtons();
  const [dir, setDir] = useState<'OUTWARD' | 'INWARD'>('OUTWARD');

  const { data: rows = [], isLoading } = useHsnSummary(dealerRowId, selectedPeriod, dir);
  const regen = useRegenerateHsn(dealerRowId, selectedPeriod);

  const totals = useMemo(() => {
    const q = rows.reduce((a, r) => a + Number(r.total_quantity), 0);
    const t = rows.reduce((a, r) => a + Number(r.taxable_value), 0);
    const tax = rows.reduce((a, r) => a + r.igst + r.cgst + r.sgst, 0);
    return { q, t, tax };
  }, [rows]);

  const exportCsv = () => {
    const header = ['HSN','Description','UOM','Quantity','Taxable Value','IGST','CGST','SGST','Cess'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.hsn_code,
          `"${(r.description ?? describeHsn(r.hsn_code)).replace(/"/g, '""')}"`,
          r.uom,
          r.total_quantity,
          r.taxable_value,
          r.igst,
          r.cgst,
          r.sgst,
          r.cess,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HSN_${dir}_${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriodSelector },
      { label: 'Outward', shortcut: 'Alt+O', onClick: () => setDir('OUTWARD') },
      { label: 'Inward', shortcut: 'Alt+I', onClick: () => setDir('INWARD') },
      { label: 'Export', shortcut: 'Alt+E', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriodSelector, rows, selectedPeriod, dir]);

  useHotkeys('alt+o', () => setDir('OUTWARD'), { enableOnFormTags: true });
  useHotkeys('alt+i', () => setDir('INWARD'), { enableOnFormTags: true });
  useHotkeys('alt+e', exportCsv, { enableOnFormTags: true }, [rows, dir, selectedPeriod]);

  return (
    <div className="text-[13px] text-black">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] px-2 py-1 text-white"
        style={{ background: '#1B5E20' }}
      >
        <span className="font-semibold">HSN-wise Summary</span>
        <span className="tabular-nums">Period: {selectedPeriod}</span>
        <span className="ml-auto text-[11px]">F2: Period</span>
      </div>
      <div className="m-3 border border-[#AAAAAA] bg-white p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="mr-2 text-[12px]">Direction:</span>
          <button
            type="button"
            className="border px-2 py-[2px] text-[12px]"
            style={{
              borderColor: '#AAAAAA',
              background: dir === 'OUTWARD' ? '#1B5E20' : '#FFF8E7',
              color: dir === 'OUTWARD' ? '#FFFFFF' : '#000000',
            }}
            onClick={() => setDir('OUTWARD')}
          >
            Outward
          </button>
          <button
            type="button"
            className="border px-2 py-[2px] text-[12px]"
            style={{
              borderColor: '#AAAAAA',
              background: dir === 'INWARD' ? '#1B5E20' : '#FFF8E7',
              color: dir === 'INWARD' ? '#FFFFFF' : '#000000',
            }}
            onClick={() => setDir('INWARD')}
          >
            Inward
          </button>
        </div>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            className="border border-[#AAAAAA] px-3 py-1 hover:bg-[#FFEB3B]"
            onClick={() =>
              regen.mutate(dir, {
                onError: (e: Error) => console.error(e.message),
              })
            }
            disabled={regen.isPending}
          >
            Regenerate
          </button>
          <button type="button" className="border border-[#AAAAAA] px-3 py-1" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        {isLoading ? <p>Loading…</p> : null}
        <div className="max-h-[480px] overflow-auto">
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
                <tr key={`${r.hsn_code}-${r.id}`}>
                  <td className="border border-[#AAAAAA] px-2 py-1 font-mono">{r.hsn_code}</td>
                  <td className="border border-[#AAAAAA] px-2 py-1">
                    {r.description ?? describeHsn(r.hsn_code)}
                  </td>
                  <td className="border border-[#AAAAAA] px-2 py-1">{r.uom}</td>
                  <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                    {Number(r.total_quantity).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
                  {totals.q.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                  {formatTallyAmount(totals.t)}
                </td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                  {formatTallyAmount(totals.tax)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
