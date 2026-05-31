import * as XLSX from 'xlsx';

export function addSheetToWorkbook(wb: XLSX.WorkBook, sheetName: string, data: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ '': '—' }]);
  const keys = data[0] ? Object.keys(data[0]) : [];
  ws['!cols'] = keys.map((k) => ({ wch: Math.max(k.length, 15) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function workbookFromSheets(sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    addSheetToWorkbook(wb, s.name, s.rows);
  }
  return wb;
}
