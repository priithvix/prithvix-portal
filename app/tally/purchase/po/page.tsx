'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePurchaseOrdersQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

export default function PurchaseOrderListPage() {
  const router = useRouter();
  const { data: rows = [], isLoading } = usePurchaseOrdersQuery();
  const setButtons = useTallySetButtons();
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'GRN', shortcut: 'Alt+G' },
      { label: 'Date', shortcut: 'F2' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useHotkeys('n', () => router.push('/tally/purchase/po/new'), { enableOnFormTags: false });
  useHotkeys(
    'g',
    () => {
      const r = rows[sel];
      if (r) router.push(`/tally/purchase/grn/new?po_id=${encodeURIComponent(r.id)}`);
    },
    { enableOnFormTags: false }
  );
  useHotkeys(
    'enter',
    () => {
      const r = rows[sel];
      if (r) router.push(`/tally/purchase/po/${r.id}`);
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

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div
        className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20' }}
      >
        Purchase Orders
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] bg-white">
        {isLoading ? (
          <div className="p-3">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  PO Number
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  Supplier
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-right font-bold text-[#1B5E20]">
                  Amount
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const sup = (r as { suppliers?: { name?: string } }).suppliers?.name ?? '—';
                const selected = i === sel;
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer tabular-nums"
                    style={
                      selected
                        ? { background: '#0D47A1', color: '#FFFFFF' }
                        : { background: 'transparent', color: '#000000' }
                    }
                    onClick={() => setSel(i)}
                  >
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{r.po_number}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{sup}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">
                      {formatTallyDate(r.po_date)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px] text-right">
                      {formatTallyAmount(Number(r.total_amount) || 0)}
                    </td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-[#AAAAAA] px-2 py-1 text-[11px] text-[#555555]">
        N: New · Enter: Open · G: New GRN ·{' '}
        <Link href="/tally/purchase" className="underline">
          Menu
        </Link>
      </div>
    </div>
  );
}
