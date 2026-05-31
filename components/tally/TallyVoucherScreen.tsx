'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLedgerPickListQuery } from '@/hooks/useReportsQueries';
import { supabase } from '@/lib/supabase/client';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';
import { formatTallyAmount } from '@/lib/tally-format';

/* ─── Constants ─────────────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  SAL: 'Sales',
  PUR: 'Purchase',
  RCT: 'Receipt',
  PMT: 'Payment',
  CNT: 'Contra',
  JNL: 'Journal',
  CRN: 'Credit Note',
  DBN: 'Debit Note',
  STJ: 'Stock Journal',
};

const GST_RATES = [0, 5, 12, 18, 28];

/* ─── Types ──────────────────────────────────────────────────────── */
type VoucherLine = {
  id: string;
  ledgerId: string;
  ledgerName: string;
  drAmount: string;
  crAmount: string;
  narration: string;
  gstRate: number; // 0-28
};

const emptyLine = (): VoucherLine => ({
  id: Math.random().toString(36).slice(2),
  ledgerId: '',
  ledgerName: '',
  drAmount: '',
  crAmount: '',
  narration: '',
  gstRate: 0,
});

/* ─── Ledger Typeahead ───────────────────────────────────────────── */
function LedgerTypeahead({
  value,
  onSelect,
  placeholder,
  autoFocus,
}: {
  value: string;
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { data: ledgers = [] } = useLedgerPickListQuery();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ledgers.slice(0, 12);
    return ledgers.filter((l) => l.name.toLowerCase().includes(q) || l.group_label.toLowerCase().includes(q)).slice(0, 12);
  }, [ledgers, query]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Ledger name…'}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
        style={{ borderRadius: 0 }}
      />
      {open && matches.length > 0 ? (
        <div className="absolute left-0 top-full z-50 w-64 border border-[#AAAAAA] bg-white shadow-md">
          {matches.map((l) => (
            <button
              key={l.id}
              type="button"
              onMouseDown={() => { onSelect(l.id, l.name); setQuery(l.name); setOpen(false); }}
              className="flex w-full flex-col px-2 py-[3px] text-left hover:bg-[#E8F5E9]"
            >
              <span className="text-[12px]">{l.name}</span>
              <span className="text-[10px] text-[#888]">{l.group_label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function TallyVoucherScreen({ voucherType }: { voucherType: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [voucherDate, setVoucherDate] = useState(today);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<VoucherLine[]>([emptyLine(), emptyLine()]);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [showGst, setShowGst] = useState(false);

  const label = TYPE_LABELS[voucherType] ?? voucherType;

  /* Totals */
  const totalDr = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.drAmount) || 0), 0), [lines]);
  const totalCr = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.crAmount) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  /* ── Line helpers ── */
  const updateLine = (idx: number, patch: Partial<VoucherLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (idx: number) =>
    setLines((prev) => prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev);

  /* ── Validation ── */
  const validate = useCallback((): string | null => {
    if (!voucherDate) return 'Voucher date is required.';
    const hasLines = lines.some((l) => l.ledgerId && (parseFloat(l.drAmount) > 0 || parseFloat(l.crAmount) > 0));
    if (!hasLines) return 'At least one ledger line with an amount is required.';
    if (!isBalanced) return `Voucher is out of balance by ${formatTallyAmount(Math.abs(totalDr - totalCr))}. Dr must equal Cr.`;
    return null;
  }, [voucherDate, lines, isBalanced, totalDr, totalCr]);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    const err = validate();
    if (err) { setFormError(err); playTallyError(); return; }
    setFormError('');
    setAcceptOpen(true);
  }, [validate]);

  const confirmPost = useCallback(async () => {
    const id = session?.dealerRowId;
    if (!id) return;
    setSaving(true);

    // Generate voucher number: TYPE/YYYYMMDD/random4
    const seq = Math.floor(1000 + Math.random() * 9000);
    const dateTag = voucherDate.replace(/-/g, '');
    const voucherNumber = `${voucherType}/${dateTag}/${seq}`;

    const activeLines = lines.filter((l) => l.ledgerId && (parseFloat(l.drAmount) > 0 || parseFloat(l.crAmount) > 0));
    const total = totalDr; // Dr = Cr when balanced

    const { data: v, error: e1 } = await supabase
      .from('vouchers')
      .insert({
        dealer_id: id,
        voucher_type: voucherType,
        voucher_date: voucherDate,
        voucher_number: voucherNumber,
        narration: narration.trim() || null,
        total_amount: total,
        status: 'POSTED',
      })
      .select('id')
      .single();

    if (e1 || !v) {
      setSaving(false);
      setAcceptOpen(false);
      setFormError(e1?.message ?? 'Failed to post voucher.');
      playTallyError();
      return;
    }

    const lineRows = activeLines.map((l) => ({
      voucher_id: v.id,
      ledger_id: l.ledgerId,
      dr_amount: parseFloat(l.drAmount) || 0,
      cr_amount: parseFloat(l.crAmount) || 0,
      narration: l.narration.trim() || null,
      gst_rate: l.gstRate > 0 ? l.gstRate : null,
    }));

    const { error: e2 } = await supabase.from('voucher_lines').insert(lineRows);

    if (e2) {
      // Try to clean up orphaned voucher header
      await supabase.from('vouchers').delete().eq('id', v.id);
      setSaving(false);
      setAcceptOpen(false);
      setFormError(e2.message);
      playTallyError();
      return;
    }

    setSaving(false);
    setAcceptOpen(false);
    playTallyAccept();

    // Invalidate day-book and trial balance caches
    await qc.invalidateQueries({ queryKey: ['day-book'] });
    await qc.invalidateQueries({ queryKey: ['trial-balance'] });

    setSavedMsg(`${label} voucher ${voucherNumber} posted successfully.`);
    // Reset form
    setLines([emptyLine(), emptyLine()]);
    setNarration('');
    setTimeout(() => setSavedMsg(''), 5000);
  }, [session?.dealerRowId, voucherType, voucherDate, narration, lines, totalDr, label, qc]);

  /* ── Keyboard shortcuts ── */
  useHotkeys('ctrl+a', (e) => { e.preventDefault(); void handleSave(); }, { enableOnFormTags: true });
  useHotkeys('alt+i', (e) => { e.preventDefault(); addLine(); });
  useHotkeys('escape', () => { if (acceptOpen) { setAcceptOpen(false); } else { router.push('/tally/vouchers'); } }, { enableOnFormTags: true });
  useHotkeys('f2', (e) => { e.preventDefault(); document.getElementById('voucher-date')?.focus(); });

  useEffect(() => {
    setButtons([
      { label: 'Date', shortcut: 'F2', onClick: () => document.getElementById('voucher-date')?.focus() },
      { label: 'Add Line', shortcut: 'Alt+I', onClick: addLine },
      { label: 'GST View', shortcut: 'Alt+J', onClick: () => setShowGst((p) => !p) },
      { label: 'Save', shortcut: 'Ctrl+A', onClick: () => void handleSave() },
      { label: 'Vouchers', shortcut: 'Esc', onClick: () => router.push('/tally/vouchers') },
    ]);
    return () => setButtons([]);
  }, [setButtons, handleSave, router]);

  /* ── GST breakdown ── */
  const gstBreakdown = useMemo(() => {
    const map: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
    for (const l of lines) {
      if (l.gstRate > 0) {
        const amt = parseFloat(l.drAmount || l.crAmount) || 0;
        if (!map[l.gstRate]) map[l.gstRate] = { taxable: 0, cgst: 0, sgst: 0 };
        const taxable = amt / (1 + l.gstRate / 100);
        map[l.gstRate].taxable += taxable;
        map[l.gstRate].cgst += (taxable * l.gstRate) / 200;
        map[l.gstRate].sgst += (taxable * l.gstRate) / 200;
      }
    }
    return Object.entries(map);
  }, [lines]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-[5px] font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        <span>Voucher Entry — {label}</span>
        <span className="text-[11px] tabular-nums opacity-80">
          {voucherDate} · {voucherType}
        </span>
      </div>

      {/* Success / error banners */}
      {savedMsg ? (
        <div className="mx-2 mt-2 border border-[#2E7D32] bg-[#E8F5E9] px-3 py-2 text-[12px] text-[#1B5E20]">
          ✓ {savedMsg}
        </div>
      ) : null}
      {formError ? (
        <div className="mx-2 mt-2 border border-[#C62828] bg-[#FFEBEE] px-3 py-2 text-[12px] text-[#B71C1C]">
          ⚠ {formError}
        </div>
      ) : null}

      {/* Header row: date + narration */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#DDDDDD] bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[#333]">
          Date
          <input
            id="voucher-date"
            type="date"
            value={voucherDate}
            onChange={(e) => setVoucherDate(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex flex-1 items-center gap-2 text-[12px] font-semibold text-[#333]">
          Narration
          <input
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Optional narration for this voucher"
            className="flex-1 border border-[#AAAAAA] bg-white px-2 py-[2px] text-[12px] focus:border-[#1B5E20] focus:outline-none"
            style={{ borderRadius: 0 }}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={showGst} onChange={(e) => setShowGst(e.target.checked)} />
          Show GST
        </label>
      </div>

      {/* Ledger lines grid */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        <table className="w-full border-collapse">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]" style={{ width: 32 }}>#</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Ledger</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]" style={{ width: 130 }}>Dr (₹)</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]" style={{ width: 130 }}>Cr (₹)</th>
              {showGst ? <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]" style={{ width: 80 }}>GST %</th> : null}
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Line Narration</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]" style={{ width: 36 }}>✕</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id}
                style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                className="border-b border-[#EEEEEE]">
                <td className="border border-[#EEEEEE] px-2 py-[3px] text-center text-[11px] text-[#888]">
                  {idx + 1}
                </td>
                <td className="border border-[#EEEEEE] px-1 py-[2px]" style={{ minWidth: 200 }}>
                  <LedgerTypeahead
                    value={line.ledgerName}
                    onSelect={(id, name) => updateLine(idx, { ledgerId: id, ledgerName: name })}
                    placeholder="Select ledger…"
                    autoFocus={idx === 0}
                  />
                </td>
                <td className="border border-[#EEEEEE] px-1 py-[2px]">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.drAmount}
                    onChange={(e) => updateLine(idx, { drAmount: e.target.value, crAmount: e.target.value ? '' : line.crAmount })}
                    placeholder="0.00"
                    className="w-full border-0 bg-transparent px-1 py-0 text-right text-[12px] tabular-nums focus:outline-none"
                    style={{ minWidth: 110 }}
                  />
                </td>
                <td className="border border-[#EEEEEE] px-1 py-[2px]">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.crAmount}
                    onChange={(e) => updateLine(idx, { crAmount: e.target.value, drAmount: e.target.value ? '' : line.drAmount })}
                    placeholder="0.00"
                    className="w-full border-0 bg-transparent px-1 py-0 text-right text-[12px] tabular-nums focus:outline-none"
                    style={{ minWidth: 110 }}
                  />
                </td>
                {showGst ? (
                  <td className="border border-[#EEEEEE] px-1 py-[2px] text-center">
                    <select
                      value={line.gstRate}
                      onChange={(e) => updateLine(idx, { gstRate: Number(e.target.value) })}
                      className="border-0 bg-transparent text-[11px] focus:outline-none"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>{r === 0 ? 'Nil' : `${r}%`}</option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td className="border border-[#EEEEEE] px-1 py-[2px]">
                  <input
                    type="text"
                    value={line.narration}
                    onChange={(e) => updateLine(idx, { narration: e.target.value })}
                    placeholder="Optional…"
                    className="w-full border-0 bg-transparent px-1 py-0 text-[11px] focus:outline-none"
                  />
                </td>
                <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-[#888] hover:text-red-600 text-[12px]"
                    title="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Totals */}
            <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
              <td colSpan={2} className="px-2 py-1 text-right text-[12px] font-semibold text-[#333]">
                TOTAL
              </td>
              <td className="px-2 py-1 text-right text-[12px] font-bold tabular-nums">
                {formatTallyAmount(totalDr)}
              </td>
              <td className="px-2 py-1 text-right text-[12px] font-bold tabular-nums">
                {formatTallyAmount(totalCr)}
              </td>
              {showGst ? <td /> : null}
              <td colSpan={2} className="px-2 py-1 text-[11px]">
                {isBalanced
                  ? <span className="text-[#1B5E20] font-semibold">✓ Balanced</span>
                  : <span className="text-red-600 font-semibold">⚠ Diff: {formatTallyAmount(Math.abs(totalDr - totalCr))}</span>
                }
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* GST breakdown panel */}
      {showGst && gstBreakdown.length > 0 ? (
        <div className="mx-2 mb-2 border border-[#AAAAAA] bg-white">
          <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-2 py-1 text-[11px] font-bold text-[#1B5E20]">
            GST Tax Analysis
          </div>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr style={{ background: '#E8F5E9' }}>
                <th className="border border-[#DDDDDD] px-2 py-1 text-left text-[11px]">Rate</th>
                <th className="border border-[#DDDDDD] px-2 py-1 text-right text-[11px]">Taxable (₹)</th>
                <th className="border border-[#DDDDDD] px-2 py-1 text-right text-[11px]">CGST (₹)</th>
                <th className="border border-[#DDDDDD] px-2 py-1 text-right text-[11px]">SGST (₹)</th>
                <th className="border border-[#DDDDDD] px-2 py-1 text-right text-[11px]">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              {gstBreakdown.map(([rate, { taxable, cgst, sgst }]) => (
                <tr key={rate} className="border-b border-[#EEEEEE]">
                  <td className="px-2 py-[3px] font-semibold">{rate}%</td>
                  <td className="px-2 py-[3px] text-right tabular-nums">{formatTallyAmount(taxable)}</td>
                  <td className="px-2 py-[3px] text-right tabular-nums">{formatTallyAmount(cgst)}</td>
                  <td className="px-2 py-[3px] text-right tabular-nums">{formatTallyAmount(sgst)}</td>
                  <td className="px-2 py-[3px] text-right tabular-nums font-semibold">{formatTallyAmount(cgst + sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Action bar */}
      <div className="flex items-center gap-3 border-t border-[#DDDDDD] bg-white px-3 py-2">
        <button
          type="button"
          onClick={addLine}
          className="border border-[#0D47A1] px-3 py-1 text-[12px] text-[#0D47A1] hover:bg-[#E3F2FD]"
          style={{ borderRadius: 0 }}
        >
          + Add Line (Alt+I)
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="border border-[#1B5E20] bg-[#1B5E20] px-5 py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
          style={{ borderRadius: 0 }}
        >
          Accept (Ctrl+A)
        </button>
        <button
          type="button"
          onClick={() => router.push('/tally/vouchers')}
          className="border border-[#AAAAAA] bg-white px-4 py-1 text-[12px] text-[#333] hover:bg-[#F5F5F5]"
          style={{ borderRadius: 0 }}
        >
          Cancel (Esc)
        </button>
        <div className="ml-auto text-[11px] text-[#888]">
          F2 Date · Alt+I Add Line · Alt+J GST · Ctrl+A Save · Esc Cancel
        </div>
      </div>

      {/* Accept confirmation modal */}
      {acceptOpen ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tally-accept-title"
        >
          <div className="w-full max-w-sm border-2 border-[#AAAAAA] bg-[#FFF8E7] p-0 shadow-lg"
            style={{ borderRadius: 0 }}>
            {/* Modal header */}
            <div className="border-b border-[#AAAAAA] bg-[#1B5E20] px-4 py-2 text-[13px] font-semibold text-white">
              Accept Voucher?
            </div>
            {/* Summary */}
            <div className="space-y-2 p-4 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#666]">Type</span>
                <span className="font-semibold">{label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Date</span>
                <span className="font-semibold tabular-nums">{voucherDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Amount</span>
                <span className="font-bold tabular-nums text-[#1B5E20]">{formatTallyAmount(totalDr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Lines</span>
                <span>{lines.filter((l) => l.ledgerId).length}</span>
              </div>
              {narration ? (
                <div className="flex justify-between">
                  <span className="text-[#666]">Narration</span>
                  <span className="text-right max-w-[200px] text-[#333]">{narration.slice(0, 60)}</span>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 border-t border-[#AAAAAA] px-4 py-3">
              <button
                type="button"
                disabled={saving}
                className="flex-1 border border-[#1B5E20] bg-[#1B5E20] py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
                style={{ borderRadius: 0 }}
                onClick={() => void confirmPost()}
              >
                {saving ? 'Posting…' : 'Yes — Post'}
              </button>
              <button
                type="button"
                disabled={saving}
                className="flex-1 border border-[#AAAAAA] bg-white py-1 text-[12px] text-[#333] hover:bg-[#F5F5F5] disabled:opacity-50"
                style={{ borderRadius: 0 }}
                onClick={() => setAcceptOpen(false)}
              >
                No — Edit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
