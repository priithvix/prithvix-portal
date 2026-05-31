'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type WorkspaceMode = 'business_engine' | 'tally';

const WORKSPACE_COOKIE = 'workspace_mode';
const COOKIE_MAX_AGE = 60 * 60 * 24;

export async function setWorkspaceMode(mode: WorkspaceMode) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.auth.updateUser({
    data: {
      workspace_mode: mode,
      workspace_picked_at: new Date().toISOString(),
    },
  });

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, mode, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearWorkspaceMode() {
  const store = await cookies();
  store.delete(WORKSPACE_COOKIE);
}

export async function getWorkspaceMode(): Promise<WorkspaceMode | null> {
  const store = await cookies();
  const v = store.get(WORKSPACE_COOKIE)?.value;
  return v === 'tally' || v === 'business_engine' ? v : null;
}
