'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useCreatePOMutation, useSuppliersQuery } from '@/hooks/usePurchaseQueries';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { TallySupplierPicker } from '@/components/tally/TallySupplierPicker';
import { TallyProductPicker } from '@/components/tally/TallyProductPicker';
import type { POLineInput } from '@/lib/supabase/purchase';
import type { SupplierRow } from '@/lib/supabase/purchase';
import { formatTallyAmount, formatTallyDate, roundMoney, splitGstForLine } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

type LineDraft = {
  sku_id: string | null;
  product_id: string | null;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
};

function buildPoLines(drafts: LineDraft[], intra: boolean) {
  const lines: POLineInput[] = [];
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  for (const d of drafts) {
    if (!d.product_name.trim() || d.quantity <= 0) continue;
    const taxable = roundMoney(d.quantity * d.rate);
    const split = splitGstForLine(taxable, d.gst_rate, intra);
    const amount = roundMoney(taxable + split.gst);
    lines.push({
      product_id: d.product_id,
      sku_id: d.sku_id,
      product_name: d.product_name,
      hsn_code: d.hsn_code || null,
      quantity: d.quantity,
      unit: d.unit,
      rate: d.rate,
      gst_rate: d.gst_rate,
      gst_amount: split.gst,
      amount,
    });
    subtotal += taxable;
    tax += split.gst;
    total += amount;
  }
  return { lines, subtotal: roundMoney(subtotal), tax: roundMoney(tax), total: roundMoney(total) };
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { dealer } = useAuth();
  const { items, productMasters } = useInventory();
  const { data: suppliers = [] } = useSuppliersQuery();
  const createPo = useCreatePOMutation();
  const setButtons = useTallySetButtons();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierRow, setSupplierRow] = useState<SupplierRow | null>(null);
  const [poDate] = useState(() => new Date());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    {
      sku_id: null,
      product_id: null,
      product_name: '',
      hsn_code: '',
      quantity: 1,
      unit: 'Bag',
      rate: 0,
      gst_rate: 5,
    },
  ]);
  const [acceptOpen, setAcceptOpen] = useState(false);

  useEffect(() => {
    setButtons([
      { label: 'Purchase', shortcut: 'F9' },
      { label: 'Send', shortcut: 'Alt+S' },
      { label: 'Date', shortcut: 'F2' },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const intra = useMemo(() => {
    const sc = supplierRow?.state_code?.trim() ?? '';
    const dc = dealer?.state_code?.trim() ?? '';
    return !!sc && !!dc && sc === dc;
  }, [supplierRow, dealer]);

  const totals = useMemo(() => buildPoLines(lines, intra), [lines, intra]);

  const save = useCallback(
    async (status: 'DRAFT' | 'SENT') => {
      if (!supplierId) {
        playTallyError();
        return;
      }
      if (totals.lines.length === 0) {
        playTallyError();
        return;
      }
      try {
        const id = await createPo.mutateAsync({
          supplierId,
          poDate,
          expectedDate: null,
          notes,
          status,
          items: totals.lines,
          userId: null,
        });
        playTallyAccept();
        router.push(`/tally/purchase/po/${id}`);
      } catch {
        playTallyError();
      }
    },
    [supplierId, totals.lines, createPo, notes, poDate, router]
  );

  useEffect(() => {
    const fn = () => setAcceptOpen(true);
    document.addEventListener('tally:save', fn);
    return () => document.removeEventListener('tally:save', fn);
  }, []);

  useHotkeys(
    'alt+s',
    (e) => {
      e.preventDefault();
      void save('SENT');
    },
    { enableOnFormTags: true }
  );

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Purchase Order — New
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
          <span className="ml-auto tabular-nums">PO Date: {formatTallyDate(poDate)}</span>
        </div>
        <div>
          <span className="font-semibold text-[#1B5E20]">Notes: </span>
          <input
            className="w-[min(100%,480px)] border border-[#AAAAAA] px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Product</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Qty</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Unit</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Rate</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">GST%</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right text-[#1B5E20]">Amount</th>
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
                  <td className="border border-[#AAAAAA] p-0">
                    <TallyProductPicker
                      items={items}
                      masters={productMasters}
                      valueSkuId={line.sku_id}
                      onChange={(row) => {
                        setLines((prev) => {
                          const next = [...prev];
                          const l = { ...next[idx] };
                          if (!row) {
                            l.sku_id = null;
                            l.product_name = '';
                            l.product_id = null;
                          } else {
                            l.sku_id = row.id || null;
                            l.product_id = row.productId;
                            l.product_name = row.label;
                            l.hsn_code = row.hsn;
                            l.gst_rate = row.gst;
                            l.unit = row.unit || l.unit;
                          }
                          next[idx] = l;
                          return next;
                        });
                      }}
                    />
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
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      className="w-full border-0 bg-transparent px-1 py-[2px] outline-none focus:bg-[#FFEB3B]"
                      value={line.unit}
                      onChange={(e) => {
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], unit: e.target.value };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent px-1 py-[2px] text-right outline-none focus:bg-[#FFEB3B]"
                      value={line.rate}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], rate: Number.isFinite(n) ? n : 0 };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[#AAAAAA] p-0">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent px-1 py-[2px] text-right outline-none focus:bg-[#FFEB3B]"
                      value={line.gst_rate}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setLines((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], gst_rate: Number.isFinite(n) ? n : 0 };
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

        <button
          type="button"
          className="w-fit border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-1 text-left hover:bg-[#FFEB3B]"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              {
                sku_id: null,
                product_id: null,
                product_name: '',
                hsn_code: '',
                quantity: 1,
                unit: 'Bag',
                rate: 0,
                gst_rate: 5,
              },
            ])
          }
        >
          + Add line
        </button>

        <div className="ml-auto grid w-[280px] gap-1 border border-[#AAAAAA] bg-[#FFFBF0] p-2 tabular-nums">
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
          <div className="text-[11px] text-[#666666]">{intra ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}</div>
        </div>
      </div>

      {acceptOpen ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40">
          <div className="w-[360px] border border-[#AAAAAA] bg-[#FFF8E7] p-3" style={{ borderRadius: 0 }}>
            <p className="mb-2 font-semibold text-[#1B5E20]">Accept ? Save as DRAFT</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-[#AAAAAA] bg-white px-3 py-1 hover:bg-[#FFEB3B]"
                onClick={() => {
                  setAcceptOpen(false);
                  void save('DRAFT');
                }}
              >
                Yes
              </button>
              <button type="button" className="border border-[#AAAAAA] bg-white px-3 py-1" onClick={() => setAcceptOpen(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
