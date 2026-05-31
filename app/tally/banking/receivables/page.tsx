'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { TallyBillSettlement, type BillSettlementInvoice } from '@/components/tally/TallyBillSettlement';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import {
  useBankAccountsQuery,
  useComputeInterestMutation,
  useFarmerSalesOutstandingQuery,
  useInterestPreviewQuery,
  usePostFarmerReceiptMutation,
  useReceivablesAgeingQuery,
  tryResolveDebtorLedger,
} from '@/hooks/useBankingQueries';
import { useAuth } from '@/contexts/AuthContext';
import {
  blockFarmer,
  getFarmerCreditRow,
  getFarmerSaleOutstandings,
  postFarmerPaymentReceiptRpc,
  postOverdueInterest,
  type SaleOutstandingRow,
  type SettlementInput,
} from '@/lib/supabase/banking';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { downloadDunningLetterPdf } from '@/lib/pdf/dunning-letter';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

type BucketKey = 'all' | '0-30' | '31-60' | '61-90' | '90+' | 'blocked';

function bucketFilter(r: Record<string, unknown>, k: BucketKey): boolean {
  if (k === 'all') return true;
  const blocked = r.credit_blocked === true;
  if (k === 'blocked') return blocked;
  const b30 = Number(r.bucket_0_30 ?? 0);
  const b60 = Number(r.bucket_31_60 ?? 0);
  const b90 = Number(r.bucket_61_90 ?? 0);
  const b90p = Number(r.bucket_90_plus ?? 0);
  if (blocked) return false;
  if (k === '0-30') return b30 > 0;
  if (k === '31-60') return b60 > 0;
  if (k === '61-90') return b90 > 0;
  if (k === '90+') return b90p > 0;
  return true;
}

function rowStyle(blocked: boolean, b90p: number, b61: number, filter: BucketKey, selected: boolean) {
  if (selected) return { background: '#0D47A1', color: '#fff' };
  const red = '#D32F2F';
  const orange = '#E65100';
  if (blocked || b90p > 0) return { color: red };
  if ((filter === '61-90' || filter === 'all') && b61 > 0) return { color: orange };
  return {};
}

export default function OutstandingReceivablesPage() {
  const { dealer, session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const dealerRowId = session?.dealerRowId ?? '';
  const dateRef = useRef<HTMLInputElement>(null);
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<BucketKey>('all');
  const [sel, setSel] = useState(0);

  const { data: ageing = [], isLoading, refetch } = useReceivablesAgeingQuery(asOn);
  const { data: banks = [] } = useBankAccountsQuery();
  const postRct = usePostFarmerReceiptMutation();
  const computeInt = useComputeInterestMutation();
  const [panelFarmerId, setPanelFarmerId] = useState<string | null>(null);

  const [settleOpen, setSettleOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);

  const { data: previewRows = [], refetch: refetchPreview } = useInterestPreviewQuery(interestOpen);

  const { data: osInvoices = [], refetch: refetchInvoices } = useFarmerSalesOutstandingQuery(panelFarmerId);
  const setButtons = useTallySetButtons();

  const rows = useMemo(() => ageing.filter((r) => bucketFilter(r as unknown as Record<string, unknown>, filter)), [ageing, filter]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.a += Number(r.bucket_0_30 ?? 0);
          acc.b += Number(r.bucket_31_60 ?? 0);
          acc.c += Number(r.bucket_61_90 ?? 0);
          acc.d += Number(r.bucket_90_plus ?? 0);
          return acc;
        },
        { a: 0, b: 0, c: 0, d: 0 }
      ),
    [rows]
  );

  const grandTotal = rows.reduce((s, r) => s + Number(r.total_due ?? 0), 0);

  const exportCsv = useCallback(() => {
    const header = ['Farmer', 'Mobile', '0-30', '31-60', '61-90', '90+', 'Total', 'Blocked'];
    const body = ageing.map((r) =>
      [
        r.farmer_name,
        r.mobile ?? '',
        r.bucket_0_30,
        r.bucket_31_60,
        r.bucket_61_90,
        r.bucket_90_plus,
        r.total_due,
        r.credit_blocked ? 'YES' : 'NO',
      ].join(',')
    );
    const blob = new Blob([header.join(',') + '\n' + body.join('\n')], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `receivables_${asOn}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    playTallyAccept();
  }, [ageing, asOn]);

  const handleBlockSelected = useCallback(async () => {
    const r = rows[sel];
    if (!r?.farmer_id) return;
    if (!window.confirm('Accept? Credit-block this farmer? Yes or No')) return;
    try {
      await blockFarmer(String(r.farmer_id), 'Blocked from receivables screen');
      playTallyAccept();
      await refetch();
    } catch {
      playTallyError();
    }
  }, [rows, sel, refetch]);

  /** Greedy waterfall allocation helper */
  const buildAutoAllocations = useCallback((inv: SaleOutstandingRow[], pay: number): SettlementInput[] => {
    let left = Math.round(pay * 100) / 100;
    const acc: SettlementInput[] = [];
    for (const s of inv) {
      const ap = Math.min(s.balance_due, left);
      if (ap > 0)
        acc.push({
          invoice_id: s.id,
          invoice_type: 'SALE',
          amount: Math.round(ap * 100) / 100,
        });
      left -= ap;
      if (left <= 0) break;
    }
    return acc;
  }, []);

  const sendRemindersFor = useCallback(
    async (fid: string) => {
      try {
        const cr = rows.find((x) => String(x.farmer_id) === fid);
        const farmerName = cr?.farmer_name ?? '';
        const invList = fid === panelFarmerId ? osInvoices : await getFarmerSaleOutstandings(dealerId, fid);
        await downloadDunningLetterPdf({
          farmerName,
          shopInfo: {
            name: dealer?.company_name ?? session?.shopName ?? 'Shop',
            address:
              [dealer?.address, dealer?.village, dealer?.district, dealer?.pin_code].filter(Boolean).join(', ') || '—',
            gstin: dealer?.gstin,
            mobile: dealer?.mobile,
          },
          interestAmount: 0,
          interestRatePct: Number((await getFarmerCreditRow(fid))?.interest_rate ?? 0),
          invoices: invList.map((inv, idx) => ({
            id: inv.id,
            invoice_number: `SALE-${idx + 1}`,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date ?? inv.invoice_date,
            balance_due: inv.balance_due,
          })),
        });
        playTallyAccept();
      } catch {
        playTallyError();
      }
    },
    [dealer, dealerId, session, rows, panelFarmerId, osInvoices]
  );

  const computeAndPreview = useCallback(async () => {
    setInterestOpen(true);
    await computeInt.mutateAsync(new Date(asOn));
    await refetchPreview();
  }, [asOn, computeInt, refetchPreview]);

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => dateRef.current?.showPicker?.() ?? dateRef.current?.focus() },
      { label: 'Settle', shortcut: 'Alt+S', onClick: () => panelFarmerId && setSettleOpen(true) },
      { label: 'Block', shortcut: 'Alt+B', onClick: () => void handleBlockSelected() },
      { label: 'Interest', shortcut: 'Alt+I', onClick: () => setInterestOpen(true) },
      { label: 'Export', shortcut: 'Alt+E', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, panelFarmerId, handleBlockSelected, exportCsv]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    dateRef.current?.showPicker?.() ?? dateRef.current?.focus();
  });
  useHotkeys(
    'enter',
    (e) => {
      const r = rows[sel];
      if (r?.farmer_id) {
        e.preventDefault();
        setPanelFarmerId(String(r.farmer_id));
      }
    },
    { enabled: rows.length > 0 }
  );
  useHotkeys('alt+e', () => exportCsv());

  function openFarmer(fid: string) {
    setPanelFarmerId(fid);
  }

  const selectedFarmerRow = rows[sel];

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Outstanding Receivables
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-[13px]">
          As on:
          <input
            ref={dateRef}
            type="date"
            className="border border-[#AAAAAA] px-1"
            value={asOn}
            onChange={(e) => setAsOn(e.target.value)}
          />
        </label>
        <span className="font-semibold tabular-nums">Total Outstanding: ₹{formatTallyAmount(grandTotal)}</span>
      </div>

      <div className="flex flex-wrap gap-1 border border-t-0 border-[#AAAAAA] bg-[#F5F5F5] px-2 py-1">
        {(['all', '0-30', '31-60', '61-90', '90+', 'blocked'] as BucketKey[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`border border-[#AAAAAA] px-2 py-[2px] text-[11px] ${filter === t ? 'bg-[#FFEB3B]' : 'bg-white'}`}
            onClick={() => {
              setFilter(t);
              setSel(0);
            }}
          >
            {t === 'all' ? 'All' : t === '90+' ? '90+ Days' : t === 'blocked' ? 'Blocked' : `${t.replace('-', '\u2013')} Days`}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] border-t-0 bg-white">
        {isLoading ? (
          <div className="p-3">Loading\u2026</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Farmer Name</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Mobile</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">0\u201330</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">31\u201360</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">61\u201390</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">90+</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const b30 = Number(r.bucket_0_30 ?? 0);
                const b60 = Number(r.bucket_31_60 ?? 0);
                const b61 = Number(r.bucket_61_90 ?? 0);
                const b90p = Number(r.bucket_90_plus ?? 0);
                const blocked = !!r.credit_blocked;
                return (
                  <tr
                    key={r.farmer_id}
                    style={{
                      ...rowStyle(blocked, b90p, b61, filter, sel === i),
                      cursor: 'pointer',
                    }}
                    onClick={() => setSel(i)}
                    onDoubleClick={() => openFarmer(String(r.farmer_id))}
                  >
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{blocked ? '\u26D4 ' : ''}{r.farmer_name}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{r.mobile ?? '\u2014'}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {b30 ? formatTallyAmount(b30) : '\u2014'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {b60 ? formatTallyAmount(b60) : '\u2014'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {b61 ? formatTallyAmount(b61) : '\u2014'}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {b90p ? formatTallyAmount(b90p) : '\u2014'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={2} className="border border-[#AAAAAA] px-1 py-1">
                  TOTAL
                </td>
                <td className="border border-[#AAAAAA] px-1 py-1 text-right">{formatTallyAmount(totals.a)}</td>
                <td className="border border-[#AAAAAA] px-1 py-1 text-right">{formatTallyAmount(totals.b)}</td>
                <td className="border border-[#AAAAAA] px-1 py-1 text-right">{formatTallyAmount(totals.c)}</td>
                <td className="border border-[#AAAAAA] px-1 py-1 text-right">{formatTallyAmount(totals.d)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-2">
        <button
          type="button"
          className="tally-button-bar-btn px-3"
          onClick={() =>
            selectedFarmerRow?.farmer_id ? void sendRemindersFor(String(selectedFarmerRow.farmer_id)) : undefined
          }
        >
          Send Reminders
        </button>
        <button
          type="button"
          className="tally-button-bar-btn px-3"
          onClick={() => {
            const fid = selectedFarmerRow?.farmer_id;
            if (!fid) return;
            const s = String(fid);
            setPanelFarmerId(s);
            setSettleOpen(true);
          }}
        >
          Settle Payment
        </button>
        <button type="button" className="tally-button-bar-btn px-3" onClick={() => void computeAndPreview()}>
          Compute Interest
        </button>
        <button type="button" className="tally-button-bar-btn px-3" onClick={exportCsv}>
          Export
        </button>
      </div>

      {panelFarmerId ? (
        <BillWisePanel
          farmerId={panelFarmerId}
          farmerLabel={rows.find((x) => String(x.farmer_id) === panelFarmerId)?.farmer_name ?? ''}
          invoices={osInvoices}
          onClose={() => setPanelFarmerId(null)}
          onRefresh={() => {
            void refetchInvoices();
            void refetch();
          }}
          onSettle={() => setSettleOpen(true)}
          onRemind={() => void sendRemindersFor(panelFarmerId)}
        />
      ) : null}

      {settleOpen && panelFarmerId ? (
        <SettleModal
          dealerId={dealerId}
          farmerId={panelFarmerId}
          farmerName={selectedFarmerRow?.farmer_name ?? ''}
          banks={banks}
          invoices={osInvoices}
          buildAutoAllocations={buildAutoAllocations}
          onClose={() => setSettleOpen(false)}
          onDone={async () => {
            setSettleOpen(false);
            await refetch();
            await refetchInvoices();
            playTallyAccept();
          }}
          postMutation={postRct}
        />
      ) : null}

      {interestOpen ? (
        <InterestModal
          dealerSlug={dealerId}
          dealerRowId={dealerRowId}
          rows={(previewRows as Record<string, unknown>[]) ?? []}
          loading={computeInt.isPending}
          onClose={() => setInterestOpen(false)}
          onCompute={async () => {
            await computeInt.mutateAsync(new Date(asOn));
            await refetchPreview();
          }}
        />
      ) : null}
    </div>
  );
}

function BillWisePanel({
  farmerLabel,
  invoices,
  onClose,
  onRefresh,
  onSettle,
  onRemind,
}: {
  farmerId: string;
  farmerLabel: string;
  invoices: SaleOutstandingRow[];
  onClose: () => void;
  onRefresh: () => void;
  onSettle: () => void;
  onRemind: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[380] bg-black/30 p-8"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="mx-auto flex h-full max-w-5xl flex-col border border-[#AAAAAA] bg-[#FFF8E7]"
        role="presentation"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between border-b border-[#AAAAAA] bg-[#1B5E20] px-2 py-1 text-white">
          <span className="font-semibold">
            {farmerLabel}
            {' — '}
            Bill-wise Outstanding
          </span>
          <button type="button" className="bg-transparent text-white underline" onClick={() => void onRefresh()}>
            Refresh
          </button>
          <button type="button" className="border border-[#AAAAAA] bg-[#F5F5F5] px-2 text-black" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Invoice</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left">Due</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right">Amount</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">SALE/{String(inv.id).slice(-8)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{formatTallyDate(inv.invoice_date)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">
                    {inv.due_date ? formatTallyDate(inv.due_date) : '\u2014'}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(inv.final_amount)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(inv.balance_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 border-t border-[#AAAAAA] bg-[#F5F5F5] p-2">
          <button type="button" className="tally-button-bar-btn px-3" onClick={onSettle}>
            Settle Payment
          </button>
          <button type="button" className="tally-button-bar-btn px-3" onClick={onRemind}>
            Print Statement
          </button>
        </div>
      </div>
    </div>
  );
}

function SettleModal({
  dealerId,
  farmerId,
  farmerName,
  banks,
  invoices,
  buildAutoAllocations,
  onClose,
  onDone,
  postMutation,
}: {
  dealerId: string;
  farmerId: string;
  farmerName: string;
  banks: Array<{ id: string; ledger_id: string | null; account_name: string }>;
  invoices: SaleOutstandingRow[];
  buildAutoAllocations: (inv: SaleOutstandingRow[], pay: number) => SettlementInput[];
  onClose: () => void;
  onDone: () => Promise<void>;
  postMutation: ReturnType<typeof usePostFarmerReceiptMutation>;
}) {
  const withLedger = useMemo(() => banks.filter((b) => b.ledger_id), [banks]);
  const list: BillSettlementInvoice[] = useMemo(
    () =>
      invoices.map((inv) => ({
        id: inv.id,
        label: inv.id.slice(0, 12),
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        outstanding: inv.balance_due,
      })),
    [invoices]
  );

  const [bankSel, setBankSel] = useState(withLedger[0]?.id ?? '');
  const [amount, setAmount] = useState(() => String(Math.round(invoices.reduce((s, i) => s + i.balance_due, 0) * 100) / 100));
  const [settlements, setSettlements] = useState<SettlementInput[]>([]);
  const [busy, setBusy] = useState(false);

  const bank = banks.find((b) => b.id === bankSel);
  const payAmt = Math.round(Number(String(amount).replace(/,/g, '')) * 100) / 100;

  const save = async () => {
    if (!bank?.ledger_id) {
      playTallyError();
      return;
    }
    let partyLedger = (await getFarmerCreditRow(farmerId))?.ledger_id ?? null;
    if (!partyLedger) partyLedger = await tryResolveDebtorLedger(dealerId, farmerName);
    if (!partyLedger) {
      playTallyError();
      window.alert('Farmer debtor ledger missing — configure ledgers.');
      return;
    }
    let alloc =
      settlements.length > 0
        ? settlements
        : invoices.length ? buildAutoAllocations(invoices, payAmt) : [];
    let tie = alloc.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(tie - payAmt) > 0.01) {
      playTallyError();
      window.alert(`Allocations (${formatTallyAmount(tie)}) must equal payment (${formatTallyAmount(payAmt)}).`);
      return;
    }
    setBusy(true);
    try {
      await postMutation.mutateAsync({
        dealerId,
        farmerId,
        amount: payAmt,
        bankLedgerId: bank.ledger_id,
        partyLedgerId: partyLedger,
        voucherDate: new Date().toISOString().slice(0, 10),
        narration: `Receipt from ${farmerName}`,
        settlements: alloc,
      });
      await onDone();
    } catch {
      playTallyError();
    } finally {
      setBusy(false);
    }
  };

  const bankChoices = withLedger.length ? withLedger : banks;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto border border-[#AAAAAA] bg-[#FFF8E7] p-4 text-[13px]">
        <div className="mb-2 flex justify-between font-semibold text-[#1B5E20]">
          <span>
            Settle Payment — {farmerName}
          </span>
          <button type="button" className="border border-[#AAAAAA] bg-[#F5F5F5] px-2" onClick={onClose}>
            Esc
          </button>
        </div>
        {!withLedger.length ? (
          <p className="text-[#D32F2F]">No bank accounts with ledger linkage. Configure bank_accounts.ledger_id first.</p>
        ) : null}
        <div className="grid gap-2 border border-[#AAAAAA] bg-white p-2">
          <label className="grid grid-cols-[120px_1fr] gap-2">
            <span>Bank account</span>
            <select className="border border-[#AAAAAA]" value={bankSel} onChange={(e) => setBankSel(e.target.value)}>
              {bankChoices.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.account_name}{!b.ledger_id ? ' (no ledger)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[120px_1fr] gap-2">
            <span>Amount</span>
            <input className="border border-[#AAAAAA] px-1" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="mt-2">
            <div className="mb-1 font-semibold text-[#1B5E20]">Bill allocation</div>
            <TallyBillSettlement partyType="FARMER" totalAmount={payAmt} invoices={list} onChange={setSettlements} />
          </div>
          <button
            type="button"
            className="mt-3 tally-button-bar-btn px-4"
            disabled={busy || !withLedger.length}
            onClick={() => {
              if (window.confirm('Accept ? Post RCT and settle invoices (Yes / No)')) void save();
            }}
          >
            Accept (Yes / No)
          </button>
        </div>
      </div>
    </div>
  );
}

function InterestModal({
  dealerSlug,
  dealerRowId,
  rows,
  loading,
  onClose,
  onCompute,
}: {
  dealerSlug: string;
  dealerRowId: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  onClose: () => void;
  onCompute: () => Promise<void>;
}) {
  const postInterest = async () => {
    const ids = rows.map((r) => String(r.id ?? '')).filter(Boolean);
    if (!ids.length) return;
    if (!window.confirm('Accept? Post JNL interest vouchers for all computed rows? Yes / No')) return;
    try {
      const n = await postOverdueInterest(ids, dealerSlug, dealerRowId);
      if (n <= 0) playTallyError();
      else playTallyAccept();
      await onCompute();
    } catch {
      playTallyError();
    }
  };

  return (
    <div className="fixed inset-0 z-[402] bg-black/40 p-10" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-3xl border border-[#AAAAAA] bg-[#FFF8E7]">
        <div className="flex justify-between border-b border-[#AAAAAA] bg-[#1B5E20] px-2 py-1 text-white">
          <span>Interest Preview</span>
          <button type="button" className="bg-[#F5F5F5] px-2 text-black" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-2">
          <button type="button" className="tally-button-bar-btn mr-2 px-3" disabled={loading} onClick={() => void onCompute()}>
            Refresh compute
          </button>
          <button type="button" className="tally-button-bar-btn mr-2 px-3" disabled={loading || !dealerRowId} onClick={() => void postInterest()}>
            Post Interest (JNL)
          </button>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 text-left">Party</th>
                <th className="border border-[#AAAAAA] px-1 text-right">Days</th>
                <th className="border border-[#AAAAAA] px-1 text-right">Interest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={String(r.id ?? i)}>
                  <td className="border border-[#AAAAAA] px-1">
                    {String(r.party_type)} / {String(r.invoice_id).slice(-8)}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{String(r.overdue_days)}</td>
                  <td className="border border-[#AAAAAA] px-1 text-right tabular-nums">{formatTallyAmount(Number(r.interest_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
