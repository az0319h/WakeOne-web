import { NextRequest, NextResponse } from 'next/server';
import {
  ANONYMOUS_ACTOR,
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  fetchUserTargetLabel,
  recordActivityLog,
  withRequestId
} from '@/features/activity-logs/api/log.server';
import type { AuthProfile } from '@/features/auth/api/types';
import { insertUserApprovalRequestAdminNotifications } from '@/features/notifications/api/fan-out.server';
import { ACCOUNT_DISABLED_FLASH_COOKIE } from '@/lib/auth/account-disabled-flash';
import { isUserBannedOAuthSignal } from '@/lib/auth/supabase-oauth-error';
import { createClient } from '@/lib/supabase/server';

const HTTP_PATH = '/api/auth/google/callback';
const DEFAULT_REDIRECT_PATH = '/dashboard/overview';

type GoogleProfileResult = {
  user_id: string;
  status: AuthProfile['status'];
  google_email: string | null;
  google_display_name: string | null;
  approval_requested_at: string | null;
  approval_request_log_needed: boolean;
};

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH;
  }

  if (value.startsWith('/auth/')) {
    return DEFAULT_REDIRECT_PATH;
  }

  return value;
}

function redirectToSignIn(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/auth/sign-in', request.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  if (params.accountDisabled === '1') {
    response.cookies.set(ACCOUNT_DISABLED_FLASH_COOKIE, '1', {
      maxAge: 60,
      path: '/',
      sameSite: 'lax',
      httpOnly: false
    });
  }
  return response;
}

function getGoogleDisplayName(userMetadata: Record<string, unknown>): string | null {
  const fullName = userMetadata.full_name;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  const name = userMetadata.name;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const code = request.nextUrl.searchParams.get('code');
  const oauthError = request.nextUrl.searchParams.get('error');
  const redirectTo = safeRedirectPath(request.nextUrl.searchParams.get('redirectTo'));
  const supabase = await createClient();

  if (oauthError) {
    const oauthErrorCode = request.nextUrl.searchParams.get('error_code');
    const oauthErrorDescription = request.nextUrl.searchParams.get('error_description');

    if (isUserBannedOAuthSignal(oauthErrorCode, oauthErrorDescription)) {
      return withRequestId(redirectToSignIn(request, { accountDisabled: '1' }), requestId);
    }

    await recordActivityLog({
      requestId,
      ...ANONYMOUS_ACTOR,
      action: 'user.approval_request',
      targetType: 'user',
      targetUserId: null,
      targetLabel: 'google_oauth',
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 400,
      metadata: buildErrorMetadata('validation', 'Google OAuth가 취소되었거나 거부되었습니다.')
    });

    return withRequestId(redirectToSignIn(request, { authError: 'google_oauth_denied' }), requestId);
  }

  if (!code) {
    await recordActivityLog({
      requestId,
      ...ANONYMOUS_ACTOR,
      action: 'user.approval_request',
      targetType: 'user',
      targetUserId: null,
      targetLabel: 'google_oauth',
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 400,
      metadata: buildErrorMetadata('validation', 'OAuth code가 없습니다.')
    });

    return withRequestId(redirectToSignIn(request, { authError: 'missing_code' }), requestId);
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    if (isUserBannedOAuthSignal(exchangeError.code, exchangeError.message)) {
      return withRequestId(redirectToSignIn(request, { accountDisabled: '1' }), requestId);
    }

    await recordActivityLog({
      requestId,
      ...ANONYMOUS_ACTOR,
      action: 'user.approval_request',
      targetType: 'user',
      targetUserId: null,
      targetLabel: 'google_oauth',
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 500,
      metadata: buildErrorMetadata('internal_error', exchangeError.message)
    });

    return withRequestId(redirectToSignIn(request, { authError: 'exchange_failed' }), requestId);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await recordActivityLog({
      requestId,
      ...ANONYMOUS_ACTOR,
      action: 'user.approval_request',
      targetType: 'user',
      targetUserId: null,
      targetLabel: 'google_oauth',
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 500,
      metadata: buildErrorMetadata('internal_error', userError?.message ?? '사용자 세션을 확인할 수 없습니다.')
    });

    return withRequestId(redirectToSignIn(request, { authError: 'session_failed' }), requestId);
  }

  const googleEmail = user.email ?? '';
  const googleDisplayName = getGoogleDisplayName(user.user_metadata);
  const { data: ensuredRows, error: ensureError } = await supabase.rpc('ensure_google_auth_profile', {
    p_google_email: googleEmail,
    p_google_display_name: googleDisplayName
  });

  if (ensureError || !ensuredRows?.length) {
    await supabase.auth.signOut();
    await recordActivityLog({
      requestId,
      actorUserId: user.id,
      actorEmail: googleEmail || 'unknown',
      actorDisplayName: googleDisplayName,
      action: 'user.approval_request',
      targetType: 'user',
      targetUserId: user.id,
      targetLabel: googleEmail || user.id,
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 500,
      metadata: buildErrorMetadata(
        'internal_error',
        ensureError?.message ?? '프로필 승인 상태를 확인할 수 없습니다.',
        { google_email: googleEmail }
      )
    });

    return withRequestId(redirectToSignIn(request, { authError: 'profile_failed' }), requestId);
  }

  const profileResult = ensuredRows[0] as GoogleProfileResult;
  const targetLabel = await fetchUserTargetLabel(user.id);

  if (profileResult.status === 'active') {
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'user_id, email, full_name, phone, birthday, system_role, password_set_at, status, avatar_url, affiliation, rank'
      )
      .eq('user_id', user.id)
      .maybeSingle();

    await recordActivityLog({
      requestId,
      ...(profile ? actorFromProfile(profile as AuthProfile) : {
        actorUserId: user.id,
        actorEmail: googleEmail || 'unknown',
        actorDisplayName: googleDisplayName
      }),
      action: 'auth.sign_in',
      targetType: 'auth',
      targetUserId: user.id,
      targetLabel,
      httpMethod: 'GET',
      httpPath: HTTP_PATH,
      httpStatus: 302,
      metadata: { google_email: googleEmail }
    });

    return withRequestId(NextResponse.redirect(new URL(redirectTo, request.nextUrl.origin)), requestId);
  }

  if (profileResult.status === 'pending_approval') {
    if (profileResult.approval_request_log_needed) {
      await recordActivityLog({
        requestId,
        actorUserId: user.id,
        actorEmail: googleEmail || 'unknown',
        actorDisplayName: googleDisplayName,
        action: 'user.approval_request',
        targetType: 'user',
        targetUserId: user.id,
        targetLabel,
        httpMethod: 'GET',
        httpPath: HTTP_PATH,
        httpStatus: 302,
        metadata: {
          google_email: googleEmail,
          new_status: 'pending_approval',
          approval_source: 'google_oauth'
        }
      });

      try {
        await insertUserApprovalRequestAdminNotifications({
          targetUserId: user.id,
          googleEmail,
          googleDisplayName
        });
      } catch (fanOutError) {
        const message =
          fanOutError instanceof Error ? fanOutError.message : 'Notification fan-out failed';
        console.error('[google/callback] approval request admin notification fan-out failed:', message);
      }
    }

    await supabase.auth.signOut();
    return withRequestId(
      redirectToSignIn(request, { authStatus: 'pending_approval' }),
      requestId
    );
  }

  await supabase.auth.signOut();

  if (profileResult.status === 'rejected') {
    return withRequestId(redirectToSignIn(request, { authStatus: 'rejected' }), requestId);
  }

  return withRequestId(redirectToSignIn(request, { accountDisabled: '1' }), requestId);
}
