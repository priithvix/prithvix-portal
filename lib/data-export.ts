import type { Farmer, Sale, InventoryItem, Visit } from '@/constants/types';

function csvEscape(value: unknown): string {
  const t = String(value ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function rowsToCsv(headers: string[], rows: (string | number | boolean | undefined)[][]): string {
  const line = (cols: unknown[]) => cols.map(csvEscape).join(',');
  return [line(headers), ...rows.map((r) => line(r))].join('\n');
}

export function buildFarmersCsv(farmers: Farmer[]): string {
  const headers = [
    'Name',
    'Mobile',
    'Village',
    'Taluka',
    'District',
    'Crop Cycles',
    'Aadhaar',
    'Created At',
  ];
  const rows = farmers.map((f) => [
    f.fullName,
    f.mobile,
    f.village,
    f.taluka,
    f.district,
    Array.isArray(f.cropCycle) ? f.cropCycle.join('; ') : '',
    f.aadhaar ?? '',
    f.createdAt,
  ]);
  return rowsToCsv(headers, rows);
}

export function buildSalesCsv(
  sales: Sale[],
  farmerNameById: Map<string, string>
): string {
  const headers = [
    'Date',
    'Sale ID',
    'Farmer Name',
    'Total Amount',
    'Payment Mode',
    'GST Amount',
  ];
  const gstAmount = (s: Sale) =>
    s.items.reduce((sum, it) => sum + (it.lineGstAmount ?? 0), 0);
  const rows = [...sales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((s) => [
      s.createdAt,
      s.id,
      farmerNameById.get(s.farmerId) ?? s.farmerId,
      s.finalAmount,
      s.paymentMode,
      gstAmount(s),
    ]);
  return rowsToCsv(headers, rows);
}

export function buildInventoryCsv(items: InventoryItem[]): string {
  const headers = [
    'Product Name',
    'Company',
    'Category',
    'Current Stock',
    'Unit',
    'Reorder Level',
    'Cost Price',
    'Sale Price',
  ];
  const rows = items.map((i) => [
    i.productName ?? i.name,
    i.companyName ?? '',
    i.category,
    i.stock,
    i.unit,
    i.reorderLevel,
    i.costPrice ?? '',
    i.sellingPrice ?? i.realizedPriceExGst ?? '',
  ]);
  return rowsToCsv(headers, rows);
}

export function buildBackupJson(payload: {
  farmers: Farmer[];
  sales: Sale[];
  items: InventoryItem[];
  visits: Visit[];
  exportedAt: string;
}): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: payload.exportedAt,
      farmers: payload.farmers,
      sales: payload.sales,
      inventory: payload.items,
      visits: payload.visits,
    },
    null,
    2
  );
}

export function triggerDownload(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
