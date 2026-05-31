import { parse } from 'date-fns';

export type Gstr2bParsedRecord = {
  supplier_gstin: string;
  supplier_name: string | null;
  invoice_number: string;
  invoice_date: string | null;
  invoice_type: string;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total_tax: number;
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/** Normalise GSTR-2B portal JSON (structure varies by download version). */
export function parseGstr2bJson(json: unknown): Gstr2bParsedRecord[] {
  const records: Gstr2bParsedRecord[] = [];
  const root = json as Record<string, unknown> | null;

  const tryB2b = (b2b: unknown) => {
    if (!Array.isArray(b2b)) return;
    for (const supplier of b2b) {
      const s = supplier as Record<string, unknown>;
      const ctin = String(s.ctin ?? s.ctin_fr ?? s.ctinFr ?? '').trim();
      const trdnm =
        (s.trdnm as string) ?? (s.tradeName as string) ?? (s.suppName as string) ?? null;
      const invList = (s.inv as unknown[]) ?? (s.invoices as unknown[]) ?? [];
      for (const invRaw of invList) {
        const inv = invRaw as Record<string, unknown>;
        const inum = String(inv.inum ?? inv.invoice_number ?? inv.inum_original ?? '').trim();
        const dtRaw = String(inv.dt ?? inv.invoice_date ?? inv.idt ?? '').trim();
        let invoiceDate: string | null = null;
        if (dtRaw) {
          const tryDmy = parse(dtRaw, 'dd-MM-yyyy', new Date());
          if (!Number.isNaN(tryDmy.getTime())) {
            invoiceDate = tryDmy.toISOString().slice(0, 10);
          } else {
            const tryIso = new Date(dtRaw);
            if (!Number.isNaN(tryIso.getTime())) invoiceDate = tryIso.toISOString().slice(0, 10);
          }
        }
        const itemList = (inv.items as unknown[]) ?? (inv.itms as unknown[]) ?? [];
        if (itemList.length === 0) {
          const txval = num(inv.val ?? inv.txval ?? inv.tx_val);
          const ig = num(inv.iamt ?? inv.igst);
          const cg = num(inv.camt ?? inv.cgst);
          const sg = num(inv.samt ?? inv.sgst);
          const cs = num(inv.csamt ?? inv.cess);
          const tt = ig + cg + sg + cs;
          if (ctin && inum) {
            records.push({
              supplier_gstin: ctin,
              supplier_name: trdnm,
              invoice_number: inum,
              invoice_date: invoiceDate,
              invoice_type: 'B2B',
              taxable_value: txval,
              igst: ig,
              cgst: cg,
              sgst: sg,
              cess: cs,
              total_tax: tt || num(inv.tax),
            });
          }
          continue;
        }
        for (const itemRaw of itemList) {
          const item =
            typeof itemRaw === 'object' && itemRaw !== null
              ? (itemRaw as Record<string, unknown>)
              : {};
          const det = (item.itm_det as Record<string, unknown> | undefined) ?? item;
          const txval = num(det.txval ?? item.txval);
          const ig = num(det.iamt ?? det.igst ?? item.igst ?? item.iamt);
          const cg = num(det.camt ?? det.cgst ?? item.cgst ?? item.camt);
          const sg = num(det.samt ?? det.sgst ?? item.sgst ?? item.samt);
          const cs = num(det.csamt ?? det.cess ?? item.cess);
          const tt = ig + cg + sg + cs;
          if (ctin && inum) {
            records.push({
              supplier_gstin: ctin,
              supplier_name: trdnm,
              invoice_number: inum,
              invoice_date: invoiceDate,
              invoice_type: 'B2B',
              taxable_value: txval,
              igst: ig,
              cgst: cg,
              sgst: sg,
              cess: cs,
              total_tax: tt,
            });
          }
        }
      }
    }
  };

  const data = root?.data as Record<string, unknown> | undefined;
  const docdata =
    (data?.docdata as Record<string, unknown> | undefined) ??
    (root?.docdata as Record<string, unknown> | undefined);
  if (docdata) {
    tryB2b(docdata.b2b);
    tryB2b(docdata.cdnr);
  }
  tryB2b(root?.b2b);

  return records;
}
