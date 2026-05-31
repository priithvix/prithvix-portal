'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { usePurchaseRegisterQuery } from '@/hooks/useReportsQueries';
import { fyDates, listFYOptions, fmtDate, getFY } from '@/lib/reports/formatters';
import { formatTallyAmount } from '@/lib/tally-format';
import { downloadWorkbook, workbookFromSheets } from '@/lib/reports/excel-export';
import { tallyTablePdfBlob, triggerDownload, getCompanyConfig } from '@/lib/reports/tally-pdf-table';

/* ─── TDS Section reference (Income Tax Act) ─────────────────────── */
const TDS_SECTIONS: { section: string; description: string; threshold: number; rate: number; rateNoP: number }[] = [
  { section: '194C', description: 'Payment to Contractors', threshold: 30000, rate: 1, rateNoP: 2 },
  { section: '194J', description: 'Professional/Technical Services', threshold: 30000, rate: 10, rateNoP: 10 },
  { section: '194I(a)', description: 'Rent — Plant & Machinery', threshold: 240000, rate: 2, rateNoP: 2 },
  { section: '194I(b)', description: 'Rent — Land/Building/Furniture', threshold: 240000, rate: 10, rateNoP: 10 },
  { section: '194A', description: 'Interest (Other than Securities)', threshold: 40000, rate: 10, rateNoP: 20 },
  { section: '194H', description: 'Commission / Brokerage', threshold: 15000, rate: 5, rateNoP: 5 },
  { section: '194Q', description: 'Purchase of Goods (TDS on Buyer)', threshold: 5000000, rate: 0.1, rateNoP: 5 },
  { section: '194B', description: 'Winnings from Lottery', threshold: 10000, rate: 30, rateNoP: 30 },
];

const FYS = listFYOptions();

type TdsEntry = {
  id: string;
  deducteeId: string;
  deducteeName: string;
  pan: string;
  section: string;
  paymentDate: string;
  paymentAmt: number;
  tdsRate: number;
  tdsAmt: number;
  deposited: boolean;
  depositDate: string;
  challanNo: string;
  remarks: string;
};

const EMPTY_ENTRY = (): TdsEntry => ({
  id: Math.random().toString(36).slice(2),
  deducteeId: '',
  deducteeName: '',
  pan: '',
  section: '194C',
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentAmt: 0,
  tdsRate: 1,
  tdsAmt: 0,
  deposited: false,
  depositDate: '',
  challanNo: '',
  remarks: '',
});

const TDS_STORAGE_KEY = 'prithvix_tds_entries';

function loadEntries(fy: string): TdsEntry[] {
  try {
    const raw = localStorage.getItem(`${TDS_STORAGE_KEY}_${fy}`);
    return raw ? (JSON.parse(raw) as TdsEntry[]) : [];
  } catch { return []; }
}

function saveEntries(fy: string, entries: TdsEntry[]) {
  try {
    localStorage.setItem(`${TDS_STORAGE_KEY}_${fy}`, JSON.stringify(entries));
  } catch { /* ignore */ }
}

export default function TdsPage() {
  const [fy, setFy] = useState(() => getFY(new Date()));
  const { dealer } = useAuth();
  const setButtons = useTallySetButtons();

  const { start: fyStart, end: fyEnd } = useMemo(() => fyDates(fy), [fy]);
  const fromIso = fyStart.toISOString().slice(0, 10);
  const toIso = fyEnd.toISOString().slice(0, 10);

  const [entries, setEntries] = useState<TdsEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TdsEntry>(EMPTY_ENTRY());
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'deposited'>('all');

  /* Load from localStorage when FY changes */
  useEffect(() => {
    setEntries(loadEntries(fy));
  }, [fy]);

  const { data: purchases = [] } = usePurchaseRegisterQuery(fromIso, toIso);

  /* ── 194Q auto-detect: purchases > ₹50L threshold ── */
  const sect194QTotal = useMemo(() =>
    purchases.reduce((s, r) => s + r.invoice_value, 0),
    [purchases]
  );
  const sect194QApplicable = sect194QTotal >= 5000000;

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let r = entries;
    if (filterSection) r = r.filter((e) => e.section === filterSection);
    if (filterStatus === 'pending') r = r.filter((e) => !e.deposited);
    if (filterStatus === 'deposited') r = r.filter((e) => e.deposited);
    return r;
  }, [entries, filterSection, filterStatus]);

  /* ── Totals ── */
  const totals = useMemo(() => ({
    payment: filtered.reduce((s, e) => s + e.paymentAmt, 0),
    tds: filtered.reduce((s, e) => s + e.tdsAmt, 0),
    deposited: filtered.filter((e) => e.deposited).reduce((s, e) => s + e.tdsAmt, 0),
    pending: filtered.filter((e) => !e.deposited).reduce((s, e) => s + e.tdsAmt, 0),
  }), [filtered]);

  /* ── Section-wise summary ── */
  const sectionSummary = useMemo(() => {
    const map = new Map<string, { count: number; payment: number; tds: number; deposited: number }>();
    for (const e of entries) {
      if (!map.has(e.section)) map.set(e.section, { count: 0, payment: 0, tds: 0, deposited: 0 });
      const s = map.get(e.section)!;
      s.count++;
      s.payment += e.paymentAmt;
      s.tds += e.tdsAmt;
      if (e.deposited) s.deposited += e.tdsAmt;
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  /* ── Form helpers ── */
  const set = (k: keyof TdsEntry, v: string | number | boolean) =>
    setForm((p) => {
      const next = { ...p, [k]: v };
      // Auto-calc TDS amount
      if (k === 'paymentAmt' || k === 'tdsRate') {
        next.tdsAmt = parseFloat(String(next.paymentAmt || 0)) * (parseFloat(String(next.tdsRate || 0)) / 100);
      }
      // Auto-fill rate from section
      if (k === 'section') {
        const sec = TDS_SECTIONS.find((s) => s.section === v);
        if (sec) next.tdsRate = sec.rate;
        next.tdsAmt = next.paymentAmt * (next.tdsRate / 100);
      }
      return next;
    });

  const saveEntry = () => {
    const updated = form.id && entries.some((e) => e.id === form.id)
      ? entries.map((e) => e.id === form.id ? form : e)
      : [...entries, form];
    setEntries(updated);
    saveEntries(fy, updated);
    setForm(EMPTY_ENTRY());
    setShowForm(false);
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(fy, updated);
  };

  const toggleDeposited = (id: string) => {
    const updated = entries.map((e) => e.id === id ? { ...e, deposited: !e.deposited } : e);
    setEntries(updated);
    saveEntries(fy, updated);
  };

  /* ── Exports ── */
  const exportExcel = useCallback(() => {
    downloadWorkbook(
      workbookFromSheets([{
        name: 'TDS Register',
        rows: filtered.map((e) => ({
          'Payment Date': e.paymentDate,
          'Deductee Name': e.deducteeName,
          'PAN': e.pan,
          'Section': e.section,
          'Payment Amt (₹)': e.paymentAmt.toFixed(2),
          'TDS Rate %': e.tdsRate,
          'TDS Amt (₹)': e.tdsAmt.toFixed(2),
          'Deposited': e.deposited ? 'Yes' : 'No',
          'Deposit Date': e.depositDate,
          'Challan No': e.challanNo,
          'Remarks': e.remarks,
        })),
      }]),
      `TDS_Register_${fy}.xlsx`
    );
  }, [filtered, fy]);

  const exportPdf = useCallback(async () => {
    const cfg = getCompanyConfig();
    const b = await tallyTablePdfBlob({
      title: 'TDS Deduction Register',
      subtitle: `FY ${fy} · ${fmtDate(fromIso)} to ${fmtDate(toIso)}`,
      reportPeriod: `FY ${fy}`,
      companyName: cfg.companyName,
      gstin: cfg.gstin,
      headers: ['Date', 'Deductee', 'PAN', 'Section', 'Payment (₹)', 'TDS (₹)', 'Deposited'],
      rows: filtered.map((e) => [
        fmtDate(e.paymentDate),
        e.deducteeName,
        e.pan || '—',
        e.section,
        formatTallyAmount(e.paymentAmt),
        formatTallyAmount(e.tdsAmt),
        e.deposited ? '✓' : '⏳',
      ]),
      footerNote: `Total TDS: ${formatTallyAmount(totals.tds)} · Deposited: ${formatTallyAmount(totals.deposited)} · Pending: ${formatTallyAmount(totals.pending)}`,
    });
    triggerDownload(b, `TDS_Register_${fy}.pdf`);
  }, [filtered, totals, fy, fromIso, toIso]);

  useHotkeys('alt+n', (e) => { e.preventDefault(); setForm(EMPTY_ENTRY()); setShowForm(true); });
  useHotkeys('alt+e', (e) => { e.preventDefault(); exportExcel(); });
  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });

  useEffect(() => {
    setButtons([
      { label: 'New Entry (Alt+N)', shortcut: 'Alt+N', onClick: () => { setForm(EMPTY_ENTRY()); setShowForm(true); } },
      { label: 'Export Excel', shortcut: 'Alt+E', onClick: exportExcel },
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportExcel, exportPdf]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      <div className="border-b py-[5px] text-center font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        TDS Deduction Register
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] bg-white px-2 py-2">
        <label className="flex items-center gap-1 text-[12px] font-semibold">
          FY
          <select value={fy} onChange={(e) => setFy(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }}>
            {FYS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}
          className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }}>
          <option value="">All Sections</option>
          {TDS_SECTIONS.map((s) => <option key={s.section} value={s.section}>{s.section} — {s.description}</option>)}
        </select>
        <div className="flex border border-[#AAAAAA]">
          {(['all', 'pending', 'deposited'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className="px-2 py-[2px] text-[11px] capitalize"
              style={{ background: filterStatus === s ? '#1B5E20' : '#FFF', color: filterStatus === s ? '#FFF' : '#333', borderRadius: 0 }}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setForm(EMPTY_ENTRY()); setShowForm(true); }}
          className="border border-[#1B5E20] bg-[#1B5E20] px-3 py-[2px] text-[12px] font-semibold text-white hover:bg-[#2E7D32]"
          style={{ borderRadius: 0 }}>
          + New (Alt+N)
        </button>
        <Link href="/tally" className="ml-auto text-[12px] text-[#0D47A1] underline">Gateway</Link>
      </div>

      {/* 194Q Alert */}
      {sect194QApplicable && (
        <div className="mx-3 mt-2 border border-[#E65100] bg-[#FFF3E0] px-3 py-2 text-[12px] text-[#E65100]">
          ⚠ <strong>Section 194Q alert:</strong> Total purchases this FY = {formatTallyAmount(sect194QTotal)} — exceeds ₹50L threshold.
          TDS @ 0.1% on purchases above ₹50L is applicable. Ensure TDS entries are recorded.
        </div>
      )}

      {/* KPI banner */}
      <div className="flex flex-wrap gap-4 border-b border-[#DDDDDD] bg-[#E8F5E9] px-3 py-2">
        {[
          { label: 'Total Deducted', value: totals.tds, color: '#1B5E20' },
          { label: 'Deposited to Govt', value: totals.deposited, color: '#2E7D32' },
          { label: 'Pending Deposit', value: totals.pending, color: '#E65100' },
          { label: 'Total Payments', value: totals.payment, color: '#333' },
        ].map((k) => (
          <div key={k.label} className="flex flex-col">
            <span className="text-[10px] text-[#666] uppercase tracking-wide">{k.label}</span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: k.color }}>
              {formatTallyAmount(k.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* Section summary sidebar */}
        <div className="border-r border-[#AAAAAA] bg-white" style={{ width: 220, minWidth: 220 }}>
          <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-2 py-1 text-[11px] font-bold uppercase text-[#1B5E20]">
            Section Summary
          </div>
          {sectionSummary.map(([sec, s]) => {
            const secDef = TDS_SECTIONS.find((t) => t.section === sec);
            const pending = s.tds - s.deposited;
            return (
              <button key={sec} type="button" onClick={() => setFilterSection(filterSection === sec ? '' : sec)}
                className="w-full border-b border-[#EEEEEE] px-2 py-[5px] text-left hover:bg-[#EEF2FF]"
                style={{ background: filterSection === sec ? '#E8F5E9' : undefined, borderRadius: 0 }}>
                <div className="text-[12px] font-semibold text-[#1B5E20]">{sec}</div>
                <div className="text-[10px] text-[#888] truncate">{secDef?.description ?? ''}</div>
                <div className="mt-1 flex justify-between text-[11px]">
                  <span className="text-[#333]">TDS: {formatTallyAmount(s.tds)}</span>
                  {pending > 0 ? <span className="text-[#E65100] font-semibold">⚠ {formatTallyAmount(pending)}</span> : <span className="text-[#1B5E20]">✓</span>}
                </div>
              </button>
            );
          })}
          <div className="p-2">
            <div className="border-b border-[#DDDDDD] pt-2 pb-1 text-[11px] font-bold uppercase text-[#1B5E20]">
              TDS Sections Guide
            </div>
            {TDS_SECTIONS.slice(0, 5).map((s) => (
              <div key={s.section} className="py-[3px] text-[10px] text-[#666]">
                <span className="font-semibold text-[#333]">{s.section}</span> — {s.rate}% · ₹{(s.threshold / 1000).toFixed(0)}K limit
              </div>
            ))}
          </div>
        </div>

        {/* Main table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                {['Date', 'Deductee', 'PAN', 'Section', 'Payment (₹)', 'Rate', 'TDS (₹)', 'Status', 'Challan', 'Actions'].map((h) => (
                  <th key={h} className="border border-[#2E7D32] px-2 py-1 text-[11px] text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-[#888]">
                    No TDS entries for FY {fy}. Click <strong>+ New</strong> to add.
                  </td>
                </tr>
              ) : filtered.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                  className="border-b border-[#EEEEEE] hover:bg-[#EEF2FF]">
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] tabular-nums">{fmtDate(e.paymentDate)}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] font-medium">{e.deducteeName}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] font-mono">{e.pan || '—'}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px]">
                    <span className="inline-block bg-[#E3F2FD] px-1 py-[1px] text-[10px] font-bold text-[#0D47A1]">{e.section}</span>
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px]">{formatTallyAmount(e.paymentAmt)}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-center text-[11px]">{e.tdsRate}%</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-right tabular-nums text-[12px] font-semibold text-[#1B5E20]">{formatTallyAmount(e.tdsAmt)}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                    <button type="button" onClick={() => toggleDeposited(e.id)}
                      className="text-[10px] font-bold px-2 py-[1px]"
                      style={{
                        background: e.deposited ? '#E8F5E9' : '#FFF3E0',
                        color: e.deposited ? '#1B5E20' : '#E65100',
                        border: `1px solid ${e.deposited ? '#2E7D32' : '#E65100'}`,
                        borderRadius: 0,
                      }}>
                      {e.deposited ? '✓ Deposited' : '⏳ Pending'}
                    </button>
                  </td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] font-mono">{e.challanNo || '—'}</td>
                  <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                    <button type="button" onClick={() => { setForm(e); setShowForm(true); }}
                      className="mr-1 text-[11px] text-[#0D47A1] underline">Edit</button>
                    <button type="button" onClick={() => deleteEntry(e.id)}
                      className="text-[11px] text-red-500 underline">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                <td colSpan={4} className="px-2 py-[4px] text-right text-[12px] font-semibold">TOTAL ({filtered.length})</td>
                <td className="px-2 py-[4px] text-right text-[12px] font-bold tabular-nums">{formatTallyAmount(totals.payment)}</td>
                <td />
                <td className="px-2 py-[4px] text-right text-[12px] font-bold tabular-nums text-[#1B5E20]">{formatTallyAmount(totals.tds)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · TDS Register FY {fy} · Alt+N New · Alt+E Excel · Alt+P PDF
      </div>

      {/* Add/Edit Form Modal */}
      {showForm ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg border-2 border-[#AAAAAA] bg-[#FFF8E7] shadow-xl" style={{ borderRadius: 0 }}>
            <div className="border-b border-[#AAAAAA] bg-[#1B5E20] px-4 py-2 text-[13px] font-semibold text-white">
              {entries.some((e) => e.id === form.id) ? 'Edit TDS Entry' : 'New TDS Entry'}
            </div>
            <div className="grid grid-cols-[150px_1fr] gap-y-2 gap-x-3 p-4 text-[12px]">
              {[
                { label: 'Payment Date *', key: 'paymentDate', type: 'date' },
                { label: 'Deductee Name *', key: 'deducteeName', type: 'text' },
                { label: 'PAN', key: 'pan', type: 'text' },
              ].map(({ label, key, type }) => (
                <>
                  <label key={`l-${key}`} className="flex items-center justify-end text-right font-semibold text-[#333]">{label}</label>
                  <input key={`i-${key}`} type={type} value={String(form[key as keyof TdsEntry] ?? '')}
                    onChange={(e) => set(key as keyof TdsEntry, e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
                    style={{ borderRadius: 0 }}
                    placeholder={key === 'pan' ? 'ABCDE1234F' : undefined}
                    maxLength={key === 'pan' ? 10 : undefined} />
                </>
              ))}

              <label className="flex items-center justify-end text-right font-semibold text-[#333]">Section *</label>
              <select value={form.section} onChange={(e) => set('section', e.target.value)}
                className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }}>
                {TDS_SECTIONS.map((s) => <option key={s.section} value={s.section}>{s.section} — {s.description} ({s.rate}%)</option>)}
              </select>

              <label className="flex items-center justify-end text-right font-semibold text-[#333]">Payment Amt (₹) *</label>
              <input type="number" min="0" step="0.01" value={form.paymentAmt || ''}
                onChange={(e) => set('paymentAmt', parseFloat(e.target.value) || 0)}
                className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }} />

              <label className="flex items-center justify-end text-right font-semibold text-[#333]">TDS Rate %</label>
              <input type="number" min="0" step="0.01" value={form.tdsRate}
                onChange={(e) => set('tdsRate', parseFloat(e.target.value) || 0)}
                className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] tabular-nums focus:border-[#1B5E20] focus:outline-none"
                style={{ borderRadius: 0 }} />

              <label className="flex items-center justify-end text-right font-bold text-[#1B5E20]">TDS Amount (₹)</label>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold tabular-nums text-[#1B5E20]">{formatTallyAmount(form.tdsAmt)}</span>
                <span className="text-[10px] text-[#888]">(auto-calculated)</span>
              </div>

              <label className="flex items-center justify-end text-right font-semibold text-[#333]">Deposited?</label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.deposited} onChange={(e) => set('deposited', e.target.checked)} />
                <span>Yes — TDS deposited to govt</span>
              </label>

              {form.deposited && (
                <>
                  <label className="flex items-center justify-end text-right font-semibold text-[#333]">Deposit Date</label>
                  <input type="date" value={form.depositDate} onChange={(e) => set('depositDate', e.target.value)}
                    className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
                  <label className="flex items-center justify-end text-right font-semibold text-[#333]">Challan No.</label>
                  <input type="text" value={form.challanNo} onChange={(e) => set('challanNo', e.target.value)}
                    placeholder="e.g. ITNS 281 / 0810XXXX"
                    className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
                </>
              )}

              <label className="flex items-center justify-end text-right font-semibold text-[#333]">Remarks</label>
              <input type="text" value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
                className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
            </div>
            <div className="flex gap-2 border-t border-[#AAAAAA] px-4 py-3">
              <button type="button" onClick={saveEntry}
                className="flex-1 border border-[#1B5E20] bg-[#1B5E20] py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32]"
                style={{ borderRadius: 0 }}>
                Save Entry
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-[#AAAAAA] bg-white py-1 text-[12px] text-[#333]"
                style={{ borderRadius: 0 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
