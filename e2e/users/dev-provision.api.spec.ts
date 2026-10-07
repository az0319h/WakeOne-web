import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createProfileWithStatus,
  createProvisionPayload,
  simulateGoogleLinkForPreProvisionedUser,
  uniqueEmail
} from './helpers';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
};

async function listActivityLogs(request: APIRequestContext, action: string) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function expectUserCreateLog(
  request: APIRequestContext,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, 'user.create');
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === 'user.create' &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched.metadata ?? {}) : null;
      },
      { timeout: 10_000 }
    )
    .not.toBeNull();
}

function assertNoSensitiveMetadata(metadata: unknown) {
  const json = JSON.stringify(metadata ?? {});
  expect(json).not.toMatch(/password/i);
  expect(json).not.toMatch(/token/i);
}

test.describe('dev 사용자 사전 등록 API (plan 70)', () => {
  test.describe.configure({ mode: 'serial' });

  test('AC-02: dev 환경에서 유효 body는 201과 active profile·success log', async ({
    request
  }) => {
    const email = uniqueEmail('ac02-provision');
    const fullName = `E2E AC02 ${Date.now()}`;

    const response = await request.post('/api/users', {
      data: createProvisionPayload(email, fullName)
    });

    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as {
      success?: boolean;
      message?: string;
      user_id?: string;
    };
    expect(body.success).toBe(true);
    expect(body.user_id).toBeTruthy();

    await expectUserCreateLog(request, requestId, 201);

    const usersResponse = await request.get(
      `/api/users?userId=${body.user_id}&limit=1`
    );
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; status: string; full_name: string; email: string }>;
    };
    const created = usersBody.users?.find((user) => user.id === body.user_id);
    expect(created?.status).toBe('active');
    expect(created?.full_name).toBe(fullName);
    expect(created?.email).toBe(email);
  });

  test('AC-03: pending_approval 이메일 충돌은 409과 failure log', async ({ request }) => {
    const pending = await createProfileWithStatus('ac03-provision', 'pending_approval');

    const response = await request.post('/api/users', {
      data: createProvisionPayload(pending.email)
    });

    expect(response.status()).toBe(409);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('승인 대기');

    await expectUserCreateLog(request, requestId, 409);
  });

  test('AC-04: active 이메일 충돌은 409과 failure log', async ({ request }) => {
    const active = await createProfileWithStatus('ac04-provision', 'active');

    const response = await request.post('/api/users', {
      data: createProvisionPayload(active.email)
    });

    expect(response.status()).toBe(409);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('이미 등록된');

    await expectUserCreateLog(request, requestId, 409);
  });

  test('AC-05: rejected 이메일 충돌은 409과 failure log', async ({ request }) => {
    const rejected = await createProfileWithStatus('ac05-provision', 'rejected');

    const response = await request.post('/api/users', {
      data: createProvisionPayload(rejected.email)
    });

    expect(response.status()).toBe(409);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('거절된 계정');

    await expectUserCreateLog(request, requestId, 409);
  });

  test('AC-06: inactive 이메일 충돌은 409과 failure log', async ({ request }) => {
    const inactive = await createProfileWithStatus('ac06-provision', 'inactive');

    const response = await request.post('/api/users', {
      data: createProvisionPayload(inactive.email)
    });

    expect(response.status()).toBe(409);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('비활성화된 계정');

    await expectUserCreateLog(request, requestId, 409);
  });

  test('AC-14: validation 실패는 400과 failure log·password metadata 없음', async ({
    request
  }) => {
    const response = await request.post('/api/users', {
      data: { email: 'not-an-email' }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expectUserCreateLog(request, requestId, 400);

    const logs = await listActivityLogs(request, 'user.create');
    const matched = logs.find(
      (item) => item.request_id === requestId && item.http_status === 400
    );
    assertNoSensitiveMetadata(matched?.metadata);
  });

  test('AC-12 plan70: pre-provision 후 Google link 시 동일 user_id·active 유지', async ({
    request
  }) => {
    const email = uniqueEmail('ac12-provision');
    const fullName = `E2E AC12 ${Date.now()}`;

    const createResponse = await request.post('/api/users', {
      data: createProvisionPayload(email, fullName)
    });
    expect(createResponse.status()).toBe(201);

    const createBody = (await createResponse.json()) as { user_id?: string };
    const userId = createBody.user_id;
    expect(userId).toBeTruthy();

    const linkResult = await simulateGoogleLinkForPreProvisionedUser(userId!, email);
    expect(linkResult.rows[0]?.user_id).toBe(userId);
    expect(linkResult.rows[0]?.status).toBe('active');

    const usersResponse = await request.get(`/api/users?userId=${userId}&limit=1`);
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; status: string }>;
    };
    const profile = usersBody.users?.find((user) => user.id === userId);
    expect(profile?.status).toBe('active');
  });
});
