/**
 * Utility functions for PDF generation
 */

/**
 * Convert a number to Indian number words
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertBelowThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertBelowThousand(n % 100) : '');
  };
  
  let intPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - intPart) * 100);
  
  let result = '';
  
  if (intPart >= 10000000) { // Crore
    result += convertBelowThousand(Math.floor(intPart / 10000000)) + ' Crore ';
    intPart %= 10000000;
  }
  if (intPart >= 100000) { // Lakh
    result += convertBelowThousand(Math.floor(intPart / 100000)) + ' Lakh ';
    intPart %= 100000;
  }
  if (intPart >= 1000) { // Thousand
    result += convertBelowThousand(Math.floor(intPart / 1000)) + ' Thousand ';
    intPart %= 1000;
  }
  if (intPart > 0) {
    result += convertBelowThousand(intPart);
  }
  
  result = result.trim() + ' Rupees';
  
  if (decimalPart > 0) {
    result += ' and ' + convertBelowThousand(decimalPart) + ' Paise';
  }
  
  result += ' Only';
  
  return (num < 0 ? 'Minus ' : '') + result;
}

/**
 * Format date for invoices and compliance reports
 */
export function formatDateForPDF(date: Date | string, format: 'DD/MM/YYYY' | 'DD MMM YYYY' | 'DD MMMM YYYY' = 'DD/MM/YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.getMonth();
  const year = d.getFullYear();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  switch (format) {
    case 'DD MMM YYYY':
      return `${day} ${monthShort[month]} ${year}`;
    case 'DD MMMM YYYY':
      return `${day} ${monthNames[month]} ${year}`;
    default:
      return `${day}/${String(month + 1).padStart(2, '0')}/${year}`;
  }
}

/**
 * Format time for invoices
 */
export function formatTimeForPDF(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate GST components
 */
export interface GSTBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
}

export function calculateGST(
  amount: number,
  gstPercent: number,
  isIntraState: boolean = true
): GSTBreakdown {
  const taxableAmount = amount;
  const totalTax = (taxableAmount * gstPercent) / 100;
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  if (isIntraState) {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  } else {
    igst = totalTax;
  }
  
  return {
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount: taxableAmount + totalTax,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, showSymbol: boolean = true): string {
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Generate invoice number with proper formatting
 */
export function generateInvoiceNumber(
  prefix: string,
  financialYear: string,
  sequenceNumber: number
): string {
  return `${prefix}/${financialYear}/${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Get financial year string (YYYY-YY format)
 */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  if (month >= 3) { // April onwards
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}

/**
 * Check if expiry date is expired or expiring soon
 */
export function checkExpiry(expiryDate: string | Date | undefined): 'valid' | 'expiring_soon' | 'expired' {
  if (!expiryDate) return 'valid';
  
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 60) return 'expiring_soon';
  return 'valid';
}

/**
 * Format month/year string (for expiry dates, germination validity)
 */
export function formatMonthYear(date: string | Date | undefined): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${month}/${year}`;
}
