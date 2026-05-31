/**
 * Invoice HTML Generator
 * Generates print-ready invoice HTML from sale data
 */

import { Sale, Farmer, SaleItem } from '@/constants/types';
import { numberToWords, formatDateForPDF, formatTimeForPDF, formatCurrency, calculateGST } from './pdf-utils';

// Extended dealer type for PDF generation
interface DealerForInvoice {
  company_name: string;
  owner_name: string;
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  state_code?: string;
  gstin?: string;
  mobile?: string;
  upi_id?: string;
  shop_logo_url?: string;
  fertilizer_license_number?: string;
}

interface InvoiceData {
  sale: Sale;
  dealer: DealerForInvoice;
  farmer: Farmer;
  invoiceNumber: string;
}

function getInvoiceType(items: SaleItem[]): 'fertilizer' | 'pesticide' | 'seed' | 'mixed' {
  const categories = new Set(items.map(item => {
    const name = item.itemName.toLowerCase();
    if (name.includes('dap') || name.includes('urea') || name.includes('npk') || name.includes('fertilizer')) return 'fertilizer';
    if (name.includes('pesticide') || name.includes('insecticide') || name.includes('fungicide')) return 'pesticide';
    if (name.includes('seed')) return 'seed';
    return 'other';
  }));
  
  if (categories.size === 1) {
    const cat = Array.from(categories)[0];
    if (cat === 'fertilizer') return 'fertilizer';
    if (cat === 'pesticide') return 'pesticide';
    if (cat === 'seed') return 'seed';
  }
  
  return 'mixed';
}

export function generateFertilizerInvoice(data: InvoiceData): string {
  const { sale, dealer, farmer, invoiceNumber } = data;
  const invoiceDate = new Date(sale.createdAt);
  const totalInWords = numberToWords(sale.finalAmount);
  
  const isCredit = sale.paymentMode === 'credit';
  const logoUrl = dealer.shop_logo_url || '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TAX INVOICE — Fertilizer | ${dealer.company_name}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; background: #fff; }
    .inv { background: #fff; border: 1.5px solid #2d7a2d; position: relative; overflow: hidden; }
    .wm { position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 96px; font-weight: 900; color: rgba(0,0,0,0.06); white-space: nowrap; pointer-events: none; letter-spacing: 14px; z-index: 0; ${isCredit ? '' : 'display: none;'} }
    .inv-title { text-align: center; font-size: 22px; font-weight: 900; color: #2d7a2d; padding: 14px 0 10px; border-bottom: 1px solid #cde8cd; letter-spacing: 1px; position: relative; z-index: 1; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 14px 10px; border-bottom: 1px solid #cde8cd; gap: 10px; position: relative; z-index: 1; }
    .hdr-left { flex: 1; }
    .logo-area { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .logo-box { width: 52px; height: 46px; border: 1px dashed #aaa; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #bbb; flex-shrink: 0; overflow: hidden; }
    .logo-box img { width: 100%; height: 100%; object-fit: contain; }
    .shop-name { font-size: 15px; font-weight: 900; color: #1a1a1a; line-height: 1.2; }
    .shop-tagline { font-size: 9px; color: #2d7a2d; font-weight: 600; margin-top: 1px; }
    .shop-detail { font-size: 9.5px; color: #444; line-height: 1.7; margin-top: 4px; }
    .shop-detail strong { color: #111; }
    .hdr-right { min-width: 210px; text-align: left; }
    .inv-meta-row { display: flex; gap: 4px; font-size: 10px; line-height: 1.85; color: #222; }
    .inv-meta-row .lbl { font-weight: 700; min-width: 110px; }
    .credit-badge { display: ${isCredit ? 'block' : 'none'}; margin-top: 6px; padding: 3px 10px; border: 1.5px solid #cc0000; border-radius: 4px; color: #cc0000; font-size: 9px; font-weight: 800; background: #fff5f5; width: fit-content; }
    .bill-section { display: flex; border-bottom: 1px solid #cde8cd; position: relative; z-index: 1; }
    .bill-box { flex: 1; padding: 8px 14px; background: #f0faf0; }
    .bill-box + .bill-box { border-left: 1px solid #cde8cd; }
    .bill-box-title { font-size: 9px; font-weight: 700; color: #2d7a2d; font-style: italic; margin-bottom: 5px; }
    .buyer-name { font-size: 12px; font-weight: 900; color: #111; }
    .buyer-detail { font-size: 9.5px; color: #444; line-height: 1.8; margin-top: 2px; }
    .balance-due { color: #cc0000; font-weight: 800; font-size: 11px; margin-top: 3px; }
    .table-wrap { position: relative; z-index: 1; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items thead tr th { background: #1a6b2a; color: #fff; padding: 6px 4px; font-size: 10px; font-weight: 700; border: 1px solid #0d4d1a; text-align: center; }
    table.items thead tr th.left { text-align: left; padding-left: 8px; }
    table.items tbody tr td { padding: 6px 4px; border: 1px solid #cde8cd; font-size: 10px; color: #111; vertical-align: middle; }
    table.items tbody tr:nth-child(odd) { background: #fff; }
    table.items tbody tr:nth-child(even) { background: #f8fdf8; }
    table.items tfoot tr td { background: #1a6b2a; color: #fff; font-weight: 800; font-size: 10px; padding: 6px 4px; border: 1px solid #0d4d1a; text-align: center; }
    table.items tfoot tr td.left { text-align: left; padding-left: 8px; }
    .td-c { text-align: center; }
    .td-r { text-align: right; padding-right: 6px !important; }
    .td-l { text-align: left; padding-left: 8px !important; }
    .item-name { font-weight: 700; }
    .item-sub { font-size: 8.5px; color: #666; margin-top: 1px; }
    .lower { display: flex; border-top: 1px solid #cde8cd; position: relative; z-index: 1; }
    .lower-left { flex: 1; padding: 10px 14px; border-right: 1px solid #cde8cd; }
    .lower-right { width: 260px; padding: 10px 14px; }
    .section-title { font-size: 10px; font-weight: 700; color: #2d7a2d; font-style: italic; margin-bottom: 6px; }
    .detail-row { display: flex; gap: 6px; font-size: 9.5px; line-height: 1.9; }
    .detail-row .dl { color: #555; min-width: 100px; }
    .detail-row .dv { font-weight: 700; color: #111; }
    .sum-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; padding: 2px 0; color: #333; border-bottom: 1px dashed #e0e0e0; }
    .sum-row:last-child { border-bottom: none; }
    .sum-row.total-row { font-size: 12px; font-weight: 900; color: #1a1a1a; border-top: 1.5px solid #1a6b2a; border-bottom: 1.5px solid #1a6b2a; padding: 4px 0; margin: 3px 0; }
    .sum-row .slabel { color: #444; }
    .sum-row .svalue { font-weight: 600; }
    .sum-row.total-row .svalue { font-weight: 900; color: #1a6b2a; }
    .amt-words { padding: 8px 14px; border-top: 1px solid #cde8cd; font-size: 10px; color: #1a1a1a; position: relative; z-index: 1; }
    .amt-words strong { color: #2d7a2d; }
    .note-section { padding: 6px 14px 8px; border-top: 1px solid #cde8cd; font-size: 9.5px; color: #444; position: relative; z-index: 1; }
    .footer { display: flex; align-items: flex-end; gap: 0; border-top: 1px solid #cde8cd; position: relative; z-index: 1; }
    .footer-col { flex: 1; padding: 8px 12px 10px; font-size: 9px; color: #444; line-height: 1.7; }
    .footer-col + .footer-col { border-left: 1px solid #cde8cd; }
    .footer-col.center { text-align: center; }
    .footer-col.right { text-align: right; }
    .sign-gap { height: 32px; }
    .sign-line { border-top: 1px solid #111; padding-top: 3px; font-size: 9px; font-weight: 700; color: #111; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
<div class="inv">
  <div class="wm">DUPLICATE</div>
  <div class="inv-title">TAX INVOICE</div>
  
  <div class="header">
    <div class="hdr-left">
      <div class="logo-area">
        <div class="logo-box">${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : 'LOGO'}</div>
        <div>
          <div class="shop-name">${dealer.company_name}</div>
          <div class="shop-tagline">Authorised Fertilizer Dealer</div>
        </div>
      </div>
      <div class="shop-detail">
        <div><strong>${dealer.owner_name}</strong> (Proprietor)</div>
        <div>${dealer.address || ''}, ${dealer.village || ''}, ${dealer.district || ''}</div>
        <div>Mobile: <strong>${dealer.mobile}</strong></div>
        <div>GST: <strong>${dealer.gstin || 'N/A'}</strong> &nbsp;|&nbsp; State: ${dealer.state || ''} &nbsp;|&nbsp; State Code: ${dealer.state_code || ''}</div>
        <div>Fertilizer License No.: <strong>${dealer.fertilizer_license_number || 'N/A'}</strong></div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="inv-meta-row"><span class="lbl">Invoice No.:</span><span class="val">${invoiceNumber}</span></div>
      <div class="inv-meta-row"><span class="lbl">Invoice Date:</span><span class="val">${formatDateForPDF(invoiceDate, 'DD MMM YYYY')} &nbsp;${formatTimeForPDF(invoiceDate)}</span></div>
      <div class="inv-meta-row"><span class="lbl">State:</span><span class="val">${dealer.state || ''} &nbsp;|&nbsp; Code: ${dealer.state_code || ''}</span></div>
      <div class="inv-meta-row"><span class="lbl">Place of Supply:</span><span class="val">${dealer.state || ''}</span></div>
      <div class="credit-badge">● CREDIT SALE</div>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-box">
      <div class="bill-box-title">Bill To (Buyer)</div>
      <div class="buyer-name">${farmer.fullName}</div>
      <div class="buyer-detail">
        Village: ${farmer.village}, Dist: ${farmer.district}<br>
        State: ${dealer.state || ''} &nbsp;|&nbsp; State Code: ${dealer.state_code || ''}<br>
        Mobile: ${farmer.mobile}
      </div>
    </div>
    <div class="bill-box">
      <div class="bill-box-title">Payment Details</div>
      ${isCredit ? `
        <div class="buyer-detail">
          <strong>Payment Mode: Credit</strong><br>
          ${sale.dueDate ? `Due Date: <strong>${formatDateForPDF(new Date(sale.dueDate), 'DD MMM YYYY')}</strong><br>` : ''}
          Advance Paid: <strong>${formatCurrency(sale.paidAmount)}</strong>
        </div>
        <div class="balance-due">Balance Due: ${formatCurrency(sale.balanceDue)}</div>
      ` : `
        <div class="buyer-detail">
          <strong>Payment Mode: ${sale.paymentMode === 'cash' ? 'Cash' : 'UPI'}</strong><br>
          Received in Full — Thank you!
        </div>
      `}
    </div>
  </div>

  <div class="table-wrap">
    <table class="items">
      <thead>
        <tr>
          <th style="width:4%;">Sr.No</th>
          <th class="left" style="width:30%;">Item &amp; Description</th>
          <th style="width:7%;">HSN</th>
          <th style="width:8%;">Pack Size</th>
          <th style="width:6%;">QTY</th>
          <th style="width:9%;">Rate/Item</th>
          <th style="width:11%;">Taxable Value</th>
          <th style="width:8%;">GST</th>
          <th style="width:9%;">Disc ₹</th>
          <th style="width:8%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map((item, idx) => `
          <tr>
            <td class="td-c">${idx + 1}</td>
            <td class="td-l">
              <div class="item-name">${item.itemName}</div>
              <div class="item-sub">Pack: ${item.unit}</div>
            </td>
            <td class="td-c">—</td>
            <td class="td-c">${item.unit}</td>
            <td class="td-c">${item.quantity}</td>
            <td class="td-r">${formatCurrency(item.priceExGst, false)}</td>
            <td class="td-r">${formatCurrency(item.lineTotalExGst, false)}</td>
            <td class="td-c">${formatCurrency(item.lineGstAmount, false)}<br><span style="font-size:8px;">(${item.gstPercent}%)</span></td>
            <td class="td-c">—</td>
            <td class="td-r"><strong>${formatCurrency(item.lineTotalIncGst, false)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="left">SUB TOTAL</td>
          <td></td><td></td>
          <td class="td-c">${sale.items.reduce((sum, item) => sum + item.quantity, 0)} Qty</td>
          <td></td>
          <td class="td-r">${formatCurrency(sale.subtotal - sale.items.reduce((sum, item) => sum + item.lineGstAmount, 0), false)}</td>
          <td class="td-r">${formatCurrency(sale.items.reduce((sum, item) => sum + item.lineGstAmount, 0), false)}</td>
          <td class="td-r">${formatCurrency(sale.discountAmount, false)}</td>
          <td class="td-r">${formatCurrency(sale.finalAmount, false)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="lower">
    <div class="lower-left">
      <div class="section-title">Payment Info</div>
      <div class="detail-row"><span class="dl">Payment Mode:</span><span class="dv">${sale.paymentMode === 'cash' ? 'Cash' : sale.paymentMode === 'upi' ? 'UPI' : 'Credit (Udhaar)'}</span></div>
      ${dealer.upi_id ? `<div class="detail-row"><span class="dl">UPI ID:</span><span class="dv">${dealer.upi_id}</span></div>` : ''}
      <br>
      <div class="section-title">Sold By:</div>
      <div style="font-size:9.5px;color:#444;line-height:1.7;">
        <strong>${dealer.company_name}</strong><br>
        ${dealer.owner_name} (Prop.)<br>
        ${dealer.village || ''}, ${dealer.district || ''}
      </div>
    </div>
    <div class="lower-right">
      <div class="sum-row"><span class="slabel">Taxable Amount</span><span class="svalue">${formatCurrency(sale.subtotal - sale.items.reduce((sum, item) => sum + item.lineGstAmount, 0))}</span></div>
      <div class="sum-row"><span class="slabel">Total Tax (GST)</span><span class="svalue">${formatCurrency(sale.items.reduce((sum, item) => sum + item.lineGstAmount, 0))}</span></div>
      <div class="sum-row"><span class="slabel">Total Discount</span><span class="svalue">- ${formatCurrency(sale.discountAmount)}</span></div>
      <div class="sum-row"><span class="slabel">Round-Off</span><span class="svalue">- ₹0.00</span></div>
      <div class="sum-row total-row">
        <span>Total Payable Amount</span>
        <span class="svalue">${formatCurrency(sale.finalAmount)}</span>
      </div>
      <div class="sum-row"><span class="slabel">Amount Received</span><span class="svalue">${formatCurrency(sale.paidAmount)}</span></div>
      <div class="sum-row"><span class="slabel">Remaining Balance</span><span class="svalue">${formatCurrency(sale.balanceDue)}</span></div>
    </div>
  </div>

  <div class="amt-words">
    <strong>Total Payable Amount:</strong> ${totalInWords}
  </div>

  <div class="note-section">
    <div class="section-title">Note:</div>
    Thank you for your business! Please retain this invoice for your records.
  </div>

  <div class="footer">
    <div class="footer-col">
      <strong>Terms &amp; Conditions:</strong><br>
      1. Goods once sold will not be returned.<br>
      2. Disputes subject to local jurisdiction only.<br>
      3. Please retain this bill for future reference.
    </div>
    <div class="footer-col center">
      Scan &amp; Pay using any UPI App<br>
      <div style="margin:5px auto;width:52px;height:52px;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;font-size:7px;color:#bbb;">UPI QR</div>
      ${dealer.upi_id ? `<span style="font-size:8.5px;color:#555;">${dealer.upi_id}</span>` : ''}
    </div>
    <div class="footer-col right">
      <div style="font-size:9px;">For ${dealer.company_name}</div>
      <div class="sign-gap"></div>
      <div>Signature</div>
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const invoiceType = getInvoiceType(data.sale.items);
  
  // For now, use fertilizer template for all types
  // TODO: Create specialized templates for pesticide and seed
  return generateFertilizerInvoice(data);
}

export function printInvoice(data: InvoiceData) {
  const html = generateInvoiceHTML(data);
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

export function downloadInvoicePDF(data: InvoiceData) {
  const html = generateInvoiceHTML(data);
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
