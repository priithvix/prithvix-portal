import { supabase } from '@/lib/supabase/client';

export type ProductBatchRow = {
  id: string;
  dealer_id: string;
  product_id: string;
  batch_number: string;
  manufacture_date: string | null;
  expiry_date: string;
  quantity_received: number;
  quantity_remaining: number;
  grn_id: string | null;
  supplier_id: string | null;
  cost_price: number | null;
  product_master?: { product_name?: string | null; hsn_code?: string | null } | null;
};

export async function listProductBatches(dealerRowId: string): Promise<ProductBatchRow[]> {
  const { data, error } = await supabase
    .from('product_batches')
    .select('*, product_master(product_name, hsn_code)')
    .eq('dealer_id', dealerRowId)
    .order('expiry_date');
  if (error) {
    console.warn('[batches]', error.message);
    return [];
  }
  return (data ?? []) as ProductBatchRow[];
}

export async function createProductBatch(
  dealerRowId: string,
  input: Omit<ProductBatchRow, 'id' | 'dealer_id' | 'product_master'>
): Promise<void> {
  const { error } = await supabase.from('product_batches').insert({ ...input, dealer_id: dealerRowId });
  if (error) throw new Error(error.message);
}

export type ExpiringBatchRow = {
  product_name: string;
  batch_number: string;
  expiry_date: string;
  days_remaining: number;
  quantity: number;
  estimated_value: number;
};

export async function fetchExpiringBatchesRpc(dealerRowId: string, days = 30): Promise<ExpiringBatchRow[]> {
  const { data, error } = await supabase.rpc('get_expiring_batches', {
    p_dealer_id: dealerRowId,
    p_days_ahead: days,
  });
  if (error) {
    console.warn('[expiring batches]', error.message);
    return [];
  }
  return (data ?? []) as ExpiringBatchRow[];
}
