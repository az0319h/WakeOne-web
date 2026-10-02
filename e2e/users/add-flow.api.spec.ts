import { expect, test, type APIRequestContext } from '@playwright/test';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
  target_label?: string;
};

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const E2E_TEST_PHONE = '01012345678';

function createUserPayload(email: string, fullName = 'E2E 테스트') {
  return {
    email,
    full_name: fullName,
    affiliation: 'wake',
    rank: '경영진',
    system_role: 'user',
    birthday: '1990-01-01',
    phone: E2E_TEST_PHONE
  };
}

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

test.describe('사용자 추가 API 제거 (plan 58)', () => {
  test('AC-06 plan58: POST /api/users는 410과 user.create log를 남긴다', async ({ request }) => {
    const email = uniqueEmail('ac06-user-removed');
    const response = await request.post('/api/users', {
      data: createUserPayload(email)
    });

    expect(response.status()).toBe(410);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('사용자 직접 추가');

    await expectUserCreateLog(request, requestId, 410);
  });
});
