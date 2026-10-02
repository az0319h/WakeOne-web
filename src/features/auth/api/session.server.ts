import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuthProfile } from './types';

export type SessionResult =
  | { ok: true; userId: string; profile: AuthProfile }
  | { ok: false; response: NextResponse };

const UNAUTHORIZED_MESSAGE = '인증이 필요합니다.';
const INACTIVE_MESSAGE = '활성화된 계정만 접근할 수 있습니다.';
const PROFILE_COLUMNS =
  'user_id, email, full_name, phone, birthday, system_role, password_set_at, status, avatar_url, affiliation, rank, google_email, google_display_name, approval_requested_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason';

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

  if (!profile || profile.status !== 'active') {
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

  if (!profile || profile.status !== 'active') {
    const authStatus =
      profile?.status === 'pending_approval' || profile?.status === 'rejected'
        ? profile.status
        : null;
    redirect(authStatus ? `/auth/sign-in?authStatus=${authStatus}` : '/auth/sign-in?accountDisabled=1');
  }

  return profile;
}

export async function requireAdminPage(): Promise<AuthProfile> {
  const profile = await requireDashboardSession();

  if (profile.system_role !== 'admin') {
    redirect('/dashboard/overview');
  }

  return profile;
}

export async function requireAdminSession(): Promise<SessionResult> {
  const session = await requireSession();

  if (!session.ok) {
    return session;
  }

  if (session.profile.system_role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    };
  }

  return session;
}

const USER_ONLY_MESSAGE = '일반 사용자 권한이 필요합니다.';

export async function requireUserSession(): Promise<SessionResult> {
  const session = await requireSession();

  if (!session.ok) {
    return session;
  }

  if (session.profile.system_role !== 'user') {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: USER_ONLY_MESSAGE }, { status: 403 })
    };
  }

  return session;
}

export async function requireMyContractsPage(): Promise<AuthProfile> {
  const profile = await requireDashboardSession();

  if (profile.system_role !== 'user') {
    redirect('/dashboard/overview');
  }

  const { countMyContracts } = await import('@/features/contracts/api/service.server');
  const matchCount = await countMyContracts(profile.full_name ?? '');

  if (matchCount < 1) {
    redirect('/dashboard/overview');
  }

  return profile;
}
