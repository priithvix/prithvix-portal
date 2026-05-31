import { format } from 'date-fns';
import type { Gstr1RecordRow } from '@/lib/supabase/gst';

export function periodToPortalFp(period: string): string {
  const [mm, yyyy] = period.split('-');
  if (!mm || !yyyy) return '';
  return `${mm.padStart(2, '0')}${yyyy}`;
}

export type Gstr1ExportInput = {
  gstin: string;
  period: string;
  records: Gstr1RecordRow[];
};

/** Build GST portal–oriented JSON; sections best-effort from book rows. */
export function buildGstr1PortalJson(input: Gstr1ExportInput): Record<string, unknown> {
  const fp = periodToPortalFp(input.period);
  const b2b = input.records
    .filter((r) => r.invoice_type === 'B2B' && r.customer_gstin)
    .reduce<
      {
        ctin: string;
        inv: {
          inum: string;
          idt: string;
          val: number;
          pos: string;
          rchrg: string;
          itms: { num: number; itm_det: Record<string, number> }[];
        }[];
      }[]
    >((acc, r) => {
      const ctin = String(r.customer_gstin ?? '').trim();
      if (!ctin) return acc;
      let bucket = acc.find((x) => x.ctin === ctin);
      if (!bucket) {
        bucket = { ctin, inv: [] };
        acc.push(bucket);
      }
      const idt = format(new Date(r.invoice_date), 'dd-MM-yyyy');
      const rt = Number(r.gst_rate) || 0;
      bucket.inv.push({
        inum: r.invoice_number,
        idt,
        val: Number(r.invoice_value),
        pos: String(r.customer_state ?? ctin.slice(0, 2)),
        rchrg: 'N',
        itms: [
          {
            num: 1,
            itm_det: {
              txval: Number(r.taxable_value),
              rt,
              iamt: Number(r.igst),
              camt: Number(r.cgst),
              samt: Number(r.sgst),
              csamt: Number(r.cess),
            },
          },
        ],
      });
      return acc;
    }, []);

  const b2cSmall = input.records.filter((r) => r.invoice_type === 'B2C_SMALL');
  const b2csMap = new Map<
    string,
    { sply_ty: string; pos: string; txval: number; rt: number; iamt: number; camt: number; samt: number }
  >();
  for (const r of b2cSmall) {
    const pos = String(r.customer_state ?? '96').trim() || '96';
    const rt = Number(r.gst_rate) || 0;
    const key = `${pos}|${rt}`;
    const cur = b2csMap.get(key) ?? {
      sply_ty: r.supply_type === 'INTER' ? 'INTER' : 'INTRA',
      pos,
      txval: 0,
      rt,
      iamt: 0,
      camt: 0,
      samt: 0,
    };
    cur.txval += Number(r.taxable_value);
    cur.iamt += Number(r.igst);
    cur.camt += Number(r.cgst);
    cur.samt += Number(r.sgst);
    b2csMap.set(key, cur);
  }
  const b2cs = [...b2csMap.values()].map((v) => ({
    sply_ty: v.sply_ty,
    pos: v.pos,
    rt: v.rt,
    txval: Math.round(v.txval * 100) / 100,
    iamt: Math.round(v.iamt * 100) / 100,
    camt: Math.round(v.camt * 100) / 100,
    samt: Math.round(v.samt * 100) / 100,
  }));

  return {
    gstin: input.gstin,
    fp,
    version: 'GSTPrithviX',
    b2b,
    b2cs,
    cdnr: [],
  };
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
