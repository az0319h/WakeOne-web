import { expect, test, type APIRequestContext } from '@playwright/test';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
};

const E2E_TEST_PHONE = '01012345678';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

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

async function listActivityLogs(request: APIRequestContext, action: 'user.update') {
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

async function expectUserUpdateLog(
  request: APIRequestContext,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, 'user.update');
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === 'user.update' &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched.metadata ?? {}) : null;
      },
      { timeout: 10_000 }
    )
    .not.toBeNull();

  const logs = await listActivityLogs(request, 'user.update');
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === 'user.update' &&
      item.http_status === status
  );
}

async function createUserViaApi(request: APIRequestContext, prefix: string) {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/users', {
    data: createUserPayload(email)
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  return { email, userId: body.user_id as string };
}

test.describe('admin 사용자 연락처 API', () => {
  test('AC-6 plan30: POST 잘못된 phone 형식은 400 validation이다', async ({ request }) => {
    const email = uniqueEmail('ac6-plan30-api');
    const response = await request.post('/api/users', {
      data: {
        ...createUserPayload(email),
        phone: '0101234567'
      }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('입력값');

    await expect
      .poll(
        async () => {
          const logsResponse = await request.get(
            `/api/activity-logs?action=${encodeURIComponent('user.create')}&limit=50`
          );
          const logsBody = (await logsResponse.json()) as {
            data?: { logs?: ActivityLogItem[] };
          };
          const matched = logsBody.data?.logs?.find(
            (item) =>
              item.request_id === requestId &&
              item.action === 'user.create' &&
              item.http_status === 400
          );
          return matched ? JSON.stringify(matched.metadata ?? {}) : null;
        },
        { timeout: 10_000 }
      )
      .not.toBeNull();
  });

  test('AC-8 plan30: PUT body phone 누락은 400 validation이다', async ({ request }) => {
    const { userId } = await createUserViaApi(request, 'ac8-plan30');

    const response = await request.put(`/api/users/${userId}`, {
      data: {
        full_name: '이름만 변경',
        affiliation: 'wake',
        rank: '경영진',
        system_role: 'user',
        birthday: '1990-01-01'
      }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectUserUpdateLog(request, requestId!, 400);
    expect(JSON.stringify(log?.metadata ?? {})).toContain('validation');
  });

  test('AC-9 plan30: PUT phone 변경 성공 시 changed_fields에 phone이 포함된다', async ({
    request
  }) => {
    const { userId } = await createUserViaApi(request, 'ac9-plan30');

    const response = await request.put(`/api/users/${userId}`, {
      data: {
        affiliation: 'wake',
        rank: '경영진',
        system_role: 'user',
        birthday: '1990-01-01',
        phone: '01098765432'
      }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectUserUpdateLog(request, requestId!, 200);
    const metadata = JSON.stringify(log?.metadata ?? {});
    expect(metadata).toContain('changed_fields');
    expect(metadata).toContain('phone');
    expect(metadata).not.toMatch(/01098765432/);
  });
});
