'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePurchaseOrderQuery, useUpdatePOStatusMutation } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { data, isLoading } = usePurchaseOrderQuery(id || null);
  const updateStatus = useUpdatePOStatusMutation();
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Send', shortcut: 'Alt+S' },
      { label: 'GRN', shortcut: 'Alt+G' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useHotkeys(
    'alt+s',
    async (e) => {
      e.preventDefault();
      if (!data?.order || data.order.status !== 'DRAFT') {
        playTallyError();
        return;
      }
      try {
        await updateStatus.mutateAsync({ id: data.order.id, status: 'SENT' });
        playTallyAccept();
        router.refresh();
      } catch {
        playTallyError();
      }
    },
    { enableOnFormTags: true }
  );

  if (!id || isLoading) {
    return <div className="p-3 text-[13px]">Loading…</div>;
  }

  if (!data) {
    return <div className="p-3 text-[13px]">Not found.</div>;
  }

  const { order, items } = data;
  const sup = (order as { suppliers?: { name?: string } }).suppliers?.name ?? '—';

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Purchase Order {order.po_number}
      </div>
      <div className="flex flex-col gap-2 border border-[#AAAAAA] bg-white p-2">
        <div>
          <span className="font-semibold text-[#1B5E20]">Supplier:</span> {sup}
        </div>
        <div className="tabular-nums">
          Date: {formatTallyDate(order.po_date)} · Status: {order.status}
        </div>
        {order.status === 'DRAFT' ? (
          <p className="text-[11px] text-[#666666]">Alt+S: mark as SENT</p>
        ) : null}

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Qty</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items as Record<string, unknown>[]).map((it) => (
              <tr key={String(it.id)}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{String(it.product_name)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(Number(it.quantity) || 0)}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(Number(it.rate) || 0)}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(Number(it.amount) || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/tally/purchase/grn/new?po_id=${encodeURIComponent(id)}`}
            className="inline-block border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-1 no-underline text-black hover:bg-[#FFEB3B]"
          >
            Create GRN
          </Link>
          <Link href="/tally/purchase/po" className="text-[#1B5E20] underline">
            Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}
