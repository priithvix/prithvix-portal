/** Common agri HSN descriptions for GST screens (portal codes). */
export const AGRI_HSN: Record<string, string> = {
  '31021000': 'Urea',
  '31053000': 'Diammonium Phosphate (DAP)',
  '31052000': 'NPK Complex',
  '10011100': 'Durum Wheat Seed',
  '10059010': 'Hybrid Maize Seed',
  '38089199': 'Pesticides - Other',
  '38089210': 'Herbicides',
  '38089310': 'Fungicides',
};

export function describeHsn(code: string | null | undefined): string {
  const c = (code ?? '').trim() || '0000';
  return AGRI_HSN[c] ?? '—';
}
