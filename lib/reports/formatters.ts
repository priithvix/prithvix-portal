/** Indian grouping, accounting negatives, percent arrows (Reports & MIS). */

export function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtRs(n: number): string {
  return `₹${fmt(n)}`;
}

export function fmtAcc(n: number): string {
  return n < 0 ? `(${fmt(Math.abs(n))})` : fmt(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const prefix = n >= 0 ? '▲ ' : '▼ ';
  return prefix + Math.abs(n).toFixed(1) + '%';
}

/** DD-MMM-YYYY */
export function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\s/g, '-');
}

/** India FY label e.g. Apr 2026 → 2026-27 */
export function getFY(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

export function fyDates(fy: string): { start: Date; end: Date } {
  const startYear = parseInt(fy.split('-')[0] ?? '0', 10);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31),
  };
}

export function listFYOptions(): string[] {
  const cur = new Date().getFullYear();
  const opts: string[] = [];
  for (let y = cur + 1; y >= cur - 8; y--) {
    opts.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return opts;
}
