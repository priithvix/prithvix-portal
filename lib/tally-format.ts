/** Tally Mode — Indian amounts and DD-MMM-YYYY dates (inside `.tally-scope`). */

export function formatTallyAmount(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** e.g. 08-May-2026 */
export function formatTallyDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\s/g, '-');
}

/** India FY: April → March. May 2026 → 2026-27; Mar 2026 → 2025-26 */
export function getFinancialYearLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (m >= 3) {
    return `${y}-${String(y + 1).slice(-2)}`;
  }
  return `${y - 1}-${String(y).slice(-2)}`;
}

export function parseTallyDateInput(raw: string): Date | null {
  const s = raw.trim();
  const dmy = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (dmy) {
    const d = new Date(`${dmy[1]} ${dmy[2]} ${dmy[3]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (iso) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Taxable amount * rate/100; line total = taxable + gst */
export function lineGstAmount(taxable: number, gstRatePct: number): number {
  return roundMoney((taxable * gstRatePct) / 100);
}

export function splitGstForLine(
  taxable: number,
  gstRatePct: number,
  intraState: boolean
): { cgst: number; sgst: number; igst: number; gst: number } {
  const gst = lineGstAmount(taxable, gstRatePct);
  if (intraState) {
    const half = roundMoney(gst / 2);
    return { cgst: half, sgst: roundMoney(gst - half), igst: 0, gst };
  }
  return { cgst: 0, sgst: 0, igst: gst, gst };
}
