/**
 * Export Utilities
 * Functions for exporting data to CSV, JSON, and Excel formats
 */

import * as XLSX from 'xlsx';

/**
 * Convert array of objects to CSV string with proper serialization
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) return '';

  // Get headers from first object if not provided
  const columnHeaders = headers || Object.keys(data[0]);

  // Create header row
  const headerRow = columnHeaders.join(',');

  // Create data rows
  const dataRows = data.map((row) => {
    return columnHeaders
      .map((header) => {
        let value = row[header];
        
        // Serialize objects and arrays as JSON strings
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        
        // Convert to string
        value = String(value ?? '');
        
        // Handle values that contain commas, quotes, or newlines
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download data as CSV file with UTF-8 BOM for Excel compatibility
 */
export function downloadCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: string[]
): void {
  const csv = convertToCSV(data, headers);
  // Add UTF-8 BOM for Excel compatibility
  const csvWithBOM = '\uFEFF' + csv;
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download data as Excel file
 */
export function downloadExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  options?: {
    sheetName?: string;
    columnWidths?: Record<string, number>;
  }
): void {
  const { sheetName = 'Sheet1', columnWidths } = options || {};

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths if provided
  if (columnWidths) {
    const wscols = Object.entries(columnWidths).map(([col, width]) => ({ wch: width }));
    ws['!cols'] = wscols;
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Download data as JSON file
 */
export function downloadJSON<T>(data: T, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Format data for export (remove internal fields, format dates, etc.)
 */
export function formatForExport<T extends Record<string, any>>(
  data: T[],
  options?: {
    excludeFields?: string[];
    dateFields?: string[];
    dateFormat?: (date: Date) => string;
  }
): Record<string, any>[] {
  const {
    excludeFields = ['id', 'createdAt', 'updatedAt', 'dealerId'],
    dateFields = [],
    dateFormat = (date: Date) => date.toLocaleDateString('en-IN'),
  } = options || {};

  return data.map((item) => {
    const formatted: Record<string, any> = {};

    Object.keys(item).forEach((key) => {
      // Skip excluded fields
      if (excludeFields.includes(key)) return;

      let value = item[key];

      // Format dates
      if (dateFields.includes(key) && value) {
        try {
          value = dateFormat(new Date(value));
        } catch (error) {
          console.error(`Failed to format date field ${key}:`, error);
        }
      }

      // Convert null to empty string
      if (value === null) {
        value = '';
      }

      formatted[key] = value;
    });

    return formatted;
  });
}

/**
 * Print utility
 */
export function printElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  const printWindow = window.open('', '', 'height=600,width=800');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  printWindow.document.write('<html><head><title>Print</title>');
  printWindow.document.write('<style>');
  printWindow.document.write(`
    body { font-family: Arial, sans-serif; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    @media print {
      @page { margin: 1cm; }
    }
  `);
  printWindow.document.write('</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(element.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string = 'csv'): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0]
    .replace('T', '_');
  return `${prefix}_${timestamp}.${extension}`;
}
