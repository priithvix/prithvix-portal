'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';

type BatchRow = {
  id: string;
  batch_number: string | null;
  manufacturing_date: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_type: string;
  sku_label: string;
  product_name: string;
  supplier_name: string | null;
  grn_id: string | null;
  cost_per_unit: number;
  daysToExpiry: number | null;
  expiryStatus: 'expired' | 'critical' | 'warning' | 'ok' | 'none';
};

function expiryStatus(expiry: string | null): { status: BatchRow['expiryStatus']; days: number | null } {
  if (!expiry) return { status: 'none', days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry);
  const diff = Math.floor((exp.getTime() - today.getTime()) / 86400_000);
  if (diff < 0) return { status: 'expired', days: diff };
  if (diff <= 30) return { status: 'critical', days: diff };
  if (diff <= 90) return { status: 'warning', days: diff };
  return { status: 'ok', days: diff };
}

const STATUS_STYLE: Record<BatchRow['expiryStatus'], { bg: string; fg: string; label: string }> = {
  expired: { bg: '#FFEBEE', fg: '#B71C1C', label: 'Expired' },
  critical: { bg: '#FFF3E0', fg: '#E65100', label: '≤30 days' },
  warning: { bg: '#FFFDE7', fg: '#F57F17', label: '31–90 days' },
  ok: { bg: '#E8F5E9', fg: '#1B5E20', label: 'OK' },
  none: { bg: '#F5F5F5', fg: '#888', label: 'No Expiry' },
};

export default function BatchesPage() {
  const { session, dealer } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();

  const [filterStatus, setFilterStatus] = useState<'all' | BatchRow['expiryStatus']>('all');
  const [search, setSearch] = useState('');

  const batchesQ = useQuery({
    queryKey: ['batch-tracking', dealerId],
    enabled: !!dealerId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_batches')
        .select(`
          id,
          batch_number,
          manufacturing_date,
          expiry_date,
          quantity,
          cost_per_unit,
          grn_id,
          product_skus(id, display_label, unit_type, product_master(product_name)),
          grns(grn_number, suppliers(name))
        `)
        .eq('dealer_id', dealerId)
        .order('expiry_date', { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((b: Record<string, unknown>) => {
        const sku = b.product_skus as { display_label?: string; unit_type?: string; product_master?: { product_name?: string } } | null;
        const grn = b.grns as { grn_number?: string; suppliers?: { name?: string } | null } | null;
        const expiry = b.expiry_date as string | null;
        const { status, days } = expiryStatus(expiry);
        return {
          id: String(b.id ?? ''),
          batch_number: b.batch_number as string | null,
          manufacturing_date: b.manufacturing_date as string | null,
          expiry_date: expiry,
          quantity: Number(b.quantity ?? 0),
          unit_type: sku?.unit_type ?? 'unit',
          sku_label: sku?.display_label ?? '—',
          product_name: sku?.product_master?.product_name ?? '—',
          supplier_name: grn?.suppliers?.name ?? null,
          grn_id: b.grn_id as string | null,
          cost_per_unit: Number(b.cost_per_unit ?? 0),
          daysToExpiry: days,
          expiryStatus: status,
        } as BatchRow;
      });
    },
  });

  const batches = batchesQ.data ?? [];

  const filtered = useMemo(() => {
    let r = batches;
    if (filterStatus !== 'all') r = r.filter((b) => b.expiryStatus === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((b) => b.sku_label.toLowerCase().includes(q) || b.product_name.toLowerCase().includes(q) || (b.batch_number ?? '').toLowerCase().includes(q));
    }
    return r;
  }, [batches, filterStatus, search]);

  /* Stats */
  const stats = useMemo(() => ({
    expired: batches.filter((b) => b.expiryStatus === 'expired').length,
    critical: batches.filter((b) => b.expiryStatus === 'critical').length,
    warning: batches.filter((b) => b.expiryStatus === 'warning').length,
    ok: batches.filter((b) => b.expiryStatus === 'ok').length,
    totalValue: batches.reduce((s, b) => s + b.quantity * b.cost_per_unit, 0),
  }), [batches]);

  const exportExcel = () => {
    downloadWorkbook(workbookFromSheets([{
      name: 'Batch Register',
      rows: filtered.map((b) => ({
        'Product': b.product_name,
        'SKU': b.sku_label,
        'Batch No': b.batch_number ?? '',
        'Qty': b.quantity,
        'Unit': b.unit_type,
        'Mfg Date': b.manufacturing_date ? fmtDate(b.manufacturing_date) : '',
        'Expiry Date': b.expiry_date ? fmtDate(b.expiry_date) : '',
        'Days to Expiry': b.daysToExpiry ?? '',
        'Status': STATUS_STYLE[b.expiryStatus].label,
        'Cost/Unit': b.cost_per_unit,
        'Total Value': b.quantity * b.cost_per_unit,
        'Supplier': b.supplier_name ?? '',
      })),
    }]), `BatchRegister_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useEffect(() => {
    setButtons([
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Back', shortcut: 'Esc', onClick: () => history.back() },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Batch Tracking & Expiry Management
      </div>
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px]">
        <Link href="/tally/inventory" className="text-[#0D47A1] underline">Inventory</Link>
        <span>›</span><span className="font-semibold">Batch Tracking</span>
        <span className="ml-auto text-[#888]">Alt+E Export</span>
      </div>

      {/* Alert banner */}
      {(stats.expired > 0 || stats.critical > 0) && (
        <div className="mx-3 mt-2 border border-[#B71C1C] bg-[#FFEBEE] px-3 py-2 text-[12px] text-[#B71C1C] font-semibold">
          ⚠ {stats.expired > 0 ? `${stats.expired} batch(es) EXPIRED — isolate immediately. ` : ''}
          {stats.critical > 0 ? `${stats.critical} batch(es) expiring within 30 days.` : ''}
        </div>
      )}

      {/* KPI pills */}
      <div className="flex flex-wrap gap-2 border-b border-[#DDDDDD] bg-white px-3 py-2">
        {(['all', 'expired', 'critical', 'warning', 'ok', 'none'] as const).map((s) => {
          const count = s === 'all' ? batches.length : batches.filter((b) => b.expiryStatus === s).length;
          const style = s === 'all' ? { bg: '#1B5E20', fg: '#FFF' } : STATUS_STYLE[s];
          return (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className="px-3 py-[3px] text-[11px] font-semibold"
              style={{
                background: filterStatus === s ? style.bg : '#F5F5F5',
                color: filterStatus === s ? style.fg : '#333',
                border: `1px solid ${filterStatus === s ? style.bg : '#AAAAAA'}`,
                borderRadius: 0,
              }}>
              {s === 'all' ? 'All' : STATUS_STYLE[s].label} ({count})
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          <input type="text" placeholder="Search product / batch…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:border-[#1B5E20] focus:outline-none"
            style={{ borderRadius: 0, minWidth: 180 }} />
          <span className="text-[11px] text-[#888]">Stock value: {formatTallyAmount(stats.totalValue)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        {batchesQ.isFetching ? (
          <div className="p-6 text-center text-[#888]">Loading batches…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                {['Product / SKU', 'Batch No', 'Qty', 'Mfg Date', 'Expiry Date', 'Days Left', 'Status', 'Cost/Unit', 'Value', 'Supplier'].map((h) => (
                  <th key={h} className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-[#888]">No batches found. Batches are created automatically when GRNs are received.</td></tr>
              ) : filtered.map((b, i) => {
                const st = STATUS_STYLE[b.expiryStatus];
                return (
                  <tr key={b.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                    className="border-b border-[#EEEEEE] hover:bg-[#F0F4FF]">
                    <td className="border border-[#EEEEEE] px-2 py-[3px]">
                      <div className="text-[12px] font-medium">{b.sku_label}</div>
                      <div className="text-[10px] text-[#888]">{b.product_name}</div>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] font-mono">{b.batch_number ?? '—'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] tabular-nums font-semibold">
                      {b.quantity.toFixed(2)} <span className="text-[10px] text-[#888]">{b.unit_type}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] tabular-nums">{b.manufacturing_date ? fmtDate(b.manufacturing_date) : '—'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] tabular-nums font-semibold">{b.expiry_date ? fmtDate(b.expiry_date) : '—'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center text-[12px] tabular-nums font-bold"
                      style={{ color: b.expiryStatus === 'expired' ? '#B71C1C' : b.expiryStatus === 'critical' ? '#E65100' : '#333' }}>
                      {b.daysToExpiry == null ? '—' : b.daysToExpiry < 0 ? `${Math.abs(b.daysToExpiry)}d ago` : `${b.daysToExpiry}d`}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <span className="inline-block px-2 py-[1px] text-[10px] font-bold"
                        style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(b.cost_per_unit)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold">{formatTallyAmount(b.quantity * b.cost_per_unit)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#666]">{b.supplier_name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                <td colSpan={8} className="px-2 py-[4px] text-right text-[12px] font-semibold">TOTAL VALUE ({filtered.length} batches)</td>
                <td className="px-2 py-[4px] text-right text-[13px] font-bold tabular-nums text-[#1B5E20]">
                  {formatTallyAmount(filtered.reduce((s, b) => s + b.quantity * b.cost_per_unit, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="px-3 pb-2 text-[11px] text-[#888]">{dealer?.company_name} · Batch register · Alt+E Export</div>
    </div>
  );
}
