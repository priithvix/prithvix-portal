'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateGRNMutation, usePurchaseOrderQuery, useSuppliersQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { TallySupplierPicker } from '@/components/tally/TallySupplierPicker';
import type { GRNLineInput, SupplierRow } from '@/lib/supabase/purchase';
import { formatTallyAmount, formatTallyDate, roundMoney, splitGstForLine } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

type LineDraft = {
  po_item_id: string | null;
  product_id: string | null;
  sku_id: string | null;
  product_name: string;
  hsn_code: string;
  ordered_qty: number | null;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  batch_number: string;
  expiry_date: string;
};

function buildGrnLines(drafts: LineDraft[], intra: boolean) {
  const lines: GRNLineInput[] = [];
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  for (const d of drafts) {
    if (!d.product_name.trim() || d.quantity <= 0) continue;
    const taxable = roundMoney(d.quantity * d.rate);
    const split = splitGstForLine(taxable, d.gst_rate, intra);
    const amount = roundMoney(taxable + split.gst);
    lines.push({
      po_item_id: d.po_item_id,
      product_id: d.product_id,
      sku_id: d.sku_id,
      product_name: d.product_name,
      hsn_code: d.hsn_code || null,
      quantity: d.quantity,
      unit: d.unit,
      rate: d.rate,
      gst_rate: d.gst_rate,
      cgst_amount: split.cgst,
      sgst_amount: split.sgst,
      igst_amount: split.igst,
      gst_amount: split.gst,
      amount,
      batch_number: d.batch_number || null,
      expiry_date: d.expiry_date ? d.expiry_date : null,
    });
    subtotal += taxable;
    tax += split.gst;
    total += amount;
  }
  return { lines, subtotal: roundMoney(subtotal), tax: roundMoney(tax), total: roundMoney(total) };
}

function NewGrnContent() {
  const router = useRouter();
  const search = useSearchParams();
  const poId = search.get('po_id');
  const { dealer } = useAuth();
  const { data: suppliers = [] } = useSuppliersQuery();
  const { data: poData } = usePurchaseOrderQuery(poId);
  const createGrn = useCreateGRNMutation();
  const setButtons = useTallySetButtons();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierRow, setSupplierRow] = useState<SupplierRow | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [grnDate] = useState(() => new Date());
  const [vehicle, setVehicle] = useState('');
  const [lr, setLr] = useState('');

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'GRN', shortcut: 'Alt+G' },
      { label: 'Date', shortcut: 'F2' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  useEffect(() => {
    if (!poData?.order) return;
    const supId = poData.order.supplier_id as string;
    setSupplierId(supId);
    const sup = suppliers.find((s) => s.id === supId);
    if (sup) setSupplierRow(sup);
    const its = (poData.items ?? []) as Record<string, unknown>[];
    setLines(
      its.map((it) => ({
        po_item_id: String(it.id),
        product_id: (it.product_id as string) ?? null,
        sku_id: (it.sku_id as string) ?? null,
        product_name: String(it.product_name ?? ''),
        hsn_code: String(it.hsn_code ?? ''),
        ordered_qty: Number(it.quantity) || 0,
        quantity: Number(it.quantity) || 0,
        unit: String(it.unit ?? 'Bag'),
        rate: Number(it.rate) || 0,
        gst_rate: Number(it.gst_rate) || 0,
        batch_number: '',
        expiry_date: '',
      }))
    );
  }, [poData, suppliers]);

  const intra = useMemo(() => {
    const sc = supplierRow?.state_code?.trim() ?? '';
    const dc = dealer?.state_code?.trim() ?? '';
    return !!sc && !!dc && sc === dc;
  }, [supplierRow, dealer]);

  const totals = useMemo(() => buildGrnLines(lines, intra), [lines, intra]);

  const save = useCallback(async () => {
    if (!supplierId || totals.lines.length === 0) {
      playTallyError();
      return;
    }
    try {
      const id = await createGrn.mutateAsync({
        supplierId,
        poId: poId || null,
        grnDate,
        vehicleNumber: vehicle,
        lrNumber: lr,
        items: totals.lines,
        userId: null,
      });
      playTallyAccept();
      router.push(`/tally/purchase/grn/${id}`);
    } catch {
      playTallyError();
    }
  }, [supplierId, totals.lines, createGrn, poId, grnDate, vehicle, lr, router]);

  useEffect(() => {
    const fn = () => {
      void save();
    };
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, [save]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Goods Receipt Note — New
      </div>
      <div className="flex flex-col gap-2 border border-[#AAAAAA] bg-white p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#1B5E20]">Supplier:</span>
          <TallySupplierPicker
            suppliers={suppliers}
            valueId={supplierId}
            onChange={(s) => {
              setSupplierRow(s);
              setSupplierId(s?.id ?? null);
            }}
          />
          <span className="ml-auto tabular-nums">GRN Date: {formatTallyDate(grnDate)}</span>
        </div>
        {poData?.order ? (
          <div>
            Against PO: <span className="font-medium">{poData.order.po_number}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1">
            Vehicle:
            <input
              className="border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1">
            LR:
            <input
              className="border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
              value={lr}
              onChange={(e) => setLr(e.target.value)}
            />
          </label>
        </div>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Ord</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Recd</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Batch</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Expiry</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Amt</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const split = splitGstForLine(
                roundMoney(line.quantity * line.rate),
                line.gst_rate,
                intra
              );
              const amount = roundMoney(line.quantity * line.rate + split.gst);
              return (
                <tr key={idx}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{line.product_name}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {line.ordered_qty != null ? formatTallyAmount(line.ordered_qty) : '—'}
                  </td>
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent px-1 py-[2px] text-right outline-none focus:bg-[#FFEB3B]"
                      value={line.quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], quantity: Number.isFinite(n) ? n : 0 };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {formatTallyAmount(line.rate)}
                  </td>
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      className="w-full border-0 bg-transparent px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
                      value={line.batch_number}
                      onChange={(e) => {
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], batch_number: e.target.value };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      type="date"
                      className="w-full border-0 bg-transparent px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
                      value={line.expiry_date}
                      onChange={(e) => {
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], expiry_date: e.target.value };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {formatTallyAmount(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ml-auto w-[260px] border border-[#AAAAAA] bg-[#FFFBF0] p-2 tabular-nums">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatTallyAmount(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST</span>
            <span>{formatTallyAmount(totals.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#1B5E20]">
            <span>Total</span>
            <span>{formatTallyAmount(totals.total)}</span>
          </div>
        </div>

        <p className="text-[11px] text-[#666666]">Ctrl+A: save GRN · Then open detail to Post inventory</p>
        <Link href="/tally/purchase/grn" className="w-fit text-[#1B5E20] underline">
          GRN list
        </Link>
      </div>
    </div>
  );
}

export default function NewGrnPage() {
  return (
    <Suspense fallback={<div className="p-3 text-[13px]">Loading…</div>}>
      <NewGrnContent />
    </Suspense>
  );
}
