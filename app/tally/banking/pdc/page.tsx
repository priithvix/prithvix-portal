'use client';

import { useMemo, useState } from 'react';
import { useChequesQuery, useBankAccountsQuery } from '@/hooks/useBankingQueries';
import { updateChequeStatus } from '@/lib/supabase/banking';
import { formatTallyAmount, formatTallyDate } from '@/lib/tally-format';
import { playTallyAccept } from '@/lib/tally-sounds';

export default function PdcPage() {
  const { data: banks = [] } = useBankAccountsQuery();
  const [bankFilter, setBankFilter] = useState('all');
  const filt = useMemo(() => ({ isPdc: true, bankAccountId: bankFilter === 'all' ? undefined : bankFilter }), [bankFilter]);
  const { data: lines = [], refetch } = useChequesQuery(filt);

  const today = new Date().toISOString().slice(0, 10);

  function rowStyle(cd: string, st: string) {
    if (st !== 'PENDING') return {};
    if (cd < today) return { background: '#FFCDD2' };
    if (Math.ceil((new Date(cd).getTime() - Date.now()) / 86400000) <= 3) return { background: '#FFE0B2' };
    return {};
  }

  return (
    <div className="min-h-[60vh] bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b border-[#0D3D0F] bg-[#1B5E20] py-[5px] text-center font-semibold text-white">
        Post-dated Cheques
      </div>
      <div className="flex gap-3 border border-[#AAAAAA] bg-white px-2 py-2">
        As on <span className="tabular-nums">{formatTallyDate(new Date())}</span>
        <select className="border border-[#AAAAAA]" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
          <option value="all">All banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.account_name}
            </option>
          ))}
        </select>
      </div>
      <div className="border border-[#AAAAAA] border-t-0 bg-white">
        <div className="bg-[#F0F0F0] px-2 py-1 font-semibold">Upcoming ({lines.filter((x) => x.cheque_date >= today).length})</div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F0F0F0]">
              <th className="border px-1 text-left">Due</th>
              <th className="border px-1 text-left">Party</th>
              <th className="border px-1 text-left">Chq</th>
              <th className="border px-1 text-right">Amount</th>
              <th className="border px-1 text-left">Dir</th>
              <th className="border px-1"></th>
            </tr>
          </thead>
          <tbody>
            {lines
              .filter((c) => c.cheque_date >= today)
              .map((c) => (
                <tr key={c.id} style={rowStyle(c.cheque_date, c.status)}>
                  <td className="border px-1 tabular-nums">{formatTallyDate(c.cheque_date)}</td>
                  <td className="border px-1">{c.party_name}</td>
                  <td className="border px-1">{c.cheque_number}</td>
                  <td className="border px-1 text-right tabular-nums">{formatTallyAmount(Number(c.amount))}</td>
                  <td className="border px-1">{c.direction}</td>
                  <td className="border px-1">
                    <button type="button" className="tally-button-bar-btn px-1 text-[11px]"
                      disabled={c.direction !== 'RECEIVED'}
                      title="Deposit received PDC"
                      onClick={() => void updateChequeStatus(c.id, 'DEPOSITED').then(() => {
                        refetch();
                        playTallyAccept();
                      })}
                    >
                      Deposit
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="bg-[#F0F0F0] px-2 py-1 font-semibold border-t border-[#AAAAAA]">
          Overdue &amp; still pending
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {lines
              .filter((c) => c.cheque_date < today && c.status === 'PENDING')
              .map((c) => (
                <tr key={`o-${c.id}`} style={{ color: '#D32F2F' }}>
                  <td className="border px-1 tabular-nums">{formatTallyDate(c.cheque_date)}</td>
                  <td className="border px-1">{c.party_name}</td>
                  <td className="border px-1">{c.cheque_number}</td>
                  <td className="border px-1 text-right tabular-nums">{formatTallyAmount(Number(c.amount))}</td>
                  <td className="border px-1">{c.direction}</td>
                  <td className="border px-1" />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
