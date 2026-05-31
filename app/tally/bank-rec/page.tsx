'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import {
  useAutoMatchMutation,
  useBankAccountsQuery,
  useBankRecQuery,
  useLastImportSummaryQuery,
  useLinkBankLineMutation,
  useUnmatchedLinesQuery,
  useUnclearedIssuedChequesQuery,
  useUpdateChequeStatusMutation,
} from '@/hooks/useBankingQueries';
import type { BankRecSummary } from '@/lib/supabase/banking';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function TallyBankRecPage() {
  const { data: banks = [] } = useBankAccountsQuery();
  const [bankSel, setBankSel] = useState('');
  const dateRefTrigger = () => document.getElementById('bank-rec-as-on')?.focus?.();
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const first = banks[0]?.id;
    if (first && !bankSel) setBankSel(first);
  }, [banks, bankSel]);

  const acc = useMemo(() => banks.find((b) => b.id === bankSel) ?? null, [banks, bankSel]);

  const { data: recap, refetch: refetchRec } = useBankRecQuery(acc, asOn);
  const { data: uncleared = [], refetch: refetchCle } = useUnclearedIssuedChequesQuery(bankSel || null);
  const { data: unmatched = [], refetch: refetchUm } = useUnmatchedLinesQuery(bankSel || null);
  const { data: lastImp } = useLastImportSummaryQuery(bankSel || null);

  const updateChq = useUpdateChequeStatusMutation();
  const matchMut = useAutoMatchMutation();
  const linkMut = useLinkBankLineMutation();

  const setButtons = useTallySetButtons();

  const refreshAll = useCallback(async () => {
    await Promise.all([refetchRec(), refetchCle(), refetchUm()]);
  }, [refetchRec, refetchCle, refetchUm]);

  const autoMatchBatch = useCallback(async () => {
    const bid = lastImp?.batch_id;
    if (!bankSel || !bid) {
      playTallyError();
      window.alert('Import a bank statement batch first.');
      return;
    }
    try {
      await matchMut.mutateAsync({ bankAccountId: bankSel, batchId: bid });
      await refreshAll();
      playTallyAccept();
    } catch {
      playTallyError();
    }
  }, [bankSel, lastImp?.batch_id, matchMut, refreshAll]);

  const buttonBarRef = useRef({
    dateFocus: dateRefTrigger,
    autoMatch: autoMatchBatch,
  });
  buttonBarRef.current.dateFocus = dateRefTrigger;
  buttonBarRef.current.autoMatch = autoMatchBatch;

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => buttonBarRef.current.dateFocus() },
      { label: 'Auto-Match', shortcut: 'Alt+M', onClick: () => void buttonBarRef.current.autoMatch() },
      { label: 'Print', shortcut: 'Alt+P', onClick: () => window.print() },
      { label: 'Configure', shortcut: 'F12' },
    ]);
  }, [setButtons]);

  useHotkeys('f2', (e) => {
    e.preventDefault();
    dateRefTrigger();
  });
  useHotkeys('alt+m', (e) => {
    e.preventDefault();
    void autoMatchBatch();
  });
  useHotkeys('alt+p', (e) => {
    e.preventDefault();
    window.print();
  });

  const summary = recap as BankRecSummary | undefined;
  const diffOk =
    summary && summary.bank_statement_balance !== null
      ? Math.abs(Number(summary.difference ?? 0)) < 0.02
      : false;

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Bank Reconciliation
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2">
          Bank:
          <select
            className="border border-[#AAAAAA] bg-white px-1"
            value={bankSel}
            onChange={(e) => setBankSel(e.target.value)}
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          As on:
          <input
            id="bank-rec-as-on"
            type="date"
            className="border border-[#AAAAAA] px-1"
            value={asOn}
            onChange={(e) => setAsOn(e.target.value)}
          />
        </label>
        {summary?.bank_statement_balance === null ? (
          <span className="text-[12px] text-[#E65100]">Import CSV with Balance column — bank-side total unknown.</span>
        ) : null}
      </div>

      <div className="mx-3 my-3 border border-[#AAAAAA] bg-white p-3">
        <div className="mb-2 font-semibold text-[#1B5E20]">Summary</div>
        {summary ? (
          <ul className="space-y-1 text-[13px] tabular-nums">
            <li className="flex justify-between gap-4 border-b border-[#EEEEEE] py-[2px]">
              <span>Balance per bank statement</span>
              <span>{summary.bank_statement_balance !== null ? `₹${formatTallyAmount(summary.bank_statement_balance)}` : '—'}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-[#EEEEEE] py-[2px]">
              <span>Add: Credits on bank unmatched (possible deposits in transit)</span>
              <span>₹{formatTallyAmount(summary.unmatched_bank_cr ?? 0)}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-[#EEEEEE] py-[2px]">
              <span>Less: Issued cheques not cleared</span>
              <span>(₹{formatTallyAmount(summary.uncleared_cheques_total ?? 0)})</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-[#EEEEEE] py-[2px]">
              <span>Balance per books (bank ledger DR−CR)</span>
              <span>₹{formatTallyAmount(summary.books_balance_net ?? 0)}</span>
            </li>
            <li className="flex justify-between gap-4 py-[2px] font-semibold">
              <span>Reconciliation difference</span>
              <span style={{ color: diffOk ? '#1B5E20' : '#D32F2F' }}>
                ₹{formatTallyAmount(summary.bank_statement_balance !== null ? summary.difference : 0)}
                {summary.bank_statement_balance !== null ? (diffOk ? ' ✓' : '') : ''}
              </span>
            </li>
          </ul>
        ) : (
          <div>Loading…</div>
        )}
      </div>

      <div className="mx-3 mb-3 border border-[#AAAAAA] bg-white">
        <div className="border-b border-[#AAAAAA] bg-[#F0F0F0] px-2 py-[4px] text-[11px] font-semibold uppercase tracking-wide">
          Uncleared cheques (issued)
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">No</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Payee</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Date</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Amount</th>
              <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Clear</th>
            </tr>
          </thead>
          <tbody>
            {uncleared.map((row) => {
              const id = String((row as { id?: string }).id ?? '');
              return (
                <tr key={id}>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {String((row as { cheque_number?: string }).cheque_number ?? '')}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {String((row as { party_name?: string }).party_name ?? '')}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {formatTallyDate(String((row as { cheque_date?: string }).cheque_date ?? '').slice(0, 10))}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    ₹{formatTallyAmount(Number((row as { amount?: number }).amount ?? 0))}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    <button
                      type="button"
                      className="border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-[2px] text-[11px]"
                      onClick={() => showMarkChequeCleared(updateChq, id, refreshAll)}
                    >
                      Mark clear
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mx-3 mb-4 border border-[#AAAAAA] bg-white">
        <div className="border-b border-[#AAAAAA] bg-[#F0F0F0] px-2 py-[4px] text-[11px] font-semibold uppercase tracking-wide">
          Unmatched bank lines
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Details</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Dr</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Cr</th>
                <th className="border border-[#AAAAAA] px-1 py-1 font-bold text-[#1B5E20]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.map((raw) => {
                const row = raw as Record<string, unknown>;
                const id = String(row.id ?? '');
                const txn = String(row.txn_date ?? '').slice(0, 10);
                const deb = Number(row.debit ?? 0);
                const cr = Number(row.credit ?? 0);
                return (
                  <UnmatchedBankRow key={id} id={id} txn={txn} desc={String(row.description ?? '')} deb={deb} cr={cr} linkMut={linkMut} refreshAll={refreshAll} />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mx-3 mb-6 text-[11px] text-[#666666]">
        Auto-match reads the latest CSV import batch ({lastImp?.batch_id ?? 'none'}).
      </div>
    </div>
  );
}

function showMarkChequeCleared(
  mut: ReturnType<typeof useUpdateChequeStatusMutation>,
  chequeId: string,
  refresh: () => Promise<void>
) {
  const dRaw = window.prompt('Clearing date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
  if (!dRaw) return playTallyError();
  const ref = window.prompt('Bank reference (optional)', '');
  void (async () => {
    try {
      await mut.mutateAsync({ id: chequeId, status: 'CLEARED', meta: { clearing_date: dRaw, bank_ref: ref ?? undefined } });
      await refresh();
      playTallyAccept();
    } catch {
      playTallyError();
    }
  })();
}

function UnmatchedBankRow({
  id,
  txn,
  desc,
  deb,
  cr,
  linkMut,
  refreshAll,
}: {
  id: string;
  txn: string;
  desc: string;
  deb: number;
  cr: number;
  linkMut: ReturnType<typeof useLinkBankLineMutation>;
  refreshAll: () => Promise<void>;
}) {
  const [vid, setVid] = useState('');
  return (
    <tr>
      <td className="border border-[#AAAAAA] px-1 py-[2px]">{formatTallyDate(txn)}</td>
      <td className="border border-[#AAAAAA] px-1 py-[2px]">{desc}</td>
      <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{deb ? formatTallyAmount(deb) : ''}</td>
      <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">{cr ? formatTallyAmount(cr) : ''}</td>
      <td className="border border-[#AAAAAA] px-1 py-[2px] align-top">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="w-fit border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-[2px] text-[11px]"
            onClick={() =>
              window.open(`/tally/voucher/new?type=${deb >= cr ? 'PMT' : 'RCT'}`, '_blank', 'noopener')
            }
          >
            Create voucher stub
          </button>
          <div className="flex flex-wrap items-center gap-1">
            <input
              className="w-[170px] border border-[#AAAAAA] px-1 py-[2px] text-[11px]"
              placeholder="Voucher UUID…"
              value={vid}
              onChange={(e) => setVid(e.target.value)}
            />
            <button
              type="button"
              className="border border-[#AAAAAA] px-2 py-[2px] text-[11px]"
              onClick={() =>
                void (async () => {
                  const t = vid.trim();
                  if (!/^[0-9a-f-]{36}$/i.test(t)) return playTallyError();
                  if (!confirm('Accept? Yes or No')) return;
                  try {
                    await linkMut.mutateAsync({ lineId: id, voucherId: t });
                    setVid('');
                    await refreshAll();
                    playTallyAccept();
                  } catch {
                    playTallyError();
                  }
                })()}
            >
              Link
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
