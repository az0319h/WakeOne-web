import 'server-only';

import {
  decryptRefreshTokenMaybeMock,
  encryptRefreshTokenForMock,
  encryptRefreshToken
} from '@/lib/google-tasks/encrypt';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { GoogleTasksConnectionRow } from './types';

const E2E_MOCK_EMAIL = 'e2e-mock@gmail.com';

function encryptToken(plain: string): string {
  if (process.env.E2E_GOOGLE_TASKS_MOCK === '1') {
    return encryptRefreshTokenForMock(plain);
  }
  return encryptRefreshToken(plain);
}

export async function getGoogleTasksConnection(
  userId: string
): Promise<GoogleTasksConnectionRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('google_tasks_connections')
    .select('user_id, google_email, encrypted_refresh_token, token_updated_at, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GoogleTasksConnectionRow | null) ?? null;
}

export async function upsertGoogleTasksConnection(input: {
  userId: string;
  googleEmail: string;
  refreshToken: string;
}): Promise<GoogleTasksConnectionRow> {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();
  const encrypted = encryptToken(input.refreshToken);

  const { data, error } = await supabase
    .from('google_tasks_connections')
    .upsert(
      {
        user_id: input.userId,
        google_email: input.googleEmail,
        encrypted_refresh_token: encrypted,
        token_updated_at: now
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, google_email, encrypted_refresh_token, token_updated_at, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Google Tasks 연결을 저장하지 못했습니다.');
  }

  return data as GoogleTasksConnectionRow;
}

export async function ensureMockGoogleTasksConnection(
  userId: string,
  googleEmail: string
): Promise<GoogleTasksConnectionRow> {
  const existing = await getGoogleTasksConnection(userId);
  if (existing) {
    return existing;
  }
  return upsertGoogleTasksConnection({
    userId,
    googleEmail: googleEmail || E2E_MOCK_EMAIL,
    refreshToken: 'mock-refresh-token'
  });
}

export function buildGoogleTasksClientContext(
  userId: string,
  connection: GoogleTasksConnectionRow
) {
  return {
    userId,
    encryptedRefreshToken: connection.encrypted_refresh_token
  };
}

export function verifyRefreshTokenDecryptable(encrypted: string): boolean {
  try {
    decryptRefreshTokenMaybeMock(encrypted);
    return true;
  } catch {
    return false;
  }
}

export type GoogleTasksLoginSyncResult =
  | { ok: true; googleEmail: string }
  | { ok: false; message: string; errorCode: 'missing_token' | 'email_mismatch' | 'persist_failed' };

export async function syncGoogleTasksConnectionOnLogin(input: {
  userId: string;
  sessionGoogleEmail: string;
  profileGoogleEmail: string | null;
  providerRefreshToken: string | null;
}): Promise<GoogleTasksLoginSyncResult> {
  const sessionEmail = input.sessionGoogleEmail.trim().toLowerCase();
  const profileEmail = input.profileGoogleEmail?.trim().toLowerCase() ?? '';

  if (profileEmail && sessionEmail !== profileEmail) {
    return {
      ok: false,
      message: 'Google 계정 이메일이 프로필과 일치하지 않습니다.',
      errorCode: 'email_mismatch'
    };
  }

  const refreshToken =
    input.providerRefreshToken ??
    (process.env.E2E_GOOGLE_TASKS_MOCK === '1' ? 'mock-refresh-token' : null);

  if (!refreshToken) {
    return {
      ok: false,
      message: 'Google Tasks 권한( refresh token )을 받지 못했습니다. 다시 로그인해 주세요.',
      errorCode: 'missing_token'
    };
  }

  try {
    await upsertGoogleTasksConnection({
      userId: input.userId,
      googleEmail: sessionEmail || input.sessionGoogleEmail,
      refreshToken
    });
    return { ok: true, googleEmail: sessionEmail || input.sessionGoogleEmail };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Tasks 연결을 저장하지 못했습니다.';
    return { ok: false, message, errorCode: 'persist_failed' };
  }
}
