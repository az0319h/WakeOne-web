import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/client';
import {
  signOutPushOnThisDevice,
  unsubscribePushOnThisDevice
} from '@/features/notifications/lib/push-client';
import { clearOwnResumeMarker, hashPushOwner } from '@/features/notifications/lib/push-resume';
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

const SIGN_OUT_SESSION_READ_TIMEOUT_MS = 2000;

/** plan 105 — 로그아웃 직전 세션의 기기 표시용 owner hash (user id 원문은 남기지 않는다 · 실패·2초 초과 시 null) */
async function readSessionPushOwnerHash(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const read = (async () => {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      return userId ? await hashPushOwner(userId) : null;
    } catch {
      return null;
    }
  })();
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), SIGN_OUT_SESSION_READ_TIMEOUT_MS);
  });
  return Promise.race([read, timeout]);
}

/**
 * 로그아웃.
 * - `scope`(plan 104): 기본 `local`(이 기기만) · 비활성 계정 강제 로그아웃만 `global`.
 * - `reason`(plan 105): 기본 `user`(로그아웃 버튼) · `forced`(비활성화 감지 강제 로그아웃).
 * 푸시 처리는 항상 `supabase.auth.signOut(`보다 먼저 한다(세션이 있어야 DELETE가 통과).
 */
export async function signOut(options?: {
  scope?: 'local' | 'global';
  reason?: 'user' | 'forced';
}) {
  const supabase = createClient();
  const pushOwnerHash = await readSessionPushOwnerHash(supabase);

  if (options?.reason === 'forced') {
    // plan 105 — 강제 로그아웃: 내 기기 표시 삭제 + plan 91 동작(DELETE forced_sign_out + 브라우저 구독 해제 · 2초 timeout · 실패 무시)
    clearOwnResumeMarker(pushOwnerHash);
    await unsubscribePushOnThisDevice();
  } else {
    // plan 105 — 로그아웃 버튼: 서버 등록만 지우고 브라우저 구독은 남긴 뒤 기기 표시를 「나」로 기록
    // (2초 timeout · DELETE 실패 시 브라우저 구독까지 해제 · 실패 무시)
    await signOutPushOnThisDevice(pushOwnerHash);
  }

  // plan 104 — 기본은 이 기기만 로그아웃(local). 비활성 계정 강제 로그아웃만 global
  await supabase.auth.signOut({ scope: options?.scope ?? 'local' });
}

export async function getSessionProfile(): Promise<AuthProfile | null> {
  return ensureProfileForSession();
}
