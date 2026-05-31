'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

/* ─── Types ─────────────────────────────────────────────────────── */
type ProductMaster = {
  id: string;
  product_name: string;
  hsn_code: string | null;
  gst_percent: number;
  base_unit: string;
  category: string | null;
  company_name: string | null;
};

type SkuRow = {
  id: string;
  display_label: string;
  unit_type: string;
  reorder_level: number;
  selling_price_ex_gst: number;
  mrp: number;
  is_active: boolean;
  product_id: string;
  currentQty?: number;
};

type FormState = {
  // Product fields
  product_name: string;
  hsn_code: string;
  gst_percent: string;
  base_unit: string;
  category: string;
  company_name: string;
  // SKU fields
  display_label: string;
  unit_type: string;
  reorder_level: string;
  selling_price_ex_gst: string;
  mrp: string;
};

const EMPTY_FORM: FormState = {
  product_name: '', hsn_code: '', gst_percent: '18', base_unit: 'Kg',
  category: '', company_name: '',
  display_label: '', unit_type: 'Kg', reorder_level: '0',
  selling_price_ex_gst: '', mrp: '',
};

const GST_RATES = ['0', '3', '5', '12', '18', '28'];
const UNITS = ['Kg', 'Bag', 'Ltr', 'Box', 'Bottle', 'Pack', 'Pcs', 'Quintal', 'MT', 'Unit'];
const CATEGORIES = ['Seeds', 'Fertilizer', 'Pesticide', 'Herbicide', 'Fungicide', 'Micronutrient', 'Equipment', 'Other'];

function ItemsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const dealerId = session?.dealerRowId ?? '';
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();

  const selectedProductId = searchParams.get('product') ?? '';
  const selectedSkuId = searchParams.get('sku') ?? '';

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [mode, setMode] = useState<'product' | 'sku'>('product');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  /* Load products */
  const productsQ = useQuery({
    queryKey: ['product-master-list', dealerId],
    enabled: !!dealerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('product_master')
        .select('id, product_name, hsn_code, gst_percent, base_unit, category, company_name')
        .eq('dealer_id', dealerId)
        .order('product_name');
      if (e) throw new Error(e.message);
      return (data ?? []) as ProductMaster[];
    },
  });

  /* Load SKUs for selected product */
  const skusQ = useQuery({
    queryKey: ['sku-list', dealerId, selectedProductId],
    enabled: !!dealerId && !!selectedProductId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const [{ data: skus, error: e1 }, { data: bals, error: e2 }] = await Promise.all([
        supabase.from('product_skus')
          .select('id, display_label, unit_type, reorder_level, selling_price_ex_gst, mrp, is_active, product_id')
          .eq('dealer_id', dealerId).eq('product_id', selectedProductId).order('display_label'),
        supabase.from('sku_stock_balances').select('sku_id, quantity_base').eq('dealer_id', dealerId),
      ]);
      if (e1) throw new Error(e1.message);
      const balMap: Record<string, number> = {};
      for (const b of bals ?? []) balMap[String((b as { sku_id: string }).sku_id)] = Number((b as { quantity_base: number }).quantity_base);
      return (skus ?? []).map((s) => {
        const r = s as SkuRow;
        return { ...r, currentQty: balMap[r.id] ?? 0 };
      });
    },
  });

  const products = productsQ.data ?? [];
  const skus = skusQ.data ?? [];

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return q ? products.filter((p) => p.product_name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)) : products;
  }, [products, search]);

  /* Load selected product into form */
  useEffect(() => {
    if (!selectedProductId) { setForm(EMPTY_FORM); setMode('product'); return; }
    const p = products.find((x) => x.id === selectedProductId);
    if (!p) return;
    setMode('product');
    setForm((prev) => ({
      ...prev,
      product_name: p.product_name,
      hsn_code: p.hsn_code ?? '',
      gst_percent: String(p.gst_percent ?? 18),
      base_unit: p.base_unit ?? 'Kg',
      category: p.category ?? '',
      company_name: p.company_name ?? '',
    }));
  }, [selectedProductId, products]);

  /* Load selected SKU into form */
  useEffect(() => {
    if (!selectedSkuId) return;
    const s = skus.find((x) => x.id === selectedSkuId);
    if (!s) return;
    setMode('sku');
    setForm((prev) => ({
      ...prev,
      display_label: s.display_label,
      unit_type: s.unit_type,
      reorder_level: String(s.reorder_level ?? 0),
      selling_price_ex_gst: String(s.selling_price_ex_gst ?? ''),
      mrp: String(s.mrp ?? ''),
    }));
  }, [selectedSkuId, skus]);

  const setF = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  /* Save Product */
  const saveProduct = useCallback(async () => {
    if (!form.product_name.trim()) { setError('Product name required.'); playTallyError(); return; }
    setSaving(true); setError('');
    const payload = {
      dealer_id: dealerId,
      product_name: form.product_name.trim(),
      hsn_code: form.hsn_code.trim() || null,
      gst_percent: parseFloat(form.gst_percent) || 18,
      base_unit: form.base_unit || 'Kg',
      category: form.category.trim() || null,
      company_name: form.company_name.trim() || null,
    };
    const { data: saved, error: e } = selectedProductId
      ? await supabase.from('product_master').update(payload).eq('id', selectedProductId).select('id').single()
      : await supabase.from('product_master').insert(payload).select('id').single();
    setSaving(false);
    if (e) { setError(e.message); playTallyError(); return; }
    playTallyAccept();
    await qc.invalidateQueries({ queryKey: ['product-master-list', dealerId] });
    setFlash(selectedProductId ? `Product updated.` : `Product "${form.product_name}" created.`);
    setTimeout(() => setFlash(''), 4000);
    if (!selectedProductId && saved) router.push(`/tally/inventory/items?product=${saved.id}`);
  }, [form, dealerId, selectedProductId, qc, router]);

  /* Save SKU */
  const saveSku = useCallback(async () => {
    if (!form.display_label.trim()) { setError('SKU label required.'); playTallyError(); return; }
    if (!selectedProductId) { setError('Select a product first.'); return; }
    setSaving(true); setError('');
    const payload = {
      dealer_id: dealerId,
      product_id: selectedProductId,
      display_label: form.display_label.trim(),
      unit_type: form.unit_type || 'Kg',
      reorder_level: parseFloat(form.reorder_level) || 0,
      selling_price_ex_gst: parseFloat(form.selling_price_ex_gst) || 0,
      mrp: parseFloat(form.mrp) || 0,
      is_active: true,
    };
    const { error: e } = selectedSkuId
      ? await supabase.from('product_skus').update(payload).eq('id', selectedSkuId)
      : await supabase.from('product_skus').insert(payload);

    if (!selectedSkuId && !e) {
      // Create zero stock balance
      const { data: newSku } = await supabase.from('product_skus').select('id').eq('dealer_id', dealerId).eq('display_label', payload.display_label).eq('product_id', selectedProductId).single();
      if (newSku) await supabase.from('sku_stock_balances').insert({ dealer_id: dealerId, sku_id: (newSku as { id: string }).id, quantity_base: 0 });
    }

    setSaving(false);
    if (e) { setError(e.message); playTallyError(); return; }
    playTallyAccept();
    await qc.invalidateQueries({ queryKey: ['sku-list', dealerId, selectedProductId] });
    await qc.invalidateQueries({ queryKey: ['stock-summary-v2', dealerId] });
    setFlash(selectedSkuId ? 'SKU updated.' : `SKU "${form.display_label}" created.`);
    setTimeout(() => setFlash(''), 4000);
    setForm((p) => ({ ...p, display_label: '', unit_type: p.unit_type, reorder_level: '0', selling_price_ex_gst: '', mrp: '' }));
  }, [form, dealerId, selectedProductId, selectedSkuId, qc]);

  const handleSave = () => { void (mode === 'product' ? saveProduct() : saveSku()); };

  useHotkeys('ctrl+a', (e) => { e.preventDefault(); handleSave(); }, { enableOnFormTags: true });
  useHotkeys('escape', () => router.push('/tally/inventory'), { enableOnFormTags: true });
  useHotkeys('alt+n', (e) => { e.preventDefault(); router.push('/tally/inventory/items'); setForm(EMPTY_FORM); setMode('product'); });

  useEffect(() => {
    setButtons([
      { label: 'Save (Ctrl+A)', shortcut: 'Ctrl+A', onClick: handleSave },
      { label: 'New', shortcut: 'Alt+N', onClick: () => router.push('/tally/inventory/items') },
      { label: 'Back', shortcut: 'Esc', onClick: () => router.push('/tally/inventory') },
    ]);
    return () => setButtons([]);
  }, [setButtons, handleSave, router]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]">
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Stock Items Master
      </div>
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px] text-[#666]">
        <Link href="/tally/inventory" className="text-[#0D47A1] underline">Inventory</Link>
        <span>›</span><span className="font-semibold text-[#333]">Items Master</span>
        <span className="ml-auto text-[#888]">Ctrl+A Save · Esc Back</span>
      </div>

      {flash && <div className="mx-3 mt-2 border border-[#2E7D32] bg-[#E8F5E9] px-3 py-2 text-[12px] text-[#1B5E20]">✓ {flash}</div>}
      {error && <div className="mx-3 mt-2 border border-[#C62828] bg-[#FFEBEE] px-3 py-2 text-[12px] text-[#B71C1C]">⚠ {error}</div>}

      <div className="flex flex-1 min-h-0">
        {/* LEFT: Product list */}
        <div className="flex flex-col border-r border-[#AAAAAA] bg-white" style={{ width: 240 }}>
          <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-2 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
            Products ({products.length})
          </div>
          <div className="border-b border-[#DDDDDD] px-1 py-1">
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[#AAAAAA] bg-white px-2 py-[2px] text-[11px] focus:border-[#1B5E20] focus:outline-none" style={{ borderRadius: 0 }} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <button type="button"
              onClick={() => { router.push('/tally/inventory/items'); setForm(EMPTY_FORM); setMode('product'); }}
              className="w-full border-b border-[#EEEEEE] px-2 py-[4px] text-left text-[11px] text-[#0D47A1] hover:bg-[#E3F2FD]"
              style={{ borderRadius: 0 }}>
              + New Product
            </button>
            {filteredProducts.map((p) => (
              <button key={p.id} type="button"
                onClick={() => router.push(`/tally/inventory/items?product=${p.id}`)}
                className="w-full border-b border-[#EEEEEE] px-2 py-[4px] text-left hover:bg-[#EEF2FF]"
                style={{ background: p.id === selectedProductId ? '#E8F5E9' : undefined, borderRadius: 0 }}>
                <div className={`truncate text-[12px] ${p.id === selectedProductId ? 'font-bold text-[#1B5E20]' : 'text-[#333]'}`}>
                  {p.product_name}
                </div>
                <div className="text-[10px] text-[#888]">{p.category ?? ''} · GST {p.gst_percent}% · {p.base_unit}</div>
              </button>
            ))}
          </div>
        </div>

        {/* MIDDLE: SKU list */}
        {selectedProductId && (
          <div className="flex flex-col border-r border-[#AAAAAA] bg-white" style={{ width: 220 }}>
            <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-2 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
              SKUs
            </div>
            <div className="flex-1 overflow-y-auto">
              <button type="button"
                onClick={() => { router.push(`/tally/inventory/items?product=${selectedProductId}`); setMode('sku'); setForm((p) => ({ ...p, display_label: '', reorder_level: '0', selling_price_ex_gst: '', mrp: '' })); }}
                className="w-full border-b border-[#EEEEEE] px-2 py-[4px] text-left text-[11px] text-[#0D47A1] hover:bg-[#E3F2FD]"
                style={{ borderRadius: 0 }}>
                + New SKU
              </button>
              {skus.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => router.push(`/tally/inventory/items?product=${selectedProductId}&sku=${s.id}`)}
                  className="w-full border-b border-[#EEEEEE] px-2 py-[4px] text-left hover:bg-[#EEF2FF]"
                  style={{ background: s.id === selectedSkuId ? '#E8F5E9' : undefined, borderRadius: 0 }}>
                  <div className={`truncate text-[12px] ${s.id === selectedSkuId ? 'font-bold text-[#1B5E20]' : ''}`}>
                    {s.display_label}
                  </div>
                  <div className="flex justify-between text-[10px] text-[#888]">
                    <span>Qty: {s.currentQty?.toFixed(1) ?? 0} {s.unit_type}</span>
                    <span>Reorder: {s.reorder_level}</span>
                  </div>
                  {!s.is_active && <span className="text-[10px] text-red-500">Inactive</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT: Form */}
        <div className="flex-1 overflow-auto p-0">
          {/* Tab bar */}
          <div className="flex border-b border-[#DDDDDD] bg-[#F5F5F5]">
            {(['product', 'sku'] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => setMode(m)}
                disabled={m === 'sku' && !selectedProductId}
                className="px-4 py-2 text-[12px] font-semibold capitalize disabled:opacity-40"
                style={{
                  background: mode === m ? '#1B5E20' : 'transparent',
                  color: mode === m ? '#FFF' : '#333',
                  borderRadius: 0,
                  borderBottom: mode === m ? '2px solid #0D3D0F' : undefined,
                }}>
                {m === 'product' ? 'Product Details' : `SKU / Pack Size ${selectedProductId ? '' : '(select product first)'}`}
              </button>
            ))}
          </div>

          <div className="m-3 border border-[#AAAAAA] bg-white">
            {mode === 'product' ? (
              <>
                <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
                  {selectedProductId ? 'Edit Product' : 'Create New Product'}
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-y-[6px] p-4 text-[12px]">
                  {([
                    { label: 'Product Name *', key: 'product_name', type: 'text', ref: nameRef },
                    { label: 'Company / Brand', key: 'company_name', type: 'text' },
                  ] as const).map(({ label, key }) => (
                    <>
                      <label key={`l${key}`} className="flex items-center justify-end pr-4 font-semibold text-[#333]">{label}</label>
                      <input key={`i${key}`} type="text" value={form[key]}
                        onChange={(e) => setF(key, e.target.value)}
                        className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                        style={{ borderRadius: 0, maxWidth: 320 }} />
                    </>
                  ))}
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">Category</label>
                  <select value={form.category} onChange={(e) => setF('category', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px] focus:outline-none"
                    style={{ borderRadius: 0, maxWidth: 200 }}>
                    <option value="">— Select —</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">HSN Code</label>
                  <input type="text" value={form.hsn_code} onChange={(e) => setF('hsn_code', e.target.value)}
                    placeholder="e.g. 31010099"
                    className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0, maxWidth: 160 }} />
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">GST Rate %</label>
                  <select value={form.gst_percent} onChange={(e) => setF('gst_percent', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px]" style={{ borderRadius: 0, maxWidth: 120 }}>
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">Base Unit</label>
                  <select value={form.base_unit} onChange={(e) => setF('base_unit', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px]" style={{ borderRadius: 0, maxWidth: 120 }}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
                  {selectedSkuId ? 'Edit SKU' : 'Create New SKU'} — {products.find((p) => p.id === selectedProductId)?.product_name}
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-y-[6px] p-4 text-[12px]">
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">SKU Label *</label>
                  <input type="text" value={form.display_label} onChange={(e) => setF('display_label', e.target.value)}
                    placeholder="e.g. DAP 50 Kg Bag"
                    className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0, maxWidth: 300 }} />
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">Unit of Measure</label>
                  <select value={form.unit_type} onChange={(e) => setF('unit_type', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-1 py-[3px] text-[12px]" style={{ borderRadius: 0, maxWidth: 120 }}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">Reorder Level</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" value={form.reorder_level}
                      onChange={(e) => setF('reorder_level', e.target.value)}
                      className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                      style={{ borderRadius: 0, width: 100 }} />
                    <span className="text-[11px] text-[#888]">{form.unit_type} — alerts when stock falls below this</span>
                  </div>
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">Selling Price (ex-GST)</label>
                  <input type="number" min="0" step="0.01" value={form.selling_price_ex_gst}
                    onChange={(e) => setF('selling_price_ex_gst', e.target.value)}
                    placeholder="₹ per unit"
                    className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0, width: 140 }} />
                  <label className="flex items-center justify-end pr-4 font-semibold text-[#333]">MRP (incl. GST)</label>
                  <input type="number" min="0" step="0.01" value={form.mrp}
                    onChange={(e) => setF('mrp', e.target.value)}
                    placeholder="₹ per unit"
                    className="border border-[#AAAAAA] bg-white px-2 py-[3px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0, width: 140 }} />
                </div>
              </>
            )}
            <div className="flex gap-3 border-t border-[#DDDDDD] bg-[#F9F9F9] px-4 py-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="border border-[#1B5E20] bg-[#1B5E20] px-5 py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
                style={{ borderRadius: 0 }}>
                {saving ? 'Saving…' : 'Accept (Ctrl+A)'}
              </button>
              {selectedProductId && mode === 'product' && (
                <button type="button" onClick={() => setMode('sku')}
                  className="border border-[#0D47A1] px-4 py-1 text-[12px] text-[#0D47A1] hover:bg-[#E3F2FD]"
                  style={{ borderRadius: 0 }}>
                  Add SKU →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="bg-[#FFF8E7] p-6 text-[13px] text-[#888]">Loading…</div>}>
      <ItemsInner />
    </Suspense>
  );
}
