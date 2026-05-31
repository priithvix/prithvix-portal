'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSupplierLedgerQuery, useSuppliersQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { TallySupplierPicker } from '@/components/tally/TallySupplierPicker';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';

export const dynamic = 'force-dynamic';

export default function SupplierLedgerPage() {
  return (
    <Suspense fallback={<div className="bg-[#FFF8E7] p-4 text-[13px]">Loading…</div>}>
      <SupplierLedgerInner />
    </Suspense>
  );
}

function SupplierLedgerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: suppliers = [] } = useSuppliersQuery();
  const setButtons = useTallySetButtons();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [from] = useState('2025-04-01');
  const [to] = useState('2026-03-31');
  const { data: ledger, isLoading } = useSupplierLedgerQuery(supplierId, from, to);

  useEffect(() => {
    const q = searchParams.get('supplier');
    if (q && !supplierId) setSupplierId(q);
  }, [searchParams, supplierId]);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Date', shortcut: 'F2' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const rows = ledger?.rows ?? [];

  const closingLabel = useMemo(() => {
    if (!ledger) return '—';
    return `${formatTallyAmount(ledger.closing)} ${ledger.openingType === 'CR' ? 'Cr' : 'Dr'}`;
  }, [ledger]);

  useHotkeys(
    'enter',
    () => {
      /* drill-down: open first row voucher if any */
      const r = rows[0];
      if (r?.pi_id) router.push(`/tally/purchase/invoices/${r.pi_id}`);
    },
    { enableOnFormTags: false }
  );

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Supplier Ledger
      </div>
      <div className="border border-[#AAAAAA] bg-white p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#1B5E20]">Supplier:</span>
          <TallySupplierPicker
            suppliers={suppliers}
            valueId={supplierId}
            onChange={(s) => {
              setSupplierId(s?.id ?? null);
            }}
          />
        </div>
        <div className="mb-2 text-[11px] tabular-nums text-[#666666]">
          Period {formatTallyDate(from)} to {formatTallyDate(to)} · F2: period (Phase A hookup)
        </div>
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Particulars</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Dr</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Cr</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{formatTallyDate(from)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">Opening Balance</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {ledger?.openingType === 'DR' ? formatTallyAmount(ledger.opening) : ''}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {ledger?.openingType === 'CR' ? formatTallyAmount(ledger.opening) : ''}
                </td>
              </tr>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="cursor-pointer hover:bg-[#FFEB3B]/40"
                  onDoubleClick={() => r.pi_id && router.push(`/tally/purchase/invoices/${r.pi_id}`)}
                >
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">
                    {formatTallyDate(r.voucher_date)}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.particulars}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {r.dr != null ? formatTallyAmount(r.dr) : ''}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {r.cr != null ? formatTallyAmount(r.cr) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-2 border-t border-[#AAAAAA] pt-2 text-right font-semibold text-[#1B5E20]">
          Closing {closingLabel}
        </div>
        <Link href="/tally/purchase" className="mt-2 inline-block underline">
          Menu
        </Link>
      </div>
    </div>
  );
}
