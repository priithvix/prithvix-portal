'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useGRNsQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

export default function GrnListPage() {
  const router = useRouter();
  const { data: rows = [], isLoading } = useGRNsQuery();
  const setButtons = useTallySetButtons();
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'GRN', shortcut: 'Alt+G' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useHotkeys('n', () => router.push('/tally/purchase/grn/new'), { enableOnFormTags: false });
  useHotkeys(
    'enter',
    () => {
      const r = rows[sel] as { id?: string } | undefined;
      if (r?.id) router.push(`/tally/purchase/grn/${r.id}`);
    },
    { enableOnFormTags: false }
  );
  useHotkeys(
    'arrowup',
    (e) => {
      e.preventDefault();
      setSel((i) => Math.max(0, i - 1));
    },
    { enableOnFormTags: false }
  );
  useHotkeys(
    'arrowdown',
    (e) => {
      e.preventDefault();
      setSel((i) => Math.min(Math.max(0, rows.length - 1), i + 1));
    },
    { enableOnFormTags: false }
  );

  const list = rows as Record<string, unknown>[];

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Goods Receipt Notes
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] bg-white">
        {isLoading ? (
          <div className="p-3">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">GRN No</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">Supplier</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-right font-bold text-[#1B5E20]">Amount</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => {
                const sup = (r.suppliers as { name?: string } | null)?.name ?? '—';
                const selected = i === sel;
                return (
                  <tr
                    key={String(r.id)}
                    className="cursor-pointer tabular-nums"
                    style={
                      selected
                        ? { background: '#0D47A1', color: '#FFFFFF' }
                        : { background: 'transparent', color: '#000000' }
                    }
                    onClick={() => setSel(i)}
                  >
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{String(r.grn_number)}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{sup}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">
                      {formatTallyDate(String(r.grn_date))}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px] text-right">
                      {formatTallyAmount(Number(r.total_amount) || 0)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{String(r.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-[#AAAAAA] px-2 py-1 text-[11px]">
        N: New · Enter: Open ·{' '}
        <Link href="/tally/purchase" className="underline">
          Menu
        </Link>
      </div>
    </div>
  );
}
