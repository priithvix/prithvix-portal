'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSuppliersQuery, useSupplierUnpaidMapQuery, useDeleteSupplierMutation } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount } from '@/lib/tally-format';
import { playTallyError } from '@/lib/tally-sounds';

export default function SuppliersListPage() {
  const router = useRouter();
  const { data: suppliers = [], isLoading } = useSuppliersQuery();
  const { data: unpaid = {} } = useSupplierUnpaidMapQuery();
  const delMut = useDeleteSupplierMutation();
  const setButtons = useTallySetButtons();
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setButtons([
      { label: 'Create', shortcut: 'C' },
      { label: 'Alter', shortcut: 'A' },
      { label: 'Delete', shortcut: 'D' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useEffect(() => {
    if (suppliers.length && sel >= suppliers.length) setSel(Math.max(0, suppliers.length - 1));
  }, [suppliers.length, sel]);

  const goAlter = useCallback(() => {
    const s = suppliers[sel];
    if (s) router.push(`/tally/purchase/suppliers/${s.id}`);
  }, [router, suppliers, sel]);

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
      setSel((i) => Math.min(Math.max(0, suppliers.length - 1), i + 1));
    },
    { enableOnFormTags: false }
  );
  useHotkeys('enter', goAlter, { enableOnFormTags: false });
  useHotkeys(
    'c',
    () => router.push('/tally/purchase/suppliers/new'),
    { enableOnFormTags: false }
  );
  useHotkeys(
    'a',
    goAlter,
    { enableOnFormTags: false }
  );
  useHotkeys(
    'd',
    () => {
      const s = suppliers[sel];
      if (!s) return;
      if (!confirm(`Delete supplier ${s.name}?`)) return;
      void delMut.mutateAsync(s.id).catch(() => playTallyError());
    },
    { enableOnFormTags: false }
  );

  return (
    <div className="flex min-h-0 flex-col text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div
        className="border-b border-[#0D3D0F] py-[5px] text-center text-[13px] font-semibold text-white"
        style={{ background: '#1B5E20' }}
      >
        List of Suppliers
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] bg-[#FFF8E7]">
        {isLoading ? (
          <div className="p-4 text-[#666666]">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  No.
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  Supplier Name
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  GSTIN
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left font-bold text-[#1B5E20]">
                  City
                </th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-right font-bold text-[#1B5E20]">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s, i) => {
                const bal = unpaid[s.id];
                const selected = i === sel;
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer tabular-nums"
                    style={
                      selected
                        ? { background: '#0D47A1', color: '#FFFFFF' }
                        : { background: 'transparent', color: '#000000' }
                    }
                    onClick={() => setSel(i)}
                  >
                    <td className="border border-[#AAAAAA] px-2 py-[3px] text-right">{i + 1}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{s.name}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{s.gstin ?? '—'}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px]">{s.city ?? '—'}</td>
                    <td className="border border-[#AAAAAA] px-2 py-[3px] text-right">
                      {bal != null && bal > 0 ? `₹${formatTallyAmount(bal)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-[#AAAAAA] px-2 py-1 text-[11px] text-[#555555]">
        C: Create · A: Alter · D: Delete · Esc: Back ·{' '}
        <Link href="/tally/purchase" className="underline">
          Purchase menu
        </Link>
      </div>
    </div>
  );
}
