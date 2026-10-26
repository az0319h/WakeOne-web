import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  DONGBANG_HOME_PATH,
  getDongbangDeniedFlashKey,
  isDongbangAllowedPage
} from '@/config/dongbang-routes';
import { canAccessBenefitsAdmin } from './benefits-access.server';
import { isDongbang } from './quick-access.server';
import { isWorkflowAdmin, WORKFLOW_ADMIN_REQUIRED_MESSAGE } from './workflow-access.server';
import type { AuthProfile } from './types';

export type SessionResult =
  | { ok: true; userId: string; profile: AuthProfile }
  | { ok: false; response: NextResponse };

const UNAUTHORIZED_MESSAGE = '인증이 필요합니다.';
const INACTIVE_MESSAGE = '활성화된 계정만 접근할 수 있습니다.';
const PROFILE_COLUMNS =
  'user_id, email, full_name, phone, birthday, system_role, password_set_at, status, avatar_url, affiliation, rank, position_level, leader_role, google_email, google_display_name, approval_requested_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason';

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown };
  return (
    value.code === 'refresh_token_not_found' ||
    (typeof value.message === 'string' &&
      value.message.toLowerCase().includes('refresh token not found'))
  );
}

export async function getSessionUser() {
  const supabase = await createClient();
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) return null;
    throw error;
  }
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  const supabase = await createClient();
  let user;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) return null;
    throw error;
  }

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
  let user;
  let authError;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) throw error;
    user = null;
    authError = error;
  }

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

  // plan 89 — 동방특송 2차 방어 (proxy allowlist가 1차). Server Component는 cookie를 못 쓰므로 legacy query flash
  // x-pathname(proxy가 설정)이 없으면 판정하지 않는다 — 추정 경로로 redirect하면 /dashboard/quick 루프가 생긴다
  if (isDongbang(profile)) {
    const pathname = (await headers()).get('x-pathname');
    if (pathname && !isDongbangAllowedPage(pathname)) {
      const flashKey = getDongbangDeniedFlashKey(pathname);
      redirect(flashKey ? `${DONGBANG_HOME_PATH}?accessDenied=${flashKey}` : DONGBANG_HOME_PATH);
    }
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

export async function requireBenefitsAdminPage(): Promise<AuthProfile> {
  const profile = await requireDashboardSession();

  if (!canAccessBenefitsAdmin(profile)) {
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

export async function requireBenefitsAdminSession(): Promise<SessionResult> {
  const session = await requireSession();

  if (!session.ok) {
    return session;
  }

  if (!canAccessBenefitsAdmin(session.profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: '복지비 관리 권한이 필요합니다.' },
        { status: 403 }
      )
    };
  }

  return session;
}

/** 워크플로우 설정 페이지 가드 (plan 88) — 미권한이면 /dashboard/workflow + 접근 거부 flash */
export async function requireWorkflowAdminPage(): Promise<AuthProfile> {
  const profile = await requireDashboardSession();

  if (!(await isWorkflowAdmin(profile))) {
    // middleware·proxy가 flash cookie로 먼저 막는다. 여기는 방어선 — Server Component에서는 cookie를 쓸 수 없어 legacy query로 toast
    redirect('/dashboard/workflow?accessDenied=workflow-settings');
  }

  return profile;
}

/** 워크플로우 관리자 API 가드 (plan 88) — 403 「워크플로우 관리자 권한이 필요합니다.」 */
export async function requireWorkflowAdminSession(): Promise<SessionResult> {
  const session = await requireSession();

  if (!session.ok) {
    return session;
  }

  let allowed = false;
  try {
    allowed = await isWorkflowAdmin(session.profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : '권한 확인 중 오류가 발생했습니다.';
    return {
      ok: false,
      response: NextResponse.json({ success: false, message }, { status: 500 })
    };
  }

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: WORKFLOW_ADMIN_REQUIRED_MESSAGE, error: WORKFLOW_ADMIN_REQUIRED_MESSAGE },
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
