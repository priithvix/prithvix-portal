'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTrialBalanceQuery } from '@/hooks/useReportsQueries';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';

/* ─── Types ────────────────────────────────────────────────────── */
type CoaRow = {
  id: string;
  name: string;
  group: string;
  side: 'Dr' | 'Cr' | '—';
  drTotal: number;
  crTotal: number;
  balance: number;
  balanceType: 'Dr' | 'Cr' | 'Nil';
};

type GroupedCoa = Record<string, CoaRow[]>;

/* ─── Helpers ──────────────────────────────────────────────────── */
function categorySortOrder(group: string): number {
  const g = group.toLowerCase();
  if (/capital|equity|reserve|proprietor|partner/i.test(g)) return 1;
  if (/loan.*long|debenture|bond/i.test(g)) return 2;
  if (/payable|creditor|gst|duty|provision|tax|outstanding/i.test(g)) return 3;
  if (/fixed|asset|building|equipment|vehicle|plant|furniture|land|machinery/i.test(g)) return 5;
  if (/investment|fd\b|fdr|mutual|bond/i.test(g)) return 6;
  if (/stock|inventory/i.test(g)) return 7;
  if (/debtor|receivable/i.test(g)) return 8;
  if (/cash|bank/i.test(g)) return 9;
  if (/sales|income|revenue/i.test(g)) return 11;
  if (/purchase|cogs/i.test(g)) return 12;
  if (/expense|wages|salary/i.test(g)) return 13;
  return 10;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function CoaPage() {
  const { dealer } = useAuth();
  const setButtons = useTallySetButtons();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showZero, setShowZero] = useState(false);

  // Use current date as "as on" — full cumulative balances
  const asOn = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: rows = [], isFetching, error } = useTrialBalanceQuery(asOn);

  /* Build CoA from Trial Balance */
  const allLedgers: CoaRow[] = useMemo(() =>
    rows.map((r) => {
      const net = r.dr_total - r.cr_total;
      const balAbs = Math.abs(net);
      const balanceType: CoaRow['balanceType'] = balAbs < 0.01 ? 'Nil' : net > 0 ? 'Dr' : 'Cr';
      const side: CoaRow['side'] = r.group_name?.toLowerCase().includes('income') || r.group_name?.toLowerCase().includes('sales') || r.group_name?.toLowerCase().includes('capital') || r.group_name?.toLowerCase().includes('payable') || r.group_name?.toLowerCase().includes('creditor') || r.group_name?.toLowerCase().includes('loan') || r.group_name?.toLowerCase().includes('gst')
        ? 'Cr'
        : r.group_name?.toLowerCase().includes('expense') || r.group_name?.toLowerCase().includes('purchase') || r.group_name?.toLowerCase().includes('asset') || r.group_name?.toLowerCase().includes('debtor') || r.group_name?.toLowerCase().includes('cash') || r.group_name?.toLowerCase().includes('bank') || r.group_name?.toLowerCase().includes('stock')
          ? 'Dr'
          : '—';
      return {
        id: r.ledger_id,
        name: r.ledger_name,
        group: r.group_name ?? 'Ungrouped',
        side,
        drTotal: r.dr_total,
        crTotal: r.cr_total,
        balance: Math.abs(net),
        balanceType,
      };
    }),
  [rows]);

  const groups = useMemo(
    () => [...new Set(allLedgers.map((r) => r.group))].sort((a, b) => categorySortOrder(a) - categorySortOrder(b) || a.localeCompare(b)),
    [allLedgers]
  );

  const filtered = useMemo(() => {
    let r = allLedgers;
    if (!showZero) r = r.filter((x) => x.balance > 0.01);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(q) || x.group.toLowerCase().includes(q));
    }
    if (groupFilter) r = r.filter((x) => x.group === groupFilter);
    return r;
  }, [allLedgers, search, groupFilter, showZero]);

  const grouped: GroupedCoa = useMemo(() => {
    const g: GroupedCoa = {};
    for (const r of filtered) {
      if (!g[r.group]) g[r.group] = [];
      g[r.group].push(r);
    }
    return g;
  }, [filtered]);

  const totalDr = useMemo(() => filtered.reduce((s, r) => s + r.drTotal, 0), [filtered]);
  const totalCr = useMemo(() => filtered.reduce((s, r) => s + r.crTotal, 0), [filtered]);
  const isBalanced = Math.abs(totalDr - totalCr) < 1;

  /* Exports */
  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([{
        name: 'Chart of Accounts',
        rows: filtered.map((r) => ({
          Group: r.group,
          Ledger: r.name,
          'Dr Total (₹)': r.drTotal.toFixed(2),
          'Cr Total (₹)': r.crTotal.toFixed(2),
          Balance: r.balance.toFixed(2),
          'Balance Type': r.balanceType,
        })),
      }]),
      `CoA_${asOn}.xlsx`
    );
  }, [filtered, asOn]);

  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useHotkeys('alt+f', () => document.getElementById('coa-search')?.focus());

  useEffect(() => {
    setButtons([
      { label: 'Search', shortcut: 'Alt+F', onClick: () => document.getElementById('coa-search')?.focus() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel]);

  /* balance type badge */
  const btBadge = (bt: CoaRow['balanceType']) => {
    const style =
      bt === 'Dr' ? { background: '#E3F2FD', color: '#0D47A1' } :
      bt === 'Cr' ? { background: '#E8F5E9', color: '#1B5E20' } :
      { background: '#F5F5F5', color: '#888' };
    return (
      <span className="inline-block min-w-[28px] px-1 py-[1px] text-center text-[10px] font-bold" style={style}>
        {bt}
      </span>
    );
  };

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Chart of Accounts
      </div>

      {/* Balance check banner */}
      <div className={`flex items-center gap-3 border-b border-[#AAAAAA] px-3 py-1 text-[12px] ${isBalanced ? 'bg-[#E8F5E9]' : 'bg-[#FFEBEE]'}`}>
        <span className={`font-semibold ${isBalanced ? 'text-[#1B5E20]' : 'text-[#B71C1C]'}`}>
          {isBalanced ? '✓ Trial Balance tallies' : '⚠ Trial Balance out by ' + formatTallyAmount(Math.abs(totalDr - totalCr))}
        </span>
        <span className="text-[#666]">Dr: {formatTallyAmount(totalDr)} · Cr: {formatTallyAmount(totalCr)}</span>
        <span className="ml-auto text-[#666]">{filtered.length} ledgers · {groups.length} groups</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DDDDDD] bg-white px-2 py-2">
        <input id="coa-search" type="text" placeholder="Search ledger / group (Alt+F)…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0, minWidth: 220 }} />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0, minWidth: 180 }}>
          <option value="">All Groups ({groups.length})</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g} ({allLedgers.filter(r => r.group === g).length})</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[12px]">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
          Show zero-balance
        </label>
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">Reports</Link>
      </div>

      {error ? <div className="p-2 text-red-700">{error instanceof Error ? error.message : String(error)}</div> : null}

      {/* Group-by-group table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        {isFetching ? (
          <div className="p-4 text-center text-[#888]">Loading Chart of Accounts…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-[#888]">No ledgers match the filter</div>
        ) : (
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Ledger Name</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Group</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Dr Total (₹)</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Cr Total (₹)</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Balance (₹)</th>
                <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">Type</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).sort(([a], [b]) => categorySortOrder(a) - categorySortOrder(b) || a.localeCompare(b)).map(([group, ledgers]) => {
                const grpDr = ledgers.reduce((s, r) => s + r.drTotal, 0);
                const grpCr = ledgers.reduce((s, r) => s + r.crTotal, 0);
                const grpNet = Math.abs(grpDr - grpCr);
                return (
                  <>
                    {/* Group header */}
                    <tr key={`g_${group}`} style={{ background: '#F0F4FF' }}>
                      <td colSpan={6} className="border-t border-[#AAAAAA] px-2 py-[4px] text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: '#1B5E20', borderLeft: '4px solid #1B5E20' }}>
                        {group}
                      </td>
                    </tr>
                    {ledgers.map((r, i) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                        className="border-b border-[#EEEEEE] hover:bg-[#EEF2FF]">
                        <td className="border border-[#EEEEEE] px-2 py-[3px] pl-5 text-[12px]">{r.name}</td>
                        <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#666]">{r.group}</td>
                        <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">
                          {r.drTotal > 0 ? formatTallyAmount(r.drTotal) : '—'}
                        </td>
                        <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">
                          {r.crTotal > 0 ? formatTallyAmount(r.crTotal) : '—'}
                        </td>
                        <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold">
                          {r.balance > 0.01 ? formatTallyAmount(r.balance) : <span className="text-[#AAA]">Nil</span>}
                        </td>
                        <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                          {btBadge(r.balanceType)}
                        </td>
                      </tr>
                    ))}
                    {/* Group subtotal */}
                    <tr style={{ background: '#E8F5E9', borderTop: '1px solid #AAAAAA' }}>
                      <td colSpan={2} className="px-2 py-[3px] pl-5 text-[11px] font-semibold text-[#1B5E20]">
                        {group} — Sub-total ({ledgers.length} ledgers)
                      </td>
                      <td className="px-2 py-[3px] text-right tabular-nums text-[11px] font-semibold">{formatTallyAmount(grpDr)}</td>
                      <td className="px-2 py-[3px] text-right tabular-nums text-[11px] font-semibold">{formatTallyAmount(grpCr)}</td>
                      <td className="px-2 py-[3px] text-right tabular-nums text-[11px] font-bold">{formatTallyAmount(grpNet)}</td>
                      <td />
                    </tr>
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1B5E20', color: '#FFF', borderTop: '2px solid #0D3D0F' }}>
                <td colSpan={2} className="px-2 py-[5px] font-bold text-[13px]">GRAND TOTAL ({filtered.length} ledgers)</td>
                <td className="px-2 py-[5px] text-right tabular-nums font-bold text-[13px]">{formatTallyAmount(totalDr)}</td>
                <td className="px-2 py-[5px] text-right tabular-nums font-bold text-[13px]">{formatTallyAmount(totalCr)}</td>
                <td className="px-2 py-[5px] text-right tabular-nums font-bold text-[13px]">{formatTallyAmount(Math.abs(totalDr - totalCr))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Ledger balances as of today · Alt+E (Export Excel) · Alt+F (Search)
      </div>
    </div>
  );
}
