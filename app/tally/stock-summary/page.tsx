'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { fmtDate, fyDates, getFY } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload } from '@/lib/reports/tally-pdf-table';

/* ─── Types ────────────────────────────────────────────────────────── */
type StockRow = {
  skuId: string;
  label: string;
  qty: number;
  unit: string;
  costPerUnit: number;
  totalValue: number;
  lowStock: boolean;
  reorderQty: number;
};

type MovementRow = {
  date: string;
  type: 'IN' | 'OUT';
  docNo: string;
  party: string;
  qty: number;
  rate: number;
  value: number;
  balance: number;
};

type ViewMode = 'summary' | 'register';
type CostMethod = 'WAC' | 'FIFO';

/* ─── helpers ──────────────────────────────────────────────────────── */
function defaultRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  return {
    fromIso: start.toISOString().slice(0, 10),
    toIso: (today > end ? end : today).toISOString().slice(0, 10),
  };
}

const STATUS_COLORS = {
  nil: { bg: '#FFEBEE', fg: '#B71C1C', label: 'Nil Stock' },
  low: { bg: '#FFF8E1', fg: '#E65100', label: 'Low Stock' },
  ok: { bg: '#E8F5E9', fg: '#1B5E20', label: 'In Stock' },
};

function stockStatus(qty: number, reorder: number): keyof typeof STATUS_COLORS {
  if (qty <= 0) return 'nil';
  if (reorder > 0 && qty <= reorder) return 'low';
  return 'ok';
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function StockSummaryPage() {
  const { session, dealer } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();

  const [view, setView] = useState<ViewMode>('summary');
  const [costMethod, setCostMethod] = useState<CostMethod>('WAC');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'nil' | 'low' | 'ok'>('all');
  const { fromIso, toIso } = useMemo(() => defaultRange(), []);
  const [regFrom, setRegFrom] = useState(fromIso);
  const [regTo, setRegTo] = useState(toIso);

  /* ── Stock Summary Query ─────────────────────────────────────────── */
  const summaryQ = useQuery({
    queryKey: ['stock-summary-v2', dealerId],
    enabled: !!dealerId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const [skuRes, balRes, purItemRes, saleItemRes] = await Promise.all([
        supabase
          .from('product_skus')
          .select('id, display_label, unit_type, reorder_level, product_master(product_name)')
          .eq('dealer_id', dealerId),
        supabase
          .from('sku_stock_balances')
          .select('sku_id, quantity_base')
          .eq('dealer_id', dealerId),
        // Average cost per unit: latest purchase price per SKU
        supabase
          .from('purchase_invoice_items')
          .select('sku_id, unit_price, quantity')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: false })
          .limit(2000),
        // Sales volumes for fast/slow moving
        supabase
          .from('sale_items')
          .select('sku_id, quantity')
          .eq('dealer_id', dealerId)
          .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()),
      ]);

      if (skuRes.error) throw new Error(skuRes.error.message);
      if (balRes.error) throw new Error(balRes.error.message);

      const balMap: Record<string, number> = {};
      for (const b of (balRes.data ?? [])) {
        balMap[String((b as { sku_id: string }).sku_id)] =
          Number((b as { quantity_base: number }).quantity_base) || 0;
      }

      // Weighted average cost per SKU from recent purchase items
      const costMap: Record<string, { total: number; qty: number }> = {};
      for (const pi of (purItemRes.data ?? [])) {
        const r = pi as { sku_id?: string; unit_price?: number; quantity?: number };
        if (!r.sku_id) continue;
        if (!costMap[r.sku_id]) costMap[r.sku_id] = { total: 0, qty: 0 };
        costMap[r.sku_id].total += Number(r.unit_price ?? 0) * Number(r.quantity ?? 0);
        costMap[r.sku_id].qty += Number(r.quantity ?? 0);
      }

      // 90-day sale qty for fast/slow
      const saleQtyMap: Record<string, number> = {};
      for (const si of (saleItemRes.data ?? [])) {
        const r = si as { sku_id?: string; quantity?: number };
        if (r.sku_id) saleQtyMap[r.sku_id] = (saleQtyMap[r.sku_id] ?? 0) + Number(r.quantity ?? 0);
      }

      return (skuRes.data ?? []).map((s) => {
        const row = s as {
          id: string;
          display_label: string | null;
          unit_type: string | null;
          reorder_level: number | null;
          product_master: { product_name?: string } | null;
        };
        const qty = balMap[row.id] ?? 0;
        const c = costMap[row.id];
        const costPerUnit = c && c.qty > 0 ? c.total / c.qty : 0;
        const reorderQty = Number(row.reorder_level ?? 0);
        return {
          skuId: row.id,
          label: row.display_label || row.product_master?.product_name || row.id,
          qty,
          unit: row.unit_type || 'unit',
          costPerUnit,
          totalValue: qty * costPerUnit,
          lowStock: reorderQty > 0 && qty <= reorderQty,
          reorderQty,
          saleQty90d: saleQtyMap[row.id] ?? 0,
        } as StockRow & { saleQty90d: number };
      });
    },
  });

  /* ── FIFO Cost Query ────────────────────────────────────────────── */
  const fifoQ = useQuery({
    queryKey: ['stock-fifo', dealerId],
    enabled: !!dealerId && costMethod === 'FIFO',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Fetch ALL purchase inflows sorted ASC (oldest first = FIFO queue order)
      const [purRes, saleRes] = await Promise.all([
        supabase
          .from('purchase_invoice_items')
          .select('sku_id, quantity, unit_price, purchase_invoices(invoice_date)')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: true })
          .limit(20000),
        supabase
          .from('sale_items')
          .select('sku_id, quantity, sales(sale_date)')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: true })
          .limit(20000),
      ]);

      // Build FIFO queue per SKU: array of { qty, cost } layers
      type Layer = { qty: number; cost: number };
      const queues: Record<string, Layer[]> = {};

      for (const pi of (purRes.data ?? [])) {
        const r = pi as { sku_id?: string; quantity?: number; unit_price?: number };
        if (!r.sku_id) continue;
        if (!queues[r.sku_id]) queues[r.sku_id] = [];
        queues[r.sku_id].push({ qty: Number(r.quantity ?? 0), cost: Number(r.unit_price ?? 0) });
      }

      // Dequeue for each sale (FIFO)
      for (const si of (saleRes.data ?? [])) {
        const r = si as { sku_id?: string; quantity?: number };
        if (!r.sku_id) continue;
        let remaining = Number(r.quantity ?? 0);
        const q = queues[r.sku_id];
        if (!q) continue;
        while (remaining > 0 && q.length > 0) {
          const layer = q[0];
          if (layer.qty <= remaining) {
            remaining -= layer.qty;
            q.shift();
          } else {
            layer.qty -= remaining;
            remaining = 0;
          }
        }
      }

      // Remaining queue = FIFO-valued current stock
      const fifoCosts: Record<string, { qty: number; value: number }> = {};
      for (const [skuId, layers] of Object.entries(queues)) {
        let qty = 0, value = 0;
        for (const l of layers) { qty += l.qty; value += l.qty * l.cost; }
        fifoCosts[skuId] = { qty, value };
      }
      return fifoCosts;
    },
  });

  /* ── Stock Register Query (movement ledger) ──────────────────────── */
  const registerQ = useQuery({
    queryKey: ['stock-register', dealerId, selectedSku, regFrom, regTo],
    enabled: !!dealerId && !!selectedSku && view === 'register',
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [purRes, saleRes] = await Promise.all([
        supabase
          .from('purchase_invoice_items')
          .select('id, created_at, quantity, unit_price, purchase_invoices(invoice_number, invoice_date, suppliers(name))')
          .eq('dealer_id', dealerId)
          .eq('sku_id', selectedSku!)
          .gte('purchase_invoices.invoice_date', regFrom)
          .lte('purchase_invoices.invoice_date', regTo),
        supabase
          .from('sale_items')
          .select('id, quantity, unit_price, sales(invoice_number, sale_date, farmer_name)')
          .eq('dealer_id', dealerId)
          .eq('sku_id', selectedSku!)
          .gte('sales.sale_date', regFrom)
          .lte('sales.sale_date', regTo),
      ]);

      const movements: (MovementRow & { sortDate: string })[] = [];

      for (const pi of (purRes.data ?? [])) {
        const r = pi as unknown as {
          quantity: number;
          unit_price: number;
          purchase_invoices: { invoice_number: string; invoice_date: string; suppliers: { name: string } | null } | null;
        };
        if (!r.purchase_invoices) continue;
        const qty = Number(r.quantity ?? 0);
        const rate = Number(r.unit_price ?? 0);
        movements.push({
          date: r.purchase_invoices.invoice_date.slice(0, 10),
          sortDate: r.purchase_invoices.invoice_date.slice(0, 10),
          type: 'IN',
          docNo: r.purchase_invoices.invoice_number,
          party: r.purchase_invoices.suppliers?.name ?? 'Supplier',
          qty,
          rate,
          value: qty * rate,
          balance: 0, // computed below
        });
      }

      for (const si of (saleRes.data ?? [])) {
        const r = si as unknown as {
          quantity: number;
          unit_price: number;
          sales: { invoice_number: string; sale_date: string; farmer_name: string | null } | null;
        };
        if (!r.sales) continue;
        const qty = Number(r.quantity ?? 0);
        const rate = Number(r.unit_price ?? 0);
        movements.push({
          date: r.sales.sale_date.slice(0, 10),
          sortDate: r.sales.sale_date.slice(0, 10),
          type: 'OUT',
          docNo: r.sales.invoice_number,
          party: r.sales.farmer_name ?? 'Customer',
          qty,
          rate,
          value: qty * rate,
          balance: 0,
        });
      }

      movements.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

      // Compute running balance
      let bal = 0;
      for (const m of movements) {
        if (m.type === 'IN') bal += m.qty;
        else bal -= m.qty;
        m.balance = bal;
      }

      return movements;
    },
  });

  /* ── Filtered rows ───────────────────────────────────────────────── */
  const allRows = (summaryQ.data ?? []) as (StockRow & { saleQty90d: number })[];
  const filteredRows = useMemo(() => {
    let r = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.label.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      r = r.filter((x) => stockStatus(x.qty, x.reorderQty) === statusFilter);
    }
    return r;
  }, [allRows, search, statusFilter]);

  // Merge FIFO costs into rows when FIFO mode active
  const displayRows = useMemo(() => {
    if (costMethod === 'WAC' || !fifoQ.data) return filteredRows;
    return filteredRows.map((r) => {
      const fifo = fifoQ.data[r.skuId];
      if (!fifo) return r;
      const costPerUnit = fifo.qty > 0 ? fifo.value / fifo.qty : 0;
      return { ...r, costPerUnit, totalValue: r.qty * costPerUnit };
    });
  }, [filteredRows, costMethod, fifoQ.data]);

  const totalValue = useMemo(() => displayRows.reduce((s, r) => s + r.totalValue, 0), [displayRows]);
  const nilCount = useMemo(() => allRows.filter((r) => r.qty <= 0).length, [allRows]);
  const lowCount = useMemo(() => allRows.filter((r) => r.qty > 0 && r.reorderQty > 0 && r.qty <= r.reorderQty).length, [allRows]);

  /* ── Exports ─────────────────────────────────────────────────────── */
  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Stock Summary',
          rows: displayRows.map((r) => ({
            'SKU / Product': r.label,
            'Qty': r.qty,
            'Unit': r.unit,
            [`Cost/Unit (${costMethod}) (₹)`]: r.costPerUnit.toFixed(2),
            'Total Value (₹)': r.totalValue.toFixed(2),
            'Reorder Qty': r.reorderQty,
            'Status': STATUS_COLORS[stockStatus(r.qty, r.reorderQty)].label,
            '90d Sales Qty': (r as StockRow & { saleQty90d: number }).saleQty90d,
          })),
        },
      ]),
      `StockSummary_${costMethod}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }, [displayRows, costMethod]);

  const exportPdf = useCallback(async () => {
    const b = await tallyTablePdfBlob({
      title: 'Stock Summary',
      subtitle: `As on ${fmtDate(new Date().toISOString().slice(0, 10))}`,
      reportPeriod: `As on ${fmtDate(new Date().toISOString().slice(0, 10))}`,
      headers: ['SKU / Product', 'Qty', 'Unit', `Cost/Unit (${costMethod})`, 'Value (₹)', 'Status'],
      rows: displayRows.slice(0, 300).map((r) => {
        const st = stockStatus(r.qty, r.reorderQty);
        return [
          r.label,
          String(r.qty),
          r.unit,
          r.costPerUnit > 0 ? formatTallyAmount(r.costPerUnit) : '—',
          r.totalValue > 0 ? formatTallyAmount(r.totalValue) : '—',
          STATUS_COLORS[st].label,
        ];
      }),
      footerNote: `Total SKUs: ${displayRows.length} · ${costMethod} Stock Value: ${formatTallyAmount(totalValue)}${displayRows.length > 300 ? ' · Truncated to 300' : ''}`,
    });
    triggerDownload(b, `StockSummary_${costMethod}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [displayRows, totalValue, costMethod]);

  const exportRegisterExcel = useCallback(() => {
    if (!registerQ.data) return;
    const sku = filteredRows.find((r) => r.skuId === selectedSku);
    downloadWorkbook(
      workbookFromSheets([
        {
          name: 'Stock Register',
          rows: registerQ.data.map((m) => ({
            Date: fmtDate(m.date),
            Type: m.type,
            'Doc No': m.docNo,
            Party: m.party,
            'Qty IN': m.type === 'IN' ? m.qty : '',
            'Qty OUT': m.type === 'OUT' ? m.qty : '',
            'Rate (₹)': m.rate.toFixed(2),
            'Value (₹)': m.value.toFixed(2),
            'Balance Qty': m.balance,
          })),
        },
      ]),
      `StockRegister_${sku?.label ?? selectedSku}_${regFrom}_${regTo}.xlsx`
    );
  }, [registerQ.data, selectedSku, filteredRows, regFrom, regTo]);

  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });
  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useHotkeys('alt+r', () => setView('register'));
  useHotkeys('alt+s', () => setView('summary'));

  useEffect(() => {
    setButtons([
      { label: view === 'summary' ? 'Register' : 'Summary', shortcut: view === 'summary' ? 'Alt+R' : 'Alt+S',
        onClick: () => setView((v) => v === 'summary' ? 'register' : 'summary') },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: view === 'register' ? exportRegisterExcel : exportExcel },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, exportExcel, exportRegisterExcel, view]);

  const selectedLabel = filteredRows.find((r) => r.skuId === selectedSku)?.label ?? selectedSku ?? '';

  /* ═══ RENDER ═════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title */}
      <div className="border-b py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Stock Summary
      </div>

      {/* Alert bar */}
      {(nilCount > 0 || lowCount > 0) ? (
        <div className="flex gap-4 border-b border-[#AAAAAA] bg-[#FFEBEE] px-3 py-1 text-[12px]">
          {nilCount > 0 && <span className="font-semibold text-[#B71C1C]">⚠ {nilCount} item{nilCount > 1 ? 's' : ''} — Nil Stock</span>}
          {lowCount > 0 && <span className="font-semibold text-[#E65100]">⚠ {lowCount} item{lowCount > 1 ? 's' : ''} — Below Reorder Level</span>}
        </div>
      ) : null}

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] bg-white px-2 py-2">
        <div className="flex gap-1">
          {(['summary', 'register'] as ViewMode[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className="px-3 py-[2px] text-[12px]"
              style={{ background: view === v ? '#1B5E20' : '#EEE', color: view === v ? '#FFF' : '#000', border: '1px solid #AAAAAA', borderRadius: 0 }}>
              {v === 'summary' ? 'Summary' : 'Stock Register'}
            </button>
          ))}
        </div>

        {view === 'summary' ? (
          <>
            <input type="text" placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0, minWidth: 180 }} />
            {(['all', 'ok', 'low', 'nil'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className="px-2 py-[1px] text-[11px]"
                style={{
                  background: statusFilter === s ? '#1B5E20' : '#FFF',
                  color: statusFilter === s ? '#FFF' : '#333',
                  border: '1px solid #AAAAAA', borderRadius: 0
                }}>
                {s === 'all' ? `All (${allRows.length})` : s === 'ok' ? `OK (${allRows.filter(r => r.qty > 0 && !(r.reorderQty > 0 && r.qty <= r.reorderQty)).length})` : s === 'low' ? `Low (${lowCount})` : `Nil (${nilCount})`}
              </button>
            ))}
            {/* Cost method toggle */}
            <div className="flex items-center gap-1 border border-[#AAAAAA]" style={{ borderRadius: 0 }}>
              {(['WAC', 'FIFO'] as CostMethod[]).map((m) => (
                <button key={m} type="button" onClick={() => setCostMethod(m)}
                  className="px-3 py-[2px] text-[11px] font-semibold"
                  style={{ background: costMethod === m ? '#1B5E20' : '#F5F5F5', color: costMethod === m ? '#FFF' : '#555', borderRadius: 0 }}>
                  {m}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[11px] text-[#666]">
              {filteredRows.length} items · {costMethod} Value: <strong>{formatTallyAmount(totalValue)}</strong>
              {costMethod === 'FIFO' && fifoQ.isFetching && <span className="ml-1 text-[#888]">(computing…)</span>}
            </span>
          </>
        ) : (
          <>
            <select value={selectedSku ?? ''} onChange={(e) => setSelectedSku(e.target.value || null)}
              className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0, minWidth: 200 }}>
              <option value="">— Select SKU / Product —</option>
              {allRows.map((r) => <option key={r.skuId} value={r.skuId}>{r.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[12px]">
              From <input type="date" value={regFrom} onChange={(e) => setRegFrom(e.target.value)}
                className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
            </label>
            <label className="flex items-center gap-1 text-[12px]">
              To <input type="date" value={regTo} onChange={(e) => setRegTo(e.target.value)}
                className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
            </label>
            {registerQ.data && (
              <button type="button" onClick={exportRegisterExcel}
                className="ml-auto border border-[#1B5E20] bg-[#1B5E20] px-3 py-[2px] text-[12px] text-white" style={{ borderRadius: 0 }}>
                ↓ Excel
              </button>
            )}
          </>
        )}
        <Link href="/tally" className="ml-auto text-[12px] text-[#0D47A1] underline">Gateway</Link>
      </div>

      {/* ── SUMMARY TABLE ─────────────────────────────────────────── */}
      {view === 'summary' ? (
        <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">SKU / Product</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Qty</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Unit</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Cost/Unit (₹)</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Stock Value (₹)</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Reorder Qty</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">90d Sales</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">Status</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">Register</th>
              </tr>
            </thead>
            <tbody>
              {summaryQ.isLoading ? (
                <tr><td colSpan={9} className="p-3 text-center text-[#888]">Loading…</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={9} className="p-3 text-center text-[#888]">No products found</td></tr>
              ) : (
                displayRows.map((r, i) => {
                  const st = stockStatus(r.qty, r.reorderQty);
                  const { bg, fg, label } = STATUS_COLORS[st];
                  return (
                    <tr key={r.skuId} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                      className="border-b border-[#EEEEEE] hover:bg-[#F0F4FF]">
                      <td className="border border-[#EEEEEE] px-2 py-[3px] font-medium">{r.label}</td>
                      <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums font-semibold ${r.qty <= 0 ? 'text-red-700' : ''}`}>
                        {r.qty.toLocaleString('en-IN')}
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#555]">{r.unit}</td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums">
                        {r.costPerUnit > 0 ? formatTallyAmount(r.costPerUnit) : '—'}
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums font-semibold">
                        {r.totalValue > 0 ? formatTallyAmount(r.totalValue) : '—'}
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[11px]">
                        {r.reorderQty > 0 ? r.reorderQty : '—'}
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[11px]">
                        {(r as StockRow & { saleQty90d: number }).saleQty90d > 0
                          ? (r as StockRow & { saleQty90d: number }).saleQty90d.toLocaleString('en-IN')
                          : '—'}
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                        <span className="inline-block min-w-[58px] px-1.5 py-[1px] text-center text-[10px] font-bold"
                          style={{ background: bg, color: fg }}>
                          {label}
                        </span>
                      </td>
                      <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                        <button type="button"
                          onClick={() => { setSelectedSku(r.skuId); setView('register'); }}
                          className="border border-[#0D47A1] px-2 py-[1px] text-[11px] text-[#0D47A1] hover:bg-[#0D47A1] hover:text-white"
                          style={{ borderRadius: 0 }}>
                          Register
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!summaryQ.isLoading && displayRows.length > 0 ? (
              <tfoot>
                <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                  <td colSpan={3} className="px-2 py-1 text-right text-[12px] font-semibold">
                    TOTAL ({displayRows.length} items)
                  </td>
                  <td className="px-2 py-1 text-right text-[11px] text-[#555]">{costMethod === 'FIFO' ? 'FIFO Cost' : 'Wtd. Avg. Cost'}</td>
                  <td className="px-2 py-1 text-right text-[12px] font-bold tabular-nums">
                    {formatTallyAmount(totalValue)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {/* ── STOCK REGISTER TABLE ───────────────────────────────────── */}
      {view === 'register' ? (
        <div className="flex flex-col flex-1 m-2">
          {!selectedSku ? (
            <div className="flex-1 flex items-center justify-center text-[#888]">
              Select a SKU / product above to view its stock register
            </div>
          ) : (
            <>
              <div className="mb-1 px-1 text-[12px] font-semibold text-[#1B5E20]">
                Stock Register — {selectedLabel} ({regFrom} to {regTo})
              </div>
              <div className="flex-1 overflow-auto border border-[#AAAAAA] bg-white">
                <table className="w-full border-collapse">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                      <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Date</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">Type</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Doc No</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Party</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Inward Qty</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Outward Qty</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Rate (₹)</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Value (₹)</th>
                      <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Balance Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerQ.isFetching ? (
                      <tr><td colSpan={9} className="p-3 text-center text-[#888]">Loading register…</td></tr>
                    ) : (registerQ.data ?? []).length === 0 ? (
                      <tr><td colSpan={9} className="p-3 text-center text-[#888]">No movements in this period</td></tr>
                    ) : (
                      (registerQ.data ?? []).map((m, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }} className="border-b border-[#EEEEEE]">
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{fmtDate(m.date)}</td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                            <span className="inline-block px-1.5 py-[1px] text-[10px] font-bold"
                              style={{ background: m.type === 'IN' ? '#E8F5E9' : '#FCE4EC', color: m.type === 'IN' ? '#1B5E20' : '#880E4F' }}>
                              {m.type}
                            </span>
                          </td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] font-medium">{m.docNo}</td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{m.party}</td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums">
                            {m.type === 'IN' ? <span className="text-[#1B5E20] font-semibold">{m.qty.toLocaleString('en-IN')}</span> : '—'}
                          </td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums">
                            {m.type === 'OUT' ? <span className="text-[#880E4F] font-semibold">{m.qty.toLocaleString('en-IN')}</span> : '—'}
                          </td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">
                            {m.rate > 0 ? formatTallyAmount(m.rate) : '—'}
                          </td>
                          <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">
                            {m.value > 0 ? formatTallyAmount(m.value) : '—'}
                          </td>
                          <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums font-semibold ${m.balance < 0 ? 'text-red-700' : ''}`}>
                            {m.balance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(registerQ.data ?? []).length > 0 ? (() => {
                    const data = registerQ.data!;
                    const totalIn = data.filter((m) => m.type === 'IN').reduce((s, m) => s + m.qty, 0);
                    const totalOut = data.filter((m) => m.type === 'OUT').reduce((s, m) => s + m.qty, 0);
                    const totalInVal = data.filter((m) => m.type === 'IN').reduce((s, m) => s + m.value, 0);
                    const totalOutVal = data.filter((m) => m.type === 'OUT').reduce((s, m) => s + m.value, 0);
                    const closingBal = data[data.length - 1]?.balance ?? 0;
                    return (
                      <tfoot>
                        <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                          <td colSpan={4} className="px-2 py-1 text-right text-[12px] font-semibold">TOTAL</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold text-[#1B5E20]">{totalIn.toLocaleString('en-IN')}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold text-[#880E4F]">{totalOut.toLocaleString('en-IN')}</td>
                          <td />
                          <td className="px-2 py-1 text-right tabular-nums font-bold">{formatTallyAmount(totalInVal - totalOutVal)}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-bold">{closingBal.toLocaleString('en-IN')}</td>
                        </tr>
                      </tfoot>
                    );
                  })() : null}
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Valuation: {costMethod === 'FIFO' ? 'FIFO (First-In First-Out)' : 'WAC (Weighted Average Cost)'} · Alt+R Register · Alt+E Excel · Alt+P PDF
      </div>
    </div>
  );
}
