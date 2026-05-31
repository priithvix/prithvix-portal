'use client';

import { useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import Link from 'next/link';

const MENU = [
  { hotkey: 'S', label: 'Stock Summary', sub: 'Quantity, value, WAC & FIFO cost per SKU', href: '/tally/stock-summary', color: '#1B5E20' },
  { hotkey: 'I', label: 'Stock Items Master', sub: 'Create & alter products, SKUs, HSN, reorder levels', href: '/tally/inventory/items', color: '#1565C0' },
  { hotkey: 'B', label: 'Batch Tracking', sub: 'Lot-wise stock, expiry dates, near-expiry alerts', href: '/tally/inventory/batches', color: '#4527A0' },
  { hotkey: 'J', label: 'Stock Journal', sub: 'Adjustments, write-offs, transfers between locations', href: '/tally/inventory/stock-journal', color: '#00695C' },
  { hotkey: 'P', label: 'Physical Verification', sub: 'Stocktaking count sheet & variance report', href: '/tally/inventory/physical', color: '#E65100' },
  { hotkey: 'R', label: 'Reorder Management', sub: 'Items below reorder level, auto-generate PO', href: '/tally/inventory/reorder', color: '#C62828' },
  { hotkey: 'G', label: 'GRN (Goods Receipt)', sub: 'Record inward stock from purchase invoices', href: '/tally/purchase/grn', color: '#2E7D32' },
  { hotkey: 'O', label: 'Purchase Orders', sub: 'Raise POs to suppliers', href: '/tally/purchase/po', color: '#1565C0' },
];

export default function InventoryGatewayPage() {
  const router = useRouter();
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();

  /* Quick stats */
  const statsQ = useQuery({
    queryKey: ['inv-gateway-stats', dealerId],
    enabled: !!dealerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [skuRes, balRes, batchRes] = await Promise.all([
        supabase.from('product_skus').select('id', { count: 'exact', head: true }).eq('dealer_id', dealerId),
        supabase.from('sku_stock_balances').select('sku_id, quantity_base').eq('dealer_id', dealerId),
        supabase.from('product_batches').select('id, expiry_date').eq('dealer_id', dealerId).not('expiry_date', 'is', null),
      ]);
      const balances = (balRes.data ?? []) as { sku_id: string; quantity_base: number }[];
      const nilStock = balances.filter((b) => Number(b.quantity_base) <= 0).length;
      const today = new Date();
      const in30 = new Date(today); in30.setDate(today.getDate() + 30);
      const expiring = (batchRes.data ?? []).filter((b: { expiry_date: string }) => {
        const d = new Date(b.expiry_date);
        return d >= today && d <= in30;
      }).length;
      return {
        totalSkus: skuRes.count ?? 0,
        nilStock,
        expiring,
      };
    },
  });

  const s = statsQ.data;

  /* Keyboard nav */
  MENU.forEach(({ hotkey, href }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkeys(hotkey.toLowerCase(), () => router.push(href), { enabled: true });
  });
  useHotkeys('escape', () => router.push('/tally'));

  useEffect(() => {
    setButtons([
      { label: 'Stock Summary', shortcut: 'S', onClick: () => router.push('/tally/stock-summary') },
      { label: 'Items Master', shortcut: 'I', onClick: () => router.push('/tally/inventory/items') },
      { label: 'Reorder', shortcut: 'R', onClick: () => router.push('/tally/inventory/reorder') },
      { label: 'Gateway', shortcut: 'Esc', onClick: () => router.push('/tally') },
    ]);
    return () => setButtons([]);
  }, [setButtons, router]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]">
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Inventory Management
      </div>

      {/* Quick stats */}
      {s && (
        <div className="flex gap-6 border-b border-[#DDDDDD] bg-white px-4 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#888]">Total SKUs</span>
            <span className="text-[16px] font-bold tabular-nums text-[#1B5E20]">{s.totalSkus}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#888]">Nil Stock</span>
            <span className={`text-[16px] font-bold tabular-nums ${s.nilStock > 0 ? 'text-[#B71C1C]' : 'text-[#1B5E20]'}`}>{s.nilStock}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-[#888]">Expiring ≤30d</span>
            <span className={`text-[16px] font-bold tabular-nums ${s.expiring > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>{s.expiring}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/tally" className="text-[12px] text-[#0D47A1] underline">← Gateway</Link>
          </div>
        </div>
      )}

      {/* Menu grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 max-w-3xl md:grid-cols-2">
          {MENU.map((item) => (
            <Link key={item.hotkey} href={item.href}
              className="group flex items-start gap-3 border border-[#AAAAAA] bg-white p-3 hover:border-[#1B5E20] hover:bg-[#F0FFF4] transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center font-bold text-[13px] text-white"
                style={{ background: item.color }}>
                {item.hotkey}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#222] group-hover:text-[#1B5E20]">{item.label}</div>
                <div className="text-[11px] text-[#888]">{item.sub}</div>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-[#888]">Press highlighted letter key to navigate · Esc — Gateway</p>
      </div>
    </div>
  );
}
