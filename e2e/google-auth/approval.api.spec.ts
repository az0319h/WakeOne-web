import { expect, test, type APIRequestContext } from '@playwright/test';
import { createUserRequest } from '../helpers/auth-request';
import {
  createPendingGoogleUser,
  createGuestRequestWithPassword
} from '../helpers/supabase-direct-auth';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: Record<string, unknown>;
};

const E2E_TEST_PHONE = '01012345678';

function approvePayload(
  email: string,
  fullName = 'E2E 승인 사용자',
  birthday: string | null = '1990-01-01'
) {
  return {
    email,
    full_name: fullName,
    affiliation: 'wake',
    rank: '경영진',
    system_role: 'user',
    birthday,
    phone: E2E_TEST_PHONE
  };
}

async function listActivityLogs(request: APIRequestContext, action: string) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50&log_user=all`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function expectActivityLog(
  request: APIRequestContext,
  action: string,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, action);
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === action &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched.metadata ?? {}) : null;
      },
      { timeout: 15_000 }
    )
    .not.toBeNull();

  const logs = await listActivityLogs(request, action);
  return logs.find(
    (item) =>
      item.request_id === requestId && item.action === action && item.http_status === status
  );
}

function assertNoSensitiveMetadata(metadata: unknown) {
  const json = JSON.stringify(metadata ?? {});
  expect(json).not.toMatch(/password/i);
  expect(json).not.toMatch(/token/i);
}

test.describe('Google auth approval API', () => {
  test.describe.configure({ mode: 'serial' });

  let pendingUserId = '';
  let pendingEmail = '';

  test('AC-08: admin approve는 active 전환과 user.approve 성공 log를 남긴다', async ({
    request
  }) => {
    const pending = await createPendingGoogleUser('ac08-approve');
    pendingUserId = pending.userId;
    pendingEmail = pending.email;

    const response = await request.post(`/api/users/${pendingUserId}/approval/approve`, {
      data: approvePayload(pendingEmail, 'E2E AC08 승인')
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(true);

    const log = await expectActivityLog(request, 'user.approve', requestId, 200);
    assertNoSensitiveMetadata(log?.metadata);

    const usersResponse = await request.get(`/api/users?userId=${pendingUserId}&limit=1`);
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; status: string; full_name: string }>;
    };
    const approved = usersBody.users?.find((user) => user.id === pendingUserId);
    expect(approved?.status).toBe('active');
    expect(approved?.full_name).toBe('E2E AC08 승인');
  });

  test('AC-01 plan58: 생일 null 승인은 active 전환과 birthday null 저장', async ({ request }) => {
    const pending = await createPendingGoogleUser('ac01-plan58');

    const response = await request.post(`/api/users/${pending.userId}/approval/approve`, {
      data: approvePayload(pending.email, 'E2E AC01 미설정', null)
    });

    expect(response.status()).toBe(200);

    const usersResponse = await request.get(`/api/users?userId=${pending.userId}&limit=1`);
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; status: string; birthday: string | null }>;
    };
    const approved = usersBody.users?.find((user) => user.id === pending.userId);
    expect(approved?.status).toBe('active');
    expect(approved?.birthday).toBeNull();
  });

  test('AC-09: approve validation 실패는 400과 user.approve 실패 log', async ({ request }) => {
    const pending = await createPendingGoogleUser('ac09-approve');

    const response = await request.post(`/api/users/${pending.userId}/approval/approve`, {
      data: { email: pending.email }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectActivityLog(request, 'user.approve', requestId, 400);
    assertNoSensitiveMetadata(log?.metadata);
  });

  test('AC-10: admin reject는 rejected 전환과 user.reject 성공 log', async ({ request }) => {
    const pending = await createPendingGoogleUser('ac10-reject');

    const response = await request.post(`/api/users/${pending.userId}/approval/reject`, {
      data: { rejection_reason: 'E2E test reject' }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectActivityLog(request, 'user.reject', requestId, 200);
    assertNoSensitiveMetadata(log?.metadata);

    const usersResponse = await request.get(`/api/users?userId=${pending.userId}&limit=1`);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; status: string }>;
    };
    const rejected = usersBody.users?.find((user) => user.id === pending.userId);
    expect(rejected?.status).toBe('rejected');
  });

  test('AC-11: non-admin reject 요청은 403과 user.reject 실패 log', async ({ playwright, request }) => {
    const pending = await createPendingGoogleUser('ac11-reject');

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.post(`/api/users/${pending.userId}/approval/reject`, {
        data: {}
      });

      expect(response.status()).toBe(403);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expect
        .poll(async () => {
          const logs = await listActivityLogs(request, 'user.reject');
          return logs.find(
            (item) => item.request_id === requestId && item.http_status === 403
          );
        }, { timeout: 15_000 })
        .toBeTruthy();

      const logs = await listActivityLogs(request, 'user.reject');
      const matched = logs.find(
        (item) => item.request_id === requestId && item.http_status === 403
      );
      assertNoSensitiveMetadata(matched?.metadata);
    } finally {
      await userRequest.dispose();
    }
  });

  test('AC-06: pending 세션은 보호 API 호출 시 403 active-only 응답', async ({ playwright }) => {
    const pending = await createPendingGoogleUser('ac06-guard');
    const guestRequest = await createGuestRequestWithPassword(
      playwright,
      pending.email,
      pending.password
    );

    try {
      const response = await guestRequest.get('/api/notifications?limit=1');
      expect(response.status()).toBe(403);

      const body = (await response.json()) as { success?: boolean; message?: string };
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/활성|비활성/);
    } finally {
      await guestRequest.dispose();
    }
  });

  test('AC-13 API: password sign-in route는 410 Gone', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in', {
      data: { email: 'any@example.com', password: 'any-password' }
    });

    expect(response.status()).toBe(410);
    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Google 로그인/);
  });
});
