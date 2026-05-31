'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Dealer } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useInventory } from '@/contexts/InventoryContext';
import { downloadCSV } from '@/lib/export';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Farmer, InventoryItem, ItemCategory, Sale, SaleItem } from '@/constants/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Leaf,
  Printer,
  Shield,
  Sprout,
  Bug,
} from 'lucide-react';
import {
  differenceInDays,
  endOfMonth,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { toast } from 'sonner';

type ActiveTab = 'overview' | 'form-n' | 'form-xii' | 'form-xiv' | 'seed-reg';

const PRINT_CSS = `:root{--ink:#1c1917;--ink-2:#44403c;--ink-3:#78716c;--ink-4:#a8a29e;--rule:#e7e5e4;--rule-strong:#d6d3d1;--bg-form:#fff;--bg-col-head:#292524;--accent:#16a34a;--accent-2:#15803d;--accent-pale:#f0fdf4;--warn:#b45309;--warn-pale:#fffbeb;--danger:#dc2626;--danger-pale:#fef2f2;--info:#1d4ed8;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--serif:Georgia,"Times New Roman",serif;--sans:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:var(--sans);background:#fafaf9;color:var(--ink);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}.form-paper{background:var(--bg-form);border:1px solid var(--rule-strong);border-radius:2px;overflow:hidden;margin-bottom:12px}.form-hdr{background:var(--bg-col-head);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:14px 24px}.form-hdr-left .gov{font-size:11px;color:#a8a29e;font-family:var(--mono);letter-spacing:.5px}.form-hdr-left .title{font-size:14px;font-weight:600;color:#f5f5f4;margin-top:2px}.form-hdr-right{text-align:right}.form-hdr-right .form-no{font-family:var(--serif);font-size:22px;color:#fff}.form-hdr-right .form-no-sub{font-family:var(--mono);font-size:9px;color:#78716c;text-transform:uppercase;letter-spacing:1px}.dealer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--rule);background:#fafaf9}.dealer-cell{padding:12px 20px;border-right:1px solid var(--rule)}.dealer-cell:last-child{border-right:none}.dealer-cell .lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--ink-4);margin-bottom:3px}.dealer-cell .val{font-size:13px;font-weight:600;color:var(--ink)}.dealer-cell .val.mono{font-family:var(--mono);font-size:11px}.dealer-cell .val.green{color:var(--accent-2)}.dealer-cell .val.red{color:var(--danger)}.period-bar{background:var(--accent-pale);border-bottom:1px solid #bbf7d0;padding:8px 20px;display:flex;align-items:center;gap:24px;font-size:12px;flex-wrap:wrap}.pb-item{display:flex;align-items:center;gap:8px}.pb-label{font-weight:600;color:var(--accent-2);font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.5px}.pb-val{background:#fff;border:1px solid #86efac;border-radius:3px;padding:2px 10px;font-family:var(--mono);font-size:11px;color:var(--ink)}.pb-auto{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--accent-2)}.tbl-wrap{overflow-x:auto}table.reg{width:100%;border-collapse:collapse;font-size:12px}table.reg thead tr{background:var(--bg-col-head)}table.reg thead th{padding:9px 12px;text-align:center;font-weight:500;font-size:11px;color:#e7e5e4;border-right:1px solid rgba(255,255,255,.08);letter-spacing:.2px;white-space:nowrap;line-height:1.3}table.reg thead th .col-no{display:block;font-family:var(--mono);font-size:8px;color:rgba(255,255,255,.3);margin-top:3px}table.reg thead th .required{display:inline-block;width:5px;height:5px;background:var(--danger);border-radius:50%;vertical-align:middle;margin-left:3px}table.reg tbody tr{border-bottom:1px solid var(--rule)}table.reg tbody tr.alt{background:#fbfbfa}table.reg tbody tr.total{background:var(--accent-pale)!important;font-weight:600;border-top:2px solid var(--accent)}table.reg tbody tr.danger-row{background:#fff8f8!important}table.reg td{padding:9px 12px;border-right:1px solid var(--rule);vertical-align:top}table.reg td:last-child{border-right:none}.tc{text-align:center}.tr{text-align:right}.mono12{font-family:var(--mono);font-size:11px}.dp{font-weight:600;font-size:12px;color:var(--ink)}.ds{font-family:var(--mono);font-size:10px;color:var(--ink-4);margin-top:1px}.nv{font-family:var(--mono);font-weight:500;font-size:13px}.nu{font-family:var(--mono);font-size:9px;color:var(--ink-4);display:block;margin-top:1px}.num-green{color:var(--accent-2)}.num-amber{color:var(--warn)}.num-red{color:var(--danger)}.pill{display:inline-block;padding:1px 6px;border-radius:2px;font-family:var(--mono);font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.3px}.pill-green{background:#dcfce7;color:#15803d}.pill-amber{background:#fef3c7;color:#92400e}.pill-red{background:#fee2e2;color:#b91c1c}.pill-blue{background:#dbeafe;color:#1d4ed8}.pill-grey{background:#f5f5f4;color:#78716c}.sr{font-family:var(--mono);font-size:10px;color:var(--ink-4);text-align:center}.form-footer{border-top:1px solid var(--rule-strong);background:#fafaf9;display:grid;grid-template-columns:1fr auto 1fr;gap:0}.sig{padding:16px 24px;border-right:1px solid var(--rule)}.sig:last-child{border-right:none}.sig .sig-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--ink-4);margin-bottom:2px}.sig .sig-name{font-size:12px;font-weight:600;color:var(--ink-2)}.sig-line{border-bottom:1px solid var(--rule-strong);height:32px;margin-top:6px}.sig-date{font-family:var(--mono);font-size:9px;color:var(--ink-4);margin-top:4px}.stamp-area{width:72px;height:72px;border:1.5px dashed #dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;color:#dc2626;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.5px;opacity:.35;margin:auto;padding:8px}.sig-center{display:flex;align-items:center;justify-content:center;padding:16px;border-right:1px solid var(--rule)}.germ-valid{color:var(--accent-2);font-family:var(--mono);font-size:11px;font-weight:500}.germ-warn{color:var(--warn);font-family:var(--mono);font-size:11px;font-weight:500}.germ-exp{color:var(--danger);font-family:var(--mono);font-size:11px;font-weight:500;text-decoration:line-through}@media print{body{background:#fff}.pb-auto{color:var(--accent-2)}}`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openPrintWindow(html: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Pop-up blocked — allow pop-ups to print.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function wrapPrintDoc(title: string, bodyInner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyInner}</body></html>`;
}

function parseMonthYearLoose(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const mmyyyy = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (mmyyyy) {
    const mm = Number(mmyyyy[1]);
    const yyyy = Number(mmyyyy[2]);
    if (mm >= 1 && mm <= 12)
      return endOfMonth(new Date(yyyy, mm - 1, 1));
  }
  const iso = parseISO(t);
  return isValid(iso) ? iso : null;
}

type ExpiryGermStatus = 'valid' | 'expiring' | 'expired' | 'unknown';

function getExpiryStatus(expiryRaw?: string, now = new Date()): ExpiryGermStatus {
  const d = parseMonthYearLoose(expiryRaw);
  if (!d) return 'unknown';
  const days = differenceInDays(d, now);
  if (days < 0) return 'expired';
  if (days <= 60) return 'expiring';
  return 'valid';
}

function getGermStatus(germRaw?: string, now = new Date()): ExpiryGermStatus {
  return getExpiryStatus(germRaw, now);
}

function isExpiringSoon(
  raw: string | undefined,
  daysThreshold: number,
  now = new Date()
): boolean {
  const d = parseMonthYearLoose(raw);
  if (!d) return false;
  const days = differenceInDays(d, now);
  return days >= 0 && days <= daysThreshold;
}

function parseLicenseExpiry(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const iso = parseISO(raw.slice(0, 10));
  return isValid(iso) ? iso : null;
}

function licenseDayStatus(validUntil?: string, now = new Date()): ExpiryGermStatus {
  const d = parseLicenseExpiry(validUntil);
  if (!d) return 'unknown';
  const days = differenceInDays(d, now);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

function dealerAddressLine(d: Dealer): string {
  const parts = [d.address, d.village, d.district, d.state].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function farmerAddress(f: Farmer, stateFallback?: string): string {
  const tail = stateFallback ? `, ${stateFallback}` : '';
  const mid = [f.village && `Vill. ${f.village}`, f.taluka && `Teh. ${f.taluka}`, `Distt. ${f.district || '—'}`]
    .filter(Boolean)
    .join(', ');
  return `${mid}${tail}`;
}

function lineTaxable(line: SaleItem): number {
  if (Number.isFinite(line.lineTotalExGst)) return line.lineTotalExGst;
  return Math.max(0, (line.priceExGst ?? 0) * (line.quantity ?? 0));
}

function lineGst(line: SaleItem): number {
  if (Number.isFinite(line.lineGstAmount)) return line.lineGstAmount;
  const tx = lineTaxable(line);
  const pct = line.gstPercent ?? 0;
  return (tx * pct) / 100;
}

function lineIncGst(line: SaleItem): number {
  if (Number.isFinite(line.lineTotalIncGst)) return line.lineTotalIncGst;
  return lineTaxable(line) + lineGst(line);
}

function salesInSelectedMonth(sales: Sale[], ym: string): Sale[] {
  const ref = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
  if (!isValid(ref)) return [];
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  return sales.filter((s) => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  });
}

function qtySoldByItemId(monthSales: Sale[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const sale of monthSales) {
    for (const line of sale.items) {
      const id = line.itemId;
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + line.quantity);
    }
  }
  return m;
}

function displayUnits(item: InventoryItem): number {
  const upb = item.unitsPerBase || 1;
  return Math.max(0, Math.ceil(item.stock / upb));
}

function invById(items: InventoryItem[]): Map<string, InventoryItem> {
  return new Map(items.map((i) => [i.id, i]));
}

function categoryOfLine(line: SaleItem, inv: Map<string, InventoryItem>): ItemCategory | undefined {
  const row = line.itemId ? inv.get(line.itemId) : undefined;
  return row?.category;
}

function complianceScoreFrom(
  dealer: Dealer,
  activeItems: InventoryItem[]
): { score: number; expiredInventory: boolean } {
  let score = 0;
  const slots = [
    { no: dealer.fertilizer_license_number, until: dealer.fertilizer_license_valid_until },
    { no: dealer.pesticide_license_number, until: dealer.pesticide_license_valid_until },
    { no: dealer.seed_license_number, until: dealer.seed_license_valid_until },
  ];
  for (const s of slots) {
    const st = licenseDayStatus(s.until);
    if (s.no?.trim() && (st === 'valid' || st === 'expiring')) score += 25;
  }
  let expiredInventory = false;
  for (const i of activeItems) {
    if (getExpiryStatus(i.expiryDate) === 'expired') {
      expiredInventory = true;
      break;
    }
    if (i.category === 'seeds' && getGermStatus(i.germinationValidUpto) === 'expired') {
      expiredInventory = true;
      break;
    }
  }
  if (!expiredInventory) score += 25;
  return { score: Math.min(100, score), expiredInventory };
}

function scoreTierLabel(score: number): { label: string; cn: string } {
  if (score >= 90) return { label: 'Excellent', cn: 'text-primary' };
  if (score >= 70) return { label: 'Good', cn: 'text-amber-600 dark:text-amber-400' };
  if (score >= 50) return { label: 'Fair', cn: 'text-muted-foreground' };
  return { label: 'At risk', cn: 'text-destructive' };
}

function germCertNoFromMetadata(it: InventoryItem): string {
  const m = it.metadata;
  if (m && typeof m.germination_cert_no === 'string' && m.germination_cert_no.trim())
    return escapeHtml(m.germination_cert_no.trim());
  if (m && typeof m.germinationCertNo === 'string' && m.germinationCertNo.trim())
    return escapeHtml(m.germinationCertNo.trim());
  return '—';
}

function formatGermPrintLabel(raw?: string): string {
  const d = parseMonthYearLoose(raw);
  if (!d) return raw?.trim() ? escapeHtml(raw.trim()) : '—';
  return escapeHtml(format(d, 'dd-MM-yyyy'));
}

function generateFormNHtml(
  dealer: Dealer,
  items: InventoryItem[],
  monthSales: Sale[],
  ym: string
): string {
  const ref = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = isValid(ref) ? format(ref, 'MMMM yyyy') : ym;
  const yearLabel = isValid(ref) ? format(ref, 'yyyy') : ym.slice(0, 4);
  const soldMap = qtySoldByItemId(monthSales);
  const fert = items.filter((i) => i.category === 'fertilizer');

  const licUntil = dealer.fertilizer_license_valid_until
    ? format(parseISO(dealer.fertilizer_license_valid_until.slice(0, 10)), 'dd-MM-yyyy')
    : '—';
  const fertLicSt = licenseDayStatus(dealer.fertilizer_license_valid_until);
  const fertLicStyle =
    fertLicSt === 'expired' ? 'color:var(--danger)' : fertLicSt === 'expiring' ? 'color:var(--warn)' : 'color:var(--accent-2)';

  let rows = '';
  let totalSold = 0;
  let totalRec = 0;
  let totalDam = 0;

  fert.forEach((it, idx) => {
    const closing = displayUnits(it);
    const sold = soldMap.get(it.id) ?? 0;
    const opening = closing + sold;
    totalSold += sold;
    const alt = idx % 2 === 1 ? ' class="alt"' : '';
    const pill =
      it.unit === 'bag'
        ? 'pill-blue'
        : it.unit === 'packet'
          ? 'pill-amber'
          : 'pill-green';
    rows += `<tr${alt}>
<td class="sr">${idx + 1}</td>
<td class="tc mono12">${format(endOfMonth(ref), 'dd/MM/yyyy')}</td>
<td><div class="dp">${escapeHtml(it.productName)}</div><div class="ds">${escapeHtml(it.displayLabel)}</div><div style="margin-top:3px"><span class="pill ${pill}">${escapeHtml(it.displayLabel)}</span></div></td>
<td class="tc"><div class="nv">${opening}</div><span class="nu">${escapeHtml(it.unit)}s</span></td>
<td style="color:var(--ink-4);font-size:11px">— No receipt (see remarks)</td>
<td style="color:var(--ink-4);font-size:10px;text-align:center">N/A</td>
<td class="tc"><div class="nv">${opening}</div><span class="nu">${escapeHtml(it.unit)}s</span></td>
<td class="tc"><div class="nv">${sold}</div><span class="nu">${escapeHtml(it.unit)}s</span></td>
<td class="tc" style="color:var(--ink-4)">—</td>
<td class="tc"><div class="nv num-green">${closing}</div><span class="nu">${escapeHtml(it.unit)}s</span></td>
<td style="font-size:11px;color:var(--ink-3)">Snapshot: opening = closing + sales (month)</td>
</tr>`;
  });

  if (!rows) {
    rows = `<tr><td colspan="11" class="tc" style="padding:24px;color:var(--ink-3)">No fertilizer SKUs in active inventory.</td></tr>`;
  } else {
    rows += `<tr class="total">
<td colspan="3" style="text-align:right;font-size:12px;padding-right:16px;color:var(--accent-2)">Monthly Total (${escapeHtml(monthLabel)}) →</td>
<td class="tc" style="color:var(--ink-3)">—</td>
<td class="tc"><div class="nv">${totalRec}</div><span class="nu">Receipts</span></td>
<td></td><td></td>
<td class="tc"><div class="nv">${totalSold}</div><span class="nu">Sold</span></td>
<td class="tc">${totalDam ? `<div class="nv num-red">${totalDam}</div>` : '—'}</td>
<td></td><td></td>
</tr>`;
  }

  const body = `<div class="form-paper">
<div class="form-hdr"><div class="form-hdr-left"><div class="gov">Government of India — Fertilizer Control Order, 1985</div><div class="title">Daily Stock Register / Fertilizer</div></div>
<div class="form-hdr-right"><div class="form-no">Form N</div><div class="form-no-sub">Fertilizer Control Order</div></div></div>
<div class="dealer-grid">
<div class="dealer-cell"><div class="lbl">Dealer Name</div><div class="val">${escapeHtml(dealer.company_name)}</div></div>
<div class="dealer-cell"><div class="lbl">Fertilizer License Number</div><div class="val mono">${escapeHtml(dealer.fertilizer_license_number ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">License Valid Until</div><div class="val mono" style="${fertLicStyle}">${escapeHtml(licUntil)}</div></div>
<div class="dealer-cell"><div class="lbl">Address / Village / Town</div><div class="val">${escapeHtml(dealerAddressLine(dealer))}</div></div>
<div class="dealer-cell"><div class="lbl">District</div><div class="val">${escapeHtml(dealer.district ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">State</div><div class="val">${escapeHtml(dealer.state ?? '—')}</div></div>
</div>
<div class="period-bar">
<div class="pb-item"><div class="pb-label">Month</div><div class="pb-val">${escapeHtml(monthLabel)}</div></div>
<div class="pb-item"><div class="pb-label">Year</div><div class="pb-val">${escapeHtml(yearLabel)}</div></div>
<div class="pb-item"><div class="pb-label">Page No.</div><div class="pb-val">1 of 1</div></div>
<div class="pb-auto">Auto-generated by PrithviX</div>
</div>
<div class="tbl-wrap"><table class="reg"><thead><tr>
<th style="width:36px">S.No<span class="col-no">(1)</span></th>
<th style="width:90px">Date<span class="required"></span><span class="col-no">(2)</span></th>
<th style="min-width:150px">Fertilizer Name &amp; Grade<span class="required"></span><span class="col-no">(3)</span></th>
<th style="width:88px">Opening Stock<span class="required"></span><span class="col-no">(4)</span></th>
<th style="min-width:130px">Receipts Today<br><span style="font-size:9px;font-weight:400;color:#a8a29e">(Qty + Supplier + Invoice No.)</span><span class="col-no">(5)</span></th>
<th style="min-width:110px">Certificate of Source<br><span style="font-size:9px;font-weight:400;color:#a8a29e">(Form O Ref. No.)</span><span class="col-no">(6)</span></th>
<th style="width:88px">Total Available<span class="col-no">(7)</span></th>
<th style="width:80px">Sales Today<span class="required"></span><span class="col-no">(8)</span></th>
<th style="width:88px">Damage / Adjustment<span class="col-no">(9)</span></th>
<th style="width:88px">Closing Stock<span class="required"></span><span class="col-no">(10)</span></th>
<th style="min-width:100px">Remarks<span class="col-no">(11)</span></th>
</tr></thead><tbody>${rows}</tbody></table></div>
<div class="form-footer">
<div class="sig"><div class="sig-lbl">Dealer / Retailer Signature</div><div class="sig-name">${escapeHtml(dealer.owner_name || dealer.company_name)}</div><div class="sig-line"></div><div class="sig-date">Date: ___________________</div></div>
<div class="sig-center"><div class="stamp-area">Dealer Stamp</div></div>
<div class="sig" style="border-right:none"><div class="sig-lbl">Inspecting Officer Signature</div><div class="sig-name">Agriculture Inspector</div><div class="sig-line"></div><div class="sig-date">Inspection Date: ___________________</div></div>
</div></div>`;

  return wrapPrintDoc(`Form N — ${dealer.company_name}`, body);
}

function generateFormXIIHtml(
  dealer: Dealer,
  monthSales: Sale[],
  farmers: Farmer[],
  inv: Map<string, InventoryItem>,
  ym: string
): string {
  const ref = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = isValid(ref) ? format(ref, 'MMMM yyyy') : ym;
  const farmerMap = new Map(farmers.map((f) => [f.id, f]));

  type Row = { sale: Sale; line: SaleItem; inv?: InventoryItem };
  const rows: Row[] = [];
  for (const sale of monthSales) {
    for (const line of sale.items) {
      const r = line.itemId ? inv.get(line.itemId) : undefined;
      const cat = r?.category;
      if (cat !== 'pesticide' && cat !== 'insecticide') continue;
      rows.push({ sale, line, inv: r });
    }
  }

  let bodyRows = '';
  let validCount = 0;
  let qtyUnits = 0;
  let amtSum = 0;

  rows.forEach((r, idx) => {
    const { sale, line, inv: it } = r;
    const f = farmerMap.get(sale.farmerId);
    const exSt = getExpiryStatus(it?.expiryDate);
    const pill =
      exSt === 'expired' ? 'pill-red' : exSt === 'expiring' ? 'pill-amber' : 'pill-green';
    if (exSt !== 'expired') {
      validCount += 1;
      qtyUnits += line.quantity;
      amtSum += lineIncGst(line);
    }
    const alt = idx % 2 === 1 ? ' class="alt"' : '';
    const trCls = exSt === 'expired' ? ' class="danger-row"' : alt;
    const buyer = f?.fullName ?? sale.farmerId;
    const addr = f ? farmerAddress(f, dealer.state) : '—';
    const exColor = exSt === 'expired' ? 'color:var(--danger)' : exSt === 'expiring' ? 'color:var(--warn)' : 'color:var(--accent-2)';
    bodyRows += `<tr${trCls}>
<td class="sr">${idx + 1}</td>
<td class="tc mono12" style="font-size:10px">${escapeHtml(sale.id)}</td>
<td class="tc mono12">${format(new Date(sale.createdAt), 'dd/MM/yyyy')}</td>
<td><div class="dp">${escapeHtml(buyer)}</div>${f?.mobile ? `<div class="ds">Mob: ${escapeHtml(f.mobile)}</div>` : ''}</td>
<td style="font-size:11px">${escapeHtml(addr)}</td>
<td><div class="dp">${escapeHtml(line.itemName)}</div><div class="ds">${escapeHtml(it?.companyName ?? '')}</div></td>
<td><div class="dp">${escapeHtml(it?.technicalName ?? line.itemName)}</div><div class="ds">${escapeHtml(it?.formulation ?? '')}</div></td>
<td><div class="mono12">${escapeHtml(it?.batchNumber ?? '—')}</div><div style="margin-top:3px"><span class="pill ${pill}">${exSt === 'expired' ? 'Expired' : exSt === 'expiring' ? 'Exp. Soon' : 'Valid'}</span></div></td>
<td class="mono12" style="font-size:10px">${escapeHtml(it?.cibRegNumber ?? '—')}</td>
<td class="tc mono12">${escapeHtml(it?.manufacturingDate ?? '—')}</td>
<td class="tc mono12" style="${exColor}">${escapeHtml(it?.expiryDate ?? '—')}</td>
<td class="tc"><div class="nv">${line.quantity}</div><span class="nu">${escapeHtml(line.unit)}</span></td>
<td class="tr"><div class="nv">${formatINR(line.priceIncGstPerUnit ?? line.pricePerUnit)}</div><span class="nu">per unit</span></td>
<td class="tr"><div class="nv ${exSt === 'expired' ? 'num-red' : 'num-green'}">${formatINR(lineIncGst(line))}</div><div style="margin-top:3px"><span class="pill ${sale.paymentMode === 'credit' ? 'pill-amber' : 'pill-green'}">${sale.paymentMode === 'credit' ? 'Credit' : 'Paid'}</span></div></td>
</tr>`;
  });

  if (!bodyRows) {
    bodyRows = `<tr><td colspan="14" class="tc" style="padding:24px;color:var(--ink-3)">No pesticide/insecticide lines in ${escapeHtml(monthLabel)}.</td></tr>`;
  } else {
    bodyRows += `<tr class="total">
<td colspan="11" style="text-align:right;padding-right:16px;font-size:12px;color:var(--accent-2)">${escapeHtml(monthLabel)} Total (${validCount} valid sales) →</td>
<td class="tc"><div class="nv">${qtyUnits}</div></td>
<td></td>
<td class="tr"><div class="nv">${formatINR(amtSum)}</div></td>
</tr>`;
  }

  const body = `<div class="form-paper">
<div class="form-hdr"><div class="form-hdr-left"><div class="gov">Insecticides Act, 1968 — Rule 15, Insecticides Rules 1971</div><div class="title">Pesticide Sales Register</div></div>
<div class="form-hdr-right"><div class="form-no">Form XII</div><div class="form-no-sub">Insecticides Rules 1971</div></div></div>
<div class="dealer-grid">
<div class="dealer-cell"><div class="lbl">Dealer / Distributor Name</div><div class="val">${escapeHtml(dealer.company_name)}</div></div>
<div class="dealer-cell"><div class="lbl">Insecticide License No.</div><div class="val mono">${escapeHtml(dealer.pesticide_license_number ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">Period (Month / Year)</div><div class="val mono">${escapeHtml(monthLabel)}</div></div>
</div>
<div class="tbl-wrap"><table class="reg"><thead><tr>
<th style="width:34px">S.No<span class="col-no">(1)</span></th>
<th style="width:90px">Bill / Memo No.<span class="required"></span><span class="col-no">(2)</span></th>
<th style="width:88px">Date of Sale<span class="required"></span><span class="col-no">(3)</span></th>
<th style="min-width:130px">Buyer Name<span class="required"></span><span class="col-no">(4)</span></th>
<th style="min-width:150px">Buyer Address<span class="required"></span><span class="col-no">(5)</span></th>
<th style="min-width:130px">Trade / Brand Name<span class="required"></span><span class="col-no">(6)</span></th>
<th style="min-width:140px">Technical / Common Name<span class="required"></span><span class="col-no">(7)</span></th>
<th style="min-width:100px">Batch No.<span class="required"></span><span class="col-no">(8)</span></th>
<th style="min-width:100px">CIB Reg. No.<span class="required"></span><span class="col-no">(9)</span></th>
<th style="width:80px">Mfg. Date<span class="col-no">(10)</span></th>
<th style="width:80px">Expiry Date<span class="required"></span><span class="col-no">(11)</span></th>
<th style="width:76px">Qty Sold<span class="required"></span><span class="col-no">(12)</span></th>
<th style="width:72px">Rate / Unit<span class="col-no">(13)</span></th>
<th style="width:80px">Total Amount<span class="col-no">(14)</span></th>
</tr></thead><tbody>${bodyRows}</tbody></table></div>
<div class="form-footer">
<div class="sig"><div class="sig-lbl">Dealer Signature &amp; Stamp</div><div class="sig-name">${escapeHtml(dealer.owner_name || dealer.company_name)}</div><div class="sig-line"></div><div class="sig-date">Date: ___________________</div></div>
<div class="sig-center"><div class="stamp-area">Dealer Stamp</div></div>
<div class="sig" style="border-right:none"><div class="sig-lbl">Inspecting Officer</div><div class="sig-name">Agriculture Inspector</div><div class="sig-line"></div><div class="sig-date">Inspection Date: ___________________</div></div>
</div></div>`;

  return wrapPrintDoc(`Form XII — ${dealer.company_name}`, body);
}

function generateFormXIVHtml(
  dealer: Dealer,
  items: InventoryItem[],
  monthSales: Sale[],
  ym: string
): string {
  const ref = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = isValid(ref) ? format(ref, 'MMMM yyyy') : ym;
  const soldMap = qtySoldByItemId(monthSales);
  const pestic = items.filter((i) => i.category === 'pesticide' || i.category === 'insecticide');

  type Agg = {
    productId: string;
    trade: string;
    company?: string;
    technical?: string;
    formulation?: string;
    unit: string;
    opening: number;
    receipts: number;
    sold: number;
    closing: number;
    value: number;
    remark: string;
  };
  const map = new Map<string, Agg>();

  for (const it of pestic) {
    const sold = soldMap.get(it.id) ?? 0;
    const closing = displayUnits(it);
    const opening = closing + sold;
    const key = it.productId;
    const lineVal = monthSales.reduce((sum, s) => {
      let v = 0;
      for (const ln of s.items) {
        if (ln.itemId === it.id) v += lineIncGst(ln);
      }
      return sum + v;
    }, 0);
    const ex = getExpiryStatus(it.expiryDate);
    const rm =
      ex === 'expiring' ? 'Exp. soon — clear stock' : ex === 'expired' ? 'Expired stock' : '';
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        productId: key,
        trade: it.productName,
        company: it.companyName,
        technical: it.technicalName ?? it.productName,
        formulation: it.formulation,
        unit: it.unit,
        opening,
        receipts: 0,
        sold,
        closing,
        value: lineVal,
        remark: rm,
      });
    } else {
      cur.opening += opening;
      cur.receipts += 0;
      cur.sold += sold;
      cur.closing += closing;
      cur.value += lineVal;
      if (rm && !cur.remark) cur.remark = rm;
    }
  }

  const list = Array.from(map.values());
  let rows = '';
  let tOpen = 0,
    tRec = 0,
    tTot = 0,
    tSold = 0,
    tClose = 0,
    tVal = 0;

  list.forEach((a, idx) => {
    const totalAvail = a.opening + a.receipts;
    const alt = idx % 2 === 1 ? ' class="alt"' : '';
    tOpen += a.opening;
    tRec += a.receipts;
    tTot += totalAvail;
    tSold += a.sold;
    tClose += a.closing;
    tVal += a.value;
    const formPill = a.formulation
      ? `<span class="pill pill-blue">${escapeHtml(a.formulation)}</span>`
      : '—';
    rows += `<tr${alt}>
<td class="sr">${idx + 1}</td>
<td><div class="dp">${escapeHtml(a.trade)}</div><div class="ds">${escapeHtml(a.company ?? '')}</div></td>
<td><div class="dp">${escapeHtml(a.technical ?? '')}</div></td>
<td class="tc">${formPill}</td>
<td class="tc mono12">${escapeHtml(a.unit)}</td>
<td class="tc"><div class="nv">${a.opening}</div></td>
<td class="tc"><div class="nv">${a.receipts}</div></td>
<td class="tc"><div class="nv">${totalAvail}</div></td>
<td class="tc"><div class="nv">${a.sold}</div></td>
<td class="tc"><div class="nv num-green">${a.closing}</div></td>
<td class="tr"><div class="nv">${formatINR(a.value)}</div></td>
<td style="font-size:11px;color:var(--ink-4)">${escapeHtml(a.remark || '—')}</td>
</tr>`;
  });

  if (!rows) {
    rows = `<tr><td colspan="12" class="tc" style="padding:24px;color:var(--ink-3)">No pesticide/insecticide products in stock.</td></tr>`;
  } else {
    rows += `<tr class="total">
<td colspan="5" style="text-align:right;padding-right:16px;font-size:12px;color:var(--accent-2)">${escapeHtml(monthLabel)} Monthly Total →</td>
<td class="tc"><div class="nv">${tOpen}</div></td>
<td class="tc"><div class="nv">${tRec}</div></td>
<td class="tc"><div class="nv">${tTot}</div></td>
<td class="tc"><div class="nv">${tSold}</div></td>
<td class="tc"><div class="nv num-green">${tClose}</div></td>
<td class="tr"><div class="nv">${formatINR(tVal)}</div></td>
<td></td>
</tr>`;
  }

  const licSt = licenseDayStatus(dealer.pesticide_license_valid_until);
  const statusPill =
    licSt === 'expired' ? 'pill-red' : licSt === 'expiring' ? 'pill-amber' : 'pill-green';

  const body = `<div class="form-paper">
<div class="form-hdr"><div class="form-hdr-left"><div class="gov">Insecticides Act, 1968 — Rule 17 · Monthly Return to Licensing Authority</div><div class="title">Monthly Statement of Stock and Sales — Insecticides</div></div>
<div class="form-hdr-right"><div class="form-no">Form XIV</div><div class="form-no-sub">Insecticides Rules 1971</div></div></div>
<div class="dealer-grid">
<div class="dealer-cell"><div class="lbl">Dealer Name</div><div class="val">${escapeHtml(dealer.company_name)}</div></div>
<div class="dealer-cell"><div class="lbl">License Number</div><div class="val mono">${escapeHtml(dealer.pesticide_license_number ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">Return For Month / Year</div><div class="val mono">${escapeHtml(monthLabel)}</div></div>
<div class="dealer-cell"><div class="lbl">Issued By (Licensing Authority)</div><div class="val">${escapeHtml(`Dept. of Agriculture, ${dealer.state ?? '—'}`)}</div></div>
<div class="dealer-cell"><div class="lbl">District</div><div class="val">${escapeHtml(dealer.district ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">Status</div><div class="val"><span class="pill ${statusPill}">${licSt === 'expired' ? 'Expired' : licSt === 'expiring' ? 'Renew Soon' : 'Draft'}</span></div></div>
</div>
<div class="tbl-wrap"><table class="reg"><thead><tr>
<th style="width:34px">S.No<span class="col-no">(1)</span></th>
<th style="min-width:140px">Insecticide Name (Trade)<span class="required"></span><span class="col-no">(2)</span></th>
<th style="min-width:150px">Technical / Common Name<span class="required"></span><span class="col-no">(3)</span></th>
<th style="min-width:90px">Formulation Type<span class="col-no">(4)</span></th>
<th style="width:80px">Unit<span class="col-no">(5)</span></th>
<th style="width:90px">Opening Stock<span class="required"></span><span class="col-no">(6)</span></th>
<th style="width:90px">Receipts During Month<span class="required"></span><span class="col-no">(7)</span></th>
<th style="width:90px">Total Available<span class="col-no">(8)</span></th>
<th style="width:90px">Quantity Sold<span class="required"></span><span class="col-no">(9)</span></th>
<th style="width:90px">Closing Stock<span class="required"></span><span class="col-no">(10)</span></th>
<th style="width:90px">Sales Value (₹)<span class="col-no">(11)</span></th>
<th style="min-width:90px">Remarks<span class="col-no">(12)</span></th>
</tr></thead><tbody>${rows}</tbody></table></div>
<div style="padding:14px 24px;border-top:1px solid var(--rule);background:#fafaf9;font-size:12px;color:var(--ink-3);font-style:italic">Declaration: I hereby certify that the above statement of stock and sales of insecticides is true and correct to the best of my knowledge.</div>
<div class="form-footer">
<div class="sig"><div class="sig-lbl">Dealer Signature</div><div class="sig-name">${escapeHtml(dealer.owner_name || dealer.company_name)}</div><div class="sig-line"></div><div class="sig-date">Date of Submission: ___________________</div></div>
<div class="sig-center"><div class="stamp-area">Shop Stamp</div></div>
<div class="sig" style="border-right:none"><div class="sig-lbl">Received By — Licensing Authority</div><div class="sig-name">Dept. of Agriculture</div><div class="sig-line"></div><div class="sig-date">Receipt Date: ___________________</div></div>
</div></div>`;

  return wrapPrintDoc(`Form XIV — ${dealer.company_name}`, body);
}

function generateSeedRegisterHtml(
  dealer: Dealer,
  items: InventoryItem[],
  monthSales: Sale[],
  ym: string
): string {
  const ref = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = isValid(ref) ? format(ref, 'MMMM yyyy') : ym;
  const soldMap = qtySoldByItemId(monthSales);
  const seeds = items.filter((i) => i.category === 'seeds');

  const licUntil = dealer.seed_license_valid_until
    ? format(parseISO(dealer.seed_license_valid_until.slice(0, 10)), 'dd-MM-yyyy')
    : '—';
  const seedLicStatus = licenseDayStatus(dealer.seed_license_valid_until);
  const seedLicStyle =
    seedLicStatus === 'expired'
      ? 'color:var(--danger)'
      : seedLicStatus === 'expiring'
        ? 'color:var(--warn)'
        : 'color:var(--accent-2)';

  let soon = 0,
    valid = 0,
    gone = 0;
  for (const s of seeds) {
    const g = getGermStatus(s.germinationValidUpto);
    if (g === 'expired') gone++;
    else if (g === 'expiring') soon++;
    else if (g === 'valid') valid++;
  }

  let rows = '';
  let tOpen = 0,
    tRec = 0,
    tTot = 0,
    tSold = 0,
    tClose = 0;

  seeds.forEach((it, idx) => {
    const closing = displayUnits(it);
    const sold = soldMap.get(it.id) ?? 0;
    const opening = closing + sold;
    const receipts = 0;
    const total = opening + receipts;
    tOpen += opening;
    tRec += receipts;
    tTot += total;
    tSold += sold;
    tClose += closing;

    const germ = getGermStatus(it.germinationValidUpto);
    const germDateHtml = formatGermPrintLabel(it.germinationValidUpto);
    const germCls = germ === 'expired' ? 'germ-exp' : germ === 'expiring' ? 'germ-warn' : 'germ-valid';
    const classRow = germ === 'expired' ? ' class="danger-row"' : idx % 2 === 1 ? ' class="alt"' : '';
    const sc =
      it.seedClass === 'Foundation'
        ? 'pill-blue'
        : it.seedClass
          ? 'pill-green'
          : 'pill-grey';

    rows += `<tr${classRow}>
<td class="sr">${idx + 1}</td>
<td class="tc mono12">${format(endOfMonth(ref), 'dd/MM/yyyy')}</td>
<td><div class="dp">${escapeHtml([it.cropName, it.variety].filter(Boolean).join(' ') || it.productName)}</div><div class="ds">${escapeHtml(it.productName)}</div></td>
<td class="tc"><span class="pill ${sc}">${escapeHtml(it.seedClass ?? '—')}</span></td>
<td class="mono12" style="font-size:10px">${escapeHtml(it.lotNumber ?? '—')}</td>
<td style="font-size:11px"><div class="dp" style="font-size:11px">${escapeHtml(it.companyName ?? '—')}</div></td>
<td class="tc mono12">${escapeHtml(it.displayLabel)}</td>
<td class="tc"><div class="nv">${opening}</div><span class="nu">${escapeHtml(it.unit)}s</span></td>
<td class="tc"><div class="nv">${receipts}</div></td>
<td class="tc"><div class="nv">${total}</div></td>
<td class="tc"><div class="nv">${sold}</div></td>
<td class="tc"><div class="nv ${germ === 'expired' ? 'num-red' : 'num-green'}">${closing}</div>${germ === 'expired' ? '<div style="margin-top:2px"><span class="pill pill-red">Cert. Exp.</span></div>' : ''}</td>
<td class="mono12" style="font-size:10px">${germCertNoFromMetadata(it)}</td>
<td class="tc"><span class="${germCls}">${germDateHtml}</span></td>
<td style="font-size:11px;color:var(--ink-4)">${germ === 'expired' ? 'Sale blocked — cert expired' : isExpiringSoon(it.germinationValidUpto, 60) ? 'Expiring within 60 days' : '—'}</td>
</tr>`;
  });

  if (!rows) {
    rows = `<tr><td colspan="15" class="tc" style="padding:24px;color:var(--ink-3)">No seed SKUs in active inventory.</td></tr>`;
  } else {
    rows += `<tr class="total">
<td colspan="7" style="text-align:right;padding-right:16px;font-size:12px;color:var(--accent-2)">${escapeHtml(monthLabel)} Total →</td>
<td class="tc"><div class="nv">${tOpen}</div></td>
<td class="tc"><div class="nv">${tRec}</div></td>
<td class="tc"><div class="nv">${tTot}</div></td>
<td class="tc"><div class="nv">${tSold}</div></td>
<td class="tc"><div class="nv num-green">${tClose}</div></td>
<td colspan="3"></td>
</tr>`;
  }

  const strip = `<div style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:8px 20px;display:flex;align-items:center;gap:16px;font-size:11px;font-family:var(--mono);flex-wrap:wrap">
<span style="color:#c2410c;font-weight:600">${soon} lot(s) expiring within 60 days</span>
<span style="color:var(--ink-3)">|</span>
<span style="color:var(--accent-2)">${valid} lot(s) valid</span>
<span style="color:var(--ink-3)">|</span>
<span style="color:var(--danger)">${gone} lot(s) expired</span>
</div>`;

  const body = `<div class="form-paper">
<div class="form-hdr"><div class="form-hdr-left"><div class="gov">Seeds Act, 1966 — State Seed Rules</div><div class="title">Seed Stock Register / Daily + Monthly</div></div>
<div class="form-hdr-right"><div class="form-no" style="font-size:16px">Seed Register</div><div class="form-no-sub">Seeds Act 1966</div></div></div>
<div class="dealer-grid">
<div class="dealer-cell"><div class="lbl">Dealer Name</div><div class="val">${escapeHtml(dealer.company_name)}</div></div>
<div class="dealer-cell"><div class="lbl">Seed License Number</div><div class="val mono">${escapeHtml(dealer.seed_license_number ?? '—')}</div></div>
<div class="dealer-cell"><div class="lbl">License Valid Until</div><div class="val mono" style="${seedLicStyle}">${escapeHtml(licUntil)}</div></div>
<div class="dealer-cell"><div class="lbl">Address</div><div class="val">${escapeHtml(dealerAddressLine(dealer))}</div></div>
<div class="dealer-cell"><div class="lbl">Period</div><div class="val mono">${escapeHtml(monthLabel)}</div></div>
<div class="dealer-cell"><div class="lbl">Active Lots in Stock</div><div class="val" style="color:var(--accent-2)">${seeds.length} lots</div></div>
</div>
${strip}
<div class="tbl-wrap"><table class="reg"><thead><tr>
<th style="width:34px">S.No<span class="col-no">(1)</span></th>
<th style="width:88px">Date<span class="required"></span><span class="col-no">(2)</span></th>
<th style="min-width:140px">Crop / Variety Name<span class="required"></span><span class="col-no">(3)</span></th>
<th style="min-width:90px">Seed Class<span class="required"></span><span class="col-no">(4)</span></th>
<th style="min-width:110px">Lot Number<span class="required"></span><span class="col-no">(5)</span></th>
<th style="min-width:110px">Source / Supplier<span class="col-no">(6)</span></th>
<th style="width:80px">Pack Size<span class="col-no">(7)</span></th>
<th style="width:80px">Opening Stock<span class="required"></span><span class="col-no">(8)</span></th>
<th style="width:80px">Receipts<span class="col-no">(9)</span></th>
<th style="width:80px">Total<span class="col-no">(10)</span></th>
<th style="width:76px">Sales<span class="required"></span><span class="col-no">(11)</span></th>
<th style="width:76px">Closing Stock<span class="required"></span><span class="col-no">(12)</span></th>
<th style="min-width:110px">Germination Cert. No.<span class="required"></span><span class="col-no">(13)</span></th>
<th style="width:100px">Germination Valid Until<span class="required"></span><span class="col-no">(14)</span></th>
<th style="min-width:80px">Remarks<span class="col-no">(15)</span></th>
</tr></thead><tbody>${rows}</tbody></table></div>
<div style="padding:10px 20px;border-top:1px solid var(--rule);background:#fafaf9;font-size:11px;font-family:var(--mono);color:var(--ink-3)">
<span>Legend:</span>
<span style="color:var(--accent-2)">Green = Valid cert</span>
<span style="color:var(--warn)">Amber = Expiring within 60 days</span>
<span style="color:var(--danger)">Red strikethrough = Expired</span>
</div>
<div class="form-footer">
<div class="sig"><div class="sig-lbl">Dealer Signature</div><div class="sig-name">${escapeHtml(dealer.owner_name || dealer.company_name)}</div><div class="sig-line"></div><div class="sig-date">Date: ___________________</div></div>
<div class="sig-center"><div class="stamp-area">Dealer Stamp</div></div>
<div class="sig" style="border-right:none"><div class="sig-lbl">Seed Inspector / Officer</div><div class="sig-name">State Seed Inspector</div><div class="sig-line"></div><div class="sig-date">Inspection Date: ___________________</div></div>
</div></div>`;

  return wrapPrintDoc(`Seed Register — ${dealer.company_name}`, body);
}

export default function CompliancePage() {
  const { t } = useLanguage();
  const { dealer } = useAuth();
  const { sales, salesLoading } = useSales();
  const { farmers } = useData();
  const { activeItems, isLoading: inventoryLoading } = useInventory();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [downloading, setDownloading] = useState<string | null>(null);

  const monthSales = useMemo(() => salesInSelectedMonth(sales, selectedMonth), [sales, selectedMonth]);
  const invMap = useMemo(() => invById(activeItems), [activeItems]);
  const { score: complianceScore, expiredInventory } = useMemo(
    () => (dealer ? complianceScoreFrom(dealer, activeItems) : { score: 0, expiredInventory: false }),
    [dealer, activeItems]
  );
  const tier = useMemo(() => scoreTierLabel(complianceScore), [complianceScore]);

  const gstBuckets = useMemo(() => {
    const m = new Map<number, { taxable: number; gst: number }>();
    for (const sale of monthSales) {
      for (const line of sale.items) {
        const pct = Math.round(line.gstPercent ?? 0);
        const cur = m.get(pct) ?? { taxable: 0, gst: 0 };
        cur.taxable += lineTaxable(line);
        cur.gst += lineGst(line);
        m.set(pct, cur);
      }
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [monthSales]);

  const farmerNameMap = useMemo(
    () => Object.fromEntries(farmers.map((f) => [f.id, f.fullName])),
    [farmers]
  );

  const licenses = useMemo(
    () =>
      dealer
        ? [
            {
              name: 'Fertilizer',
              number: dealer.fertilizer_license_number,
              validUntil: dealer.fertilizer_license_valid_until,
            },
            {
              name: 'Pesticide / Insecticide',
              number: dealer.pesticide_license_number,
              validUntil: dealer.pesticide_license_valid_until,
            },
            {
              name: 'Seed',
              number: dealer.seed_license_number,
              validUntil: dealer.seed_license_valid_until,
            },
          ]
        : [],
    [dealer]
  );

  const registers = useMemo(
    () => [
      {
        id: 'form-n' as const,
        title: 'Form N',
        subtitle: 'Fertilizer daily stock',
        icon: Leaf,
        count: activeItems.filter((i) => i.category === 'fertilizer').length,
      },
      {
        id: 'form-xii' as const,
        title: 'Form XII',
        subtitle: 'Pesticide sales lines',
        icon: Bug,
        count: monthSales.reduce(
          (n, s) =>
            n +
            s.items.filter((l) => {
              const c = categoryOfLine(l, invMap);
              return c === 'pesticide' || c === 'insecticide';
            }).length,
          0
        ),
      },
      {
        id: 'form-xiv' as const,
        title: 'Form XIV',
        subtitle: 'Monthly return (aggregated)',
        icon: FileText,
        count: new Set(
          activeItems
            .filter((i) => i.category === 'pesticide' || i.category === 'insecticide')
            .map((i) => i.productId)
        ).size,
      },
      {
        id: 'seed-reg' as const,
        title: 'Seed register',
        subtitle: 'Seed stock + germination',
        icon: Sprout,
        count: activeItems.filter((i) => i.category === 'seeds').length,
      },
    ],
    [activeItems, monthSales, invMap]
  );

  const handleDownloadReport = useCallback(
    async (reportType: string) => {
      if (!dealer) return;
      setDownloading(reportType);
      try {
        const monthLabel = format(parse(`${selectedMonth}-01`, 'yyyy-MM-dd', new Date()), 'MMM-yyyy');

        if (reportType === 'GSTR-1') {
          const rows = monthSales.map((sale) => {
            const totalExGst = sale.items.reduce((s, i) => s + lineTaxable(i), 0);
            const totalGst = sale.items.reduce((s, i) => s + lineGst(i), 0);
            return {
              'Invoice Date': format(new Date(sale.createdAt), 'dd/MM/yyyy'),
              'Sale ID': sale.id,
              'Farmer Name': farmerNameMap[sale.farmerId] ?? sale.farmerId,
              'Payment Mode': sale.paymentMode.toUpperCase(),
              'Taxable Amount (₹)': totalExGst.toFixed(2),
              'GST Amount (₹)': totalGst.toFixed(2),
              'Invoice Total (₹)': sale.finalAmount.toFixed(2),
              Status: sale.status,
            };
          });
          if (rows.length === 0) {
            toast.info('No sales data for selected month');
            return;
          }
          downloadCSV(rows, `GSTR1_${monthLabel}`);
          toast.success('GSTR-1 report downloaded');
        } else if (reportType === 'Sales Register') {
          const rows = monthSales.flatMap((sale) =>
            sale.items.map((item) => ({
              Date: format(new Date(sale.createdAt), 'dd/MM/yyyy'),
              'Sale ID': sale.id,
              Farmer: farmerNameMap[sale.farmerId] ?? sale.farmerId,
              'Product Name': item.itemName,
              Qty: item.quantity,
              Unit: item.unit,
              'Price Ex-GST (₹)': item.priceExGst.toFixed(2),
              'GST %': item.gstPercent,
              'GST Amount (₹)': lineGst(item).toFixed(2),
              'Line Total (₹)': lineIncGst(item).toFixed(2),
              'Payment Mode': sale.paymentMode.toUpperCase(),
            }))
          );
          if (rows.length === 0) {
            toast.info('No sales data for selected month');
            return;
          }
          downloadCSV(rows, `SalesRegister_${monthLabel}`);
          toast.success('Sales Register downloaded');
        } else if (reportType === 'Stock Register') {
          const rows = activeItems.map((item) => ({
            'Product Name': item.productName,
            SKU: item.displayLabel,
            Category: item.category,
            Unit: item.unit,
            'Base Unit': item.baseUnit,
            'Current Stock (base)': item.stock,
            'Reorder Level': item.reorderLevel,
            'Safety Stock': item.safetyStockBase,
            Status: item.stockStatus ?? 'unknown',
            'Selling Price Ex-GST': item.sellingPrice?.toFixed(2) ?? '',
            'GST %': item.gstPercent ?? '',
          }));
          if (rows.length === 0) {
            toast.info('No inventory data available');
            return;
          }
          downloadCSV(rows, `StockRegister_${monthLabel}`);
          toast.success('Stock Register downloaded');
        } else if (reportType === 'Compliance Pack') {
          const today = new Date();
          const rows = licenses.map((lic) => {
            const status = licenseDayStatus(lic.validUntil);
            return {
              'License Type': lic.name,
              'License Number': lic.number ?? 'Not configured',
              'Valid Until': lic.validUntil
                ? format(parseISO(lic.validUntil.slice(0, 10)), 'dd/MM/yyyy')
                : 'N/A',
              Status:
                status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring Soon' : status === 'expired' ? 'Expired' : 'Not Set',
              'Business Name': dealer.company_name ?? '',
              GSTIN: dealer.gstin ?? '',
              'Report Date': format(today, 'dd/MM/yyyy'),
            };
          });
          downloadCSV(rows, `LicenseCompliancePack_${monthLabel}`);
          toast.success('License Compliance Pack downloaded');
        }
      } catch (error) {
        console.error('Download error:', error);
        toast.error(`Failed to download ${reportType}`);
      } finally {
        setDownloading(null);
      }
    },
    [dealer, monthSales, farmerNameMap, activeItems, selectedMonth, licenses]
  );

  const reportRows = useMemo(
    () => [
      { id: 'GSTR-1', title: 'GST Return (GSTR-1)', desc: 'Monthly sales return for GST filing' },
      { id: 'Sales Register', title: 'Sales Register', desc: 'Ledger with tax breakup' },
      { id: 'Stock Register', title: 'Stock Register', desc: 'Inventory snapshot' },
      { id: 'Compliance Pack', title: 'License Compliance Pack', desc: 'License details & validity' },
    ],
    []
  );

  const monthLabelLong = format(parse(`${selectedMonth}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy');

  if (!dealer || salesLoading || inventoryLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const formNPreviewRows = activeItems.filter((i) => i.category === 'fertilizer').slice(0, 8);
  const formNSold = qtySoldByItemId(monthSales);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('compliance.title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('compliance.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="compliance-month" className="text-xs text-muted-foreground whitespace-nowrap">
            Month
          </label>
          <input
            id="compliance-month"
            type="month"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            ['overview', t('analytics.overview')],
            ['form-n', t('compliance.formN')],
            ['form-xii', t('compliance.formXII')],
            ['form-xiv', t('compliance.formXIV')],
            ['seed-reg', t('compliance.seedRegister')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <Card className="border-border bg-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Compliance score</p>
                <p className={cn('mt-1 text-4xl font-bold tabular-nums', tier.cn)}>{complianceScore}</p>
                <p className={cn('text-sm font-medium', tier.cn)}>{tier.label}</p>
                {expiredInventory && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Expired SKU batch or seed germination certificate in stock
                  </p>
                )}
                {!expiredInventory && complianceScore >= 70 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    No blocked/expired cert or batch flags on active SKUs
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground md:max-w-md">
                +25 points per active license slot (fertilizer, pesticide, seed) when the license is not expired, up
                to 75. +25 when no inventory lot shows an expired batch expiry or expired seed germination validity.
                Bands: 90+ excellent, 70+ good, 50+ fair.
              </div>
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Licenses
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {licenses.map((license, index) => {
                const status = licenseDayStatus(license.validUntil);
                return (
                  <Card key={index} className="border-border bg-card">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold text-foreground">{license.name}</h3>
                        </div>
                        {license.number && (
                          <Badge
                            variant={
                              status === 'expired'
                                ? 'destructive'
                                : status === 'expiring'
                                  ? 'secondary'
                                  : 'default'
                            }
                          >
                            {status === 'expired' ? 'Expired' : status === 'expiring' ? 'Renew soon' : 'Valid'}
                          </Badge>
                        )}
                      </div>
                      {license.number ? (
                        <>
                          <p className="mt-2 font-mono text-xs text-muted-foreground">{license.number}</p>
                          {license.validUntil && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Valid until{' '}
                              {format(parseISO(license.validUntil.slice(0, 10)), 'dd MMM yyyy')}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Not configured</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              GST ({monthLabelLong})
            </h2>
            <Card className="overflow-hidden border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2 text-left font-medium">GST %</th>
                    <th className="px-4 py-2 text-right font-medium">Taxable (₹)</th>
                    <th className="px-4 py-2 text-right font-medium">GST (₹)</th>
                    <th className="px-4 py-2 text-right font-medium">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {gstBuckets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No line items in selected month
                      </td>
                    </tr>
                  ) : (
                    gstBuckets.map(([pct, v]) => (
                      <tr key={pct} className="border-b border-border">
                        <td className="px-4 py-2">{pct}%</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatINR(v.taxable)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatINR(v.gst)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatINR(v.taxable + v.gst)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registers
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {registers.map((r) => (
                <Card
                  key={r.id}
                  className="cursor-pointer border-border bg-card transition-colors hover:bg-muted/30"
                  onClick={() => setActiveTab(r.id)}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <r.icon className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">{r.title}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.subtitle}</p>
                    <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{r.count}</p>
                    <p className="text-xs text-muted-foreground">rows / SKUs</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CSV exports
            </h2>
            <div className="space-y-2">
              {reportRows.map((r) => (
                <Card key={r.id} className="border-border bg-card">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border shrink-0"
                      onClick={() => handleDownloadReport(r.id)}
                      disabled={downloading === r.id}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloading === r.id ? 'Generating…' : 'Download'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'form-n' && (
        <Card className="border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Form N — Fertilizer</h2>
              <p className="text-xs text-muted-foreground">
                {activeItems.filter((i) => i.category === 'fertilizer').length} fertilizer SKUs · {monthLabelLong}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => openPrintWindow(generateFormNHtml(dealer, activeItems, monthSales, selectedMonth))}
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate &amp; Print Report
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Sold (mo)</th>
                  <th className="p-2 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {formNPreviewRows.map((it) => (
                  <tr key={it.id} className="border-b border-border">
                    <td className="p-2">{it.productName}</td>
                    <td className="p-2 text-right">{formNSold.get(it.id) ?? 0}</td>
                    <td className="p-2 text-right">{displayUnits(it)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'form-xii' && (
        <Card className="border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Form XII — Pesticide sales</h2>
              <p className="text-xs text-muted-foreground">
                {
                  monthSales.reduce(
                    (n, s) =>
                      n +
                      s.items.filter((l) => {
                        const c = categoryOfLine(l, invMap);
                        return c === 'pesticide' || c === 'insecticide';
                      }).length,
                    0
                  )
                }{' '}
                lines · {monthLabelLong}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                openPrintWindow(generateFormXIIHtml(dealer, monthSales, farmers, invMap, selectedMonth))
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate &amp; Print Report
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2 text-left">Bill</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Buyer</th>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {monthSales
                  .flatMap((s) => s.items.map((l) => ({ s, l })))
                  .filter(({ l }) => {
                    const c = categoryOfLine(l, invMap);
                    return c === 'pesticide' || c === 'insecticide';
                  })
                  .slice(0, 8)
                  .map(({ s, l }, idx) => (
                    <tr key={`${s.id}-${idx}`} className="border-b border-border">
                      <td className="p-2 font-mono text-[10px]">{s.id}</td>
                      <td className="p-2 whitespace-nowrap">{format(new Date(s.createdAt), 'dd/MM/yy')}</td>
                      <td className="p-2">{farmerNameMap[s.farmerId] ?? s.farmerId}</td>
                      <td className="p-2">{l.itemName}</td>
                      <td className="p-2 text-right">
                        {l.quantity} {l.unit}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'form-xiv' && (
        <Card className="border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Form XIV — Monthly return</h2>
              <p className="text-xs text-muted-foreground">
                Aggregated by product · {monthLabelLong}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                openPrintWindow(generateFormXIVHtml(dealer, activeItems, monthSales, selectedMonth))
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate &amp; Print Report
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2 text-left">Trade</th>
                  <th className="p-2 text-right">Opening</th>
                  <th className="p-2 text-right">Sold</th>
                  <th className="p-2 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  (() => {
                    const sold = qtySoldByItemId(monthSales);
                    const m = new Map<
                      string,
                      { trade: string; opening: number; sold: number; closing: number }
                    >();
                    for (const it of activeItems) {
                      if (it.category !== 'pesticide' && it.category !== 'insecticide') continue;
                      const sl = sold.get(it.id) ?? 0;
                      const cl = displayUnits(it);
                      const op = cl + sl;
                      const cur = m.get(it.productId);
                      if (!cur)
                        m.set(it.productId, { trade: it.productName, opening: op, sold: sl, closing: cl });
                      else {
                        cur.opening += op;
                        cur.sold += sl;
                        cur.closing += cl;
                      }
                    }
                    return m;
                  })().values()
                )
                  .slice(0, 8)
                  .map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-2">{row.trade}</td>
                      <td className="p-2 text-right">{row.opening}</td>
                      <td className="p-2 text-right">{row.sold}</td>
                      <td className="p-2 text-right">{row.closing}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'seed-reg' && (
        <Card className="border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Seed register</h2>
              <p className="text-xs text-muted-foreground">
                {activeItems.filter((i) => i.category === 'seeds').length} seed SKUs · {monthLabelLong}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                openPrintWindow(generateSeedRegisterHtml(dealer, activeItems, monthSales, selectedMonth))
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate &amp; Print Report
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-2 text-left">Crop / variety</th>
                  <th className="p-2 text-left">Lot</th>
                  <th className="p-2 text-right">Closing</th>
                  <th className="p-2 text-left">Germ. valid</th>
                </tr>
              </thead>
              <tbody>
                {activeItems
                  .filter((i) => i.category === 'seeds')
                  .slice(0, 8)
                  .map((it) => {
                    const g = getGermStatus(it.germinationValidUpto);
                    return (
                      <tr key={it.id} className="border-b border-border">
                        <td className="p-2">
                          {[it.cropName, it.variety].filter(Boolean).join(' ') || it.productName}
                        </td>
                        <td className="p-2 font-mono text-[10px]">{it.lotNumber ?? '—'}</td>
                        <td className="p-2 text-right">{displayUnits(it)}</td>
                        <td
                          className={cn(
                            'p-2',
                            g === 'expired' && 'text-destructive line-through',
                            g === 'expiring' && 'text-amber-600 dark:text-amber-400',
                            g === 'valid' && 'text-primary'
                          )}
                        >
                          {it.germinationValidUpto ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
