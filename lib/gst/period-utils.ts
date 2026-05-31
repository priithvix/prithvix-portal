import { getFinancialYearLabel } from '@/lib/tally-format';

/** Current return period MM-YYYY (calendar month). */
export function currentReturnPeriod(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/** Indian FY label from MM-YYYY period string. */
export function financialYearLabelFromPeriod(period: string): string {
  const [mmRaw, yyyyRaw] = period.split('-');
  const m = Number(mmRaw);
  const y = Number(yyyyRaw);
  if (!m || !y) return getFinancialYearLabel(new Date());
  return m >= 4
    ? `${y}-${String((y + 1) % 100).padStart(2, '0')}`
    : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

/** FY e.g. 2025-26 → ordered periods 04-2025 … 03-2026 */
export function periodsInFinancialYear(fyLabel: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(fyLabel.trim());
  if (!m) return [];
  const yStart = Number(m[1]);
  const y2Suffix = Number(m[2]);
  const yEnd = Math.floor(yStart / 100) * 100 + y2Suffix;
  const out: string[] = [];
  for (let mo = 4; mo <= 12; mo++) out.push(`${String(mo).padStart(2, '0')}-${yStart}`);
  for (let mo = 1; mo <= 3; mo++) out.push(`${String(mo).padStart(2, '0')}-${yEnd}`);
  return out;
}

/** Short pill label e.g. 05-2026 → May-26 */
export function periodToShortLabel(period: string): string {
  const [mm, yyyy] = period.split('-');
  if (!mm || !yyyy) return period;
  const d = new Date(Number(yyyy), Number(mm) - 1, 1);
  const mon = d.toLocaleString('en-IN', { month: 'short' });
  return `${mon}-${String(yyyy).slice(-2)}`;
}
