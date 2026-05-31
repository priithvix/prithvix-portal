'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { supabase } from '@/lib/supabase/client';
import { formatTallyAmount } from '@/lib/tally-format';
import { fmtDate } from '@/lib/reports/formatters';
import { tallyTablePdfBlob, triggerDownload, getCompanyConfig } from '@/lib/reports/tally-pdf-table';
import { playTallyAccept, playTallyError } from '@/lib/tally-sounds';

/* ─── Types ─────────────────────────────────────────────────────── */
type VoucherHeader = {
  id: string;
  voucher_number: string | null;
  voucher_type: string | null;
  voucher_date: string;
  narration: string | null;
  total_amount: number;
  status: string | null;
  created_at: string | null;
};

type VoucherLine = {
  id: string;
  ledger_id: string;
  ledger_name: string;
  dr_amount: number;
  cr_amount: number;
  narration: string | null;
  gst_rate: number | null;
};

const TYPE_COLOR: Record<string, { bg: string; fg: string }> = {
  SAL: { bg: '#E8F5E9', fg: '#1B5E20' },
  PUR: { bg: '#E3F2FD', fg: '#0D47A1' },
  RCT: { bg: '#F3E5F5', fg: '#6A1B9A' },
  PMT: { bg: '#FFF3E0', fg: '#E65100' },
  JNL: { bg: '#F1F8E9', fg: '#558B2F' },
  CNT: { bg: '#E0F7FA', fg: '#006064' },
  CRN: { bg: '#FCE4EC', fg: '#880E4F' },
  DBN: { bg: '#FBE9E7', fg: '#BF360C' },
};

const TYPE_FULL: Record<string, string> = {
  SAL: 'Sales', PUR: 'Purchase', RCT: 'Receipt', PMT: 'Payment',
  JNL: 'Journal', CNT: 'Contra', CRN: 'Credit Note', DBN: 'Debit Note', STJ: 'Stock Journal',
};

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, dealer } = useAuth();
  const setButtons = useTallySetButtons();

  const [header, setHeader] = useState<VoucherHeader | null>(null);
  const [lines, setLines] = useState<VoucherLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  /* ── Fetch voucher + lines ── */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      supabase.from('vouchers').select('*').eq('id', id).single(),
      supabase
        .from('voucher_lines')
        .select('id, ledger_id, dr_amount, cr_amount, narration, gst_rate, ledgers(name)')
        .eq('voucher_id', id)
        .order('dr_amount', { ascending: false }),
    ]).then(([{ data: vh, error: e1 }, { data: vl, error: e2 }]) => {
      setLoading(false);
      if (e1) { setError(e1.message); return; }
      setHeader(vh as VoucherHeader);
      setLines(
        (vl ?? []).map((r: Record<string, unknown>) => {
          const led = r.ledgers as { name?: string } | null;
          return {
            id: String(r.id ?? ''),
            ledger_id: String(r.ledger_id ?? ''),
            ledger_name: led?.name ?? String(r.ledger_id ?? ''),
            dr_amount: Number(r.dr_amount ?? 0),
            cr_amount: Number(r.cr_amount ?? 0),
            narration: r.narration != null ? String(r.narration) : null,
            gst_rate: r.gst_rate != null ? Number(r.gst_rate) : null,
          };
        })
      );
      if (e2) console.warn('Lines fetch error:', e2.message);
    });
  }, [id]);

  /* ── PDF ── */
  const exportPdf = useCallback(async () => {
    if (!header) return;
    const cfg = getCompanyConfig();
    const blob = await tallyTablePdfBlob({
      title: `${TYPE_FULL[header.voucher_type ?? ''] ?? header.voucher_type ?? 'Voucher'} — ${header.voucher_number ?? id}`,
      subtitle: `Date: ${fmtDate(header.voucher_date)} · Status: ${header.status ?? '—'}`,
      reportPeriod: fmtDate(header.voucher_date),
      companyName: cfg.companyName,
      gstin: cfg.gstin,
      address: cfg.address,
      headers: ['Ledger', 'Dr (₹)', 'Cr (₹)', 'GST %', 'Line Narration'],
      rows: [
        ...lines.map((l) => [
          l.ledger_name,
          l.dr_amount > 0 ? formatTallyAmount(l.dr_amount) : '—',
          l.cr_amount > 0 ? formatTallyAmount(l.cr_amount) : '—',
          l.gst_rate ? `${l.gst_rate}%` : '—',
          l.narration ?? '',
        ]),
        ['', '', '', '', ''],
        ['TOTAL', formatTallyAmount(lines.reduce((s, l) => s + l.dr_amount, 0)), formatTallyAmount(lines.reduce((s, l) => s + l.cr_amount, 0)), '', header.narration ?? ''],
      ],
      footerNote: `Voucher: ${header.voucher_number ?? id} · ${dealer?.company_name ?? ''}`,
    });
    triggerDownload(blob, `Voucher_${header.voucher_number ?? id}.pdf`);
  }, [header, lines, id, dealer?.company_name]);

  /* ── Delete/Reverse ── */
  const handleDelete = useCallback(async () => {
    if (!header) return;
    setDeleting(true);
    const { error: e } = await supabase
      .from('vouchers')
      .update({ status: 'CANCELLED' })
      .eq('id', header.id);
    setDeleting(false);
    setDeleteConfirm(false);
    if (e) { playTallyError(); setError(e.message); return; }
    playTallyAccept();
    setHeader((h) => h ? { ...h, status: 'CANCELLED' } : h);
  }, [header]);

  useHotkeys('alt+p', (e) => { e.preventDefault(); void exportPdf(); });
  useHotkeys('escape', () => router.push('/tally/vouchers'));

  useEffect(() => {
    setButtons([
      { label: 'Print PDF', shortcut: 'Alt+P', onClick: () => void exportPdf() },
      { label: 'Edit', shortcut: 'Alt+E', onClick: () => router.push(`/tally/voucher/new?edit=${id}`) },
      { label: 'Back', shortcut: 'Esc', onClick: () => router.push('/tally/vouchers') },
    ]);
    return () => setButtons([]);
  }, [setButtons, exportPdf, router, id]);

  const tc = TYPE_COLOR[header?.voucher_type ?? ''] ?? { bg: '#F5F5F5', fg: '#333' };

  if (loading) return <div className="bg-[#FFF8E7] p-6 text-[13px] text-[#888]">Loading voucher…</div>;
  if (error) return <div className="bg-[#FFF8E7] p-6 text-[13px] text-red-700">Error: {error}</div>;
  if (!header) return <div className="bg-[#FFF8E7] p-6 text-[13px] text-[#888]">Voucher not found.</div>;

  const totalDr = lines.reduce((s, l) => s + l.dr_amount, 0);
  const totalCr = lines.reduce((s, l) => s + l.cr_amount, 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]" style={{ fontFeatureSettings: "'tnum' 1" }}>
      {/* Title */}
      <div className="flex items-center justify-between px-4 py-[5px] font-semibold text-white"
        style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        <span>Voucher Detail</span>
        <span className="text-[11px] opacity-80">{header.voucher_number ?? id}</span>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b border-[#DDDDDD] bg-white px-3 py-1 text-[11px] text-[#666]">
        <Link href="/tally" className="text-[#0D47A1] underline">Gateway</Link>
        <span>›</span>
        <Link href="/tally/vouchers" className="text-[#0D47A1] underline">Vouchers</Link>
        <span>›</span>
        <span className="font-semibold text-[#333]">{header.voucher_number ?? id}</span>
        <span className="ml-auto text-[#888]">Alt+P Print · Esc Back</span>
      </div>

      <div className="m-3 space-y-3">
        {/* Voucher header card */}
        <div className="border border-[#AAAAAA] bg-white">
          <div className="border-b border-[#DDDDDD] px-4 py-2 flex items-center gap-4"
            style={{ background: tc.bg }}>
            <span className="text-[14px] font-bold" style={{ color: tc.fg }}>
              {TYPE_FULL[header.voucher_type ?? ''] ?? header.voucher_type}
            </span>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: tc.fg }}>
              {header.voucher_number ?? '—'}
            </span>
            {header.status === 'CANCELLED' ? (
              <span className="ml-2 border border-red-400 bg-red-50 px-2 py-[1px] text-[10px] font-bold text-red-600">CANCELLED</span>
            ) : (
              <span className="ml-2 border border-[#2E7D32] bg-[#E8F5E9] px-2 py-[1px] text-[10px] font-bold text-[#1B5E20]">POSTED</span>
            )}
            <span className="ml-auto text-[12px] font-bold tabular-nums text-[#333]">
              {formatTallyAmount(header.total_amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 px-4 py-3 text-[12px]">
            <div className="flex gap-2">
              <span className="w-28 text-[#888] shrink-0">Date</span>
              <span className="font-semibold">{fmtDate(header.voucher_date)}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 text-[#888] shrink-0">Voucher #</span>
              <span className="font-semibold tabular-nums">{header.voucher_number ?? '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 text-[#888] shrink-0">Type</span>
              <span className="font-semibold">{TYPE_FULL[header.voucher_type ?? ''] ?? header.voucher_type}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 text-[#888] shrink-0">Amount</span>
              <span className="font-bold tabular-nums text-[#1B5E20]">{formatTallyAmount(header.total_amount)}</span>
            </div>
            {header.narration ? (
              <div className="col-span-2 flex gap-2">
                <span className="w-28 text-[#888] shrink-0">Narration</span>
                <span className="text-[#333]">{header.narration}</span>
              </div>
            ) : null}
            <div className="flex gap-2">
              <span className="w-28 text-[#888] shrink-0">Status</span>
              <span className={`font-semibold ${header.status === 'CANCELLED' ? 'text-red-600' : 'text-[#1B5E20]'}`}>
                {header.status ?? 'POSTED'}
              </span>
            </div>
            {header.created_at ? (
              <div className="flex gap-2">
                <span className="w-28 text-[#888] shrink-0">Created</span>
                <span className="text-[#666] tabular-nums">{new Date(header.created_at).toLocaleString('en-IN')}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Ledger entries */}
        <div className="border border-[#AAAAAA] bg-white">
          <div className="border-b border-[#DDDDDD] bg-[#F0F4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
            Ledger Entries ({lines.length} lines)
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: '#1B5E20', color: '#FFF' }}>
                <th className="border border-[#2E7D32] px-3 py-1 text-left text-[11px]">Ledger Account</th>
                <th className="border border-[#2E7D32] px-3 py-1 text-right text-[11px]" style={{ width: 140 }}>Dr (₹)</th>
                <th className="border border-[#2E7D32] px-3 py-1 text-right text-[11px]" style={{ width: 140 }}>Cr (₹)</th>
                <th className="border border-[#2E7D32] px-3 py-1 text-center text-[11px]" style={{ width: 70 }}>GST %</th>
                <th className="border border-[#2E7D32] px-3 py-1 text-left text-[11px]">Line Narration</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-[#888]">
                    No line items found (voucher may predate PrithviX)
                  </td>
                </tr>
              ) : (
                lines.map((l, i) => (
                  <tr key={l.id}
                    style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                    className="border-b border-[#EEEEEE]">
                    <td className="border border-[#EEEEEE] px-3 py-[4px] text-[12px] font-medium">
                      <Link href={`/tally/reports/ledger?id=${l.ledger_id}`}
                        className="text-[#0D47A1] hover:underline">
                        {l.ledger_name}
                      </Link>
                    </td>
                    <td className="border border-[#EEEEEE] px-3 py-[4px] text-right text-[12px] tabular-nums font-semibold text-[#0D47A1]">
                      {l.dr_amount > 0 ? formatTallyAmount(l.dr_amount) : <span className="text-[#CCC]">—</span>}
                    </td>
                    <td className="border border-[#EEEEEE] px-3 py-[4px] text-right text-[12px] tabular-nums font-semibold text-[#1B5E20]">
                      {l.cr_amount > 0 ? formatTallyAmount(l.cr_amount) : <span className="text-[#CCC]">—</span>}
                    </td>
                    <td className="border border-[#EEEEEE] px-3 py-[4px] text-center text-[11px]">
                      {l.gst_rate ? (
                        <span className="inline-block bg-[#E8F5E9] px-1.5 py-[1px] text-[10px] font-bold text-[#1B5E20]">{l.gst_rate}%</span>
                      ) : <span className="text-[#CCC]">—</span>}
                    </td>
                    <td className="border border-[#EEEEEE] px-3 py-[4px] text-[11px] text-[#666]">
                      {l.narration ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F0F0F0', borderTop: '2px solid #1B5E20' }}>
                <td className="px-3 py-[5px] text-[12px] font-bold">TOTAL</td>
                <td className="px-3 py-[5px] text-right text-[13px] font-bold tabular-nums text-[#0D47A1]">
                  {formatTallyAmount(totalDr)}
                </td>
                <td className="px-3 py-[5px] text-right text-[13px] font-bold tabular-nums text-[#1B5E20]">
                  {formatTallyAmount(totalCr)}
                </td>
                <td />
                <td className="px-3 py-[5px] text-[11px]">
                  {isBalanced
                    ? <span className="text-[#1B5E20] font-semibold">✓ Balanced</span>
                    : <span className="text-red-600 font-semibold">⚠ Diff: {formatTallyAmount(Math.abs(totalDr - totalCr))}</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void exportPdf()}
            className="border border-[#1B5E20] bg-[#1B5E20] px-5 py-1 text-[12px] font-semibold text-white hover:bg-[#2E7D32]"
            style={{ borderRadius: 0 }}>
            Print / PDF (Alt+P)
          </button>
          {header.status !== 'CANCELLED' ? (
            <button type="button" onClick={() => setDeleteConfirm(true)}
              className="border border-[#C62828] px-4 py-1 text-[12px] text-[#C62828] hover:bg-[#FFEBEE]"
              style={{ borderRadius: 0 }}>
              Cancel Voucher
            </button>
          ) : null}
          <Link href="/tally/vouchers"
            className="border border-[#AAAAAA] px-4 py-1 text-[12px] text-[#333] hover:bg-[#F5F5F5]"
            style={{ borderRadius: 0 }}>
            ← Back to Vouchers
          </Link>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40">
          <div className="w-80 border-2 border-[#AAAAAA] bg-[#FFF8E7] shadow-lg" style={{ borderRadius: 0 }}>
            <div className="border-b border-[#AAAAAA] bg-[#B71C1C] px-4 py-2 text-[13px] font-semibold text-white">
              Cancel Voucher?
            </div>
            <div className="p-4 text-[12px] text-[#333]">
              This will mark voucher <strong>{header.voucher_number}</strong> as CANCELLED.
              The accounting entries will no longer affect ledger balances.
            </div>
            <div className="flex gap-2 border-t border-[#AAAAAA] px-4 py-3">
              <button type="button" onClick={() => void handleDelete()} disabled={deleting}
                className="flex-1 border border-[#B71C1C] bg-[#B71C1C] py-1 text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ borderRadius: 0 }}>
                {deleting ? 'Cancelling…' : 'Yes — Cancel It'}
              </button>
              <button type="button" onClick={() => setDeleteConfirm(false)}
                className="flex-1 border border-[#AAAAAA] bg-white py-1 text-[12px] text-[#333]"
                style={{ borderRadius: 0 }}>
                No — Keep It
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-3 pb-2 text-[11px] text-[#888]">
        {dealer?.company_name} · Voucher {header.voucher_number} · Alt+P Print · Esc Back
      </div>
    </div>
  );
}
