import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Export a singleton instance for use in client components
export const supabase = createClient();

// Upload utilities (ported from mobile utils/supabase.ts)

/** Upload a farmer photo to Supabase Storage bucket "farmer-photos". */
export async function uploadFarmerPhoto(
  localUri: string,
  farmerId: string,
  dealerId: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerId}/${farmerId}.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('farmer-photos')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Photo upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('farmer-photos').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadFarmerPhoto exception:', e);
    return null;
  }
}

/** Upload a product photo to Supabase Storage bucket "product-photos". */
export async function uploadProductPhoto(
  localUri: string,
  productId: string,
  dealerId: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerId}/${productId}.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('product-photos')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Product photo upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('product-photos').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadProductPhoto exception:', e);
    return null;
  }
}

/** Upload dealer shop logo to Supabase Storage bucket "dealer-logos". */
export async function uploadDealerLogo(
  localUri: string,
  dealerId: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerId}/logo.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('dealer-logos')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Dealer logo upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('dealer-logos').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadDealerLogo exception:', e);
    return null;
  }
}

/** Upload dealer profile photo to bucket "dealer-logos" at path {dealerPk}/profile.{ext}. */
export async function uploadDealerProfilePhoto(
  localUri: string,
  dealerPk: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerPk}/profile.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('dealer-logos')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Dealer profile photo upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('dealer-logos').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadDealerProfilePhoto exception:', e);
    return null;
  }
}

/** Credit / payment proof for a sale — bucket "credit-proofs". */
export async function uploadCreditProofPhoto(
  localUri: string,
  dealerId: string,
  saleId: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerId}/${saleId}.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('credit-proofs')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Credit proof upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('credit-proofs').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadCreditProofPhoto exception:', e);
    return null;
  }
}

/** Field visit photo — bucket "visit-photos". */
export async function uploadVisitPhoto(
  localUri: string,
  visitId: string,
  dealerId: string
): Promise<string | null> {
  try {
    let ext = 'jpg';
    if (!localUri.startsWith('blob:') && !localUri.startsWith('data:')) {
      ext = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
      if (ext.length > 5) ext = 'jpg';
    }
    const safePath = `${dealerId}/${visitId}.${ext}`;

    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('visit-photos')
      .upload(safePath, blob, { upsert: true, contentType: `image/${ext}` });
    
    if (error) {
      console.error('[Supabase] Visit photo upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('visit-photos').getPublicUrl(safePath);
    return data.publicUrl ?? null;
  } catch (e) {
    console.error('[Supabase] uploadVisitPhoto exception:', e);
    return null;
  }
}

/** Upload PDF to private bucket `daily-reports`. */
export async function uploadDailyReportPdf(
  localUri: string,
  storagePath: string,
): Promise<{ error: Error | null }> {
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('daily-reports')
      .upload(storagePath, blob, { upsert: true, contentType: 'application/pdf' });
    return { error: error ? new Error(error.message) : null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** True if URI is already a remote http(s) URL (persisted in DB). */
export function isRemoteImageUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const t = uri.trim().toLowerCase();
  return t.startsWith('http://') || t.startsWith('https://');
}
