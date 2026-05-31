import { supabase } from '@/lib/supabase/client';

export type CropCycleRow = {
  id: string;
  dealer_id: string;
  farmer_id: string;
  crop_name: string;
  season: string;
  sowing_date: string | null;
  expected_harvest: string;
  actual_harvest: string | null;
  plot_area_acres: number | null;
  plot_location: string | null;
  status: string;
  notes: string | null;
};

export async function listCropCycles(dealerRowId: string, season?: string | null): Promise<CropCycleRow[]> {
  let q = supabase.from('crop_cycles').select('*').eq('dealer_id', dealerRowId).order('expected_harvest');
  if (season) q = q.eq('season', season);
  const { data, error } = await q;
  if (error) {
    console.warn('[crop_cycles]', error.message);
    return [];
  }
  return (data ?? []) as CropCycleRow[];
}

export async function upsertCropCycle(
  dealerRowId: string,
  row: Partial<CropCycleRow> & Pick<CropCycleRow, 'farmer_id' | 'crop_name' | 'season' | 'expected_harvest'>
): Promise<void> {
  const payload = {
    ...row,
    dealer_id: dealerRowId,
    updated_at: new Date().toISOString(),
  };
  if (row.id) {
    const { error } = await supabase.from('crop_cycles').update(payload).eq('id', row.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('crop_cycles').insert(payload);
    if (error) throw new Error(error.message);
  }
}

export async function markCropHarvested(id: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('crop_cycles')
    .update({ status: 'HARVESTED', actual_harvest: today, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
