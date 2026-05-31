'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useGRNQuery, usePostGRNMutation } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function GrnDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { data, isLoading, refetch } = useGRNQuery(id || null);
  const postMut = usePostGRNMutation();
  const setButtons = useTallySetButtons();

  useEffect(() => {
    setButtons([
      { label: 'Post', shortcut: 'Ctrl+A' },
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useEffect(() => {
    const fn = async () => {
      if (!id || data?.grn?.status !== 'DRAFT') {
        playTallyError();
        return;
      }
      try {
        await postMut.mutateAsync(id);
        playTallyAccept();
        await refetch();
      } catch {
        playTallyError();
      }
    };
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, [id, data?.grn?.status, postMut, refetch]);

  if (!id || isLoading) return <div className="p-3 text-[13px]">Loading…</div>;
  if (!data?.grn) return <div className="p-3 text-[13px]">Not found.</div>;

  const { grn, items } = data;
  const sup = (grn as { suppliers?: { name?: string } }).suppliers?.name ?? '—';

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        GRN {String(grn.grn_number)}
      </div>
      <div className="border border-[#AAAAAA] bg-white p-2">
        <div>Supplier: {sup}</div>
        <div className="tabular-nums">
          Date: {formatTallyDate(String(grn.grn_date))} · Status: {String(grn.status)}
        </div>
        {grn.status === 'DRAFT' ? (
          <p className="my-2 text-[11px] text-[#666666]">Ctrl+A: Post GRN (updates stock)</p>
        ) : null}
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Qty</th>
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
                  {formatTallyAmount(Number(it.amount) || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={`/tally/purchase/invoices/new?grn_id=${encodeURIComponent(id)}`} className="border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-1 no-underline text-black hover:bg-[#FFEB3B]">
            Create Purchase Invoice
          </Link>
          <Link href="/tally/purchase/grn" className="text-[#1B5E20] underline">
            List
          </Link>
        </div>
      </div>
    </div>
  );
}
