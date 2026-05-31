import type { Gstr3bSummaryRow } from '@/lib/supabase/gst';
import { periodToPortalFp } from '@/lib/gst/gstr1-json';

export function buildGstr3bPortalJson(gstin: string, period: string, row: Gstr3bSummaryRow): Record<string, unknown> {
  const fp = periodToPortalFp(period);
  return {
    gstin,
    fp,
    version: 'GSTPrithviX',
    sup_details: {
      osup_det: {
        txval: row.taxable_outward,
        iamt: row.tax_outward_igst,
        camt: row.tax_outward_cgst,
        samt: row.tax_outward_sgst,
      },
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'OTH',
          iamt: row.itc_igst,
          camt: row.itc_cgst,
          samt: row.itc_sgst,
        },
      ],
    },
    inward_sup: {
      isup_details: [],
    },
    intr_ltflpaid: {
      intr_details: {
        iamt: row.interest_paid,
        camt: 0,
        samt: 0,
        csamt: 0,
      },
    },
    tax_pmt: {
      pdcash: [
        { liab_ldg: 'IGST', trans_typ: 'TP', ipd: row.cash_paid_igst },
        { liab_ldg: 'CGST', trans_typ: 'TP', cpd: row.cash_paid_cgst },
        { liab_ldg: 'SGST', trans_typ: 'TP', spd: row.cash_paid_sgst },
      ],
    },
  };
}
