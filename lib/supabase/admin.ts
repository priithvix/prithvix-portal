import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Server/webhook only — bypasses RLS when SUPABASE_SERVICE_ROLE_KEY is set */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
