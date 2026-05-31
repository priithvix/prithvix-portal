import { supabase } from '@/lib/supabase/client';

export type WaMessageRow = {
  id: string;
  dealer_id: string;
  from_number: string;
  farmer_id: string | null;
  message_text: string;
  parsed_order: Record<string, unknown> | null;
  status: string;
  received_at: string;
};

export async function listWhatsAppMessages(dealerRowId: string): Promise<WaMessageRow[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('dealer_id', dealerRowId)
    .order('received_at', { ascending: false })
    .limit(100);
  if (error) {
    console.warn('[wa]', error.message);
    return [];
  }
  return (data ?? []) as WaMessageRow[];
}

export async function countPendingWaOrders(dealerRowId: string): Promise<number> {
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('dealer_id', dealerRowId)
    .in('status', ['RECEIVED', 'PARSED']);
  if (error) return 0;
  return count ?? 0;
}

export async function updateWaMessageStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('whatsapp_messages').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}
