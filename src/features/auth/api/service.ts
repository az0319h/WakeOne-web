import { createClient } from '@/lib/supabase/client';
import type { AuthProfile, SignInPayload } from './types';
import { AUTH_ERROR_MESSAGES } from './types';

const PROFILE_COLUMNS = 'user_id, email, first_name, last_name, system_role';

async function fetchProfile(userId: string): Promise<AuthProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AuthProfile | null;
}

async function ensureProfileForSession(): Promise<AuthProfile | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const existing = await fetchProfile(user.id);
  if (existing) {
    return existing;
  }

  const { error: rpcError } = await supabase.rpc('ensure_profile_for_user');
  if (rpcError) {
    throw rpcError;
  }

  return fetchProfile(user.id);
}

export async function signInWithEmail(payload: SignInPayload) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    const message =
      error.message === 'Invalid login credentials'
        ? AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS
        : AUTH_ERROR_MESSAGES.UNKNOWN;
    return { ok: false as const, message };
  }

  await ensureProfileForSession();
  return { ok: true as const };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  return ensureProfileForSession();
}
