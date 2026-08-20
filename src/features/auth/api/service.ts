import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/client';
import type {
  AuthProfile,
  ForcePasswordChangePayload,
  ForcePasswordChangeResponse,
  SignInPayload,
  SignInResult
} from './types';
import { AUTH_ERROR_MESSAGES } from './types';

const PROFILE_COLUMNS =
  'user_id, email, full_name, phone, system_role, password_set_at, status';

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

export async function signInWithEmail(payload: SignInPayload): Promise<SignInResult> {
  const email = normalizeEmail(payload.email);

  try {
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: payload.password }),
      credentials: 'same-origin'
    });

    const data = (await res.json()) as {
      success: boolean;
      mustChange?: boolean;
      message?: string;
    };

    if (!res.ok || !data.success) {
      return {
        ok: false,
        message: data.message ?? AUTH_ERROR_MESSAGES.UNKNOWN
      };
    }

    return { ok: true, mustChange: data.mustChange ?? false };
  } catch {
    return { ok: false, message: AUTH_ERROR_MESSAGES.UNKNOWN };
  }
}

export async function forcePasswordChange(
  payload: ForcePasswordChangePayload
): Promise<ForcePasswordChangeResponse> {
  const res = await fetch('/api/auth/force-password-change', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin'
  });

  const data = (await res.json()) as ForcePasswordChangeResponse;

  if (!res.ok || !data.success) {
    throw new Error(
      data.message ??
        '비밀번호 변경에 실패했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.'
    );
  }

  return data;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  return ensureProfileForSession();
}
