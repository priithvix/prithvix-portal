'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePurchaseInvoicesQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

function isOverdue(dueRaw: string | null | undefined): boolean {
  if (!dueRaw) return false;
  const d = new Date(dueRaw);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d < t;
}

export default function PurchaseInvoicesListPage() {
  const router = useRouter();
  const { data: rows = [], isLoading } = usePurchaseInvoicesQuery();
  const setButtons = useTallySetButtons();
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Debit Note', shortcut: 'Ctrl+F9' },
      { label: 'Date', shortcut: 'F2' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useHotkeys('n', () => router.push('/tally/purchase/invoices/new'), { enableOnFormTags: false });
  useHotkeys(
    'enter',
    () => {
      const r = rows[sel] as { id?: string } | undefined;
      if (r?.id) router.push(`/tally/purchase/invoices/${r.id}`);
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
        Purchase Invoices
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] bg-white">
        {isLoading ? (
          <div className="p-3">Loading…</div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">PI No</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Supplier</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Due</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Total</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Balance</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">St</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => {
                const sup = (r.suppliers as { name?: string } | null)?.name ?? '—';
                const selected = i === sel;
                const overdue =
                  isOverdue(r.due_date as string) &&
                  (r.status === 'UNPAID' || r.status === 'PARTIAL');
                return (
                  <tr
                    key={String(r.id)}
                    className="cursor-pointer tabular-nums"
                    style={
                      selected
                        ? { background: '#0D47A1', color: '#FFFFFF' }
                        : overdue
                          ? { color: '#C62828', background: 'transparent' }
                          : { color: '#000000', background: 'transparent' }
                    }
                    onClick={() => setSel(i)}
                  >
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{String(r.pi_number)}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{sup}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">
                      {formatTallyDate(String(r.invoice_date))}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">
                      {r.due_date ? formatTallyDate(String(r.due_date)) : '—'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">
                      {formatTallyAmount(Number(r.total_amount) || 0)}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">
                      {formatTallyAmount(Number(r.balance_due) || 0)}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">
                      {r.status === 'PAID' ? <span className="text-[#888888]">PAID</span> : String(r.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-[#AAAAAA] px-2 py-1 text-[11px]">
        N: New · Enter: Open ·{' '}
        <Link className="underline" href="/tally/purchase">
          Menu
        </Link>
      </div>
    </div>
  );
}
