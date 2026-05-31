'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useTrialBalanceQuery } from '@/hooks/useReportsQueries';
import { fmtDate } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload, getCompanyConfig } from '@/lib/reports/tally-pdf-table';
import type { TrialBalanceRow } from '@/lib/supabase/reports';

/* ─── Classification ────────────────────────────────────────────── */
type BsCategory =
  | 'share_capital'       // Note 1 — Share / Proprietor Capital
  | 'reserves'            // Note 2 — Reserves & Surplus / P&L
  | 'ltd_borrowing'       // Note 3 — Long-term Borrowings
  | 'other_lt_liab'       // Note 4 — Other LT Liabilities
  | 'lt_provision'        // Note 5 — Long-term Provisions
  | 'st_borrowing'        // Note 6 — Short-term Borrowings
  | 'trade_payable'       // Note 7 — Trade Payables (Creditors)
  | 'other_cl'            // Note 8 — Other Current Liabilities (GST, TDS, advance recd)
  | 'st_provision'        // Note 9 — Short-term Provisions (Salary payable, etc.)
  | 'tangible_fa'         // Note 10a — Tangible Fixed Assets
  | 'intangible_fa'       // Note 10b — Intangible Assets
  | 'cwip'                // Note 10c — Capital WIP
  | 'investment'          // Note 11 — Non-current Investments
  | 'lt_loans_given'      // Note 12 — Long-term Loans & Advances
  | 'inventory'           // Note 14 — Inventories
  | 'trade_recv'          // Note 15 — Trade Receivables
  | 'cash'                // Note 16 — Cash & Cash Equivalents
  | 'st_loans'            // Note 17 — Short-term Loans & Advances
  | 'other_ca'            // Note 18 — Other Current Assets
  | null;

function classifyBS(name: string, group: string): BsCategory {
  const s = `${group} ${name}`.toLowerCase();

  // Exclude pure P&L items
  if (/\bsales\b|turnover|revenue(?! reserve)|^income|purchase|direct exp|indirect exp|wages|salary expense|rent expense|electricity|depreciation|interest paid|finance cost|discount allowed|bank charges|printing|travel|legal|audit|insurance|telephone|advertisement|misc expense/i.test(s))
    return null;

  // Share / Proprietor Capital
  if (/\bcapital\b|share capital|partner.*capital|proprietor|partner.*current account/i.test(s))
    return 'share_capital';

  // Reserves & Surplus (Retained Earnings, General Reserve, P&L balance)
  if (/reserve|retained|p&l|profit.*loss|surplus|general reserve|capital reserve/i.test(s))
    return 'reserves';

  // Long-term Borrowings (term loans, debentures, bonds)
  if (/(term loan|long.?term.*(loan|debt|borrowing)|debenture|bond)/i.test(s) && !/short|current/i.test(s))
    return 'ltd_borrowing';

  // Short-term Borrowings (OD, CC, STL)
  if (/bank.*od|overdraft|cash credit|short.?term.*loan|cc limit|working capital loan/i.test(s))
    return 'st_borrowing';

  // Trade Payables
  if (/\bcreditor|sundry creditor|trade payable|supplier.*payable|account payable/i.test(s))
    return 'trade_payable';

  // Other Current Liabilities (GST, TDS, advance received, salary payable, outstanding liab)
  if (/gst payable|gst output|cgst payable|sgst payable|igst payable|tds payable|advance received|income received in adv|outstanding.*liab|statutory liab|esi payable|pf payable|profession tax|salary payable|wages payable/i.test(s))
    return 'other_cl';

  // Short-term Provisions
  if (/provision.*tax|provision.*salary|provision.*bonus|provision.*leave/i.test(s))
    return 'st_provision';

  // Long-term Provisions
  if (/provision.*gratuity|provision.*pension/i.test(s))
    return 'lt_provision';

  // Other LT Liabilities
  if (/security deposit.*received|tenant deposit/i.test(s))
    return 'other_lt_liab';

  // Tangible Fixed Assets
  if (/building|equipment|vehicle|plant|furniture|computer|motor|machinery|leasehold improve|office equipment/i.test(s))
    return 'tangible_fa';

  // Intangible Fixed Assets
  if (/goodwill|patent|trademark|software|licence|brand/i.test(s))
    return 'intangible_fa';

  // CWIP
  if (/capital.*wip|work.in.progress|cwip/i.test(s))
    return 'cwip';

  // Non-current Investments
  if (/investment|mutual fund|shares.*held|securities|fdr|fd\b|fixed deposit/i.test(s))
    return 'investment';

  // Inventories
  if (/\bstock\b|inventory\b|merchandise|goods in hand/i.test(s))
    return 'inventory';

  // Cash & Bank
  if (/\bcash\b|petty cash|^bank\b|bank account|bank balance/i.test(s))
    return 'cash';

  // Trade Receivables
  if (/debtor|sundry debtor|trade receivable|customer.*outstanding|farmer.*outstanding/i.test(s))
    return 'trade_recv';

  // ST Loans & Advances
  if (/advance paid|prepaid|security deposit paid|loan.*given|deposit.*paid|advance to supplier/i.test(s))
    return 'st_loans';

  // Other CA (ITC, TDS receivable)
  if (/tds receivable|input tax credit|itc|gst receivable|cgst input|sgst input|tax refund/i.test(s))
    return 'other_ca';

  return null;
}

/* ─── Build engine ──────────────────────────────────────────────── */
interface BsLine { name: string; amount: number; group: string }

type BsBuckets = Record<string, BsLine[]>;

interface Sch3Data {
  // EQUITY & LIABILITIES
  shareCapital: BsLine[];
  reserves: BsLine[];
  ltdBorrowing: BsLine[];
  otherLtLiab: BsLine[];
  ltProvision: BsLine[];
  stBorrowing: BsLine[];
  tradePayable: BsLine[];
  otherCl: BsLine[];
  stProvision: BsLine[];
  unclassifiedL: BsLine[];
  // ASSETS
  tangibleFa: BsLine[];
  intangibleFa: BsLine[];
  cwip: BsLine[];
  investments: BsLine[];
  ltLoans: BsLine[];
  inventory: BsLine[];
  tradeRecv: BsLine[];
  cash: BsLine[];
  stLoans: BsLine[];
  otherCa: BsLine[];
  unclassifiedA: BsLine[];
  // Totals
  totShareCapital: number; totReserves: number; totEquity: number;
  totLtdBorrowing: number; totOtherLtLiab: number; totLtProvision: number; totNonCurrLiab: number;
  totStBorrowing: number; totTradePayable: number; totOtherCl: number; totStProvision: number; totCurrLiab: number;
  totLiabilities: number;
  totTangibleFa: number; totIntangibleFa: number; totCwip: number; totFa: number;
  totInvestments: number; totLtLoans: number; totNonCurrAssets: number;
  totInventory: number; totTradeRecv: number; totCash: number; totStLoans: number; totOtherCa: number; totCurrAssets: number;
  totAssets: number;
  difference: number;
}

function buildSch3(rows: TrialBalanceRow[]): Sch3Data {
  const b: BsBuckets = {
    share_capital: [], reserves: [], ltd_borrowing: [], other_lt_liab: [], lt_provision: [],
    st_borrowing: [], trade_payable: [], other_cl: [], st_provision: [],
    tangible_fa: [], intangible_fa: [], cwip: [], investment: [], lt_loans_given: [],
    inventory: [], trade_recv: [], cash: [], st_loans: [], other_ca: [],
    unclassifiedL: [], unclassifiedA: [],
  };

  for (const r of rows) {
    const net = r.dr_total - r.cr_total;
    if (Math.abs(net) < 0.01) continue;
    const cat = classifyBS(r.ledger_name, r.group_name ?? '');
    const line: BsLine = { name: r.ledger_name, amount: net, group: r.group_name ?? '' };

    if (!cat) {
      if (net < 0) b.unclassifiedL.push({ ...line, amount: -net });
      else b.unclassifiedA.push(line);
      continue;
    }

    const liabSide = ['share_capital','reserves','ltd_borrowing','other_lt_liab','lt_provision','st_borrowing','trade_payable','other_cl','st_provision'];
    if (liabSide.includes(cat)) {
      b[cat].push({ ...line, amount: -net }); // flip sign: liabilities appear as positive
    } else {
      b[cat].push(line);
    }
  }

  const sum = (arr: BsLine[]) => arr.reduce((s, r) => s + r.amount, 0);

  const totShareCapital = sum(b.share_capital);
  const totReserves = sum(b.reserves);
  const totEquity = totShareCapital + totReserves;
  const totLtdBorrowing = sum(b.ltd_borrowing);
  const totOtherLtLiab = sum(b.other_lt_liab);
  const totLtProvision = sum(b.lt_provision);
  const totNonCurrLiab = totLtdBorrowing + totOtherLtLiab + totLtProvision;
  const totStBorrowing = sum(b.st_borrowing);
  const totTradePayable = sum(b.trade_payable);
  const totOtherCl = sum(b.other_cl);
  const totStProvision = sum(b.st_provision);
  const totCurrLiab = totStBorrowing + totTradePayable + totOtherCl + totStProvision;
  const totLiabilities = totEquity + totNonCurrLiab + totCurrLiab + sum(b.unclassifiedL);

  const totTangibleFa = sum(b.tangible_fa);
  const totIntangibleFa = sum(b.intangible_fa);
  const totCwip = sum(b.cwip);
  const totFa = totTangibleFa + totIntangibleFa + totCwip;
  const totInvestments = sum(b.investment);
  const totLtLoans = sum(b.lt_loans_given);
  const totNonCurrAssets = totFa + totInvestments + totLtLoans;
  const totInventory = sum(b.inventory);
  const totTradeRecv = sum(b.trade_recv);
  const totCash = sum(b.cash);
  const totStLoans = sum(b.st_loans);
  const totOtherCa = sum(b.other_ca);
  const totCurrAssets = totInventory + totTradeRecv + totCash + totStLoans + totOtherCa + sum(b.unclassifiedA);
  const totAssets = totNonCurrAssets + totCurrAssets;

  return {
    shareCapital: b.share_capital, reserves: b.reserves, ltdBorrowing: b.ltd_borrowing,
    otherLtLiab: b.other_lt_liab, ltProvision: b.lt_provision, stBorrowing: b.st_borrowing,
    tradePayable: b.trade_payable, otherCl: b.other_cl, stProvision: b.st_provision,
    unclassifiedL: b.unclassifiedL,
    tangibleFa: b.tangible_fa, intangibleFa: b.intangible_fa, cwip: b.cwip,
    investments: b.investment, ltLoans: b.lt_loans_given, inventory: b.inventory,
    tradeRecv: b.trade_recv, cash: b.cash, stLoans: b.st_loans, otherCa: b.other_ca,
    unclassifiedA: b.unclassifiedA,
    totShareCapital, totReserves, totEquity, totLtdBorrowing, totOtherLtLiab, totLtProvision,
    totNonCurrLiab, totStBorrowing, totTradePayable, totOtherCl, totStProvision, totCurrLiab,
    totLiabilities, totTangibleFa, totIntangibleFa, totCwip, totFa,
    totInvestments, totLtLoans, totNonCurrAssets, totInventory, totTradeRecv,
    totCash, totStLoans, totOtherCa, totCurrAssets, totAssets,
    difference: totAssets - totLiabilities,
  };
}

/* ─── UI helpers ─────────────────────────────────────────────────── */
const FA = formatTallyAmount;

function NoteLines({ lines, accent }: { lines: BsLine[]; accent?: string }) {
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((l) => (
        <tr key={l.name} className="border-b border-[#F0F0F0]">
          <td className="py-[2px] pl-8 pr-2 text-[11px] text-[#555]">{l.name}</td>
          <td className="py-[2px] pr-2 text-right text-[11px] tabular-nums" style={{ color: accent }}>
            {l.amount < 0 ? `(${FA(Math.abs(l.amount))})` : FA(l.amount)}
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}

function NoteSection({
  noteNum, label, lines, total, accent = '#333',
}: { noteNum: string; label: string; lines: BsLine[]; total: number; accent?: string }) {
  if (total === 0 && lines.length === 0) return null;
  return (
    <>
      <tr style={{ background: '#F7F7F7' }}>
        <td className="border-t border-[#E0E0E0] py-[3px] pl-4 pr-2 text-[12px] font-semibold text-[#333]">
          <span className="mr-2 text-[10px] font-bold text-[#888]">{noteNum}</span>{label}
        </td>
        <td className="border-t border-[#E0E0E0] py-[3px] pr-2 text-right text-[12px] font-bold tabular-nums" style={{ color: accent }}>
          {FA(total)}
        </td>
        <td className="border-t border-[#E0E0E0] w-[90px]" />
      </tr>
      <NoteLines lines={lines} accent="#888" />
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr style={{ background: '#1B5E20' }}>
      <td colSpan={3} className="py-[4px] pl-3 text-[11px] font-bold uppercase tracking-widest text-white">
        {label}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, amount, indent = false }: { label: string; amount: number; indent?: boolean }) {
  if (amount === 0) return null;
  return (
    <tr style={{ background: '#E8F5E9', borderTop: '1px solid #AAAAAA' }}>
      <td className={`py-[3px] ${indent ? 'pl-8' : 'pl-4'} pr-2 text-[12px] font-semibold text-[#1B5E20]`}>{label}</td>
      <td className="py-[3px] pr-2 text-right text-[12px] font-bold tabular-nums text-[#1B5E20]">{FA(amount)}</td>
      <td />
    </tr>
  );
}

function GrandRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr style={{ background: '#1B5E20', color: '#FFF', borderTop: '2px solid #0D3D0F' }}>
      <td className="py-[5px] pl-3 text-[13px] font-bold">{label}</td>
      <td className="py-[5px] pr-2 text-right text-[14px] font-bold tabular-nums">{FA(amount)}</td>
      <td />
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function BalanceSheetPage() {
  const [asOnIso, setAsOnIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<'sch3' | 'simple'>('sch3');
  const setButtons = useTallySetButtons();
  const { dealer } = useAuth();

  const { data: rows = [], isFetching, error } = useTrialBalanceQuery(asOnIso);
  const bs = useMemo(() => buildSch3(rows), [rows]);
  const balanceOk = Math.abs(bs.difference) <= 1;

  /* ── Excel Export ── */
  const exportExcel = useCallback(() => {
    const exRows: { Section: string; Note: string; Particulars: string; Amount: number }[] = [];
    const push = (section: string, note: string, label: string, amount: number) =>
      exRows.push({ Section: section, Note: note, Particulars: label, Amount: amount });

    push('EQUITY & LIABILITIES', '', '', 0);
    push('I. Shareholders Funds', '1', 'Share Capital', bs.totShareCapital);
    push('I. Shareholders Funds', '2', 'Reserves & Surplus', bs.totReserves);
    push('', '', 'TOTAL EQUITY', bs.totEquity);
    push('II. Non-Current Liabilities', '3', 'Long-term Borrowings', bs.totLtdBorrowing);
    push('II. Non-Current Liabilities', '4', 'Other LT Liabilities', bs.totOtherLtLiab);
    push('II. Non-Current Liabilities', '5', 'Long-term Provisions', bs.totLtProvision);
    push('', '', 'TOTAL NCL', bs.totNonCurrLiab);
    push('III. Current Liabilities', '6', 'Short-term Borrowings', bs.totStBorrowing);
    push('III. Current Liabilities', '7', 'Trade Payables', bs.totTradePayable);
    push('III. Current Liabilities', '8', 'Other Current Liabilities', bs.totOtherCl);
    push('III. Current Liabilities', '9', 'Short-term Provisions', bs.totStProvision);
    push('', '', 'TOTAL CL', bs.totCurrLiab);
    push('', '', 'TOTAL EQUITY & LIABILITIES', bs.totLiabilities);
    push('ASSETS', '', '', 0);
    push('I. Non-Current Assets', '10', 'Fixed Assets (Tangible)', bs.totTangibleFa);
    push('I. Non-Current Assets', '10', 'Fixed Assets (Intangible)', bs.totIntangibleFa);
    push('I. Non-Current Assets', '10', 'Capital WIP', bs.totCwip);
    push('I. Non-Current Assets', '11', 'Investments', bs.totInvestments);
    push('I. Non-Current Assets', '12', 'LT Loans & Advances', bs.totLtLoans);
    push('', '', 'TOTAL NCA', bs.totNonCurrAssets);
    push('II. Current Assets', '14', 'Inventories', bs.totInventory);
    push('II. Current Assets', '15', 'Trade Receivables', bs.totTradeRecv);
    push('II. Current Assets', '16', 'Cash & Cash Equivalents', bs.totCash);
    push('II. Current Assets', '17', 'ST Loans & Advances', bs.totStLoans);
    push('II. Current Assets', '18', 'Other Current Assets', bs.totOtherCa);
    push('', '', 'TOTAL CA', bs.totCurrAssets);
    push('', '', 'TOTAL ASSETS', bs.totAssets);

    downloadWorkbook(
      workbookFromSheets([{ name: 'Balance Sheet', rows: exRows }]),
      `BalanceSheet_Sch3_${asOnIso}.xlsx`
    );
  }, [bs, asOnIso]);

  /* ── PDF Export ── */
  const exportPdf = useCallback(async () => {
    const cfg = getCompanyConfig();
    const pdfRows: string[][] = [];
    const push = (label: string, note: string, amount: string) => pdfRows.push([label, note, amount]);

    push('EQUITY AND LIABILITIES', '', '');
    push('I. Shareholders\' Funds', '', '');
    push('   (a) Share Capital', '1', FA(bs.totShareCapital));
    push('   (b) Reserves & Surplus', '2', FA(bs.totReserves));
    push('   Sub-total — Shareholders\' Funds', '', FA(bs.totEquity));
    push('II. Non-Current Liabilities', '', '');
    push('   (a) Long-term Borrowings', '3', FA(bs.totLtdBorrowing));
    push('   (b) Other LT Liabilities', '4', FA(bs.totOtherLtLiab));
    push('   (c) Long-term Provisions', '5', FA(bs.totLtProvision));
    push('   Sub-total — Non-Current Liabilities', '', FA(bs.totNonCurrLiab));
    push('III. Current Liabilities', '', '');
    push('   (a) Short-term Borrowings', '6', FA(bs.totStBorrowing));
    push('   (b) Trade Payables', '7', FA(bs.totTradePayable));
    push('   (c) Other Current Liabilities', '8', FA(bs.totOtherCl));
    push('   (d) Short-term Provisions', '9', FA(bs.totStProvision));
    push('   Sub-total — Current Liabilities', '', FA(bs.totCurrLiab));
    push('TOTAL EQUITY & LIABILITIES', '', FA(bs.totLiabilities));
    push('', '', '');
    push('ASSETS', '', '');
    push('I. Non-Current Assets', '', '');
    push('   (a) Fixed Assets — Tangible', '10', FA(bs.totTangibleFa));
    push('   (a) Fixed Assets — Intangible', '10', FA(bs.totIntangibleFa));
    push('   (a) Capital Work-in-Progress', '10', FA(bs.totCwip));
    push('   (b) Non-current Investments', '11', FA(bs.totInvestments));
    push('   (c) LT Loans & Advances', '12', FA(bs.totLtLoans));
    push('   Sub-total — Non-Current Assets', '', FA(bs.totNonCurrAssets));
    push('II. Current Assets', '', '');
    push('   (a) Inventories', '14', FA(bs.totInventory));
    push('   (b) Trade Receivables', '15', FA(bs.totTradeRecv));
    push('   (c) Cash & Cash Equivalents', '16', FA(bs.totCash));
    push('   (d) Short-term Loans & Advances', '17', FA(bs.totStLoans));
    push('   (e) Other Current Assets', '18', FA(bs.totOtherCa));
    push('   Sub-total — Current Assets', '', FA(bs.totCurrAssets));
    push('TOTAL ASSETS', '', FA(bs.totAssets));

    const b = await tallyTablePdfBlob({
      title: 'Balance Sheet',
      subtitle: `As on ${fmtDate(asOnIso)} — Schedule III Format (Companies Act 2013)`,
      reportPeriod: `As on ${fmtDate(asOnIso)}`,
      companyName: cfg.companyName,
      gstin: cfg.gstin,
      address: cfg.address,
      headers: ['Particulars', 'Note', 'Amount (₹)'],
      rows: pdfRows,
      footerNote: `${dealer?.company_name ?? ''} · Balance Sheet as on ${fmtDate(asOnIso)}`,
    });
    triggerDownload(b, `BalanceSheet_Sch3_${asOnIso}.pdf`);
  }, [bs, asOnIso, dealer?.company_name]);

  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });
  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: () => document.getElementById('bs-as-on')?.focus() },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel, exportPdf]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        Balance Sheet — Schedule III Format
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-[12px]">
          As on
          <input id="bs-as-on" type="date" value={asOnIso} onChange={(e) => setAsOnIso(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <div className="flex items-center gap-0 border border-[#AAAAAA]">
          {(['sch3', 'simple'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setViewMode(m)}
              className="px-3 py-[2px] text-[11px] font-semibold"
              style={{
                background: viewMode === m ? '#1B5E20' : '#FFF',
                color: viewMode === m ? '#FFF' : '#333',
                borderRadius: 0,
              }}>
              {m === 'sch3' ? 'Schedule III' : 'Simple'}
            </button>
          ))}
        </div>
        {!isFetching && (
          <span className={`text-[11px] font-semibold ${balanceOk ? 'text-[#1B5E20]' : 'text-[#B71C1C]'}`}>
            {balanceOk ? '✓ Books Balanced' : `⚠ Difference: ${FA(Math.abs(bs.difference))}`}
          </span>
        )}
        <Link href="/tally/reports" className="ml-auto text-[12px] text-[#0D47A1] underline">Reports</Link>
      </div>

      {error ? <div className="p-2 text-red-700">{error instanceof Error ? error.message : String(error)}</div> : null}
      {isFetching ? <div className="px-3 py-1 text-[12px] text-[#888]">Loading trial balance…</div> : null}

      {/* ── Schedule III View ── */}
      {viewMode === 'sch3' ? (
        <div className="flex-1 overflow-auto p-3">
          <div className="mb-2 text-center text-[11px] text-[#666] font-semibold uppercase tracking-wider">
            {dealer?.company_name} · Balance Sheet as at {fmtDate(asOnIso)}
            <span className="ml-3 text-[10px] normal-case font-normal">(As per Schedule III — Companies Act 2013)</span>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* ── LEFT: EQUITY & LIABILITIES ── */}
            <div className="border border-[#AAAAAA] bg-white">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                    <th className="px-3 py-[5px] text-left text-[11px]">Equity & Liabilities</th>
                    <th className="px-2 py-[5px] text-right text-[11px]" style={{ width: 110 }}>₹</th>
                    <th className="px-2 py-[5px] text-center text-[11px]" style={{ width: 90 }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {/* I. Shareholders' Funds */}
                  <SectionHeader label="I. Shareholders' Funds" />
                  <NoteSection noteNum="1" label="Share Capital" lines={bs.shareCapital} total={bs.totShareCapital} accent="#1B5E20" />
                  <NoteSection noteNum="2" label="Reserves & Surplus" lines={bs.reserves} total={bs.totReserves} accent="#1B5E20" />
                  <SubtotalRow label="Total Shareholders' Funds" amount={bs.totEquity} />

                  {/* II. Non-Current Liabilities */}
                  <SectionHeader label="II. Non-Current Liabilities" />
                  <NoteSection noteNum="3" label="Long-term Borrowings" lines={bs.ltdBorrowing} total={bs.totLtdBorrowing} accent="#0D47A1" />
                  <NoteSection noteNum="4" label="Other Long-term Liabilities" lines={bs.otherLtLiab} total={bs.totOtherLtLiab} accent="#0D47A1" />
                  <NoteSection noteNum="5" label="Long-term Provisions" lines={bs.ltProvision} total={bs.totLtProvision} accent="#0D47A1" />
                  <SubtotalRow label="Total Non-Current Liabilities" amount={bs.totNonCurrLiab} />

                  {/* III. Current Liabilities */}
                  <SectionHeader label="III. Current Liabilities" />
                  <NoteSection noteNum="6" label="Short-term Borrowings" lines={bs.stBorrowing} total={bs.totStBorrowing} accent="#E65100" />
                  <NoteSection noteNum="7" label="Trade Payables" lines={bs.tradePayable} total={bs.totTradePayable} accent="#E65100" />
                  <NoteSection noteNum="8" label="Other Current Liabilities" lines={bs.otherCl} total={bs.totOtherCl} accent="#E65100" />
                  <NoteSection noteNum="9" label="Short-term Provisions" lines={bs.stProvision} total={bs.totStProvision} accent="#E65100" />
                  {bs.unclassifiedL.length > 0 && (
                    <NoteSection noteNum="—" label="Other (Unclassified)" lines={bs.unclassifiedL}
                      total={bs.unclassifiedL.reduce((s, r) => s + r.amount, 0)} accent="#777" />
                  )}
                  <SubtotalRow label="Total Current Liabilities" amount={bs.totCurrLiab} />
                </tbody>
                <tfoot>
                  <GrandRow label="TOTAL EQUITY & LIABILITIES" amount={bs.totLiabilities} />
                </tfoot>
              </table>
            </div>

            {/* ── RIGHT: ASSETS ── */}
            <div className="border border-[#AAAAAA] bg-white">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                    <th className="px-3 py-[5px] text-left text-[11px]">Assets</th>
                    <th className="px-2 py-[5px] text-right text-[11px]" style={{ width: 110 }}>₹</th>
                    <th className="px-2 py-[5px] text-center text-[11px]" style={{ width: 90 }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {/* I. Non-Current Assets */}
                  <SectionHeader label="I. Non-Current Assets" />
                  <NoteSection noteNum="10a" label="Tangible Fixed Assets" lines={bs.tangibleFa} total={bs.totTangibleFa} accent="#4527A0" />
                  <NoteSection noteNum="10b" label="Intangible Assets" lines={bs.intangibleFa} total={bs.totIntangibleFa} accent="#4527A0" />
                  <NoteSection noteNum="10c" label="Capital Work-in-Progress" lines={bs.cwip} total={bs.totCwip} accent="#4527A0" />
                  <NoteSection noteNum="11" label="Non-current Investments" lines={bs.investments} total={bs.totInvestments} accent="#00838F" />
                  <NoteSection noteNum="12" label="LT Loans & Advances" lines={bs.ltLoans} total={bs.totLtLoans} accent="#00838F" />
                  <SubtotalRow label="Total Non-Current Assets" amount={bs.totNonCurrAssets} />

                  {/* II. Current Assets */}
                  <SectionHeader label="II. Current Assets" />
                  <NoteSection noteNum="14" label="Inventories" lines={bs.inventory} total={bs.totInventory} accent="#E65100" />
                  <NoteSection noteNum="15" label="Trade Receivables" lines={bs.tradeRecv} total={bs.totTradeRecv} accent="#1565C0" />
                  <NoteSection noteNum="16" label="Cash & Cash Equivalents" lines={bs.cash} total={bs.totCash} accent="#2E7D32" />
                  <NoteSection noteNum="17" label="Short-term Loans & Advances" lines={bs.stLoans} total={bs.totStLoans} accent="#558B2F" />
                  <NoteSection noteNum="18" label="Other Current Assets" lines={bs.otherCa} total={bs.totOtherCa} accent="#558B2F" />
                  {bs.unclassifiedA.length > 0 && (
                    <NoteSection noteNum="—" label="Other (Unclassified)" lines={bs.unclassifiedA}
                      total={bs.unclassifiedA.reduce((s, r) => s + r.amount, 0)} accent="#777" />
                  )}
                  <SubtotalRow label="Total Current Assets" amount={bs.totCurrAssets} />
                </tbody>
                <tfoot>
                  <GrandRow label="TOTAL ASSETS" amount={bs.totAssets} />
                </tfoot>
              </table>
            </div>
          </div>

          {!balanceOk && !isFetching ? (
            <p className="mt-2 text-[11px] text-[#B71C1C]">
              ⚠ Difference of {FA(Math.abs(bs.difference))} — check ledger group assignments in
              {' '}<Link href="/tally/coa" className="underline">Chart of Accounts</Link>.
              Common causes: P&L items missing from Income/Expense groups, or incorrect opening balances.
            </p>
          ) : null}

          <p className="mt-2 text-[11px] text-[#888]">
            {dealer?.company_name} · As on {fmtDate(asOnIso)} · Schedule III — Companies Act 2013
          </p>
        </div>
      ) : (
        /* ── Simple View (legacy) ── */
        <div className="flex-1 overflow-auto p-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="border border-[#AAAAAA] bg-white">
              <div className="px-2 py-1 font-semibold text-white text-[12px]" style={{ background: '#1B5E20' }}>LIABILITIES</div>
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {[
                    { label: 'Capital & Reserves', lines: [...bs.shareCapital, ...bs.reserves], total: bs.totEquity },
                    { label: 'Long-Term Borrowings', lines: bs.ltdBorrowing, total: bs.totLtdBorrowing },
                    { label: 'Current Liabilities', lines: [...bs.stBorrowing, ...bs.tradePayable, ...bs.otherCl, ...bs.stProvision], total: bs.totCurrLiab },
                  ].map(({ label, lines, total }) => lines.length > 0 ? (
                    <NoteSection key={label} noteNum="" label={label} lines={lines} total={total} />
                  ) : null)}
                </tbody>
                <tfoot><GrandRow label="TOTAL LIABILITIES" amount={bs.totLiabilities} /></tfoot>
              </table>
            </div>
            <div className="border border-[#AAAAAA] bg-white">
              <div className="px-2 py-1 font-semibold text-white text-[12px]" style={{ background: '#1B5E20' }}>ASSETS</div>
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {[
                    { label: 'Fixed Assets', lines: [...bs.tangibleFa, ...bs.intangibleFa, ...bs.cwip], total: bs.totFa },
                    { label: 'Investments', lines: bs.investments, total: bs.totInvestments },
                    { label: 'Inventories', lines: bs.inventory, total: bs.totInventory },
                    { label: 'Trade Receivables', lines: bs.tradeRecv, total: bs.totTradeRecv },
                    { label: 'Cash & Bank', lines: bs.cash, total: bs.totCash },
                    { label: 'Other Current Assets', lines: [...bs.stLoans, ...bs.otherCa], total: bs.totStLoans + bs.totOtherCa },
                  ].map(({ label, lines, total }) => lines.length > 0 ? (
                    <NoteSection key={label} noteNum="" label={label} lines={lines} total={total} />
                  ) : null)}
                </tbody>
                <tfoot><GrandRow label="TOTAL ASSETS" amount={bs.totAssets} /></tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
