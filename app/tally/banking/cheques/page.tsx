'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useChequesQuery, useBankAccountsQuery } from '@/hooks/useBankingQueries';
import { createCheque, postBouncedChequeReversal, updateChequeStatus } from '@/lib/supabase/banking';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_COLOR: Record<string, string> = {
  CLEARED: '#1B5E20',
  PENDING: '#000000',
  PRESENTED: '#E65100',
  BOUNCED: '#D32F2F',
  DEPOSITED: '#E65100',
  STOPPED: '#9E9E9E',
};

function statusChip(s: string): string {
  if (s === 'CLEARED') return '✓';
  if (s === 'PENDING') return '◌';
  if (s === 'BOUNCED') return '✗';
  return '';
}

export default function ChequeRegisterPage() {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const dealerRowId = session?.dealerRowId ?? '';
  const { data: banks = [] } = useBankAccountsQuery();
  const [bankId, setBankId] = useState<string>('all');
  const [dir, setDir] = useState<'ISSUED' | 'RECEIVED'>('ISSUED');

  const filters = useMemo(
    () => ({ direction: dir, bankAccountId: bankId === 'all' ? undefined : bankId }),
    [dir, bankId]
  );

  const { data: cheques = [], refetch } = useChequesQuery(filters);
  const [sel, setSel] = useState(0);
  const [newOpen, setNewOpen] = useState(false);

  const setButtons = useTallySetButtons();
  useEffect(() => {
    setButtons([
      { label: 'New Cheque', shortcut: 'N', onClick: () => setNewOpen(true) },
      { label: 'Update Status', shortcut: 'U' },
      { label: 'Bounced', shortcut: 'B' },
      { label: 'Export', shortcut: 'Alt+E' },
    ]);
    return () => setButtons([]);
  }, [setButtons]);

  const openUpdate = useCallback(async () => {
    const row = cheques[sel];
    if (!row) return;
    const next =
      prompt(
        row.direction === 'ISSUED'
          ? 'Status [PRESENTED|CLEARED|STOPPED]'
          : 'Status [DEPOSITED|CLEARED|RETURNED]',
        row.status
      )?.trim()?.toUpperCase() ?? '';
    if (!next) return;
    const cd = prompt('Clearing date (YYYY-MM-DD) optional')?.slice(0, 10);
    await updateChequeStatus(row.id, next, { clearing_date: cd || undefined, bank_ref: prompt('Bank ref optional') ?? undefined }).catch(() =>
      playTallyError()
    );
    playTallyAccept();
    refetch();
  }, [cheques, sel, refetch]);

  useHotkeys('n', () => setNewOpen(true), { enableOnFormTags: false });
  useHotkeys('u', () => void openUpdate(), { enableOnFormTags: false });
  useHotkeys(
    'b',
    async () => {
      const row = cheques[sel];
      if (!row) return;
      if (!confirm('Mark bounced? Reversal JNL will be posted if a voucher is linked. Yes/No')) return;
      try {
        if (row.voucher_id && dealerRowId) {
          await postBouncedChequeReversal(row.id, dealerId, dealerRowId);
        } else {
          await updateChequeStatus(row.id, 'BOUNCED', { bounce_reason: 'Marked from register (no reversal — missing voucher)' });
        }
        playTallyAccept();
        refetch();
      } catch {
        playTallyError();
      }
    },
    { enableOnFormTags: false },
    [cheques, sel, dealerId, dealerRowId, refetch]
  );

  const pend = cheques.filter((c) => c.status === 'PENDING').reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] bg-[#1B5E20] py-[5px] text-center font-semibold text-white">
        Cheque Register
      </div>
      <div className="flex flex-wrap gap-2 border border-[#AAAAAA] bg-white px-2 py-2">
        <label className="flex items-center gap-1">
          Bank:
          <select className="border border-[#AAAAAA]" value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="all">All banks</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={dir === 'ISSUED' ? 'bg-[#FFEB3B]' : ''} onClick={() => setDir('ISSUED')}>
          Issued
        </button>
        <button type="button" className={dir === 'RECEIVED' ? 'bg-[#FFEB3B]' : ''} onClick={() => setDir('RECEIVED')}>
          Received
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] border-t-0 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#F0F0F0]">
            <tr>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left text-[#1B5E20]">Chq No</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Party</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Date</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right">Amount</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map((c, i) => (
              <tr
                key={c.id}
                style={{
                  cursor: 'pointer',
                  background: sel === i ? '#0D47A1' : '',
                  color: sel === i ? '#fff' : STATUS_COLOR[c.status] ?? '#000',
                }}
                onClick={() => setSel(i)}
              >
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{c.cheque_number}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{c.party_name}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] tabular-nums">{formatTallyDate(c.cheque_date)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{formatTallyAmount(Number(c.amount))}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{c.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-[#AAAAAA] px-1" colSpan={3}>
                TOTAL PENDING
              </td>
              <td className="border border-[#AAAAAA] px-1 text-right">{formatTallyAmount(pend)}</td>
              <td className="border border-[#AAAAAA] px-1">{statusChip('PENDING')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {newOpen ? (
        <NewChequeDialog
          dealerId={dealerId}
          banks={banks}
          dirDefault={dir}
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            setNewOpen(false);
            refetch();
            playTallyAccept();
          }}
        />
      ) : null}
    </div>
  );
}

function NewChequeDialog({
  dealerId,
  banks,
  dirDefault,
  onClose,
  onSaved,
}: {
  dealerId: string;
  banks: Array<{ id: string; account_name: string }>;
  dirDefault: 'ISSUED' | 'RECEIVED';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState(dirDefault);
  const [bid, setBid] = useState(banks[0]?.id ?? '');
  const [no, setNo] = useState('');
  const [dt, setDt] = useState(() => new Date().toISOString().slice(0, 10));
  const [amt, setAmt] = useState('');
  const [party, setParty] = useState('');
  const [pdc, setPdc] = useState(false);
  const [nar, setNar] = useState('');

  const save = async () => {
    if (!bid || !no || !amt || !party) return playTallyError();
    const today = new Date().toISOString().slice(0, 10);
    const ispdc = dt > today || pdc;
    await createCheque(dealerId, {
      bank_account_id: bid,
      cheque_number: no,
      cheque_date: dt,
      amount: Number(amt.replace(/,/g, '')),
      direction,
      party_name: party,
      party_id: null,
      party_type: null,
      narration: nar || null,
      voucher_id: null,
      status: 'PENDING',
      is_pdc: ispdc,
      clearing_date: null,
      bank_ref: null,
      bounce_reason: null,
      reversal_voucher_id: null,
    }).catch(() => playTallyError());
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[405] bg-black/40 p-10">
      <div className="mx-auto max-w-md border border-[#AAAAAA] bg-[#FFF8E7] p-4 text-[13px]">
        <div className="mb-3 font-semibold text-[#1B5E20]">New Cheque</div>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Direction</span>
          <select value={direction} onChange={(e) => setDirection(e.target.value as 'ISSUED' | 'RECEIVED')}>
            <option value="ISSUED">Issued</option>
            <option value="RECEIVED">Received</option>
          </select>
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Bank</span>
          <select value={bid} onChange={(e) => setBid(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Cheque No</span>
          <input className="border border-[#AAAAAA]" value={no} onChange={(e) => setNo(e.target.value)} />
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Date</span>
          <input className="border border-[#AAAAAA]" type="date" value={dt} onChange={(e) => setDt(e.target.value)} />
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Amount</span>
          <input className="border border-[#AAAAAA]" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Party</span>
          <input className="border border-[#AAAAAA]" value={party} onChange={(e) => setParty(e.target.value)} />
        </label>
        <label className="mb-2 flex items-center gap-2">
          <input type="checkbox" checked={pdc} onChange={(e) => setPdc(e.target.checked)} /> Post-dated
        </label>
        <label className="mb-2 grid grid-cols-[120px_1fr] gap-2">
          <span>Narration</span>
          <input className="border border-[#AAAAAA]" value={nar} onChange={(e) => setNar(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="button" className="tally-button-bar-btn px-4" onClick={() => confirm('Accept? Yes/No') && void save()}>
            Accept
          </button>
          <button type="button" className="border border-[#AAAAAA] bg-[#F5F5F5] px-3" onClick={onClose}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}
