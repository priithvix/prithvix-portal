'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useGstPeriodContext } from '@/app/tally/gst/gst-period-context';
import { useGstr2b, useReconcileGstr2b, useUploadGstr2b } from '@/hooks/use-gst';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { TallyGstr2bUpload } from '@/components/tally/TallyGstr2bUpload';
import { parseGstr2bJson } from '@/lib/gst/gstr2b-parser';
import {
  acceptGstr2bTaxToPi,
  getGstr2bRecords,
  getPurchaseInvoiceForCompare,
  keepBooksGstr2bDifference,
  type Gstr2bRecordRow,
} from '@/lib/supabase/gst';
import { formatTallyAmount } from '@/lib/tally-format';

type FilterTab = 'MATCHED' | 'MISMATCH' | 'MISSING_IN_BOOKS';

export default function Gstr2bPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId;
  const { selectedPeriod, openPeriodSelector } = useGstPeriodContext();
  const setButtons = useTallySetButtons();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<FilterTab>('MATCHED');
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState<number | null>(null);
  const [panel, setPanel] = useState<Gstr2bRecordRow | null>(null);

  const allQuery = useQuery({
    queryKey: ['gstr2b', dealerRowId, selectedPeriod, 'all'],
    queryFn: () => (dealerRowId ? getGstr2bRecords(dealerRowId, selectedPeriod) : []),
    enabled: !!dealerRowId,
  });

  const filteredQuery = useGstr2b(dealerRowId, selectedPeriod, filter);
  const rows = filteredQuery.data ?? [];
  const all = allQuery.data ?? [];

  const summary = useMemo(() => {
    const sumTax = (list: Gstr2bRecordRow[]) => list.reduce((a, r) => a + Number(r.total_tax), 0);
    return {
      m: all.filter((r) => r.recon_status === 'MATCHED'),
      x: all.filter((r) => r.recon_status === 'MISMATCH'),
      miss: all.filter((r) => r.recon_status === 'MISSING_IN_BOOKS'),
      sumTax,
    };
  }, [all]);

  const uploadMut = useUploadGstr2b(dealerRowId, selectedPeriod);
  const reconMut = useReconcileGstr2b(dealerRowId, selectedPeriod);

  const onUpload = (text: string) => {
    try {
      const j = JSON.parse(text);
      const recs = parseGstr2bJson(j);
      uploadMut.mutate(recs, {
        onSuccess: (n) => {
          setUploadedAt(new Date().toLocaleString('en-IN'));
          setUploadCount(n);
          setStatus(`Loaded ${n} record(s).`);
          allQuery.refetch();
        },
        onError: (e: Error) => setStatus(e.message),
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR2B_REPORT_${selectedPeriod}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setButtons([
      { label: 'Period', shortcut: 'F2', onClick: openPeriodSelector },
      { label: 'Upload 2B', shortcut: 'Alt+U', onClick: () => {} },
      { label: 'Reconcile', shortcut: 'Alt+R', onClick: () => reconMut.mutate() },
      { label: 'Export', shortcut: 'Alt+E', onClick: onExport },
      { label: 'Configure', shortcut: 'F12' },
    ]);
    return () => setButtons([]);
  }, [setButtons, openPeriodSelector, reconMut, rows, selectedPeriod]);

  useHotkeys('alt+r', () => reconMut.mutate(), { enableOnFormTags: true }, [reconMut]);
  useHotkeys('alt+e', onExport, { enableOnFormTags: true }, [onExport]);

  return (
    <div className="flex min-h-0 gap-0 text-[13px] text-black">
      <div className="min-w-0 flex-1">
        <div
          className="flex flex-wrap items-center gap-2 border-b border-[#AAAAAA] px-2 py-1 text-white"
          style={{ background: '#1B5E20' }}
        >
          <span className="font-semibold">GSTR-2B Reconciliation</span>
          <span className="tabular-nums">Period: {selectedPeriod}</span>
          <span className="ml-auto text-[11px]">F2: Period</span>
        </div>
        {status ? <div className="bg-[#FFEB3B] px-2 py-1 text-[12px]">{status}</div> : null}

        <div className="m-3 border border-[#AAAAAA] bg-white p-3">
          <p className="mb-2 text-[12px] font-semibold">Step 1: Upload GSTR-2B JSON</p>
          <TallyGstr2bUpload onJsonLoaded={onUpload} disabled={uploadMut.isPending} />
          {uploadedAt ? (
            <p className="mt-2 text-[11px] text-[#555555]">
              Last uploaded: {uploadedAt}
              {uploadCount != null ? ` (${uploadCount} records)` : ''}
            </p>
          ) : null}

          <p className="mt-4 text-[12px] font-semibold">Step 2: Summary</p>
          <table className="mb-2 mt-1 w-full max-w-lg border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
            <thead>
              <tr style={{ background: '#F5F5F5' }}>
                <th className="border border-[#AAAAAA] px-2 py-1 text-left">Status</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-right">Count</th>
                <th className="border border-[#AAAAAA] px-2 py-1 text-right">Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#AAAAAA] px-2 py-1">● Matched</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{summary.m.length}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                  {formatTallyAmount(summary.sumTax(summary.m))}
                </td>
              </tr>
              <tr>
                <td className="border border-[#AAAAAA] px-2 py-1">⚠ Mismatch</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{summary.x.length}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                  {formatTallyAmount(summary.sumTax(summary.x))}
                </td>
              </tr>
              <tr>
                <td className="border border-[#AAAAAA] px-2 py-1">✗ Missing in Books</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">{summary.miss.length}</td>
                <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
                  {formatTallyAmount(summary.sumTax(summary.miss))}
                </td>
              </tr>
            </tbody>
          </table>
          <button
            type="button"
            className="border border-[#AAAAAA] bg-white px-3 py-1 hover:bg-[#FFEB3B]"
            onClick={() =>
              reconMut.mutate(undefined, {
                onSuccess: (r) =>
                  setStatus(
                    `Reconciled: matched ${r.matched}, mismatch ${r.mismatched}, missing ${r.missing_in_books}.`
                  ),
                onError: (e: Error) => setStatus(e.message),
              })
            }
            disabled={reconMut.isPending}
          >
            Auto-Reconcile
          </button>

          <p className="mt-4 text-[12px] font-semibold">Step 3: Review</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                ['MATCHED', 'Matched'],
                ['MISMATCH', `Mismatches ⚠${summary.x.length}`],
                ['MISSING_IN_BOOKS', `Missing ✗${summary.miss.length}`],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                className="border px-2 py-[2px] text-[12px]"
                style={{
                  borderColor: '#AAAAAA',
                  background: filter === k ? '#1B5E20' : '#FFF8E7',
                  color: filter === k ? '#FFFFFF' : '#000000',
                }}
                onClick={() => setFilter(k)}
              >
                {lab}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-[360px] overflow-auto">
            <table className="w-full border-collapse text-[12px]" style={{ border: '1px solid #AAAAAA' }}>
              <thead>
                <tr style={{ background: '#F5F5F5' }}>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">Supplier</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-left">Invoice</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">2B Tax</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">Books</th>
                  <th className="border border-[#AAAAAA] px-2 py-1 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Gstr2bRow
                    key={r.id}
                    r={r}
                    onOpen={() => setPanel(r)}
                    highlightDiff={r.recon_status === 'MISMATCH'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {panel ? (
        <Gstr2bPanel
          row={panel}
          onClose={() => setPanel(null)}
          onRefresh={() => {
            void qc.invalidateQueries({ queryKey: ['gstr2b'] });
            void qc.invalidateQueries({ queryKey: ['gstr3b', dealerRowId, selectedPeriod] });
            setPanel(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Gstr2bRow({
  r,
  onOpen,
  highlightDiff,
}: {
  r: Gstr2bRecordRow;
  onOpen: () => void;
  highlightDiff: boolean;
}) {
  const [books, setBooks] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    if (r.matched_pi_id) {
      getPurchaseInvoiceForCompare(r.matched_pi_id).then((pi) => {
        if (alive && pi) setBooks(Number(pi.tax_amount));
      });
    } else setBooks(null);
    return () => {
      alive = false;
    };
  }, [r.matched_pi_id]);

  const twob = Number(r.total_tax);
  const diff = books != null ? twob - books : null;

  return (
    <tr
      className="cursor-pointer hover:bg-[#0D47A1] hover:text-white"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      tabIndex={0}
      role="button"
    >
      <td className="border border-[#AAAAAA] px-2 py-1">{r.supplier_name ?? r.supplier_gstin}</td>
      <td className="border border-[#AAAAAA] px-2 py-1 font-mono text-[11px]">{r.invoice_number}</td>
      <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
        {formatTallyAmount(twob)}
      </td>
      <td className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums">
        {books != null ? formatTallyAmount(books) : '—'}
      </td>
      <td
        className="border border-[#AAAAAA] px-2 py-1 text-right tabular-nums"
        style={{ color: highlightDiff ? '#C62828' : undefined }}
      >
        {diff == null ? '—' : formatTallyAmount(diff)}
      </td>
    </tr>
  );
}

function Gstr2bPanel({
  row,
  onClose,
  onRefresh,
}: {
  row: Gstr2bRecordRow;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [pi, setPi] = useState<Awaited<ReturnType<typeof getPurchaseInvoiceForCompare>>>(null);

  useEffect(() => {
    if (row.matched_pi_id) getPurchaseInvoiceForCompare(row.matched_pi_id).then(setPi);
  }, [row.matched_pi_id]);

  const accept = async () => {
    if (!row.matched_pi_id || !pi) return;
    await acceptGstr2bTaxToPi(
      row.id,
      row.matched_pi_id,
      {
        igst: pi.igst_amount,
        cgst: pi.cgst_amount,
        sgst: pi.sgst_amount,
        tax_amount: pi.tax_amount,
      },
      { igst: row.igst, cgst: row.cgst, sgst: row.sgst, total_tax: row.total_tax }
    );
    onRefresh();
  };

  const keepBooks = async () => {
    await keepBooksGstr2bDifference(row.id);
    onRefresh();
  };

  return (
    <aside
      className="w-[280px] shrink-0 border-l border-[#AAAAAA] bg-[#F5F5F5] p-2 text-[12px]"
      style={{ boxShadow: 'none' }}
    >
      <div className="mb-2 flex justify-between font-semibold">
        <span>2B vs Books</span>
        <button type="button" className="border border-[#AAAAAA] px-1 text-[11px]" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="space-y-1 border border-[#AAAAAA] bg-white p-2">
        <div>Supplier: {row.supplier_name}</div>
        <div className="font-mono text-[11px]">GSTIN: {row.supplier_gstin}</div>
        <div>Inv: {row.invoice_number}</div>
        <div className="mt-2 font-semibold">Portal 2B</div>
        <div>Tax: ₹{formatTallyAmount(row.total_tax)}</div>
        <div className="mt-2 font-semibold">Books (PI)</div>
        {pi ? (
          <>
            <div>Tax: ₹{formatTallyAmount(pi.tax_amount)}</div>
            <div className="mt-2 flex flex-col gap-1">
              <button
                type="button"
                className="border border-[#AAAAAA] bg-white py-1 hover:bg-[#FFEB3B]"
                onClick={() => accept()}
              >
                Accept 2B Value
              </button>
              <button type="button" className="border border-[#AAAAAA] bg-white py-1" onClick={() => keepBooks()}>
                Keep Books Value
              </button>
            </div>
          </>
        ) : (
          <div className="text-[#666666]">No purchase invoice linked (missing in books).</div>
        )}
      </div>
    </aside>
  );
}
