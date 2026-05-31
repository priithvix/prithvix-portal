import { format } from 'date-fns';
import type { Dealer } from '@/contexts/AuthContext';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface DailyCloseData {
  reportDate: string;
  cashSales: number;
  digitalSales: number;
  creditSales: number;
  creditCollected: number;
  totalSales: number;
  totalCash: number;
  expenses: number;
  safeDeposit: number;
  cashInHand: number;
  notes?: string;
  grossRevenue: number;
  totalDiscount: number;
  totalProfit: number;
  transactionCount: number;
  farmerCount: number;
  soldItems: {
    itemName: string;
    unit: string;
    totalQty: number;
    pricePerUnit: number;
    totalAmount: number;
    gstPercent: number;
  }[];
  daySales: {
    id: string;
    farmerName: string;
    paymentMode: string;
    finalAmount: number;
    balanceDue: number;
    itemCount: number;
    createdAt: string;
  }[];
}

export function generateDailyCloseHTML(
  data: DailyCloseData,
  dealer: Dealer
): string {
  const fmt = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const date = new Date(data.reportDate);
  const licenseBits = [
    dealer.fertilizer_license_number &&
      `Fert: ${dealer.fertilizer_license_number}`,
    dealer.pesticide_license_number &&
      `PEST: ${dealer.pesticide_license_number}`,
    dealer.seed_license_number && `Seed: ${dealer.seed_license_number}`,
  ].filter(Boolean);
  const licenseLine = licenseBits.length
    ? `| License: ${licenseBits.join(' · ')}`
    : '';

  const itemsRows =
    data.soldItems.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:#666;padding:10px">No items recorded for this date</td></tr>`
      : data.soldItems
          .map(
            (item) => `
        <tr>
          <td>${escHtml(item.itemName)}</td>
          <td class="right">${item.totalQty}</td>
          <td>${escHtml(item.unit)}</td>
          <td class="right">₹${item.pricePerUnit.toLocaleString('en-IN')}</td>
          <td class="right">${item.gstPercent}%</td>
          <td class="right"><strong>₹${item.totalAmount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          })}</strong></td>
        </tr>`
          )
          .join('');

  const txnRows = data.daySales
    .map(
      (s) => `
        <tr>
          <td style="font-family:monospace">${escHtml(s.id.slice(-8))}</td>
          <td>${escHtml(s.farmerName)}</td>
          <td class="right">${s.itemCount}</td>
          <td style="text-transform:uppercase">${escHtml(s.paymentMode)}</td>
          <td class="right"><strong>₹${s.finalAmount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          })}</strong></td>
          <td class="right" style="color:${
            s.balanceDue > 0 ? '#dc2626' : '#16a34a'
          }">${
            s.balanceDue > 0
              ? '-₹' +
                s.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })
              : 'Paid'
          }</td>
        </tr>`
    )
    .join('');

  const notesBlock = data.notes
    ? `<div class="section"><div class="section-title">Notes</div><p style="font-size:11px;color:#374151">${escHtml(
        data.notes
      )}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Daily Close - ${format(date, 'dd MMM yyyy')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20mm; }
    
    .header { border-bottom: 2px solid #0F7A3E; padding-bottom: 10px; margin-bottom: 16px; }
    .shop-name { font-size: 18px; font-weight: bold; color: #0F7A3E; }
    .shop-sub { font-size: 10px; color: #555; margin-top: 2px; }
    .report-title { text-align: center; font-size: 15px; font-weight: bold; margin: 12px 0 2px; letter-spacing: 1px; text-transform: uppercase; }
    .report-date { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
    
    .summary-row { display: flex; gap: 0; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 16px; overflow: hidden; }
    .summary-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #ddd; }
    .summary-cell:last-child { border-right: none; }
    .summary-label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-size: 14px; font-weight: bold; color: #0F7A3E; margin-top: 2px; }
    .summary-value.red { color: #dc2626; }
    .summary-value.black { color: #111; }
    
    .section { margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: bold; color: #0F7A3E; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    
    table { width: 100%; border-collapse: collapse; }
    table thead tr { background: #f3f4f6; }
    table th { padding: 6px 8px; text-align: left; font-size: 10px; font-weight: bold; color: #374151; border: 1px solid #d1d5db; }
    table th.right { text-align: right; }
    table td { padding: 5px 8px; font-size: 11px; border: 1px solid #d1d5db; }
    table td.right { text-align: right; }
    table tfoot tr { background: #f9fafb; }
    table tfoot td { padding: 6px 8px; font-weight: bold; border: 1px solid #d1d5db; }
    table tfoot td.total { text-align: right; color: #0F7A3E; font-size: 12px; }
    table tbody tr:nth-child(even) { background: #fafafa; }
    
    .cash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .cash-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 10px; }
    .cash-box-title { font-size: 10px; font-weight: bold; color: #0F7A3E; margin-bottom: 6px; text-transform: uppercase; }
    .cash-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
    .cash-row.total { border-top: 1px solid #0F7A3E; padding-top: 4px; margin-top: 4px; font-weight: bold; font-size: 11px; color: #0F7A3E; }
    .cash-row.minus { color: #dc2626; }
    
    .txn-table th, .txn-table td { font-size: 10px; }
    
    .footer { margin-top: 20px; border-top: 1px solid #d1d5db; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left { font-size: 9px; color: #888; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #333; width: 150px; margin: 30px auto 4px; }
    .signature-name { font-size: 10px; font-weight: bold; }
    .signature-role { font-size: 9px; color: #666; }
    
    @media print {
      body { padding: 10mm; }
      @page { margin: 10mm; size: A4; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="shop-name">${escHtml(dealer.company_name)}</div>
    <div class="shop-sub">${escHtml(
      [dealer.address, dealer.village, dealer.taluka, dealer.district]
        .filter(Boolean)
        .join(', ')
    )} - ${escHtml(dealer.pin_code || '')}</div>
    <div class="shop-sub">Mobile: ${escHtml(dealer.mobile || '')} ${licenseLine}</div>
  </div>
  
  <div class="report-title">Daily Closing Report</div>
  <div class="report-date">${format(date, 'EEEE, dd MMMM yyyy')} &nbsp;|&nbsp; ${
    data.transactionCount
  } transactions &nbsp;|&nbsp; ${data.farmerCount} farmers</div>

  <div class="summary-row">
    <div class="summary-cell">
      <div class="summary-label">Total Sales</div>
      <div class="summary-value black">${fmt(data.totalSales)}</div>
    </div>
    <div class="summary-cell">
      <div class="summary-label">Cash Sales</div>
      <div class="summary-value black">${fmt(data.cashSales)}</div>
    </div>
    <div class="summary-cell">
      <div class="summary-label">UPI Sales</div>
      <div class="summary-value black">${fmt(data.digitalSales)}</div>
    </div>
    <div class="summary-cell">
      <div class="summary-label">Credit Sales</div>
      <div class="summary-value black">${fmt(data.creditSales)}</div>
    </div>
    <div class="summary-cell">
      <div class="summary-label">Est. Profit</div>
      <div class="summary-value">${fmt(data.totalProfit)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items Sold</div>
    <table>
      <thead>
        <tr>
          <th style="width:35%">Item Name</th>
          <th class="right" style="width:12%">Qty</th>
          <th style="width:10%">Unit</th>
          <th class="right" style="width:18%">Rate / Unit</th>
          <th class="right" style="width:10%">GST%</th>
          <th class="right" style="width:15%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5">TOTAL ITEMS SOLD (${data.soldItems.length} products)</td>
          <td class="total">${fmt(data.totalSales)}</td>
        </tr>
        <tr>
          <td colspan="5" style="font-size:10px;color:#555">Gross Revenue: ${fmt(
            data.grossRevenue
          )} &nbsp;|&nbsp; Discount Given: -₹${data.totalDiscount.toLocaleString(
    'en-IN',
    { minimumFractionDigits: 2 }
  )}</td>
          <td class="total" style="color:#555;font-size:10px">Net: ${fmt(
            data.totalSales
          )}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="cash-grid">
    <div class="cash-box">
      <div class="cash-box-title">Cash Reconciliation</div>
      <div class="cash-row"><span>Cash Sales</span><span>${fmt(
        data.cashSales
      )}</span></div>
      <div class="cash-row"><span>+ Credit Collected</span><span>${fmt(
        data.creditCollected
      )}</span></div>
      <div class="cash-row minus"><span>- Expenses</span><span>-${fmt(
        data.expenses
      )}</span></div>
      <div class="cash-row minus"><span>- Safe Deposit</span><span>-${fmt(
        data.safeDeposit
      )}</span></div>
      <div class="cash-row total"><span>Cash in Hand</span><span>${fmt(
        data.cashInHand
      )}</span></div>
    </div>
    <div class="cash-box">
      <div class="cash-box-title">Payment Mix</div>
      <div class="cash-row"><span>Cash</span><span>${fmt(data.cashSales)} (${
    data.totalSales > 0 ? ((data.cashSales / data.totalSales) * 100).toFixed(0) : 0
  }%)</span></div>
      <div class="cash-row"><span>UPI / Digital</span><span>${fmt(
        data.digitalSales
      )} (${
    data.totalSales > 0
      ? ((data.digitalSales / data.totalSales) * 100).toFixed(0)
      : 0
  }%)</span></div>
      <div class="cash-row"><span>Credit</span><span>${fmt(data.creditSales)} (${
    data.totalSales > 0
      ? ((data.creditSales / data.totalSales) * 100).toFixed(0)
      : 0
  }%)</span></div>
      <div class="cash-row total"><span>Total Billed</span><span>${fmt(
        data.totalSales
      )}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Transaction Detail</div>
    <table class="txn-table">
      <thead>
        <tr>
          <th>Invoice ID</th>
          <th>Farmer</th>
          <th class="right">Items</th>
          <th>Payment</th>
          <th class="right">Amount</th>
          <th class="right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${txnRows || `<tr><td colspan="6" style="text-align:center;color:#666">No transactions</td></tr>`}
      </tbody>
    </table>
  </div>

  ${notesBlock}

  <div class="footer">
    <div class="footer-left">
      <p>Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
      <p>PrithviX — Agricultural Input Management System</p>
      <p>This is a computer-generated document.</p>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-name">${escHtml(dealer.owner_name)}</div>
      <div class="signature-role">Authorized Signatory</div>
    </div>
  </div>

</body>
</html>`;
}

export function printDailyClose(data: DailyCloseData, dealer: Dealer): void {
  const html = generateDailyCloseHTML(data, dealer);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Please allow popups to generate the report');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}
