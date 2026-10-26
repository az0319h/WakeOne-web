import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * plan 91 — 휴대폰 웹 푸시 E2E helper.
 * mock 전송기(`E2E_WEB_PUSH_MOCK=1`)는 endpoint 패턴으로 결과를 정한다:
 *   `https://e2e.invalid/push/ok/…` → 성공 · `/push/410/…` → 410(만료) · `/push/404/…` → 404
 */

export type MockEndpointKind = 'ok' | '410' | '404';

export const PUSH_SUBSCRIPTIONS_PATH = '/api/notifications/push/subscriptions';
export const PUSH_PREFERENCES_PATH = '/api/notifications/push/preferences';
export const PUSH_TEST_PATH = '/api/notifications/push/test';

/** base64url 형태의 가짜 키 (Zod `^[A-Za-z0-9_\-+/]+=*$`, 8자 이상) */
export const MOCK_KEYS = {
  p256dh: 'BE2E_mock_p256dh_key_0123456789abcdefABCDEF-_0123456789abcdef',
  auth: 'e2e_mock_auth_0123456789'
} as const;

export function mockEndpoint(kind: MockEndpointKind = 'ok', suffix = randomUUID()): string {
  return `https://e2e.invalid/push/${kind}/${suffix}`;
}

export function mockSubscriptionBody(endpoint: string, userAgent = 'E2E Android Chrome') {
  return { endpoint, keys: { ...MOCK_KEYS }, userAgent };
}

export type PushDevice = {
  id: number;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  endpoint_hash: string;
};

export type PushPreferences = {
  configured: boolean;
  disabled_groups: string[];
  device_count: number;
  devices: PushDevice[];
  groups: Array<{ key: string; label: string; description: string; admin_only: boolean }>;
};

export async function getPushPreferences(request: APIRequestContext): Promise<PushPreferences> {
  const response = await request.get(PUSH_PREFERENCES_PATH);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { success: boolean; data: PushPreferences };
  expect(body.success).toBe(true);
  return body.data;
}

export async function registerMockDevice(
  request: APIRequestContext,
  endpoint: string,
  userAgent?: string
) {
  const response = await request.post(PUSH_SUBSCRIPTIONS_PATH, {
    data: mockSubscriptionBody(endpoint, userAgent)
  });
  return response;
}

/** 이 사용자의 기기 전부 삭제 + 그룹 설정 초기화 (spec 전후 멱등 정리) */
export async function resetPushStateForUser(request: APIRequestContext) {
  const prefs = await getPushPreferences(request);
  for (const device of prefs.devices) {
    await request.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { id: device.id } });
  }
  if (prefs.disabled_groups.length > 0) {
    const reset = await request.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: [] } });
    expect(reset.status()).toBe(200);
  }
}

// ---------------------------------------------------------------------------
// activity log
// ---------------------------------------------------------------------------

export type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: Record<string, unknown> | null;
};

export async function listActivityLogs(request: APIRequestContext, action: string) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { success?: boolean; data?: { logs?: ActivityLogItem[] } };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

export async function expectActivityLog(
  request: APIRequestContext,
  action: string,
  requestId: string,
  status: number
): Promise<ActivityLogItem> {
  let matched: ActivityLogItem | undefined;
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, action);
        matched = logs.find(
          (item) =>
            item.request_id === requestId && item.action === action && item.http_status === status
        );
        return Boolean(matched);
      },
      { timeout: 15_000 }
    )
    .toBe(true);
  return matched!;
}

// ---------------------------------------------------------------------------
// service_role (dev DB 직접 조회 — AC-15 push_subscriptions count)
// ---------------------------------------------------------------------------

function loadEnvValue(key: string): string {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && match[1] === key) return match[2].trim();
    }
  }
  return process.env[key]?.trim() ?? '';
}

export function getE2eServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for push E2E DB checks.');
  }
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function countPushSubscriptionsForUser(userId: string): Promise<number> {
  const admin = getE2eServiceRoleClient();
  const { count, error } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function resolveUserIdByEmail(
  adminRequest: APIRequestContext,
  email: string
): Promise<string> {
  const response = await adminRequest.get(`/api/users?search=${encodeURIComponent(email)}&limit=5`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { users?: Array<{ id: string; email: string }> };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.id).toBeTruthy();
  return user!.id;
}

/** plan 27 AC-1 경로 — admin이 사용자 이름 변경 (wake·경영진은 position_level 필수) */
export async function renameUserAsAdmin(
  adminRequest: APIRequestContext,
  userId: string,
  fullName: string
) {
  const response = await adminRequest.put(`/api/users/${userId}`, {
    data: {
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진',
      position_level: 'CEO',
      phone: '01012345678'
    }
  });
  expect(response.status()).toBe(200);
  return response;
}

/**
 * 헤드리스 Chromium은 `Notification.permission`을 `denied`로 보고한다(환경 제약).
 * `default`로 stub하면 plan §상태 모델의 `off` 분기를 판정할 수 있다.
 */
export const NOTIFICATION_PERMISSION_DEFAULT_STUB = `
  try {
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
    }
  } catch {}
`;
