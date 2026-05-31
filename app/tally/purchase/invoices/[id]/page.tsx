'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePostPIMutation, usePurchaseInvoiceQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function PurchaseInvoiceDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data, isLoading, refetch } = usePurchaseInvoiceQuery(id || null);
  const postPi = usePostPIMutation();
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Post Vch', shortcut: 'Ctrl+A' },
      { label: 'Purchase', shortcut: 'F9' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useEffect(() => {
    const fn = async () => {
      if (!id || !data?.invoice) {
        playTallyError();
        return;
      }
      const inv = data.invoice as Record<string, unknown>;
      if (inv.voucher_id) {
        playTallyError();
        return;
      }
      try {
        await postPi.mutateAsync(id);
        playTallyAccept();
        await refetch();
      } catch {
        playTallyError();
      }
    };
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, [id, data?.invoice, postPi, refetch]);

  if (!id || isLoading) return <div className="p-3 text-[13px]">Loading…</div>;
  if (!data?.invoice) return <div className="p-3 text-[13px]">Not found.</div>;

  const inv = data.invoice as Record<string, unknown>;
  const items = data.items as Record<string, unknown>[];
  const sup = (inv.suppliers as { name?: string } | undefined)?.name ?? '—';

  return (
    <div className="bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        PI {String(inv.pi_number)}
      </div>
      <div className="border border-[#AAAAAA] bg-white p-2">
        <div>{sup}</div>
        <div className="tabular-nums">
          {formatTallyDate(String(inv.invoice_date))} · Due:{' '}
          {inv.due_date ? formatTallyDate(String(inv.due_date)) : '—'} · {String(inv.status)}
        </div>
        {inv.voucher_id ? (
          <p className="text-[11px] text-[#1B5E20]">Voucher posted.</p>
        ) : (
          <p className="text-[11px] text-[#666666]">Ctrl+A: Post PUR voucher</p>
        )}
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={String(it.id)}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{String(it.product_name)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(Number(it.amount) || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-right tabular-nums font-bold text-[#1B5E20]">
          Total {formatTallyAmount(Number(inv.total_amount) || 0)}
        </div>
        <Link href="/tally/purchase/invoices" className="underline">
          List
        </Link>
      </div>
    </div>
  );
}
