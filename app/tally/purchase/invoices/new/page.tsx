'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreatePIMutation, useGRNQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import type { PILineInput } from '@/lib/supabase/purchase';
import { formatTallyAmount, formatTallyDate, roundMoney } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function NewPiInner() {
  const router = useRouter();
  const search = useSearchParams();
  const grnId = search.get('grn_id');
  const { data, isLoading } = useGRNQuery(grnId);
  const createPi = useCreatePIMutation();
  const setButtons = useTallySetButtons();

  const [invDate] = useState(() => new Date());
  const [supplierInv, setSupplierInv] = useState('');
  const [dueDate, setDueDate] = useState<string>(() => addDays(new Date(), 30).toISOString().slice(0, 10));

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Post', shortcut: 'Ctrl+A' },
      { label: 'Date', shortcut: 'F2' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const rawSuppliers = data?.grn ? (data.grn as { suppliers?: unknown }).suppliers : undefined;
  const supplier = (
    Array.isArray(rawSuppliers) ? rawSuppliers[0] : rawSuppliers
  ) as Record<string, unknown> | undefined;
  const creditDays = Number(supplier?.credit_days) || 30;

  useEffect(() => {
    const base = new Date(invDate);
    const d = addDays(base, creditDays);
    setDueDate(d.toISOString().slice(0, 10));
  }, [invDate, creditDays]);

  const lines = useMemo(() => {
    const its = (data?.items ?? []) as Record<string, unknown>[];
    return its.map((it) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const taxable = roundMoney(qty * rate);
      return {
        grn_item_id: String(it.id),
        product_id: (it.product_id as string) ?? null,
        sku_id: (it.sku_id as string) ?? null,
        product_name: String(it.product_name ?? ''),
        hsn_code: (it.hsn_code as string) ?? null,
        quantity: qty,
        unit: String(it.unit ?? 'Bag'),
        rate,
        discount_pct: 0,
        gst_rate: Number(it.gst_rate) || 0,
        cgst_amount: Number(it.cgst_amount) || 0,
        sgst_amount: Number(it.sgst_amount) || 0,
        igst_amount: Number(it.igst_amount) || 0,
        gst_amount: Number(it.gst_amount) || 0,
        amount: Number(it.amount) || roundMoney(taxable + (Number(it.gst_amount) || 0)),
        batch_number: (it.batch_number as string) ?? null,
        expiry_date: (it.expiry_date as string) ?? null,
      } as PILineInput;
    });
  }, [data?.items]);

  const totals = useMemo(() => {
    let sub = 0;
    let cg = 0;
    let sg = 0;
    let ig = 0;
    let tax = 0;
    let tot = 0;
    for (const l of lines) {
      const taxable = roundMoney(l.quantity * l.rate);
      sub += taxable;
      cg += l.cgst_amount;
      sg += l.sgst_amount;
      ig += l.igst_amount;
      tax += l.gst_amount;
      tot += l.amount;
    }
    return {
      subtotal: roundMoney(sub),
      cgst: roundMoney(cg),
      sgst: roundMoney(sg),
      igst: roundMoney(ig),
      tax: roundMoney(tax),
      total: roundMoney(tot),
    };
  }, [lines]);

  const save = useCallback(async () => {
    if (!data?.grn || !grnId) {
      playTallyError();
      return;
    }
    const g = data.grn as Record<string, unknown>;
    try {
      const id = await createPi.mutateAsync({
        supplierId: String(g.supplier_id),
        grnId,
        invoiceDate: invDate,
        dueDate: new Date(dueDate),
        supplierInvNo: supplierInv || undefined,
        notes: undefined,
        subtotal: totals.subtotal,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        tax_amount: totals.tax,
        round_off: 0,
        total_amount: totals.total,
        balance_due: totals.total,
        items: lines,
        userId: null,
      });
      playTallyAccept();
      router.push(`/tally/purchase/invoices/${id}`);
    } catch {
      playTallyError();
    }
  }, [
    data?.grn,
    grnId,
    createPi,
    invDate,
    dueDate,
    supplierInv,
    totals,
    lines,
    router,
  ]);

  useEffect(() => {
    const fn = () => void save();
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, [save]);

  if (!grnId) {
    return (
      <div className="p-3 text-[13px]">
        Open from a posted GRN (add ?grn_id=…) or{' '}
        <Link href="/tally/purchase/grn" className="underline">
          pick a GRN
        </Link>
        .
      </div>
    );
  }

  if (isLoading || !data) return <div className="p-3 text-[13px]">Loading…</div>;

  const g = data.grn as Record<string, unknown>;
  const supName = (supplier?.name as string | undefined) ?? '—';

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Purchase Invoice — New
      </div>
      <div className="border border-[#AAAAAA] bg-white p-2">
        <div>Supplier: {supName}</div>
        <div>Against GRN: {String(g.grn_number)}</div>
        <div className="mt-1 flex flex-wrap gap-2">
          <label>
            Supplier Inv #:{' '}
            <input
              className="border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
              value={supplierInv}
              onChange={(e) => setSupplierInv(e.target.value)}
            />
          </label>
          <label>
            Date:{' '}
            <span className="tabular-nums">{formatTallyDate(invDate)}</span>
          </label>
          <label>
            Due:{' '}
            <input
              type="date"
              className="border border-[#AAAAAA] px-1 py-[2px]"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <table className="mt-2 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Qty</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Amt</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{l.product_name}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(l.quantity)}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(l.rate)}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {formatTallyAmount(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-2 w-[280px] border border-[#AAAAAA] bg-[#FFFBF0] p-2 tabular-nums">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatTallyAmount(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST</span>
            <span>{formatTallyAmount(totals.cgst)}</span>
          </div>
          <div className="flex justify-between">
            <span>SGST</span>
            <span>{formatTallyAmount(totals.sgst)}</span>
          </div>
          <div className="flex justify-between">
            <span>IGST</span>
            <span>{formatTallyAmount(totals.igst)}</span>
          </div>
          <div className="flex justify-between font-bold text-[#1B5E20]">
            <span>Total</span>
            <span>{formatTallyAmount(totals.total)}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[#666666]">Ctrl+A: Save PI · Open detail to post voucher</p>
      </div>
    </div>
  );
}

export default function NewPurchaseInvoicePage() {
  return (
    <Suspense fallback={<div className="p-3">Loading…</div>}>
      <NewPiInner />
    </Suspense>
  );
}
