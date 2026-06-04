import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuthProfile } from './types';

const ADMIN_PROFILE_COLUMNS =
  'user_id, email, first_name, last_name, phone, system_role, password_set_at';

export type AdminSessionResult =
  | { ok: true; userId: string; profile: AuthProfile }
  | { ok: false; response: NextResponse };

export async function requireAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      )
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(ADMIN_PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: profileError.message },
        { status: 500 }
      )
    };
  }

  if (!profile || profile.system_role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    };
  }

  return { ok: true, userId: user.id, profile: profile as AuthProfile };
}
