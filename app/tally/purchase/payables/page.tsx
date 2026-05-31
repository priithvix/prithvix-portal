'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePayablesQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

export default function PayablesPage() {
  const router = useRouter();
  const asOn = useMemo(() => new Date(), []);
  const { data: rows = [], isLoading } = usePayablesQuery(asOn);
  const setButtons = useTallySetButtons();
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Supplier', shortcut: 'Alt+S' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const totals = useMemo(() => {
    let a = 0,
      b = 0,
      c = 0,
      d = 0;
    for (const r of rows) {
      a += r.b0_30;
      b += r.b31_60;
      c += r.b61_90;
      d += r.b90p;
    }
    return { a, b, c, d, all: a + b + c + d };
  }, [rows]);

  useHotkeys(
    'enter',
    () => {
      const r = rows[sel];
      if (r) router.push(`/tally/purchase/supplier-ledger?supplier=${encodeURIComponent(r.supplier_id)}`);
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
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Payables Dashboard
      </div>
      <div className="border border-[#AAAAAA] bg-white p-2">
        <div className="mb-2 tabular-nums">As on {formatTallyDate(asOn)}</div>
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Supplier</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">0-30</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">31-60</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">61-90</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">90+</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const selected = i === sel;
                return (
                  <tr
                    key={r.supplier_id}
                    className="cursor-pointer tabular-nums"
                    style={
                      selected
                        ? { background: '#0D47A1', color: '#FFFFFF' }
                        : { background: 'transparent', color: '#000000' }
                    }
                    onClick={() => setSel(i)}
                  >
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.supplier_name}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">
                      {r.b0_30 ? formatTallyAmount(r.b0_30) : '—'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">
                      {r.b31_60 ? formatTallyAmount(r.b31_60) : '—'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">
                      {r.b61_90 ? formatTallyAmount(r.b61_90) : '—'}
                    </td>
                    <td
                      className="border border-[#AAAAAA] px-1 py-[2px] text-right font-medium"
                      style={r.b90p > 0 ? { color: selected ? '#FFFFFF' : '#C62828' } : undefined}
                    >
                      {r.b90p ? formatTallyAmount(r.b90p) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#F9F9F9] font-semibold">
                <td className="border border-[#AAAAAA] px-1 py-[2px]">TOTAL</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{formatTallyAmount(totals.a)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{formatTallyAmount(totals.b)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right">{formatTallyAmount(totals.c)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right text-[#C62828]">
                  {formatTallyAmount(totals.d)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="mt-2 text-right font-bold text-[#1B5E20]">
          Total Outstanding ₹{formatTallyAmount(totals.all)}
        </div>
        <Link href="/tally/purchase" className="mt-2 inline-block underline">
          Menu
        </Link>
      </div>
    </div>
  );
}
