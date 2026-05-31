'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { fmtDate, getFY, fyDates } from '@/lib/reports/formatters';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';

/* ─── Types ────────────────────────────────────────────────────────── */
const REASON_CODES = [
  { code: 'DAMAGE',   label: 'Damage / Wastage',          sign: -1 },
  { code: 'SHORTAGE', label: 'Shortage (Book Correction)', sign: -1 },
  { code: 'SURPLUS',  label: 'Surplus (Book Correction)',  sign: +1 },
  { code: 'RETURN_IN', label: 'Customer Return (Inward)', sign: +1 },
  { code: 'RETURN_OUT', label: 'Return to Supplier',       sign: -1 },
  { code: 'TRANSFER_OUT', label: 'Transfer Out',           sign: -1 },
  { code: 'TRANSFER_IN',  label: 'Transfer In',            sign: +1 },
  { code: 'OPENING',  label: 'Opening Balance Entry',      sign: +1 },
  { code: 'OTHER',    label: 'Other Adjustment',           sign: +1 },
] as const;

type ReasonCode = (typeof REASON_CODES)[number]['code'];

type JournalEntry = {
  id: string;
  entry_date: string;
  voucher_no: string;
  sku_id: string;
  sku_label: string;
  product_name: string;
  reason_code: ReasonCode;
  qty_adjusted: number;
  unit_type: string;
  narration: string | null;
  created_at: string;
};

type SkuOption = { id: string; label: string; unit: string; product_name: string; current_qty: number };

type FormState = {
  entry_date: string;
  sku_id: string;
  reason_code: ReasonCode;
  qty: string;
  narration: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const t = new Date();
  return {
    from: start.toISOString().slice(0, 10),
    to: (t > end ? end : t).toISOString().slice(0, 10),
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function StockJournalPage() {
  const { session, dealer } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [search, setSearch] = useState('');
  const { from: fromDefault, to: toDefault } = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(fromDefault);
  const [to, setTo] = useState(toDefault);

  const emptyForm = (): FormState => ({
    entry_date: today(),
    sku_id: '',
    reason_code: 'DAMAGE',
    qty: '',
    narration: '',
  });

  const [form, setForm] = useState<FormState>(emptyForm());

  /* ── SKU Options ─────────────────────────────────────────────────── */
  const skuQ = useQuery({
    queryKey: ['sku-with-balance', dealerId],
    enabled: !!dealerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_skus')
        .select('id, display_label, unit_type, product_master(product_name), sku_stock_balances(quantity_base)')
        .eq('dealer_id', dealerId)
        .order('display_label', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => {
        const r = s as {
          id: string;
          display_label: string | null;
          unit_type: string | null;
          product_master: { product_name?: string } | null;
          sku_stock_balances: { quantity_base?: number }[] | null;
        };
        const bal = r.sku_stock_balances;
        const current_qty = Array.isArray(bal) && bal.length > 0 ? Number(bal[0].quantity_base ?? 0) : 0;
        return {
          id: r.id,
          label: r.display_label ?? r.id,
          unit: r.unit_type ?? 'unit',
          product_name: r.product_master?.product_name ?? '—',
          current_qty,
        } as SkuOption;
      });
    },
  });

  /* ── Journal Entries Query ───────────────────────────────────────── */
  const journalQ = useQuery({
    queryKey: ['stock-journal', dealerId, from, to],
    enabled: !!dealerId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_journal_entries')
        .select('id, entry_date, voucher_no, sku_id, reason_code, qty_adjusted, narration, created_at, product_skus(display_label, unit_type, product_master(product_name))')
        .eq('dealer_id', dealerId)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((e) => {
        const r = e as Record<string, unknown>;
        const sku = r.product_skus as { display_label?: string; unit_type?: string; product_master?: { product_name?: string } } | null;
        return {
          id: String(r.id),
          entry_date: String(r.entry_date ?? ''),
          voucher_no: String(r.voucher_no ?? ''),
          sku_id: String(r.sku_id ?? ''),
          sku_label: sku?.display_label ?? '—',
          product_name: sku?.product_master?.product_name ?? '—',
          reason_code: String(r.reason_code ?? 'OTHER') as ReasonCode,
          qty_adjusted: Number(r.qty_adjusted ?? 0),
          unit_type: sku?.unit_type ?? 'unit',
          narration: r.narration as string | null,
          created_at: String(r.created_at ?? ''),
        } as JournalEntry;
      });
    },
  });

  const entries = journalQ.data ?? [];
  const skus = skuQ.data ?? [];

  /* ── Filtered ────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) =>
      e.sku_label.toLowerCase().includes(q) ||
      e.product_name.toLowerCase().includes(q) ||
      e.voucher_no.toLowerCase().includes(q) ||
      (e.narration ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  /* ── Selected SKU details ────────────────────────────────────────── */
  const selectedSku = skus.find((s) => s.id === form.sku_id) ?? null;
  const reasonInfo = REASON_CODES.find((r) => r.code === form.reason_code)!;
  const qtyNum = parseFloat(form.qty) || 0;
  const effectiveQty = reasonInfo.sign * qtyNum;
  const resultingQty = selectedSku ? selectedSku.current_qty + effectiveQty : null;

  /* ── Save ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.sku_id) { setFlash({ ok: false, msg: 'Select a SKU.' }); return; }
    if (qtyNum <= 0) { setFlash({ ok: false, msg: 'Quantity must be > 0.' }); return; }
    if (!form.narration.trim()) { setFlash({ ok: false, msg: 'Narration is required.' }); return; }

    setSaving(true);
    setFlash(null);
    try {
      // Auto-generate voucher number
      const { count } = await supabase
        .from('stock_journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', dealerId);
      const seq = String((count ?? 0) + 1).padStart(4, '0');
      const voucherNo = `STJ/${form.entry_date.replace(/-/g, '')}/${seq}`;

      // Insert journal entry
      const { error: insertError } = await supabase.from('stock_journal_entries').insert({
        dealer_id: dealerId,
        entry_date: form.entry_date,
        voucher_no: voucherNo,
        sku_id: form.sku_id,
        reason_code: form.reason_code,
        qty_adjusted: effectiveQty,
        narration: form.narration.trim(),
      });
      if (insertError) throw new Error(insertError.message);

      // Update sku_stock_balances
      if (selectedSku) {
        const newQty = selectedSku.current_qty + effectiveQty;
        const { error: balError } = await supabase
          .from('sku_stock_balances')
          .upsert({
            dealer_id: dealerId,
            sku_id: form.sku_id,
            quantity_base: newQty,
          }, { onConflict: 'dealer_id,sku_id' });
        if (balError) throw new Error(balError.message);
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['stock-journal', dealerId] }),
        qc.invalidateQueries({ queryKey: ['stock-summary-v2', dealerId] }),
        qc.invalidateQueries({ queryKey: ['sku-with-balance', dealerId] }),
        qc.invalidateQueries({ queryKey: ['inv-gateway-stats', dealerId] }),
      ]);
      setFlash({ ok: true, msg: `${voucherNo} posted successfully.` });
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      setFlash({ ok: false, msg: String((err as Error).message) });
    } finally {
      setSaving(false);
    }
  };

  /* ── Excel Export ────────────────────────────────────────────────── */
  const exportExcel = () => {
    downloadWorkbook(workbookFromSheets([{
      name: 'Stock Journal',
      rows: filtered.map((e) => {
        const sign = e.qty_adjusted >= 0 ? '+' : '';
        return {
          'Date': fmtDate(e.entry_date),
          'Voucher No': e.voucher_no,
          'Product': e.product_name,
          'SKU': e.sku_label,
          'Reason': REASON_CODES.find((r) => r.code === e.reason_code)?.label ?? e.reason_code,
          'Qty Adjusted': `${sign}${e.qty_adjusted.toFixed(2)} ${e.unit_type}`,
          'Narration': e.narration ?? '',
        };
      }),
    }]), `StockJournal_${from}_${to}.xlsx`);
  };

  useHotkeys('ctrl+a', (ev) => { ev.preventDefault(); if (showForm) handleSave(); }, { enableOnFormTags: true });
  useHotkeys('alt+n', (ev) => { ev.preventDefault(); setShowForm(true); setForm(emptyForm()); });
  useHotkeys('alt+e', (ev) => { ev.preventDefault(); exportExcel(); });
  useHotkeys('escape', () => {
    if (showForm) { setShowForm(false); setFlash(null); }
    else history.back();
  }, { enableOnFormTags: true });

  useEffect(() => {
    setButtons([
      { label: 'New Entry', shortcut: 'Alt+N', onClick: () => { setShowForm(true); setForm(emptyForm()); } },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Back', shortcut: 'Esc', onClick: () => history.back() },
    ]);
    return () => setButtons([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setButtons]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Header */}
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Stock Journal — Adjustments & Write-offs
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px]">
        <Link href="/tally/inventory" className="text-[#0D47A1] underline">Inventory</Link>
        <span>›</span><span className="font-semibold">Stock Journal</span>
        <span className="ml-auto text-[#888]">Alt+N New · Alt+E Export</span>
      </div>

      {/* Flash */}
      {flash && (
        <div className={`mx-3 mt-2 border px-3 py-2 text-[12px] font-semibold ${flash.ok
          ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#1B5E20]'
          : 'border-[#B71C1C] bg-[#FFEBEE] text-[#B71C1C]'}`}>
          {flash.ok ? '✓' : '✗'} {flash.msg}
        </div>
      )}

      {/* ── Entry Form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="m-3 border border-[#AAAAAA] bg-white">
          <div className="px-3 py-2 text-[11px] font-bold text-white" style={{ background: '#00695C' }}>
            New Stock Journal Entry — Ctrl+A to Post · Esc to Cancel
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-[12px]">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#555]">Entry Date *</label>
              <input type="date" value={form.entry_date}
                onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
                className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }} />
            </div>

            {/* Reason Code */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#555]">Reason / Type *</label>
              <select value={form.reason_code}
                onChange={(e) => setForm((f) => ({ ...f, reason_code: e.target.value as ReasonCode }))}
                className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }}>
                {REASON_CODES.map((r) => (
                  <option key={r.code} value={r.code}>{r.label} ({r.sign > 0 ? '+IN' : '−OUT'})</option>
                ))}
              </select>
            </div>

            {/* SKU */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[11px] font-semibold text-[#555]">Stock Item (SKU) *</label>
              <select value={form.sku_id}
                onChange={(e) => setForm((f) => ({ ...f, sku_id: e.target.value }))}
                className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }}>
                <option value="">— Select SKU —</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>{s.label} · {s.product_name} (Book: {s.current_qty.toFixed(2)} {s.unit})</option>
                ))}
              </select>
            </div>

            {/* Qty */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#555]">
                Quantity ({selectedSku?.unit ?? 'unit'}) *
              </label>
              <input type="number" min="0.001" step="0.001" value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="0.000"
                className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }} />
              {selectedSku && qtyNum > 0 && (
                <span className={`text-[10px] font-semibold ${resultingQty! < 0 ? 'text-[#B71C1C]' : 'text-[#1B5E20]'}`}>
                  {effectiveQty >= 0 ? '+' : ''}{effectiveQty.toFixed(3)} → New Balance: {resultingQty!.toFixed(3)} {selectedSku.unit}
                  {resultingQty! < 0 ? ' ⚠ NEGATIVE STOCK' : ''}
                </span>
              )}
            </div>

            {/* Narration */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#555]">Narration *</label>
              <input type="text" value={form.narration}
                onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
                placeholder="Describe reason for adjustment…"
                className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }} />
            </div>
          </div>

          {/* Action row */}
          <div className="flex gap-2 border-t border-[#EEEEEE] bg-[#F9F9F9] px-4 py-2">
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-[4px] text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: '#1B5E20', borderRadius: 0 }}>
              {saving ? 'Posting…' : 'Post Entry (Ctrl+A)'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFlash(null); }}
              className="border border-[#AAAAAA] px-4 py-[4px] text-[12px] text-[#555]"
              style={{ borderRadius: 0 }}>
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#DDDDDD] bg-white px-3 py-2 text-[11px]">
        <span className="font-semibold text-[#555]">Period:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:outline-none" style={{ borderRadius: 0 }} />
        <span>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:outline-none" style={{ borderRadius: 0 }} />
        <input type="text" placeholder="Search SKU / voucher…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:border-[#1B5E20] focus:outline-none ml-auto"
          style={{ borderRadius: 0, minWidth: 180 }} />
        {!showForm && (
          <button type="button" onClick={() => { setShowForm(true); setForm(emptyForm()); }}
            className="px-3 py-[3px] text-[11px] font-bold text-white"
            style={{ background: '#00695C', borderRadius: 0 }}>
            + New Entry (Alt+N)
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        {journalQ.isFetching ? (
          <div className="p-6 text-center text-[#888]">Loading journal entries…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#00695C', color: '#FFF' }}>
                {['Date', 'Voucher No', 'SKU / Product', 'Reason', 'Qty Adjusted', 'Narration'].map((h) => (
                  <th key={h} className="border border-[#00897B] px-2 py-1 text-left text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-[#888]">
                  No journal entries found for this period. Use Alt+N to create one.
                </td></tr>
              ) : filtered.map((e, i) => {
                const sign = e.qty_adjusted >= 0 ? '+' : '';
                const isPos = e.qty_adjusted >= 0;
                const reasonLabel = REASON_CODES.find((r) => r.code === e.reason_code)?.label ?? e.reason_code;
                return (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F0FFF4' }}
                    className="border-b border-[#EEEEEE] hover:bg-[#E8F5E9]">
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] tabular-nums">{fmtDate(e.entry_date)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] font-mono">{e.voucher_no}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px]">
                      <div className="text-[12px] font-medium">{e.sku_label}</div>
                      <div className="text-[10px] text-[#888]">{e.product_name}</div>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px]">{reasonLabel}</td>
                    <td className={`border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-bold ${isPos ? 'text-[#1B5E20]' : 'text-[#B71C1C]'}`}>
                      {sign}{e.qty_adjusted.toFixed(3)} <span className="text-[10px] font-normal text-[#888]">{e.unit_type}</span>
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#666]">{e.narration ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #00695C' }}>
                <td colSpan={4} className="px-2 py-[4px] text-right text-[12px] font-semibold">
                  {filtered.length} entries
                </td>
                <td className="px-2 py-[4px] text-right text-[13px] font-bold tabular-nums text-[#00695C]">
                  Net: {filtered.reduce((s, e) => s + e.qty_adjusted, 0).toFixed(3)} units
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Stock Journal · STJ vouchers · Alt+N New · Alt+E Export
      </div>
    </div>
  );
}
