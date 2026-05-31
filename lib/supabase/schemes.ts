import { supabase } from '@/lib/supabase/client';

export type AgriSchemeRow = {
  id: string;
  scheme_name: string;
  scheme_type: string;
  description: string | null;
  benefit_type: string | null;
  benefit_amount: number | null;
  deadline_date: string | null;
  is_active: boolean | null;
  dealer_id: string | null;
};

export async function listActiveSchemes(dealerRowId: string): Promise<AgriSchemeRow[]> {
  const { data, error } = await supabase
    .from('agri_schemes')
    .select('*')
    .eq('is_active', true)
    .or(`dealer_id.eq.${dealerRowId},dealer_id.is.null`)
    .order('scheme_name');
  if (error) {
    console.warn('[schemes]', error.message);
    return [];
  }
  return (data ?? []) as AgriSchemeRow[];
}

export async function countEnrollmentsByScheme(dealerRowId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('farmer_scheme_enrollments')
    .select('scheme_id')
    .eq('dealer_id', dealerRowId);
  if (error) {
    console.warn('[schemes enroll]', error.message);
    return new Map();
  }
  const m = new Map<string, number>();
  for (const r of data ?? []) {
    const sid = String((r as { scheme_id: string }).scheme_id);
    m.set(sid, (m.get(sid) ?? 0) + 1);
  }
  return m;
}

export async function enrollFarmersBulk(
  dealerRowId: string,
  schemeId: string,
  farmerIds: string[],
  status = 'ENROLLED'
): Promise<void> {
  for (const farmer_id of farmerIds) {
    const { error } = await supabase.from('farmer_scheme_enrollments').upsert(
      {
        dealer_id: dealerRowId,
        farmer_id,
        scheme_id: schemeId,
        status,
      },
      { onConflict: 'farmer_id,scheme_id' }
    );
    if (error) throw new Error(error.message);
  }
}

export async function updateEnrollmentStatus(enrollmentId: string, status: string): Promise<void> {
  const { error } = await supabase.from('farmer_scheme_enrollments').update({ status }).eq('id', enrollmentId);
  if (error) throw new Error(error.message);
}

export async function listEnrollmentsForFarmer(farmerId: string): Promise<
  {
    id: string;
    scheme_id: string;
    status: string;
    enrollment_date: string | null;
    agri_schemes: { scheme_name: string; scheme_type: string } | null;
  }[]
> {
  const { data, error } = await supabase
    .from('farmer_scheme_enrollments')
    .select('id, scheme_id, status, enrollment_date, agri_schemes(scheme_name, scheme_type)')
    .eq('farmer_id', farmerId);
  if (error) {
    console.warn('[farmer schemes]', error.message);
    return [];
  }
  type Row = {
    id: string;
    scheme_id: string;
    status: string;
    enrollment_date: string | null;
    agri_schemes: { scheme_name: string; scheme_type: string }[] | { scheme_name: string; scheme_type: string } | null;
  };
  return ((data ?? []) as Row[]).map((row) => {
    const nested = row.agri_schemes;
    const agri =
      nested == null
        ? null
        : Array.isArray(nested)
          ? (nested[0] ?? null)
          : nested;
    return {
      id: row.id,
      scheme_id: row.scheme_id,
      status: row.status,
      enrollment_date: row.enrollment_date,
      agri_schemes: agri,
    };
  });
}
