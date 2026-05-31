/**
 * Format number as Indian Rupees
 */
export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 0 
  }).format(n);

/**
 * Format large numbers in compact notation (e.g., 1,23,456 → "1.2L")
 */
export const formatCompact = (n: number) =>
  new Intl.NumberFormat('en-IN', { 
    notation: 'compact', 
    maximumFractionDigits: 1 
  }).format(n);

/**
 * Format number with Indian number system grouping
 */
export const formatNumber = (n: number) =>
  new Intl.NumberFormat('en-IN').format(n);
