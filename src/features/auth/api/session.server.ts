import { createClient } from '@/lib/supabase/server';
import type { AuthProfile } from './types';

const PROFILE_COLUMNS =
  'user_id, email, first_name, last_name, phone, system_role, password_set_at, status';

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (profile) {
    return profile as AuthProfile;
  }

  const { error: rpcError } = await supabase.rpc('ensure_profile_for_user');
  if (rpcError) {
    throw rpcError;
  }

  const { data: ensured, error: refetchError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();

  if (refetchError) {
    throw refetchError;
  }

  return (ensured as AuthProfile | null) ?? null;
}
