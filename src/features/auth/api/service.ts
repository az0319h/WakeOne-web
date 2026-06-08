import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/client';
import type { AuthProfile, SignInPayload } from './types';
import { AUTH_ERROR_MESSAGES } from './types';

const PROFILE_COLUMNS =
  'user_id, email, first_name, last_name, phone, system_role, password_set_at, status';
const SESSION_REFRESH_ERROR_KEYWORDS = [
  'Invalid Refresh Token',
  'Session Expired',
  'Refresh Token'
] as const;

function isSessionRefreshError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return SESSION_REFRESH_ERROR_KEYWORDS.some((keyword) => error.message.includes(keyword));
}

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

function mapAuthClientError(error: unknown): string {
  if (!(error instanceof Error)) {
    return AUTH_ERROR_MESSAGES.UNKNOWN;
  }

  if (
    error.message.includes('Missing Supabase') ||
    error.message.includes('NEXT_PUBLIC_SUPABASE')
  ) {
    return 'Supabase 설정이 누락되었습니다. .env의 API 키를 확인한 뒤 `npm run dev`를 다시 실행해 주세요.';
  }

  return AUTH_ERROR_MESSAGES.UNKNOWN;
}

export async function signInWithEmail(payload: SignInPayload) {
  let supabase;

  try {
    supabase = createClient();
  } catch (error) {
    return { ok: false as const, message: mapAuthClientError(error) };
  }

  const email = normalizeEmail(payload.email);

  const readProfileStatus = () =>
    supabase.rpc('profile_status_for_email', {
      p_email: email
    });

  let { data: profileStatus, error: statusError } = await readProfileStatus();

  if (statusError && isSessionRefreshError(statusError)) {
    await supabase.auth.signOut();
    const retried = await readProfileStatus();
    profileStatus = retried.data;
    statusError = retried.error;
  }

  if (statusError) {
    return { ok: false as const, message: AUTH_ERROR_MESSAGES.UNKNOWN };
  }

  if (profileStatus === 'inactive') {
    return { ok: false as const, message: AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED };
  }

  const requestSignIn = () =>
    supabase.auth.signInWithPassword({
      email,
      password: payload.password
    });

  let { error } = await requestSignIn();

  // Stale local refresh tokens can survive dashboard inactivity resets.
  // Clear local auth state and retry once so users can sign in immediately.
  if (error && isSessionRefreshError(error)) {
    await supabase.auth.signOut();
    const retried = await requestSignIn();
    error = retried.error;
  }

  if (error) {
    if (error.message.includes('No API key found')) {
      return {
        ok: false as const,
        message:
          'Supabase API 키가 요청에 포함되지 않았습니다. .env의 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하고 개발 서버를 재시작해 주세요.'
      };
    }

    const message =
      error.message === 'Invalid login credentials'
        ? AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS
        : AUTH_ERROR_MESSAGES.UNKNOWN;
    return { ok: false as const, message };
  }

  const profile = await ensureProfileForSession();

  if (profile?.status === 'inactive') {
    await supabase.auth.signOut();
    return { ok: false as const, message: AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED };
  }

  return { ok: true as const };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  return ensureProfileForSession();
}
