'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useSalesRegisterQuery } from '@/hooks/useReportsQueries';
import { formatTallyAmount } from '@/lib/tally-format';
import { COMPANY_CONFIG_KEY, type PrithviXCompanyStoredConfig } from '@/lib/reports/tally-pdf-table';
import { fyDates, fmtDate, getFY } from '@/lib/reports/formatters';
import type { SalesRegisterRow } from '@/lib/supabase/reports';

const NIC_KEY = 'prithvix_nic_einvoice_creds';

type NicCreds = { clientId: string; secret: string; gstin: string };

function loadCreds(): NicCreds {
  if (typeof window === 'undefined') return { clientId: '', secret: '', gstin: '' };
  try {
    const raw = localStorage.getItem(NIC_KEY);
    if (!raw) return { clientId: '', secret: '', gstin: '' };
    return JSON.parse(raw) as NicCreds;
  } catch { return { clientId: '', secret: '', gstin: '' }; }
}

function defaultFYRange() {
  const fy = getFY(new Date());
  const { start, end } = fyDates(fy);
  const today = new Date();
  return {
    fromIso: start.toISOString().slice(0, 10),
    toIso: (today > end ? end : today).toISOString().slice(0, 10),
  };
}

/** Build IRN-like JSON payload (NIC format v1.03) — user uploads to NIC portal */
function buildIrnPayload(invoice: InvoiceRow, companyCfg: Partial<PrithviXCompanyStoredConfig>) {
  const taxableValue = Number(invoice.taxable_value ?? 0);
  const cgst = Number(invoice.cgst ?? 0);
  const sgst = Number(invoice.sgst ?? 0);
  const igst = Number(invoice.igst ?? 0);
  const totalValue = taxableValue + cgst + sgst + igst;

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: igst > 0 ? 'INTER' : 'INTRA',
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.invoice_number,
      Dt: invoice.invoice_date.split('-').reverse().join('/'), // DD/MM/YYYY
    },
    SellerDtls: {
      Gstin: companyCfg.gstin ?? '',
      LglNm: companyCfg.companyName ?? '',
      Addr1: companyCfg.addressLine1 ?? '',
      Addr2: companyCfg.addressLine2 ?? '',
      Loc: companyCfg.city ?? '',
      Pin: Number(companyCfg.pin ?? 0),
      Stcd: (companyCfg.gstin ?? '').slice(0, 2),
      Ph: companyCfg.phone ?? '',
      Em: companyCfg.email ?? '',
    },
    BuyerDtls: {
      Gstin: invoice.farmer_gstin ?? 'URP',
      LglNm: invoice.farmer_name ?? 'Unregistered',
      Pos: (invoice.farmer_gstin ?? '').slice(0, 2) || (companyCfg.gstin ?? '').slice(0, 2),
      Addr1: '',
      Loc: invoice.farmer_state ?? '',
      Stcd: (invoice.farmer_gstin ?? '').slice(0, 2),
    },
    ValDtls: {
      AssVal: taxableValue,
      CgstVal: cgst,
      SgstVal: sgst,
      IgstVal: igst,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: totalValue,
      TotInvValFc: 0,
    },
    EwbDtls: null,
  };
}

type InvoiceRow = SalesRegisterRow;

export default function EinvoicePage() {
  const setButtons = useTallySetButtons();

  const [creds, setCreds] = useState<NicCreds>({ clientId: '', secret: '', gstin: '' });
  const [credsSaved, setCredsSaved] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { fromIso, toIso } = useMemo(() => defaultFYRange(), []);
  const [from, setFrom] = useState(fromIso);
  const [to, setTo] = useState(toIso);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Load stored creds and company config after mount
  useEffect(() => {
    setCreds(loadCreds());
  }, []);

  const companyCfg = useMemo<Partial<PrithviXCompanyStoredConfig>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(COMPANY_CONFIG_KEY);
      return raw ? (JSON.parse(raw) as Partial<PrithviXCompanyStoredConfig>) : {};
    } catch { return {}; }
  }, []);

  const saveCreds = useCallback(() => {
    localStorage.setItem(NIC_KEY, JSON.stringify(creds));
    setCredsSaved(true);
    setConfigOpen(false);
    setTimeout(() => setCredsSaved(false), 2000);
  }, [creds]);

  // Fetch all sales invoices then filter for high value (≥ ₹50,000)
  const { data: allInvoices = [], isFetching } = useSalesRegisterQuery(from, to);
  const invoices = useMemo(
    () => allInvoices.filter((inv) => Number(inv.invoice_value) >= 50000),
    [allInvoices]
  );

  const downloadIrn = useCallback((inv: InvoiceRow) => {
    const payload = buildIrnPayload(inv, companyCfg);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `IRN_${inv.invoice_number.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [companyCfg]);

  const downloadBulk = useCallback(() => {
    const batch = invoices.filter((inv) => selected.has(inv.invoice_id)).map((inv) => buildIrnPayload(inv, companyCfg));
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `IRN_Batch_${from}_${to}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [invoices, selected, companyCfg, from, to]);

  const toggleAll = useCallback(() => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map((i) => i.invoice_id)));
  }, [invoices, selected]);

  useEffect(() => {
    setButtons([
      { label: 'Config', shortcut: 'C', onClick: () => setConfigOpen(true) },
      { label: 'Bulk JSON', shortcut: 'Alt+D', onClick: downloadBulk },
      { label: 'Back', shortcut: 'Esc' },
    ]);
    return () => setButtons([]);
  }, [setButtons, downloadBulk]);

  const hasGstin = Boolean(companyCfg.gstin);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]">
      <div className="border-b py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        E-Invoice (IRN) — JSON Generator
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] bg-[#F0ECD8] px-3 py-2 text-[12px]">
        <span>
          Mandatory for turnover &gt; ₹5 Cr.
          E-Invoice requires IRP registration.
        </span>
        {!hasGstin ? (
          <Link href="/tally/settings" className="text-[#B71C1C] underline font-semibold">
            ⚠ Set GSTIN in Settings first
          </Link>
        ) : (
          <span className="font-semibold text-[#1B5E20]">✓ GSTIN: {companyCfg.gstin}</span>
        )}
        <button
          type="button"
          className="ml-auto border border-[#AAAAAA] bg-white px-3 py-[2px] text-[12px]"
          onClick={() => setConfigOpen(true)}
          style={{ borderRadius: 0 }}
        >
          {creds.clientId ? '✓ NIC Creds Saved' : 'NIC API Config'}
        </button>
        {credsSaved ? <span className="text-[#1B5E20] font-semibold">Saved!</span> : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DDDDDD] bg-white px-2 py-2">
        <label className="flex items-center gap-1 text-[12px]">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <label className="flex items-center gap-1 text-[12px]">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <span className="text-[11px] text-[#666]">{invoices.length} eligible invoices (≥ ₹50,000)</span>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={downloadBulk}
            className="ml-auto border border-[#1B5E20] bg-[#1B5E20] px-3 py-[2px] text-[12px] text-white"
            style={{ borderRadius: 0 }}
          >
            ↓ Download {selected.size} IRN JSON(s)
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">
                <input type="checkbox" checked={selected.size === invoices.length && invoices.length > 0} onChange={toggleAll} />
              </th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Invoice #</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Date</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Buyer</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">GSTIN</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Taxable</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Tax</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Total</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">IRN JSON</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={9} className="p-3 text-center text-[#888]">Loading…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={9} className="p-3 text-center text-[#888]">No invoices ≥ ₹50,000 in this period</td></tr>
            ) : (
              invoices.map((inv, i) => {
                const tax = Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst);
                return (
                  <tr key={inv.invoice_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }}
                    className="border-b border-[#EEEEEE]">
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <input type="checkbox" checked={selected.has(inv.invoice_id)}
                        onChange={() => {
                          const s = new Set(selected);
                          if (s.has(inv.invoice_id)) s.delete(inv.invoice_id); else s.add(inv.invoice_id);
                          setSelected(s);
                        }} />
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] font-medium">{inv.invoice_number}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{fmtDate(inv.invoice_date)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{inv.farmer_name ?? 'Unknown'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#555]">{inv.farmer_gstin ?? 'URP'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] tabular-nums">{formatTallyAmount(inv.taxable_value)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] tabular-nums">{formatTallyAmount(tax)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] font-semibold tabular-nums">{formatTallyAmount(inv.invoice_value)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <button
                        type="button"
                        onClick={() => downloadIrn(inv)}
                        className="border border-[#1B5E20] px-2 py-[1px] text-[11px] text-[#1B5E20] hover:bg-[#1B5E20] hover:text-white"
                        style={{ borderRadius: 0 }}
                      >
                        ↓ JSON
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="px-3 pb-2 text-[10px] text-[#888]">
        Downloads NIC-format IRN JSON (v1.1). Upload to{' '}
        <a href="https://einvoice1.gst.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#0D47A1] underline">
          einvoice1.gst.gov.in
        </a>{' '}
        → Bulk Upload to generate actual IRN. NIC API integration (live calls) planned for future phase.
      </p>

      {/* NIC Config Modal */}
      {configOpen ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md border border-[#AAAAAA] bg-[#FFF8E7] shadow-lg" style={{ borderRadius: 0 }}>
            <div className="flex items-center justify-between border-b border-[#0D3D0F] px-3 py-2 text-white" style={{ background: '#1B5E20' }}>
              <h2 className="text-[13px] font-semibold">NIC E-Invoice API Configuration</h2>
              <button type="button" className="text-[12px] text-white underline" onClick={() => setConfigOpen(false)}>Esc</button>
            </div>
            <div className="p-3 text-[13px]">
              <p className="mb-2 text-[11px] text-[#666]">
                Stored locally in browser. Get credentials from einvoice1.gst.gov.in → API Access.
              </p>
              <label className="mt-2 block text-[11px] font-medium text-[#444]">Client ID</label>
              <input className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.clientId} onChange={(e) => setCreds({ ...creds, clientId: e.target.value })} />
              <label className="mt-2 block text-[11px] font-medium text-[#444]">Client Secret</label>
              <input type="password" className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.secret} onChange={(e) => setCreds({ ...creds, secret: e.target.value })} />
              <label className="mt-2 block text-[11px] font-medium text-[#444]">GSTIN</label>
              <input className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.gstin}
                onChange={(e) => setCreds({ ...creds, gstin: e.target.value.toUpperCase() })} />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={saveCreds}
                  className="border border-[#1B5E20] bg-[#1B5E20] px-4 py-1.5 text-[13px] text-white" style={{ borderRadius: 0 }}>
                  Save
                </button>
                <button type="button" onClick={() => setConfigOpen(false)}
                  className="border border-[#AAAAAA] bg-white px-4 py-1.5 text-[13px]" style={{ borderRadius: 0 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
