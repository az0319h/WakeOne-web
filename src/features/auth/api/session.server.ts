import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuthProfile } from './types';

export type SessionResult =
  | { ok: true; userId: string; profile: AuthProfile }
  | { ok: false; response: NextResponse };

const UNAUTHORIZED_MESSAGE = '인증이 필요합니다.';
const INACTIVE_MESSAGE = '비활성화된 계정입니다.';
const PROFILE_COLUMNS =
  'user_id, email, first_name, last_name, phone, birthday, system_role, password_set_at, status, avatar_url, affiliation, department, rank, job_title, food_restrictions';

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

export async function requireSession(): Promise<SessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: UNAUTHORIZED_MESSAGE },
        { status: 401 }
      )
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
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

  if (!profile || profile.status === 'inactive') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: INACTIVE_MESSAGE },
        { status: 403 }
      )
    };
  }

  return { ok: true, userId: user.id, profile: profile as AuthProfile };
}

async function getRequestPathname(): Promise<string> {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname');

  if (pathname) {
    return pathname;
  }

  const nextUrl = headersList.get('next-url');

  if (nextUrl) {
    try {
      return new URL(nextUrl).pathname;
    } catch {
      // ignore malformed header
    }
  }

  return '/dashboard/overview';
}

export async function requireDashboardSession(): Promise<AuthProfile> {
  const user = await getSessionUser();

  if (!user) {
    const pathname = await getRequestPathname();
    redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
  }

  const profile = await getSessionProfile();

  if (!profile || profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  return profile;
}

export async function requireAdminPage(): Promise<AuthProfile> {
  const profile = await requireDashboardSession();

  if (profile.system_role !== 'admin') {
    redirect('/dashboard/overview?accessDenied=users');
  }

  return profile;
}
