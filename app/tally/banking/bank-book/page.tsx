'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useBankAccountsQuery, useBankBookQuery } from '@/hooks/useBankingQueries';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept } from '@/lib/tally-sounds';

type BookLineRow = {
  voucher_id: string;
  voucher_date: string;
  voucher_number: string;
  narration: string | null;
  dr: number;
  cr: number;
  voucher_type: string | null;
};

export default function BankBookPage() {
  const { data: banks = [] } = useBankAccountsQuery();
  const [bankSel, setBankSel] = useState('');
  const [fromIso, setFromIso] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [toIso, setToIso] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const first = banks.filter((b) => b.ledger_id)[0]?.id;
    if (first && !bankSel) setBankSel(first);
  }, [banks, bankSel]);

  const acc = useMemo(() => banks.find((b) => b.id === bankSel) ?? null, [banks, bankSel]);
  const q = useBankBookQuery(acc, fromIso, toIso);

  const setButtons = useTallySetButtons();

  const exportCsv = useCallback(() => {
    const rows = (q.data?.lines ?? []) as BookLineRow[];
    const opening = Number(q.data?.opening ?? 0);
    const closingNet = Number(q.data?.closingNet ?? 0);
    const hdr = ['Date', 'Particulars', 'Dr', 'Cr'];
    const body: string[][] = [
      [
        '',
        'Opening balance',
        opening >= 0 ? formatTallyAmount(opening) : '',
        opening < 0 ? formatTallyAmount(-opening) : '',
      ],
      ...rows.map((r) => [
        formatTallyDate(r.voucher_date),
        `${String(r.voucher_type ?? '').toUpperCase()}/${String(r.voucher_number ?? '')}`,
        r.dr ? formatTallyAmount(r.dr) : '',
        r.cr ? formatTallyAmount(r.cr) : '',
      ]),
      ['', 'Closing ledger net', '', formatTallyAmount(closingNet)],
    ];
    const csv = body.map((c) => c.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([hdr.join(',') + '\n' + csv], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `bank_book_${fromIso}_${toIso}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    playTallyAccept();
  }, [q.data?.lines, q.data?.opening, q.data?.closingNet, fromIso, toIso]);

  useEffect(() => {
    setButtons([
      {
        label: 'Period',
        shortcut: 'F2',
        onClick: () => document.getElementById('bank-book-from')?.focus?.(),
      },
      { label: 'Print', shortcut: 'Alt+P', onClick: () => window.print() },
      { label: 'Export CSV', shortcut: 'Alt+E', onClick: exportCsv },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportCsv]);

  useHotkeys('alt+e', (e) => {
    e.preventDefault();
    exportCsv();
  });
  useHotkeys('alt+p', (e) => {
    e.preventDefault();
    window.print();
  });
  useHotkeys('f2', (e) => {
    e.preventDefault();
    document.getElementById('bank-book-from')?.focus?.();
  });

  const ledgerMissing = !!acc && !acc.ledger_id;

  const runningRows = useMemo(() => {
    let run = Number(q.data?.opening ?? 0);
    const lines = (q.data?.lines ?? []) as BookLineRow[];
    return lines.map((ln) => {
      run = Math.round((run + ln.dr - ln.cr) * 100) / 100;
      return { ...ln, run };
    });
  }, [q.data?.lines, q.data?.opening]);

  const firstEmptyBank = banks.length === 0;

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20' }}>
        Bank Book
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2">
          Bank:
          <select
            className="border border-[#AAAAAA] bg-white px-1"
            value={bankSel}
            onChange={(e) => setBankSel(e.target.value)}
          >
            {firstEmptyBank ? <option value="">—</option> : null}
            {banks.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.ledger_id}>
                {b.account_name}{!b.ledger_id ? ' — no ledger' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          From:
          <input
            id="bank-book-from"
            type="date"
            className="border border-[#AAAAAA] px-1"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          To:
          <input
            id="bank-book-to"
            type="date"
            className="border border-[#AAAAAA] px-1"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
          />
        </label>
        {!ledgerMissing && q.data !== undefined ? (
          <span className="font-semibold tabular-nums">
            Opening (net ledger): ₹{formatTallyAmount(q.data.opening)}
          </span>
        ) : null}
      </div>

      {ledgerMissing ? (
        <div className="border border-[#AAAAAA] border-t-0 bg-[#FFE0B2] px-3 py-2 text-[#E65100]">
          Link this bank account to a ledger in Settings — bank book requires ledger_id.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border border-[#AAAAAA] border-t-0 bg-white">
        {q.isLoading ? (
          <div className="p-4">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">Date</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-left font-bold text-[#1B5E20]">
                  Particulars
                </th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Dr</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">Cr</th>
                <th className="border border-[#AAAAAA] px-1 py-1 text-right font-bold text-[#1B5E20]">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 600 }}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{formatTallyDate(fromIso)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">Opening balance</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {(q.data?.opening ?? 0) > 0 ? formatTallyAmount(q.data?.opening ?? 0) : ''}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  {(q.data?.opening ?? 0) < 0 ? formatTallyAmount(-(q.data?.opening ?? 0)) : ''}
                </td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  ₹{formatTallyAmount(q.data?.opening ?? 0)}
                </td>
              </tr>
              {runningRows.map((r) => (
                <tr
                  key={r.voucher_id}
                  className="cursor-pointer hover:bg-[#FFEB3B]"
                  tabIndex={0}
                  role="button"
                  onClick={() => void navigator.clipboard.writeText(String(r.voucher_id)).then(playTallyAccept)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void navigator.clipboard.writeText(String(r.voucher_id)).then(playTallyAccept);
                    }
                  }}
                >
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">{formatTallyDate(r.voucher_date)}</td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px]">
                    {(r.voucher_type ?? '').toString().toUpperCase()}/{r.voucher_number}
                    {(() => {
                      const nar = String(r.narration ?? '').trim();
                      if (!nar) return '';
                      return nar.length > 56 ? ` — ${nar.slice(0, 56)}…` : ` — ${nar}`;
                    })()}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {r.dr ? formatTallyAmount(r.dr) : ''}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    {r.cr ? formatTallyAmount(r.cr) : ''}
                  </td>
                  <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                    ₹{formatTallyAmount(r.run)}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600 }}>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">{formatTallyDate(toIso)}</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px]">Closing balance (period)</td>
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums" colSpan={2} />
                <td className="border border-[#AAAAAA] px-1 py-[2px] text-right tabular-nums">
                  ₹{formatTallyAmount(q.data?.closingNet ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="border border-t-0 border-[#AAAAAA] bg-[#F5F5F5] px-2 py-[3px] text-[11px] text-[#666666]">
        Click row — voucher UUID copied to clipboard · F2 focuses period-from
      </div>
    </div>
  );
}
