/**
 * Compliance Forms HTML Generator
 * Generates print-ready compliance forms from inventory data
 */

import { InventoryItem } from '@/constants/types';
import { formatDateForPDF, formatCurrency } from './pdf-utils';

// Extended dealer type for PDF generation
interface DealerForPDF {
  company_name: string;
  owner_name: string;
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  state_code?: string;
  gstin?: string;
  mobile?: string;
  fertilizer_license_number?: string;
  pesticide_license_number?: string;
  seed_license_number?: string;
}

interface ComplianceFormData {
  dealer: DealerForPDF;
  items: InventoryItem[];
  reportDate: Date;
  month: string;
  year: string;
}

/**
 * Form N - Fertilizer Daily Stock Register
 */
export function generateFormN(data: ComplianceFormData): string {
  const { dealer, items, reportDate } = data;
  const fertilizerItems = items.filter(item => item.category === 'fertilizer');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Form N — Fertilizer Daily Stock Register | ${dealer.company_name}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #1a6b2a; padding-bottom: 10px; margin-bottom: 15px; }
    .title { font-size: 16px; font-weight: 900; color: #1a6b2a; margin-bottom: 5px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 8px; }
    .dealer-info { display: flex; justify-content: space-between; font-size: 9px; color: #555; line-height: 1.7; }
    .dealer-info strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table thead tr th { background: #1a6b2a; color: #fff; padding: 6px 4px; font-size: 9px; font-weight: 700; border: 1px solid #0d4d1a; text-align: center; }
    table thead tr th.left { text-align: left; padding-left: 8px; }
    table tbody tr td { padding: 5px 4px; border: 1px solid #cde8cd; font-size: 9px; color: #111; vertical-align: middle; text-align: center; }
    table tbody tr:nth-child(odd) { background: #fff; }
    table tbody tr:nth-child(even) { background: #f8fdf8; }
    .td-l { text-align: left; padding-left: 8px !important; }
    .td-r { text-align: right; padding-right: 6px !important; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; }
    .sign-area { width: 30%; }
    .sign-line { border-top: 1px solid #333; padding-top: 5px; font-size: 9px; font-weight: 700; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">FORM N</div>
    <div class="subtitle">Daily Stock Register of Fertilizers</div>
    <div class="subtitle">[See Rule 13(9) of the Fertilizer (Control) Order, 1985]</div>
  </div>

  <div class="dealer-info">
    <div>
      <strong>${dealer.company_name}</strong><br>
      ${dealer.address || ''}, ${dealer.village || ''}, ${dealer.district || ''}<br>
      License No.: <strong>${dealer.fertilizer_license_number || 'N/A'}</strong>
    </div>
    <div style="text-align: right;">
      Date: <strong>${formatDateForPDF(reportDate, 'DD MMM YYYY')}</strong><br>
      State: ${dealer.state || ''} &nbsp;|&nbsp; Code: ${dealer.state_code || ''}<br>
      GST: ${dealer.gstin || 'N/A'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%;">Sr. No</th>
        <th class="left" style="width:20%;">Name & Grade of Fertilizer</th>
        <th style="width:10%;">Brand Name</th>
        <th style="width:8%;">FCO Number</th>
        <th style="width:8%;">Opening Stock (bags)</th>
        <th style="width:8%;">Receipt (bags)</th>
        <th style="width:8%;">Total (bags)</th>
        <th style="width:8%;">Sale (bags)</th>
        <th style="width:8%;">Closing Stock (bags)</th>
        <th class="left" style="width:18%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${fertilizerItems.length === 0 ? `
        <tr>
          <td colspan="10" style="text-align:center;padding:20px;color:#888;">No fertilizer stock available for this period</td>
        </tr>
      ` : fertilizerItems.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="td-l"><strong>${item.productName}</strong><br><span style="font-size:8px;color:#666;">${item.displayLabel}</span></td>
          <td>${item.companyName || '—'}</td>
          <td>${item.hsnCode || '—'}</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td>—</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td>—</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td class="td-l">Current stock as of today</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Prepared By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Verified By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

</body>
</html>`;
}

/**
 * Form XII - Pesticide Sales Register
 */
export function generateFormXII(data: ComplianceFormData): string {
  const { dealer, items, reportDate, month, year } = data;
  const pesticideItems = items.filter(item => item.category === 'pesticide' || item.category === 'insecticide');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Form XII — Pesticide Sales Register | ${dealer.company_name}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #cc4400; padding-bottom: 10px; margin-bottom: 15px; }
    .title { font-size: 16px; font-weight: 900; color: #cc4400; margin-bottom: 5px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 8px; }
    .dealer-info { display: flex; justify-content: space-between; font-size: 9px; color: #555; line-height: 1.7; }
    .dealer-info strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table thead tr th { background: #cc4400; color: #fff; padding: 6px 4px; font-size: 9px; font-weight: 700; border: 1px solid #992200; text-align: center; }
    table thead tr th.left { text-align: left; padding-left: 8px; }
    table tbody tr td { padding: 5px 4px; border: 1px solid #ffddcc; font-size: 9px; color: #111; vertical-align: middle; text-align: center; }
    table tbody tr:nth-child(odd) { background: #fff; }
    table tbody tr:nth-child(even) { background: #fffaf8; }
    .td-l { text-align: left; padding-left: 8px !important; }
    .td-r { text-align: right; padding-right: 6px !important; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; }
    .sign-area { width: 30%; }
    .sign-line { border-top: 1px solid #333; padding-top: 5px; font-size: 9px; font-weight: 700; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">FORM XII</div>
    <div class="subtitle">Register of Sales of Insecticides</div>
    <div class="subtitle">[See Rule 19(5) of the Insecticides Rules, 1971]</div>
  </div>

  <div class="dealer-info">
    <div>
      <strong>${dealer.company_name}</strong><br>
      ${dealer.address || ''}, ${dealer.village || ''}, ${dealer.district || ''}<br>
      License No.: <strong>${dealer.pesticide_license_number || 'N/A'}</strong>
    </div>
    <div style="text-align: right;">
      Period: <strong>${month} ${year}</strong><br>
      State: ${dealer.state || ''} &nbsp;|&nbsp; Code: ${dealer.state_code || ''}<br>
      Report Date: ${formatDateForPDF(reportDate, 'DD MMM YYYY')}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%;">Sr. No</th>
        <th class="left" style="width:16%;">Name of Insecticide</th>
        <th style="width:12%;">Technical Name</th>
        <th style="width:8%;">CIB Reg. No.</th>
        <th style="width:8%;">Batch No.</th>
        <th style="width:8%;">Mfg. Date</th>
        <th style="width:8%;">Expiry</th>
        <th style="width:10%;">Manufacturer</th>
        <th style="width:8%;">Quantity (Units)</th>
        <th style="width:8%;">Stock (Units)</th>
        <th class="left" style="width:10%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${pesticideItems.length === 0 ? `
        <tr>
          <td colspan="11" style="text-align:center;padding:20px;color:#888;">No pesticide/insecticide stock available for this period</td>
        </tr>
      ` : pesticideItems.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="td-l"><strong>${item.productName}</strong><br><span style="font-size:8px;color:#666;">${item.displayLabel}</span></td>
          <td>${item.technicalName || '—'}</td>
          <td>${item.cibRegNumber || '—'}</td>
          <td>${item.batchNumber || '—'}</td>
          <td>${item.manufacturingDate || '—'}</td>
          <td>${item.expiryDate || '—'}</td>
          <td>${item.companyName || '—'}</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td class="td-l">In Stock</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Prepared By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Verified By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

</body>
</html>`;
}

/**
 * Seed Stock Register
 */
export function generateSeedRegister(data: ComplianceFormData): string {
  const { dealer, items, reportDate } = data;
  const seedItems = items.filter(item => item.category === 'seeds');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Seed Stock Register | ${dealer.company_name}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #2d7a2d; padding-bottom: 10px; margin-bottom: 15px; }
    .title { font-size: 16px; font-weight: 900; color: #2d7a2d; margin-bottom: 5px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 8px; }
    .dealer-info { display: flex; justify-content: space-between; font-size: 9px; color: #555; line-height: 1.7; }
    .dealer-info strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table thead tr th { background: #2d7a2d; color: #fff; padding: 6px 4px; font-size: 9px; font-weight: 700; border: 1px solid #1a5a1a; text-align: center; }
    table thead tr th.left { text-align: left; padding-left: 8px; }
    table tbody tr td { padding: 5px 4px; border: 1px solid #cde8cd; font-size: 9px; color: #111; vertical-align: middle; text-align: center; }
    table tbody tr:nth-child(odd) { background: #fff; }
    table tbody tr:nth-child(even) { background: #f8fdf8; }
    .td-l { text-align: left; padding-left: 8px !important; }
    .td-r { text-align: right; padding-right: 6px !important; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; }
    .sign-area { width: 30%; }
    .sign-line { border-top: 1px solid #333; padding-top: 5px; font-size: 9px; font-weight: 700; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">SEED STOCK REGISTER</div>
    <div class="subtitle">Daily Stock Register of Seeds</div>
  </div>

  <div class="dealer-info">
    <div>
      <strong>${dealer.company_name}</strong><br>
      ${dealer.address || ''}, ${dealer.village || ''}, ${dealer.district || ''}<br>
      License No.: <strong>${dealer.seed_license_number || 'N/A'}</strong>
    </div>
    <div style="text-align: right;">
      Date: <strong>${formatDateForPDF(reportDate, 'DD MMM YYYY')}</strong><br>
      State: ${dealer.state || ''} &nbsp;|&nbsp; Code: ${dealer.state_code || ''}<br>
      GST: ${dealer.gstin || 'N/A'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%;">Sr. No</th>
        <th class="left" style="width:14%;">Crop & Variety</th>
        <th style="width:10%;">Seed Class</th>
        <th style="width:10%;">Company</th>
        <th style="width:8%;">Lot No.</th>
        <th style="width:8%;">Batch No.</th>
        <th style="width:8%;">Pack Size</th>
        <th style="width:8%;">Stock (Units)</th>
        <th style="width:8%;">Germination %</th>
        <th style="width:8%;">Germ. Valid</th>
        <th class="left" style="width:14%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${seedItems.length === 0 ? `
        <tr>
          <td colspan="11" style="text-align:center;padding:20px;color:#888;">No seed stock available for this period</td>
        </tr>
      ` : seedItems.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="td-l">
            <strong>${item.cropName || item.productName}</strong>
            ${item.variety ? `<br><span style="font-size:8px;color:#666;">Variety: ${item.variety}</span>` : ''}
          </td>
          <td>${item.seedClass || '—'}</td>
          <td>${item.companyName || '—'}</td>
          <td>${item.lotNumber || '—'}</td>
          <td>${item.batchNumber || '—'}</td>
          <td>${item.displayLabel}</td>
          <td>${Math.ceil(item.stock / (item.unitsPerBase || 1))}</td>
          <td>${item.germinationPercent ? `${item.germinationPercent}%` : '—'}</td>
          <td>${item.germinationValidUpto || '—'}</td>
          <td class="td-l">In Stock</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Prepared By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Verified By</div>
    </div>
    <div class="sign-area">
      <div style="height:40px;"></div>
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

</body>
</html>`;
}

export function printComplianceForm(html: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

export function downloadCompliancePDF(html: string, filename: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
