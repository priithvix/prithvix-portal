'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';

/* ─── Types ────────────────────────────────────────────────────────── */
type PhysRow = {
  sku_id: string;
  sku_label: string;
  product_name: string;
  unit: string;
  book_qty: number;
  physical_qty: string; // editable string
  cost_per_unit: number;
};

type View = 'count' | 'variance';

/* ═══════════════════════════════════════════════════════════════════ */
export default function PhysicalVerificationPage() {
  const { session, dealer } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();

  const [view, setView] = useState<View>('count');
  const [rows, setRows] = useState<PhysRow[]>([]);
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verificationDate] = useState(() => new Date().toISOString().slice(0, 10));

  /* ── Load SKUs ───────────────────────────────────────────────────── */
  const skuQ = useQuery({
    queryKey: ['physical-verification-skus', dealerId],
    enabled: !!dealerId,
    staleTime: 0, // always fresh for physical count
    queryFn: async () => {
      const [skuRes, balRes, costRes] = await Promise.all([
        supabase
          .from('product_skus')
          .select('id, display_label, unit_type, product_master(product_name)')
          .eq('dealer_id', dealerId)
          .order('display_label', { ascending: true }),
        supabase
          .from('sku_stock_balances')
          .select('sku_id, quantity_base')
          .eq('dealer_id', dealerId),
        supabase
          .from('purchase_invoice_items')
          .select('sku_id, unit_price, quantity')
          .eq('dealer_id', dealerId)
          .order('created_at', { ascending: false })
          .limit(3000),
      ]);
      if (skuRes.error) throw new Error(skuRes.error.message);

      const balMap: Record<string, number> = {};
      for (const b of (balRes.data ?? [])) {
        const r = b as { sku_id: string; quantity_base: number };
        balMap[r.sku_id] = Number(r.quantity_base ?? 0);
      }

      const costMap: Record<string, { tot: number; qty: number }> = {};
      for (const pi of (costRes.data ?? [])) {
        const r = pi as { sku_id?: string; unit_price?: number; quantity?: number };
        if (!r.sku_id) continue;
        if (!costMap[r.sku_id]) costMap[r.sku_id] = { tot: 0, qty: 0 };
        costMap[r.sku_id].tot += Number(r.unit_price ?? 0) * Number(r.quantity ?? 0);
        costMap[r.sku_id].qty += Number(r.quantity ?? 0);
      }

      return (skuRes.data ?? []).map((s) => {
        const r = s as { id: string; display_label?: string | null; unit_type?: string | null; product_master?: { product_name?: string } | null };
        const c = costMap[r.id];
        return {
          sku_id: r.id,
          sku_label: r.display_label ?? r.id,
          product_name: r.product_master?.product_name ?? '—',
          unit: r.unit_type ?? 'unit',
          book_qty: balMap[r.id] ?? 0,
          physical_qty: '',
          cost_per_unit: c && c.qty > 0 ? c.tot / c.qty : 0,
        } as PhysRow;
      });
    },
  });

  useEffect(() => {
    if (skuQ.data && rows.length === 0) {
      setRows(skuQ.data);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuQ.data]);

  /* ── Computed rows ───────────────────────────────────────────────── */
  const computed = useMemo(() => rows.map((r) => {
    const phys = r.physical_qty === '' ? null : parseFloat(r.physical_qty);
    const variance = phys !== null ? phys - r.book_qty : null;
    const varianceValue = variance !== null ? variance * r.cost_per_unit : null;
    return { ...r, phys, variance, varianceValue };
  }), [rows]);

  const filtered = useMemo(() => {
    let list = computed;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.sku_label.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q));
    }
    if (view === 'variance') {
      list = list.filter((r) => r.variance !== null && r.variance !== 0);
    }
    return list;
  }, [computed, search, view]);

  const variances = computed.filter((r) => r.variance !== null && r.variance !== 0);
  const enteredCount = computed.filter((r) => r.phys !== null).length;
  const totalVarianceValue = variances.reduce((s, r) => s + (r.varianceValue ?? 0), 0);

  /* ── Update physical qty ─────────────────────────────────────────── */
  const setPhysQty = (sku_id: string, val: string) => {
    setRows((prev) => prev.map((r) => r.sku_id === sku_id ? { ...r, physical_qty: val } : r));
  };

  /* ── Apply Adjustments ───────────────────────────────────────────── */
  const handleApply = async () => {
    if (variances.length === 0) { setFlash({ ok: false, msg: 'No variances to apply.' }); return; }
    const confirm = window.confirm(
      `Apply ${variances.length} variance adjustment(s)?\nNet variance value: ${totalVarianceValue >= 0 ? '+' : ''}${formatTallyAmount(totalVarianceValue)}\nThis will update stock balances.`
    );
    if (!confirm) return;

    setApplying(true);
    setFlash(null);
    try {
      const { count } = await supabase
        .from('stock_journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', dealerId);
      let seq = (count ?? 0) + 1;

      for (const r of variances) {
        if (r.variance === null || r.phys === null) continue;
        const voucherNo = `PV/${verificationDate.replace(/-/g, '')}/${String(seq).padStart(4, '0')}`;
        seq++;

        // Journal entry
        await supabase.from('stock_journal_entries').insert({
          dealer_id: dealerId,
          entry_date: verificationDate,
          voucher_no: voucherNo,
          sku_id: r.sku_id,
          reason_code: r.variance > 0 ? 'SURPLUS' : 'SHORTAGE',
          qty_adjusted: r.variance,
          narration: `Physical verification on ${verificationDate}. Book: ${r.book_qty.toFixed(3)}, Physical: ${r.phys.toFixed(3)}`,
        });

        // Update balance
        await supabase.from('sku_stock_balances').upsert({
          dealer_id: dealerId,
          sku_id: r.sku_id,
          quantity_base: r.phys,
        }, { onConflict: 'dealer_id,sku_id' });
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['stock-journal', dealerId] }),
        qc.invalidateQueries({ queryKey: ['stock-summary-v2', dealerId] }),
        qc.invalidateQueries({ queryKey: ['inv-gateway-stats', dealerId] }),
        qc.invalidateQueries({ queryKey: ['sku-with-balance', dealerId] }),
      ]);
      setFlash({ ok: true, msg: `${variances.length} variance(s) applied. Stock balances updated.` });
      setApplied(true);
      // Reload rows with updated book qtys
      await skuQ.refetch();
      setRows([]);
    } catch (err) {
      setFlash({ ok: false, msg: String((err as Error).message) });
    } finally {
      setApplying(false);
    }
  };

  /* ── Excel Export ────────────────────────────────────────────────── */
  const exportExcel = () => {
    downloadWorkbook(workbookFromSheets([{
      name: 'Physical Count Sheet',
      rows: computed.map((r) => ({
        'SKU': r.sku_label,
        'Product': r.product_name,
        'Unit': r.unit,
        'Book Qty': r.book_qty,
        'Physical Qty': r.phys ?? '',
        'Variance': r.variance ?? '',
        'Cost/Unit': r.cost_per_unit,
        'Variance Value': r.varianceValue ?? '',
        'Status': r.variance === null ? 'Not Counted' : r.variance === 0 ? 'Matched' : r.variance > 0 ? 'Surplus' : 'Shortage',
      })),
    }]), `PhysicalVerification_${verificationDate}.xlsx`);
  };

  useHotkeys('alt+e', (ev) => { ev.preventDefault(); exportExcel(); });
  useHotkeys('escape', () => history.back());

  useEffect(() => {
    setButtons([
      { label: 'Apply Adjustments', shortcut: 'Alt+A', onClick: handleApply },
      { label: 'Export Count Sheet', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Back', shortcut: 'Esc', onClick: () => history.back() },
    ]);
    return () => setButtons([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setButtons, variances]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Header */}
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#E65100', borderBottom: '1px solid #BF360C' }}>
        Physical Verification — Stocktaking Count Sheet
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px]">
        <Link href="/tally/inventory" className="text-[#0D47A1] underline">Inventory</Link>
        <span>›</span><span className="font-semibold">Physical Verification</span>
        <span className="ml-auto text-[#888]">Date: {verificationDate} · Alt+E Export Count Sheet</span>
      </div>

      {/* Flash */}
      {flash && (
        <div className={`mx-3 mt-2 border px-3 py-2 text-[12px] font-semibold ${flash.ok
          ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#1B5E20]'
          : 'border-[#B71C1C] bg-[#FFEBEE] text-[#B71C1C]'}`}>
          {flash.ok ? '✓' : '✗'} {flash.msg}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-6 border-b border-[#DDDDDD] bg-white px-4 py-2 text-[11px]">
        <div>
          <span className="text-[#888]">Total SKUs: </span>
          <span className="font-bold">{rows.length}</span>
        </div>
        <div>
          <span className="text-[#888]">Counted: </span>
          <span className="font-bold text-[#1B5E20]">{enteredCount}</span>
        </div>
        <div>
          <span className="text-[#888]">Variances: </span>
          <span className={`font-bold ${variances.length > 0 ? 'text-[#E65100]' : 'text-[#1B5E20]'}`}>{variances.length}</span>
        </div>
        <div>
          <span className="text-[#888]">Variance Value: </span>
          <span className={`font-bold tabular-nums ${totalVarianceValue < 0 ? 'text-[#B71C1C]' : totalVarianceValue > 0 ? 'text-[#1B5E20]' : 'text-[#888]'}`}>
            {totalVarianceValue >= 0 ? '+' : ''}{formatTallyAmount(totalVarianceValue)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <button type="button" onClick={() => setView('count')}
            className="px-3 py-[2px] text-[11px] font-semibold border"
            style={{ background: view === 'count' ? '#E65100' : '#F5F5F5', color: view === 'count' ? '#FFF' : '#333', borderColor: view === 'count' ? '#E65100' : '#AAAAAA', borderRadius: 0 }}>
            Count Sheet
          </button>
          <button type="button" onClick={() => setView('variance')}
            className="px-3 py-[2px] text-[11px] font-semibold border"
            style={{ background: view === 'variance' ? '#E65100' : '#F5F5F5', color: view === 'variance' ? '#FFF' : '#333', borderColor: view === 'variance' ? '#E65100' : '#AAAAAA', borderRadius: 0 }}>
            Variance Report ({variances.length})
          </button>
          <input type="text" placeholder="Search…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:outline-none"
            style={{ borderRadius: 0, minWidth: 150 }} />
        </div>
      </div>

      {/* Apply banner */}
      {variances.length > 0 && !applied && (
        <div className="mx-3 mt-2 flex items-center justify-between border border-[#E65100] bg-[#FFF3E0] px-3 py-2 text-[12px]">
          <span className="font-semibold text-[#E65100]">
            ⚠ {variances.length} variance(s) pending — apply to update stock balances
          </span>
          <button type="button" onClick={handleApply} disabled={applying}
            className="px-4 py-[3px] text-[11px] font-bold text-white disabled:opacity-50"
            style={{ background: '#E65100', borderRadius: 0 }}>
            {applying ? 'Applying…' : 'Apply Adjustments'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        {skuQ.isFetching ? (
          <div className="p-6 text-center text-[#888]">Loading stock items…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#E65100', color: '#FFF' }}>
                <th className="border border-[#F4511E] px-2 py-1 text-left text-[11px]">#</th>
                <th className="border border-[#F4511E] px-2 py-1 text-left text-[11px]">SKU / Product</th>
                <th className="border border-[#F4511E] px-2 py-1 text-right text-[11px]">Book Qty</th>
                <th className="border border-[#F4511E] px-2 py-1 text-center text-[11px]">Physical Count ✎</th>
                <th className="border border-[#F4511E] px-2 py-1 text-right text-[11px]">Variance</th>
                <th className="border border-[#F4511E] px-2 py-1 text-right text-[11px]">Cost/Unit</th>
                <th className="border border-[#F4511E] px-2 py-1 text-right text-[11px]">Variance Value</th>
                <th className="border border-[#F4511E] px-2 py-1 text-center text-[11px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-[#888]">No items found.</td></tr>
              ) : filtered.map((r, i) => {
                const hasVariance = r.variance !== null && r.variance !== 0;
                const isShortage = r.variance !== null && r.variance < 0;
                const isSurplus = r.variance !== null && r.variance > 0;
                return (
                  <tr key={r.sku_id}
                    style={{ background: hasVariance ? (isShortage ? '#FFF3E0' : '#E8F5E9') : i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
                    className="border-b border-[#EEEEEE] hover:bg-[#FFF8E1]">
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[10px] text-[#888] tabular-nums">{i + 1}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px]">
                      <div className="text-[12px] font-medium">{r.sku_label}</div>
                      <div className="text-[10px] text-[#888]">{r.product_name}</div>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">
                      {r.book_qty.toFixed(3)} <span className="text-[10px] text-[#888]">{r.unit}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={r.physical_qty}
                        onChange={(e) => setPhysQty(r.sku_id, e.target.value)}
                        placeholder={r.book_qty.toFixed(3)}
                        className="w-24 border border-[#CCCCCC] px-2 py-[2px] text-center text-[12px] tabular-nums focus:border-[#E65100] focus:outline-none"
                        style={{ borderRadius: 0 }}
                      />
                    </td>
                    <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-bold ${isShortage ? 'text-[#B71C1C]' : isSurplus ? 'text-[#1B5E20]' : 'text-[#888]'}`}>
                      {r.variance === null ? '—' : `${r.variance >= 0 ? '+' : ''}${r.variance.toFixed(3)}`}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[11px]">
                      {r.cost_per_unit > 0 ? formatTallyAmount(r.cost_per_unit) : '—'}
                    </td>
                    <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold ${isShortage ? 'text-[#B71C1C]' : isSurplus ? 'text-[#1B5E20]' : 'text-[#888]'}`}>
                      {r.varianceValue === null ? '—' : formatTallyAmount(r.varianceValue)}
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      {r.phys === null ? (
                        <span className="text-[10px] text-[#AAAAAA]">Not counted</span>
                      ) : r.variance === 0 ? (
                        <span className="text-[10px] font-bold text-[#1B5E20]">✓ Matched</span>
                      ) : isShortage ? (
                        <span className="text-[10px] font-bold text-[#B71C1C]">↓ Shortage</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#2E7D32]">↑ Surplus</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #E65100' }}>
                <td colSpan={4} className="px-2 py-[4px] text-right text-[12px] font-semibold">
                  {enteredCount}/{rows.length} items counted
                </td>
                <td className={`px-2 py-[4px] text-right text-[12px] font-bold tabular-nums ${totalVarianceValue < 0 ? 'text-[#B71C1C]' : 'text-[#1B5E20]'}`}>
                  {totalVarianceValue >= 0 ? '+' : ''}{variances.reduce((s, r) => s + (r.variance ?? 0), 0).toFixed(3)} units
                </td>
                <td />
                <td className={`px-2 py-[4px] text-right text-[13px] font-bold tabular-nums ${totalVarianceValue < 0 ? 'text-[#B71C1C]' : 'text-[#1B5E20]'}`}>
                  {formatTallyAmount(totalVarianceValue)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Physical Verification · {verificationDate} · Alt+E Export Count Sheet
      </div>
    </div>
  );
}
