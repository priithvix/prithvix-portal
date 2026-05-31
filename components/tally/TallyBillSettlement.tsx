'use client';

import { useMemo, useState } from 'react';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import type { SettlementInput } from '@/lib/supabase/banking';

export type BillSettlementInvoice = {
  id: string;
  label: string;
  invoice_date: string;
  due_date: string | null;
  outstanding: number;
};

export interface TallyBillSettlementProps {
  partyType: 'FARMER' | 'SUPPLIER';
  totalAmount: number;
  invoices: BillSettlementInvoice[];
  onChange?: (settlements: SettlementInput[]) => void;
}

/** Bill-wise allocations; total settle must equal payment `totalAmount` */
export function TallyBillSettlement({ partyType, totalAmount, invoices, onChange }: TallyBillSettlementProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const z: Record<string, string> = {};
    return z;
  });

  const settlements: SettlementInput[] = useMemo(() => {
    return invoices.flatMap((inv) => {
      const raw = amounts[inv.id]?.trim().replace(/,/g, '') ?? '';
      const n = parseFloat(raw || '0');
      if (!n || Number.isNaN(n)) return [];
      const applied = Math.min(n, inv.outstanding);
      if (applied <= 0) return [];
      return [
        {
          invoice_id: inv.id,
          invoice_type: partyType === 'FARMER' ? 'SALE' : 'PURCHASE',
          amount: Math.round(applied * 100) / 100,
        },
      ];
    });
  }, [amounts, invoices, partyType]);

  const allocated = useMemo(() => settlements.reduce((s, x) => s + x.amount, 0), [settlements]);
  const delta = Math.round((totalAmount - allocated) * 100) / 100;

  const sync = (next: Record<string, string>) => {
    setAmounts(next);
    const settles = invoices.flatMap((inv) => {
      const raw = next[inv.id]?.trim().replace(/,/g, '') ?? '';
      const n = parseFloat(raw || '0');
      if (!n || Number.isNaN(n)) return [];
      const applied = Math.min(n, inv.outstanding);
      return applied <= 0
        ? []
        : [
            {
              invoice_id: inv.id,
              invoice_type: (partyType === 'FARMER' ? 'SALE' : 'PURCHASE') as 'SALE' | 'PURCHASE',
              amount: Math.round(applied * 100) / 100,
            },
          ];
    });
    onChange?.(settles);
  };

  const setAmt = (id: string, v: string) => sync({ ...amounts, [id]: v });

  return (
    <div className="border border-[#AAAAAA] bg-white text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F0F0F0]">
            <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">{partyType === 'FARMER' ? 'Sale' : 'Invoice'}</th>
            <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Date</th>
            <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Due</th>
            <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Outstanding</th>
            <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Settle</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="border border-[#AAAAAA] px-1 py-[2px]">{inv.label}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{formatTallyDate(inv.invoice_date)}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{inv.due_date ? formatTallyDate(inv.due_date) : '—'}</td>
              <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(inv.outstanding)}</td>
              <td className="border border-[#AAAAAA] p-0 text-right tabular-nums">
                <input
                  type="text"
                  inputMode="decimal"
                  className="h-[26px] w-full border-none bg-transparent px-1 py-0 text-right outline-none focus:bg-[#FFEB3B]"
                  aria-label={`Settle for ${inv.label}`}
                  value={amounts[inv.id] ?? ''}
                  onChange={(e) => setAmt(inv.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`flex justify-end border border-t-[#AAAAAA] px-2 py-1 tabular-nums ${delta !== 0 ? 'text-[#D32F2F]' : 'text-[#1B5E20]'}`}>
        Unallocated: ₹{formatTallyAmount(delta)}
      </div>
      <p className="border-t border-[#AAAAAA] px-2 py-1 text-[11px] text-[#555]">Totals must tie to payment ₹{formatTallyAmount(totalAmount)}</p>
    </div>
  );
}
