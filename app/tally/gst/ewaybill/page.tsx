'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTallySetButtons } from '@/components/tally/TallyButtonBarContext';
import { useSalesRegisterQuery, usePurchaseRegisterQuery } from '@/hooks/useReportsQueries';
import { formatTallyAmount } from '@/lib/tally-format';
import { COMPANY_CONFIG_KEY, type PrithviXCompanyStoredConfig } from '@/lib/reports/tally-pdf-table';
import { fyDates, fmtDate, getFY } from '@/lib/reports/formatters';
import type { SalesRegisterRow, PurchaseRegisterRow } from '@/lib/supabase/reports';

const EWB_KEY = 'prithvix_nic_ewaybill_creds';
const EWB_THRESHOLD = 50000; // ₹50,000

type EwbCreds = { username: string; password: string; gstin: string };

function loadCreds(): EwbCreds {
  if (typeof window === 'undefined') return { username: '', password: '', gstin: '' };
  try {
    const raw = localStorage.getItem(EWB_KEY);
    return raw ? (JSON.parse(raw) as EwbCreds) : { username: '', password: '', gstin: '' };
  } catch { return { username: '', password: '', gstin: '' }; }
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

type InvoiceRow = SalesRegisterRow;
type PurchaseRow = PurchaseRegisterRow;

/** Build EWB JSON payload (NIC EWB API format) */
function buildEwbPayload(
  docType: 'sales' | 'purchase',
  row: InvoiceRow | PurchaseRow,
  companyCfg: Partial<PrithviXCompanyStoredConfig>
) {
  if (docType === 'sales') {
    const inv = row as InvoiceRow;
    const taxableValue = Number(inv.taxable_value ?? 0);
    const igst = Number(inv.igst ?? 0);
    const cgst = Number(inv.cgst ?? 0);
    const sgst = Number(inv.sgst ?? 0);
    const totalValue = Number(inv.invoice_value ?? 0);

    return {
      supplyType: igst > 0 ? 'O' : 'I',
      subSupplyType: '1',
      docType: 'INV',
      docNo: inv.invoice_number,
      docDate: inv.invoice_date.split('-').reverse().join('/'),
      fromGstin: companyCfg.gstin ?? '',
      fromTrdName: companyCfg.companyName ?? '',
      fromAddr1: companyCfg.addressLine1 ?? '',
      fromAddr2: companyCfg.addressLine2 ?? '',
      fromPlace: companyCfg.city ?? '',
      fromPincode: Number(companyCfg.pin ?? 0),
      fromStateCode: Number((companyCfg.gstin ?? '').slice(0, 2) || 0),
      toGstin: inv.farmer_gstin || 'URP',
      toTrdName: inv.farmer_name ?? 'Unregistered',
      toAddr1: '',
      toPlace: inv.farmer_state ?? '',
      toPincode: 0,
      toStateCode: Number((inv.farmer_gstin ?? '').slice(0, 2) || 0),
      totalValue,
      cgstValue: cgst,
      sgstValue: sgst,
      igstValue: igst,
      cessValue: 0,
      transporterName: '',
      transporterId: '',
      transDocNo: '',
      transMode: '1',
      transDistance: '',
      vehicleNo: '',
      vehicleType: 'R',
      itemList: [
        {
          itemNo: 1,
          productName: 'Agricultural Inputs',
          productDesc: 'Agricultural Inputs',
          hsnCode: '3101',
          quantity: 1,
          qtyUnit: 'PCS',
          cgstRate: cgst > 0 ? (cgst / taxableValue) * 100 : 0,
          sgstRate: sgst > 0 ? (sgst / taxableValue) * 100 : 0,
          igstRate: igst > 0 ? (igst / taxableValue) * 100 : 0,
          cessRate: 0,
          taxableAmount: taxableValue,
        },
      ],
    };
  } else {
    const pur = row as PurchaseRow;
    return {
      supplyType: 'I',
      subSupplyType: '1',
      docType: 'INV',
      docNo: pur.pi_number,
      docDate: pur.invoice_date.split('-').reverse().join('/'),
      fromGstin: pur.supplier_gstin ?? 'URP',
      fromTrdName: pur.supplier_name ?? 'Supplier',
      fromAddr1: '',
      fromPlace: '',
      fromPincode: 0,
      fromStateCode: Number((pur.supplier_gstin ?? '').slice(0, 2) || 0),
      toGstin: companyCfg.gstin ?? '',
      toTrdName: companyCfg.companyName ?? '',
      toAddr1: companyCfg.addressLine1 ?? '',
      toPlace: companyCfg.city ?? '',
      toPincode: Number(companyCfg.pin ?? 0),
      toStateCode: Number((companyCfg.gstin ?? '').slice(0, 2) || 0),
      totalValue: Number(pur.invoice_value ?? 0),
      cgstValue: 0,
      sgstValue: 0,
      igstValue: Number(pur.total_tax ?? 0),
      cessValue: 0,
      transporterName: '',
      vehicleNo: '',
      transMode: '1',
      vehicleType: 'R',
      itemList: [
        {
          itemNo: 1,
          productName: 'Agricultural Inputs',
          hsnCode: '3101',
          quantity: 1,
          qtyUnit: 'PCS',
          taxableAmount: Number(pur.taxable_value ?? 0),
        },
      ],
    };
  }
}

type TabKey = 'sales' | 'purchase';

export default function EwaybillPage() {
  const setButtons = useTallySetButtons();

  const [tab, setTab] = useState<TabKey>('sales');
  const [creds, setCreds] = useState<EwbCreds>({ username: '', password: '', gstin: '' });
  const [configOpen, setConfigOpen] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { fromIso, toIso } = useMemo(() => defaultFYRange(), []);
  const [from, setFrom] = useState(fromIso);
  const [to, setTo] = useState(toIso);

  useEffect(() => { setCreds(loadCreds()); }, []);

  const companyCfg = useMemo<Partial<PrithviXCompanyStoredConfig>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(COMPANY_CONFIG_KEY);
      return raw ? (JSON.parse(raw) as Partial<PrithviXCompanyStoredConfig>) : {};
    } catch { return {}; }
  }, []);

  const saveCreds = useCallback(() => {
    localStorage.setItem(EWB_KEY, JSON.stringify(creds));
    setCredsSaved(true);
    setConfigOpen(false);
    setTimeout(() => setCredsSaved(false), 2000);
  }, [creds]);

  const { data: allSales = [], isFetching: salesLoad } = useSalesRegisterQuery(from, to);
  const { data: allPurchases = [], isFetching: purLoad } = usePurchaseRegisterQuery(from, to);

  const salesRows = useMemo(
    () => allSales.filter((r) => Number(r.invoice_value) >= EWB_THRESHOLD),
    [allSales]
  );
  const purRows = useMemo(
    () => allPurchases.filter((r) => Number(r.invoice_value) >= EWB_THRESHOLD),
    [allPurchases]
  );

  const rows = tab === 'sales' ? (salesRows as (InvoiceRow | PurchaseRow)[]) : (purRows as (InvoiceRow | PurchaseRow)[]);
  const isFetching = tab === 'sales' ? salesLoad : purLoad;

  const downloadSingle = useCallback((row: InvoiceRow | PurchaseRow) => {
    const id = tab === 'sales' ? (row as InvoiceRow).invoice_id : (row as PurchaseRow).pi_id;
    const num = tab === 'sales' ? (row as InvoiceRow).invoice_number : (row as PurchaseRow).pi_number;
    const payload = buildEwbPayload(tab, row, companyCfg);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EWB_${num.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [tab, companyCfg]);

  const downloadBulk = useCallback(() => {
    const batch = rows
      .filter((r) => {
        const id = tab === 'sales' ? (r as InvoiceRow).invoice_id : (r as PurchaseRow).pi_id;
        return selected.has(id);
      })
      .map((r) => buildEwbPayload(tab, r, companyCfg));
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EWB_Batch_${from}_${to}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rows, selected, tab, companyCfg, from, to]);

  const getId = (r: InvoiceRow | PurchaseRow) =>
    tab === 'sales' ? (r as InvoiceRow).invoice_id : (r as PurchaseRow).pi_id;

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(getId)));
  };

  useEffect(() => {
    setButtons([
      { label: 'Config', shortcut: 'C', onClick: () => setConfigOpen(true) },
      { label: 'Bulk JSON', shortcut: 'Alt+D', onClick: downloadBulk },
      { label: 'Back', shortcut: 'Esc' },
    ]);
    return () => setButtons([]);
  }, [setButtons, downloadBulk]);

  return (
    <div className="flex min-h-0 flex-col bg-[#FFF8E7] text-[13px]">
      <div className="border-b py-[5px] text-center font-semibold text-white" style={{ background: '#1B5E20', borderBottom: '1px solid #0D3D0F' }}>
        E-Way Bill — JSON Generator
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-[#AAAAAA] bg-[#F0ECD8] px-3 py-2 text-[12px]">
        <span>Mandatory for consignment value &gt; ₹50,000.</span>
        {!companyCfg.gstin ? (
          <Link href="/tally/settings" className="text-[#B71C1C] underline font-semibold">⚠ Set GSTIN in Settings</Link>
        ) : (
          <span className="font-semibold text-[#1B5E20]">✓ GSTIN: {companyCfg.gstin}</span>
        )}
        <button type="button" onClick={() => setConfigOpen(true)}
          className="ml-auto border border-[#AAAAAA] bg-white px-3 py-[2px] text-[12px]" style={{ borderRadius: 0 }}>
          {creds.username ? '✓ NIC Creds Saved' : 'NIC API Config'}
        </button>
        {credsSaved ? <span className="text-[#1B5E20] font-semibold">Saved!</span> : null}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DDDDDD] bg-white px-2 py-2">
        {(['sales', 'purchase'] as TabKey[]).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setSelected(new Set()); }}
            className="px-3 py-1 text-[12px]"
            style={{ background: tab === t ? '#1B5E20' : '#EEE', color: tab === t ? '#FFF' : '#000', borderRadius: 0, border: '1px solid #AAAAAA' }}>
            {t === 'sales' ? 'Sales Invoices' : 'Purchase Invoices'}
          </button>
        ))}
        <label className="flex items-center gap-1 text-[12px]">
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <label className="flex items-center gap-1 text-[12px]">
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-[#AAAAAA] bg-white px-1 py-[2px] text-[12px]" style={{ borderRadius: 0 }} />
        </label>
        <span className="text-[11px] text-[#666]">{rows.length} eligible (≥ ₹50,000)</span>
        {selected.size > 0 ? (
          <button type="button" onClick={downloadBulk}
            className="ml-auto border border-[#1B5E20] bg-[#1B5E20] px-3 py-[2px] text-[12px] text-white" style={{ borderRadius: 0 }}>
            ↓ Download {selected.size} EWB JSON(s)
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto m-2 border border-[#AAAAAA] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: '#1B5E20', color: '#FFF' }}>
              <th className="border border-[#2E7D32] px-2 py-1 text-center">
                <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
              </th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Invoice #</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">Date</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">{tab === 'sales' ? 'Buyer' : 'Supplier'}</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-left text-[11px]">GSTIN</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Taxable</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-right text-[11px]">Total</th>
              <th className="border border-[#2E7D32] px-2 py-1 text-center text-[11px]">EWB JSON</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={8} className="p-3 text-center text-[#888]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-3 text-center text-[#888]">No invoices ≥ ₹50,000 in this period</td></tr>
            ) : (
              rows.map((r, i) => {
                const id = getId(r);
                const num = tab === 'sales' ? (r as InvoiceRow).invoice_number : (r as PurchaseRow).pi_number;
                const date = tab === 'sales' ? (r as InvoiceRow).invoice_date : (r as PurchaseRow).invoice_date;
                const party = tab === 'sales' ? (r as InvoiceRow).farmer_name : (r as PurchaseRow).supplier_name;
                const gstin = tab === 'sales' ? (r as InvoiceRow).farmer_gstin : (r as PurchaseRow).supplier_gstin;
                const taxable = tab === 'sales' ? (r as InvoiceRow).taxable_value : (r as PurchaseRow).taxable_value;
                const total = tab === 'sales' ? (r as InvoiceRow).invoice_value : (r as PurchaseRow).invoice_value;
                return (
                  <tr key={id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F9FFF9' }} className="border-b border-[#EEEEEE]">
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <input type="checkbox" checked={selected.has(id)}
                        onChange={() => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); }} />
                    </td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px] font-medium">{num}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{fmtDate(date)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[12px]">{party ?? '—'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-[11px] text-[#555]">{gstin ?? 'URP'}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] tabular-nums">{formatTallyAmount(taxable)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-right text-[12px] font-semibold tabular-nums">{formatTallyAmount(total)}</td>
                    <td className="border border-[#EEEEEE] px-2 py-[3px] text-center">
                      <button type="button" onClick={() => downloadSingle(r)}
                        className="border border-[#1B5E20] px-2 py-[1px] text-[11px] text-[#1B5E20] hover:bg-[#1B5E20] hover:text-white" style={{ borderRadius: 0 }}>
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
        Downloads NIC EWB-format JSON. Upload to{' '}
        <a href="https://ewaybillgst.gov.in" target="_blank" rel="noopener noreferrer" className="text-[#0D47A1] underline">
          ewaybillgst.gov.in
        </a>{' '}
        → Bulk Generate. Fill transporter &amp; vehicle details before submission. Live NIC API calls planned for future phase.
      </p>

      {/* Config Modal */}
      {configOpen ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md border border-[#AAAAAA] bg-[#FFF8E7] shadow-lg" style={{ borderRadius: 0 }}>
            <div className="flex items-center justify-between border-b border-[#0D3D0F] px-3 py-2 text-white" style={{ background: '#1B5E20' }}>
              <h2 className="text-[13px] font-semibold">NIC E-Way Bill API Configuration</h2>
              <button type="button" className="text-[12px] text-white underline" onClick={() => setConfigOpen(false)}>Esc</button>
            </div>
            <div className="p-3 text-[13px]">
              <p className="mb-2 text-[11px] text-[#666]">Credentials from ewaybillgst.gov.in → API Registration</p>
              <label className="mt-2 block text-[11px] font-medium text-[#444]">API Username</label>
              <input className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} />
              <label className="mt-2 block text-[11px] font-medium text-[#444]">API Password</label>
              <input type="password" className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} />
              <label className="mt-2 block text-[11px] font-medium text-[#444]">GSTIN</label>
              <input className="border border-[#AAAAAA] bg-white px-1 py-[3px] w-full" style={{ borderRadius: 0 }}
                value={creds.gstin} onChange={(e) => setCreds({ ...creds, gstin: e.target.value.toUpperCase() })} />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={saveCreds}
                  className="border border-[#1B5E20] bg-[#1B5E20] px-4 py-1.5 text-[13px] text-white" style={{ borderRadius: 0 }}>Save</button>
                <button type="button" onClick={() => setConfigOpen(false)}
                  className="border border-[#AAAAAA] bg-white px-4 py-1.5 text-[13px]" style={{ borderRadius: 0 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
