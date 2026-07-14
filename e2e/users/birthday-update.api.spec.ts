import { expect, test, type APIRequestContext } from '@playwright/test';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
};

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function listActivityLogs(request: APIRequestContext) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent('user.update')}&limit=50`
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
        const logs = await listActivityLogs(request);
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

  const logs = await listActivityLogs(request);
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === 'user.update' &&
      item.http_status === status
  );
}

test.describe('plan22 PUT birthday · user.update activity log', () => {
  test('AC-04 plan22: PUT birthday 성공 시 200 · changed_fields · user.update 2xx', async ({
    request
  }) => {
    const email = uniqueEmail('p22-ac04');
    const createResponse = await request.post('/api/users', {
      data: {
        email,
        full_name: 'E2E 생일수정',
        affiliation: 'wake',
        rank: '사원',
        system_role: 'user',
        birthday: '1990-01-01'
      }
    });
    expect(createResponse.status()).toBe(201);
    const createBody = (await createResponse.json()) as { user_id?: string };
    const userId = createBody.user_id as string;

    const response = await request.put(`/api/users/${userId}`, {
      data: { birthday: '1991-06-18' }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectUserUpdateLog(request, requestId!, 200);
    const metadata = JSON.stringify(log?.metadata ?? {});
    expect(metadata).toContain('changed_fields');
    expect(metadata).toContain('birthday');
    expect(metadata).not.toMatch(/1991-06-18/);
  });
});
