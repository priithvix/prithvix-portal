'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { fmtDate } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';

/* ─── Types ────────────────────────────────────────────────────────── */
type ReorderItem = {
  sku_id: string;
  sku_label: string;
  product_name: string;
  unit: string;
  current_qty: number;
  reorder_level: number;
  shortage: number;
  last_purchase_price: number;
  last_supplier_id: string | null;
  last_supplier_name: string | null;
  last_purchase_date: string | null;
  suggested_order_qty: number;
  selected: boolean;
};

/* ═══════════════════════════════════════════════════════════════════ */
export default function ReorderManagementPage() {
  const { session, dealer } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ReorderItem[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);

  /* ── Query ───────────────────────────────────────────────────────── */
  const reorderQ = useQuery({
    queryKey: ['reorder-mgmt', dealerId],
    enabled: !!dealerId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const [skuRes, balRes, purItemRes] = await Promise.all([
        supabase
          .from('product_skus')
          .select('id, display_label, unit_type, reorder_level, product_master(product_name)')
          .eq('dealer_id', dealerId)
          .gt('reorder_level', 0), // only SKUs with a reorder level set
        supabase
          .from('sku_stock_balances')
          .select('sku_id, quantity_base')
          .eq('dealer_id', dealerId),
        // Last purchase per SKU
        supabase
          .from('purchase_invoice_items')
          .select('sku_id, unit_price, created_at, purchase_invoices(invoice_date, supplier_id, suppliers(id, name))')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: false })
          .limit(5000),
      ]);
      if (skuRes.error) throw new Error(skuRes.error.message);

      const balMap: Record<string, number> = {};
      for (const b of (balRes.data ?? [])) {
        const r = b as { sku_id: string; quantity_base: number };
        balMap[r.sku_id] = Number(r.quantity_base ?? 0);
      }

      // Last purchase info per SKU (first match since sorted DESC)
      type PurData = {
        sku_id?: string;
        unit_price?: number;
        created_at?: string;
        purchase_invoices?: {
          invoice_date?: string;
          supplier_id?: string;
          suppliers?: { id?: string; name?: string } | null;
        } | null;
      };
      const lastPurMap: Record<string, { price: number; supplier_id: string | null; supplier_name: string | null; date: string | null }> = {};
      for (const pi of (purItemRes.data ?? [])) {
        const r = pi as PurData;
        if (!r.sku_id || lastPurMap[r.sku_id]) continue; // keep only first (most recent)
        lastPurMap[r.sku_id] = {
          price: Number(r.unit_price ?? 0),
          supplier_id: r.purchase_invoices?.suppliers?.id ?? null,
          supplier_name: r.purchase_invoices?.suppliers?.name ?? null,
          date: r.purchase_invoices?.invoice_date ?? null,
        };
      }

      return (skuRes.data ?? [])
        .map((s) => {
          const r = s as { id: string; display_label?: string | null; unit_type?: string | null; reorder_level?: number | null; product_master?: { product_name?: string } | null };
          const current_qty = balMap[r.id] ?? 0;
          const reorder_level = Number(r.reorder_level ?? 0);
          const shortage = reorder_level - current_qty; // positive means we need to order
          const lp = lastPurMap[r.id];
          // Suggest ordering 2× the reorder level (or shortage + reorder_level)
          const suggested_order_qty = Math.max(reorder_level * 2 - current_qty, reorder_level);
          return {
            sku_id: r.id,
            sku_label: r.display_label ?? r.id,
            product_name: r.product_master?.product_name ?? '—',
            unit: r.unit_type ?? 'unit',
            current_qty,
            reorder_level,
            shortage: Math.max(shortage, 0),
            last_purchase_price: lp?.price ?? 0,
            last_supplier_id: lp?.supplier_id ?? null,
            last_supplier_name: lp?.supplier_name ?? null,
            last_purchase_date: lp?.date ?? null,
            suggested_order_qty,
            selected: current_qty <= reorder_level, // auto-select below-reorder items
          } as ReorderItem;
        })
        .filter((r) => r.current_qty <= r.reorder_level); // only show items at/below reorder
    },
  });

  useEffect(() => {
    if (reorderQ.data && !rowsLoaded) {
      setRows(reorderQ.data);
      setRowsLoaded(true);
    }
  }, [reorderQ.data, rowsLoaded]);

  /* ── Computed ────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.sku_label.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q));
  }, [rows, search]);

  const selected = rows.filter((r) => r.selected);
  const totalOrderValue = selected.reduce((s, r) => s + r.suggested_order_qty * r.last_purchase_price, 0);

  const toggleSelect = (sku_id: string) => {
    setRows((prev) => prev.map((r) => r.sku_id === sku_id ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = filtered.every((r) => r.selected);
    const ids = new Set(filtered.map((r) => r.sku_id));
    setRows((prev) => prev.map((r) => ids.has(r.sku_id) ? { ...r, selected: !allSelected } : r));
  };

  const setSuggestedQty = (sku_id: string, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) {
      setRows((prev) => prev.map((r) => r.sku_id === sku_id ? { ...r, suggested_order_qty: n } : r));
    }
  };

  /* ── Generate PO ─────────────────────────────────────────────────── */
  const generatePO = () => {
    if (selected.length === 0) { alert('Select at least one item.'); return; }
    // Navigate to PO creation with items pre-filled via query params
    const items = selected.map((r) => ({
      sku_id: r.sku_id,
      sku_label: r.sku_label,
      qty: r.suggested_order_qty,
      unit_price: r.last_purchase_price,
      supplier_id: r.last_supplier_id,
    }));
    localStorage.setItem('prithvix_po_prefill', JSON.stringify(items));
    router.push('/tally/purchase/po/new?from=reorder');
  };

  /* ── Excel Export ────────────────────────────────────────────────── */
  const exportExcel = () => {
    downloadWorkbook(workbookFromSheets([{
      name: 'Reorder List',
      rows: filtered.map((r) => ({
        'SKU': r.sku_label,
        'Product': r.product_name,
        'Unit': r.unit,
        'Current Stock': r.current_qty,
        'Reorder Level': r.reorder_level,
        'Shortage': r.shortage,
        'Suggested Order Qty': r.suggested_order_qty,
        'Last Purchase Price': r.last_purchase_price,
        'Estimated Value': r.suggested_order_qty * r.last_purchase_price,
        'Last Supplier': r.last_supplier_name ?? '',
        'Last Purchase Date': r.last_purchase_date ? fmtDate(r.last_purchase_date) : '',
      })),
    }]), `ReorderList_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useHotkeys('alt+e', (ev) => { ev.preventDefault(); exportExcel(); });
  useHotkeys('escape', () => history.back());

  useEffect(() => {
    setButtons([
      { label: 'Generate PO', shortcut: 'Alt+P', onClick: generatePO },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Back', shortcut: 'Esc', onClick: () => history.back() },
    ]);
    return () => setButtons([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setButtons, selected]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Header */}
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#C62828', borderBottom: '1px solid #8E0000' }}>
        Reorder Management — Items Below Reorder Level
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px]">
        <Link href="/tally/inventory" className="text-[#0D47A1] underline">Inventory</Link>
        <span>›</span><span className="font-semibold">Reorder Management</span>
        <span className="ml-auto text-[#888]">Alt+P Generate PO · Alt+E Export</span>
      </div>

      {/* Alert banner */}
      {rows.length > 0 && (
        <div className="mx-3 mt-2 border border-[#C62828] bg-[#FFEBEE] px-3 py-2 text-[12px] font-semibold text-[#C62828]">
          ⚠ {rows.length} item{rows.length > 1 ? 's' : ''} at or below reorder level.
          {selected.length > 0 ? ` ${selected.length} selected for PO — Estimated value: ${formatTallyAmount(totalOrderValue)}` : ' Select items to generate a Purchase Order.'}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#DDDDDD] bg-white px-3 py-2 text-[11px]">
        <input type="text" placeholder="Search SKU / product…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:border-[#C62828] focus:outline-none"
          style={{ borderRadius: 0, minWidth: 200 }} />
        <span className="text-[#888]">{filtered.length} item(s) below reorder level</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={generatePO} disabled={selected.length === 0}
            className="px-3 py-[3px] text-[11px] font-bold text-white disabled:opacity-40"
            style={{ background: '#C62828', borderRadius: 0 }}>
            Generate PO ({selected.length} items) Alt+P
          </button>
          <button type="button" onClick={exportExcel}
            className="border border-[#AAAAAA] px-3 py-[3px] text-[11px] font-semibold text-[#333]"
            style={{ borderRadius: 0 }}>
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        {reorderQ.isFetching ? (
          <div className="p-6 text-center text-[#888]">Loading reorder items…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-[14px] font-semibold text-[#1B5E20]">✓ All stock levels are adequate</div>
            <div className="mt-1 text-[12px] text-[#888]">No items are at or below their reorder levels. Set reorder levels in Stock Items Master.</div>
            <Link href="/tally/inventory/items" className="mt-3 inline-block text-[12px] text-[#0D47A1] underline">
              → Go to Stock Items Master
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#C62828', color: '#FFF' }}>
                <th className="border border-[#D32F2F] px-2 py-1 text-center text-[11px]">
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every((r) => r.selected)}
                    onChange={toggleAll} />
                </th>
                {['SKU / Product', 'Current Qty', 'Reorder Level', 'Shortage', 'Suggested Order', 'Last Price', 'Est. Value', 'Last Supplier', 'Last Purchase'].map((h) => (
                  <th key={h} className="border border-[#D32F2F] px-2 py-1 text-left text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isNil = r.current_qty <= 0;
                return (
                  <tr key={r.sku_id}
                    style={{ background: r.selected ? '#FFF3E0' : isNil ? '#FFEBEE' : i % 2 === 0 ? '#FFFFFF' : '#FFF5F5' }}
                    className="border-b border-[#EEEEEE] hover:bg-[#FFF3E0] cursor-pointer"
                    onClick={() => toggleSelect(r.sku_id)}>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={r.selected} onChange={() => toggleSelect(r.sku_id)} />
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px]">
                      <div className="text-[12px] font-medium">{r.sku_label}</div>
                      <div className="text-[10px] text-[#888]">{r.product_name}</div>
                    </td>
                    <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-bold ${isNil ? 'text-[#B71C1C]' : 'text-[#E65100]'}`}>
                      {r.current_qty.toFixed(3)} <span className="text-[10px] font-normal text-[#888]">{r.unit}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[11px]">
                      {r.reorder_level.toFixed(3)} {r.unit}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold text-[#B71C1C]">
                      {r.shortage > 0 ? `${r.shortage.toFixed(3)} ${r.unit}` : 'At level'}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={r.suggested_order_qty}
                        onChange={(e) => setSuggestedQty(r.sku_id, e.target.value)}
                        className="w-20 border border-[#CCCCCC] px-1 py-[2px] text-center text-[12px] tabular-nums focus:border-[#C62828] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      />
                      <span className="ml-1 text-[10px] text-[#888]">{r.unit}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[11px]">
                      {r.last_purchase_price > 0 ? formatTallyAmount(r.last_purchase_price) : '—'}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold">
                      {r.last_purchase_price > 0 ? formatTallyAmount(r.suggested_order_qty * r.last_purchase_price) : '—'}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#666]">
                      {r.last_supplier_name ?? '—'}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] tabular-nums text-[#888]">
                      {r.last_purchase_date ? fmtDate(r.last_purchase_date) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #C62828' }}>
                <td colSpan={7} className="px-2 py-[4px] text-right text-[12px] font-semibold">
                  Selected {selected.length} of {filtered.length} items — Est. PO Value:
                </td>
                <td className="px-2 py-[4px] text-right text-[13px] font-bold tabular-nums text-[#C62828]">
                  {formatTallyAmount(totalOrderValue)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Reorder Management · Click row to select · Alt+P Generate PO · Alt+E Export
      </div>
    </div>
  );
}
