'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { TallyBankImportUpload } from '@/components/tally/TallyBankImportUpload';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import {
  useAutoMatchMutation,
  useBankAccountsQuery,
  useImportStatementMutation,
  useLastImportSummaryQuery,
  useLinkBankLineMutation,
  useMarkBankLineManualMutation,
  useUnmatchedLinesQuery,
} from '@/hooks/useBankingQueries';
import { useAuth } from '@/contexts/AuthContext';
import type { BankFormat, ParsedBankLine } from '@/lib/banking/csv-parser';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

export default function BankStatementImportPage() {
  const { session } = useAuth();
  const dealerId = session?.dealerId ?? '';
  const { data: banks = [] } = useBankAccountsQuery();
  const [bankSel, setBankSel] = useState('');
  useEffect(() => {
    const first = banks[0]?.id;
    if (first && !bankSel) setBankSel(first);
  }, [banks, bankSel]);

  const { data: lastImp } = useLastImportSummaryQuery(bankSel || null);

  const [previewLines, setPreviewLines] = useState<ParsedBankLine[]>([]);
  const [detectedFmt, setDetectedFmt] = useState<BankFormat | ''>('');
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [matchMsg, setMatchMsg] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const importMut = useImportStatementMutation();
  const matchMut = useAutoMatchMutation();
  const linkMut = useLinkBankLineMutation();
  const manualMut = useMarkBankLineManualMutation();

  const { data: unmatched = [] } = useUnmatchedLinesQuery(bankSel || null);

  const setButtons = useTallySetButtons();

  const onParsed = useCallback((lines: ParsedBankLine[], fmt: BankFormat) => {
    setPreviewLines(lines);
    setDetectedFmt(fmt === 'GENERIC' ? '' : fmt);
    setActiveBatch(null);
    setMatchMsg(null);
    playTallyAccept();
  }, []);

  const doImportAndSetBatch = useCallback(
    async (batchId: string) => {
      if (!bankSel || previewLines.length === 0) return;
      try {
        const n = await importMut.mutateAsync({
          bankAccountId: bankSel,
          batchId,
          lines: previewLines,
        });
        setActiveBatch(batchId);
        if (n === 0 && previewLines.length > 0)
          window.alert(
            'This batch was skipped (duplicate import_batch_id — same CSV already imported).'
          );
        else playTallyAccept();
        setMatchMsg(null);
      } catch {
        playTallyError();
      }
    },
    [bankSel, previewLines, importMut]
  );

  const runAutoMatch = useCallback(
    async (batchOverride?: string) => {
      const b = batchOverride ?? activeBatch ?? lastImp?.batch_id;
      if (!bankSel || !b) {
        playTallyError();
        window.alert('Pick a batch: import CSV first or use Last import batch.');
        return;
      }
      try {
        const r = await matchMut.mutateAsync({ bankAccountId: bankSel, batchId: b });
        setMatchMsg(`Matched: ${r.matched} · Unmatched: ${r.unmatched}`);
        playTallyAccept();
      } catch {
        playTallyError();
      }
    },
    [activeBatch, lastImp?.batch_id, bankSel, matchMut]
  );

  const importBarRef = useRef({
    previewLinesLength: previewLines.length,
    bankSel,
    doImportAndSetBatch,
    runAutoMatch,
    setReviewOpen,
  });
  importBarRef.current.previewLinesLength = previewLines.length;
  importBarRef.current.bankSel = bankSel;
  importBarRef.current.doImportAndSetBatch = doImportAndSetBatch;
  importBarRef.current.runAutoMatch = runAutoMatch;
  importBarRef.current.setReviewOpen = setReviewOpen;

  useEffect(() => {
    setButtons([
      {
        label: 'Import',
        shortcut: 'Alt+I',
        onClick: () => {
          const r = importBarRef.current;
          r.previewLinesLength > 0 && r.bankSel
            ? void r.doImportAndSetBatch(crypto.randomUUID())
            : playTallyError();
        },
      },
      {
        label: 'Auto-Match',
        shortcut: 'Alt+M',
        onClick: () => void importBarRef.current.runAutoMatch(),
      },
      {
        label: 'Review',
        shortcut: 'Alt+R',
        onClick: () => importBarRef.current.setReviewOpen((v) => !v),
      },
      { label: 'Configure', shortcut: 'F12' },
    ]);
  }, [setButtons]);

  useHotkeys('alt+i', (e) => {
    e.preventDefault();
    if (previewLines.length > 0 && bankSel) void doImportAndSetBatch(crypto.randomUUID());
    else playTallyError();
  });
  useHotkeys('alt+m', (e) => {
    e.preventDefault();
    void runAutoMatch();
  });
  useHotkeys('alt+r', (e) => {
    e.preventDefault();
    setReviewOpen((v) => !v);
  });

  const previewTotals = previewLines.reduce(
    (acc, l) => {
      acc.dr += l.debit;
      acc.cr += l.credit;
      return acc;
    },
    { dr: 0, cr: 0 }
  );

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Bank Statement Import
      </div>

      <div className="flex flex-wrap gap-4 border border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2">
          Bank Account:
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
        {!dealerId ? <span className="text-red-700">Sign in required</span> : null}
      </div>

      <div className="border border-t-0 border-[#AAAAAA] bg-white px-3 py-2">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-[#666666]">Step 1 — Upload Statement</p>
        <TallyBankImportUpload
          onParsed={onParsed}
          onError={(m) => {
            playTallyError();
            window.alert(m);
          }}
        />
        {lastImp ? (
          <p className="mt-2 text-[11px] text-[#555555]">
            Last import:{' '}
            <span className="font-semibold">
              {formatTallyDate(lastImp.txn_sample_date)} ({lastImp.count} txns, ₹
              {formatTallyAmount(lastImp.total_dr)} Dr / ₹{formatTallyAmount(lastImp.total_cr)} Cr)
            </span>
            {lastImp.batch_id ? (
              <span className="ml-2">
                · Batch{' '}
                <button
                  type="button"
                  className="underline decoration-[#AAAAAA]"
                  onClick={() => setActiveBatch(lastImp.batch_id)}
                >
                  {lastImp.batch_id.slice(0, 8)}
                </button>
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-[#AAAAAA]">No imports yet for this account.</p>
        )}
      </div>

      <div className="border border-t-0 border-[#AAAAAA] bg-[#F5F5F5] px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          {detectedFmt ? (
            <span className="border border-[#AAAAAA] bg-white px-2 py-[2px]">Detected format: {detectedFmt}</span>
          ) : null}
          {activeBatch ? (
            <span className="border border-[#AAAAAA] bg-[#FFEB3B] px-2 py-[2px]">
              Working batch: {activeBatch.slice(0, 24)}…
            </span>
          ) : null}
        </div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-[#666666]">Step 2 — Preview</p>
        <div className="max-h-[220px] overflow-auto border border-[#AAAAAA] bg-white">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-[2px] text-left font-semibold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-[2px] text-left font-semibold text-[#1B5E20]">Ref</th>
                <th className="border border-[#AAAAAA] px-1 py-[2px] text-left font-semibold text-[#1B5E20]">
                  Description
                </th>
                <th className="border border-[#AAAAAA] px-1 py-[2px] text-right font-semibold text-[#1B5E20]">Debit</th>
                <th className="border border-[#AAAAAA] px-1 py-[2px] text-right font-semibold text-[#1B5E20]">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {previewLines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-[#AAAAAA] px-2 py-3 text-[#888888]">
                    No file loaded.
                  </td>
                </tr>
              ) : (
                previewLines.slice(0, 200).map((l, i) => (
                  <tr key={i}>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] whitespace-nowrap">
                      {formatTallyDate(l.txn_date)}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{l.ref_number ?? '—'}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px]">{l.description}</td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {l.debit ? formatTallyAmount(l.debit) : ''}
                    </td>
                    <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                      {l.credit ? formatTallyAmount(l.credit) : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {previewLines.length > 200 ? (
          <p className="mt-1 text-[11px] text-[#E65100]">Showing first 200 of {previewLines.length}</p>
        ) : null}
        {previewLines.length > 0 ? (
          <p className="mt-2 text-[12px] font-semibold tabular-nums text-[#1B5E20]">
            Preview totals: ₹{formatTallyAmount(previewTotals.dr)} Dr · ₹{formatTallyAmount(previewTotals.cr)} Cr
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-t-0 border-[#AAAAAA] bg-white px-3 py-2">
        <button
          type="button"
          className="border border-[#AAAAAA] bg-[#F5F5F5] px-3 py-1"
          onClick={() => void doImportAndSetBatch(crypto.randomUUID())}
          disabled={!bankSel || previewLines.length === 0 || importMut.isPending}
        >
          Import All
        </button>
        <button
          type="button"
          className="border border-[#AAAAAA] bg-[#F5F5F5] px-3 py-1"
          onClick={() => void runAutoMatch()}
          disabled={!bankSel || matchMut.isPending}
        >
          Auto-Match
        </button>
        <button
          type="button"
          className="border border-[#AAAAAA] bg-[#F5F5F5] px-3 py-1"
          onClick={() => setReviewOpen(true)}
          disabled={!bankSel || unmatched.length === 0}
        >
          Review Unmatched ({unmatched.length})
        </button>
        {matchMsg ? <span className="text-[12px] text-[#1B5E20]">{matchMsg}</span> : null}
      </div>

      {reviewOpen ? (
        <div className="border border-[#AAAAAA] border-t-0 bg-[#FFF8E7] px-3 py-3">
          <div className="mb-2 flex justify-between border-b border-[#AAAAAA] pb-2 font-semibold text-[#1B5E20]">
            <span>Unmatched / manual review</span>
            <button type="button" className="border border-[#AAAAAA] px-2 text-[11px]" onClick={() => setReviewOpen(false)}>
              Hide
            </button>
          </div>
          <UnmatchedReviewTable rows={unmatched} linkMut={linkMut} manualMut={manualMut} />
        </div>
      ) : null}

    </div>
  );
}

function UnmatchedReviewTable({
  rows,
  linkMut,
  manualMut,
}: {
  rows: Record<string, unknown>[];
  linkMut: ReturnType<typeof useLinkBankLineMutation>;
  manualMut: ReturnType<typeof useMarkBankLineManualMutation>;
}) {
  return (
    <div className="max-h-[320px] overflow-auto border border-[#AAAAAA] bg-white">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#F0F0F0]">
            <th className="border border-[#AAAAAA] px-1 py-1 font-semibold text-[#1B5E20]">Date</th>
            <th className="border border-[#AAAAAA] px-1 py-1 font-semibold text-[#1B5E20]">Description</th>
            <th className="border border-[#AAAAAA] px-1 py-1 text-right font-semibold text-[#1B5E20]">Amount</th>
            <th className="border border-[#AAAAAA] px-1 py-1 font-semibold text-[#1B5E20]">Link voucher</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <UnmatchedRow key={String(r.id)} row={r} linkMut={linkMut} manualMut={manualMut} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnmatchedRow({
  row,
  linkMut,
  manualMut,
}: {
  row: Record<string, unknown>;
  linkMut: ReturnType<typeof useLinkBankLineMutation>;
  manualMut: ReturnType<typeof useMarkBankLineManualMutation>;
}) {
  const [vid, setVid] = useState('');
  const id = String(row.id ?? '');
  const txn = String(row.txn_date ?? '').slice(0, 10);
  const deb = Number(row.debit ?? 0);
  const cr = Number(row.credit ?? 0);

  const amtUi =
    cr > 0
      ? `CR ${formatTallyAmount(cr)}`
      : deb > 0
        ? `DR ${formatTallyAmount(deb)}`
        : '—';

  return (
    <tr>
      <td className="border border-[#AAAAAA] px-1 py-1">{formatTallyDate(txn)}</td>
      <td className="border border-[#AAAAAA] px-1 py-1">{String(row.description ?? '')}</td>
      <td className="border border-[#AAAAAA] px-1 py-1 text-right tabular-nums">{amtUi}</td>
      <td className="border border-[#AAAAAA] px-1 py-1 align-top">
        <div className="flex flex-wrap gap-1">
          <input
            placeholder="UUID of voucher…"
            className="w-[220px] border border-[#AAAAAA] px-1 py-[2px] text-[11px]"
            value={vid}
            onChange={(e) => setVid(e.target.value)}
          />
          <button
            type="button"
            className="border border-[#AAAAAA] bg-[#F5F5F5] px-2 py-[2px] text-[11px]"
            onClick={async () => {
              const t = vid.trim();
              if (!t || !/^[0-9a-f-]{36}$/i.test(t)) return playTallyError();
              if (!confirm('Accept? Yes or No')) return;
              try {
                await linkMut.mutateAsync({ lineId: id, voucherId: t });
                setVid('');
                playTallyAccept();
              } catch {
                playTallyError();
              }
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="border border-[#AAAAAA] px-2 py-[2px] text-[11px] text-[#666666]"
            onClick={async () => {
              if (!confirm('Mark bank line as MANUAL (charge / unexplained)?')) return;
              try {
                await manualMut.mutateAsync(id);
                playTallyAccept();
              } catch {
                playTallyError();
              }
            }}
          >
            Manual
          </button>
          <button
            type="button"
            className="border border-[#AAAAAA] px-2 py-[2px] text-[11px]"
            title="Opens new voucher stub"
            onClick={() => {
              window.open(`/tally/voucher/new?type=${deb > cr ? 'PMT' : 'RCT'}`, '_blank', 'noopener');
            }}
          >
            New RCT/PMT
          </button>
        </div>
      </td>
    </tr>
  );
}
