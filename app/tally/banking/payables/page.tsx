'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { TallyBillSettlement, type BillSettlementInvoice } from '@/components/tally/TallyBillSettlement';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import {
  useBankAccountsQuery,
  usePayablesAgeingQuery,
  usePostSupplierPaymentMutation,
  useSupplierPiOutstandingQuery,
} from '@/hooks/useBankingQueries';
import { useAuth } from '@/contexts/AuthContext';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import type { SettlementInput } from '@/lib/supabase/banking';
import { supabase } from '@/lib/supabase/client';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function OutstandingPayablesPage() {
  const router = useRouter();
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const dateRef = useRef<HTMLInputElement>(null);
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [sel, setSel] = useState(0);
  const [panelSid, setPanelSid] = useState<string | null>(null);

  const { data: ageing = [], isLoading, refetch } = usePayablesAgeingQuery(asOn);
  const { data: banks = [] } = useBankAccountsQuery();
  const { data: pis = [], refetch: refetchPi } = useSupplierPiOutstandingQuery(panelSid);
  const mut = usePostSupplierPaymentMutation();
  const [settleOpen, setSettleOpen] = useState(false);

  const setButtons = useTallySetButtons();

  const grandTotal = ageing.reduce((s, r) => s + Number(r.total_due ?? 0), 0);

  const exportCsv = useCallback(() => {
    const hdr = ageing.map((r) =>
      [r.supplier_name, r.mobile ?? '', r.bucket_0_30, r.bucket_31_60, r.bucket_61_90, r.bucket_90_plus, r.total_due].join(',')
    );
    const csv = ['Supplier,Mobile,0-30,31-60,61-90,90+,Total', ...hdr].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `payables_${asOn}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    playTallyAccept();
  }, [ageing, asOn]);

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => dateRef.current?.showPicker?.() },
      { label: 'Export', shortcut: 'Alt+E', onClick: exportCsv },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportCsv]);

  useHotkeys('enter', () => {
    const r = ageing[sel];
    if (r?.supplier_id) setPanelSid(String(r.supplier_id));
  });
  useHotkeys('f2', (e) => {
    e.preventDefault();
    dateRef.current?.showPicker?.();
  });

  const listInv: BillSettlementInvoice[] = useMemo(
    () =>
      pis.map((row) => ({
        id: String((row as Record<string, unknown>).id),
        label: String((row as Record<string, unknown>).pi_number ?? ''),
        invoice_date: String((row as Record<string, unknown>).invoice_date ?? '').slice(0, 10),
        due_date: (row as Record<string, unknown>).due_date ? String((row as Record<string, unknown>).due_date).slice(0, 10) : null,
        outstanding: Number((row as Record<string, unknown>).balance_due ?? 0),
      })),
    [pis]
  );

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Outstanding Payables
      </div>
      <div className="flex flex-wrap gap-3 border border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2">
          As on:
          <input ref={dateRef} type="date" className="border border-[#AAAAAA] px-1" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
        </label>
        <span className="font-semibold tabular-nums">Total: ₹{formatTallyAmount(grandTotal)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] border-t-0 bg-white">
        {isLoading ? (
          <div className="p-3">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-[#F0F0F0]">
              <tr>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Supplier</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">0–30</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">31–60</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">61–90</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">90+</th>
              </tr>
            </thead>
            <tbody>
              {ageing.map((r, i) => {
                const red = Number(r.bucket_90_plus ?? 0) > 0;
                return (
                  <tr
                    key={r.supplier_id}
                    style={{ background: sel === i ? '#0D47A1' : '', color: sel === i ? '#fff' : red ? '#D32F2F' : undefined, cursor: 'pointer' }}
                    onClick={() => setSel(i)}
                    onDoubleClick={() => setPanelSid(String(r.supplier_id))}
                  >
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.supplier_name}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(Number(r.bucket_0_30 ?? 0))}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(Number(r.bucket_31_60 ?? 0))}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(Number(r.bucket_61_90 ?? 0))}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(Number(r.bucket_90_plus ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="border border-[#AAAAAA] bg-[#F5F5F5] p-2">
        <button
          type="button"
          className="tally-button-bar-btn px-3"
          onClick={() =>
            ageing[sel]?.supplier_id && (setPanelSid(String(ageing[sel].supplier_id)), setSettleOpen(true))
          }
        >
          Make Payment
        </button>
        <button type="button" className="tally-button-bar-btn ml-2 px-3" onClick={exportCsv}>
          Export
        </button>
      </div>

      {panelSid ? (
        <div className="fixed inset-0 z-[370] bg-black/30 p-6" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setPanelSid(null)}>
          <div className="mx-auto max-h-[88vh] max-w-4xl overflow-auto border border-[#AAAAAA] bg-[#FFF8E7] p-2">
            <div className="mb-2 flex justify-between bg-[#1B5E20] px-2 py-1 text-white">
              <span>PI Outstanding</span>
              <button type="button" className="bg-[#F5F5F5] px-2 text-black" onClick={() => setPanelSid(null)}>
                Close
              </button>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#F0F0F0]">
                  <th className="border border-[#AAAAAA] px-1 text-left">PI</th>
                  <th className="border px-1 text-left">Date</th>
                  <th className="border px-1 text-right">Due</th>
                  <th className="border px-1 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {pis.map((pi) => {
                  const p = pi as Record<string, unknown>;
                  return (
                    <tr key={String(p.id)} onDoubleClick={() => router.push(`/tally/purchase/invoices/${String(p.id)}`)}>
                      <td className="border border-[#AAAAAA] px-1">{String(p.pi_number ?? '')}</td>
                      <td className="border border-[#AAAAAA] px-1">{formatTallyDate(String(p.invoice_date ?? ''))}</td>
                      <td className="border border-[#AAAAAA] px-1">{p.due_date ? formatTallyDate(String(p.due_date)) : '—'}</td>
                      <td className="border border-[#AAAAAA] px-1 text-right">{formatTallyAmount(Number(p.balance_due ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="tally-button-bar-btn mt-2 px-3" onClick={() => setSettleOpen(true)}>
              Make Payment (allocations)
            </button>
          </div>
        </div>
      ) : null}

      {settleOpen && panelSid ? (
        <PaySettlementModal
          dealerId={dealerId}
          supplierId={panelSid}
          banks={banks}
          invoices={listInv}
          onClose={() => setSettleOpen(false)}
          onDone={async () => {
            setSettleOpen(false);
            await refetch();
            await refetchPi();
            playTallyAccept();
          }}
          mut={mut}
        />
      ) : null}
    </div>
  );
}

function PaySettlementModal({
  dealerId,
  supplierId,
  banks,
  invoices,
  onClose,
  onDone,
  mut,
}: {
  dealerId: string;
  supplierId: string;
  banks: Array<{ id: string; ledger_id: string | null; account_name: string }>;
  invoices: BillSettlementInvoice[];
  onClose: () => void;
  onDone: () => Promise<void>;
  mut: ReturnType<typeof usePostSupplierPaymentMutation>;
}) {
  const [bankSel, setBankSel] = useState(banks.filter((b) => b.ledger_id)[0]?.id ?? '');
  const [amt, setAmt] = useState(() => String(invoices.reduce((s, i) => s + i.outstanding, 0)));
  const [settles, setSettles] = useState<SettlementInput[]>([]);
  const bank = banks.find((b) => b.id === bankSel);
  const pay = Math.round(Number(String(amt).replace(/,/g, '')) * 100) / 100;

  const save = async () => {
    if (!bank?.ledger_id) return playTallyError();
    const { data: sup } = await supabase.from('suppliers').select('ledger_id,name').eq('id', supplierId).maybeSingle();
    let partyLedger = (sup?.ledger_id as string | null) ?? null;
    if (!partyLedger) {
      /** Try mirror creditor ledger create */
      const name = (sup?.name as string | undefined)?.trim() ?? supplierId.slice(0, 8);
      partyLedger = await tryCreditorLedger(dealerId, name);
    }
    const bankLedgerId = bank.ledger_id!;
    if (!partyLedger) {
      playTallyError();
      window.alert('Supplier ledger missing');
      return;
    }
    const alloc =
      settles.length > 0
        ? settles
        : waterfallPi(invoices, pay);

    const sum = alloc.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(sum - pay) > 0.02) return playTallyError();

    try {
      await mut.mutateAsync({
        dealerId,
        supplierId,
        supplierName: typeof sup?.name === 'string' ? sup.name : undefined,
        amount: pay,
        bankLedgerId,
        partyLedgerId: partyLedger,
        voucherDate: new Date().toISOString().slice(0, 10),
        settlements: alloc,
      });
      await onDone();
    } catch {
      playTallyError();
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl border border-[#AAAAAA] bg-[#FFF8E7] p-4 text-[13px]">
        <div className="mb-2 flex justify-between font-semibold text-[#1B5E20]">
          <span>Make Payment</span>
          <button type="button" className="border border-[#AAAAAA] px-2" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Bank</span>
          <select className="border border-[#AAAAAA]" value={bankSel} onChange={(e) => setBankSel(e.target.value)}>
            {banks.filter((b) => b.ledger_id).map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Amount</span>
          <input className="border border-[#AAAAAA]" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </label>
        <TallyBillSettlement partyType="SUPPLIER" totalAmount={pay} invoices={invoices} onChange={setSettles} />
        <button type="button" className="tally-button-bar-btn mt-3 px-4" onClick={() => window.confirm('Accept? Yes/No') && void save()}>
          Accept (Ctrl+A simulation)
        </button>
      </div>
    </div>
  );
}

function waterfallPi(invoices: BillSettlementInvoice[], pay: number): SettlementInput[] {
  let left = Math.round(pay * 100) / 100;
  const acc: SettlementInput[] = [];
  for (const i of invoices) {
    const ap = Math.min(i.outstanding, left);
    if (ap > 0) acc.push({ invoice_id: i.id, invoice_type: 'PURCHASE', amount: ap });
    left -= ap;
    if (left <= 0) break;
  }
  return acc;
}

async function tryCreditorLedger(dealerId: string, supplierName: string): Promise<string | null> {
  const codes = ['SUNDRY_CREDITORS', 'SUNDRY_CREDIT', 'SC'];
  for (const code of codes) {
    const g = await supabase.from('ledger_groups').select('id').eq('dealer_id', dealerId).eq('group_code', code).maybeSingle();
    if (!g.error && g.data?.id) {
      const ins = await supabase
        .from('ledgers')
        .insert({
          dealer_id: dealerId,
          name: supplierName.slice(0, 120),
          ledger_group_id: g.data.id,
          ledger_code: `SC_TMP_${Date.now().toString(36)}`,
        })
        .select('id')
        .single();
      if (!ins.error && ins.data?.id) return ins.data.id as string;
    }
  }
  return null;
}
