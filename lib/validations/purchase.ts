import * as z from 'zod';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  gstin: z.string().optional(),
  state_code: z.string().optional(),
  mobile: z.string().optional(),
  credit_days: z.coerce.number().min(0).max(365).default(30),
  credit_limit: z.coerce.number().min(0).default(0),
  opening_balance: z.coerce.number().default(0),
  balance_type: z.enum(['DR', 'CR']).default('CR'),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  bank_ifsc: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  pan: z.string().optional(),
  email: z.string().optional(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export function validateGstin(gstin: string | undefined): boolean {
  const g = (gstin ?? '').trim().toUpperCase();
  return g === '' || GSTIN_RE.test(g);
}

export function validateSupplierMobile(mobile: string | undefined): boolean {
  const m = (mobile ?? '').trim();
  return m === '' || /^[6-9]\d{9}$/.test(m);
}

export function validateSupplierForm(
  v: SupplierFormValues
): { ok: true; data: SupplierFormValues } | { ok: false; message: string } {
  const base = supplierSchema.safeParse(v);
  if (!base.success) return { ok: false, message: base.error.issues[0]?.message ?? 'Invalid' };
  if (!validateGstin(base.data.gstin)) return { ok: false, message: 'Invalid GSTIN' };
  const sc = (base.data.state_code ?? '').trim();
  if (sc !== '' && sc.length !== 2) return { ok: false, message: 'State code must be 2 digits' };
  if (!validateSupplierMobile(base.data.mobile)) return { ok: false, message: 'Invalid mobile' };
  return { ok: true, data: base.data };
}
