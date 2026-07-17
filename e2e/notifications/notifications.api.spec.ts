import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createUserViaApi,
  resolveUserIdByEmail,
  uniqueEmail,
  updateUserFullName
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

async function expectActivityLog(
  request: APIRequestContext,
  action: string,
  requestId: string,
  status: number
) {
  await expect
    .poll(async () => {
      const logs = await listActivityLogs(request, action);
      return logs.some(
        (item) =>
          item.request_id === requestId &&
          item.action === action &&
          item.http_status === status
      );
    })
    .toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.describe('알림 API', () => {
  test('AC-12: GET /api/notifications limit=10', async ({ playwright }) => {
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const response = await userRequest.get('/api/notifications?limit=10');
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      data?: {
        notifications?: unknown[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.notifications)).toBe(true);
    expect(typeof body.data?.hasMore).toBe('boolean');

    await userRequest.dispose();
  });

  test('AC-13: PATCH 단건 읽음 200·DB status=read', async ({ playwright }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await userRequest.patch('/api/notifications/read-all');
    await updateUserFullName(adminRequest, userId, `E2E알림AC13-${Date.now()}`);

    const listResponse = await userRequest.get('/api/notifications?limit=5');
    const listBody = (await listResponse.json()) as {
      data?: { notifications?: Array<{ id: number; status: string }> };
    };
    const notificationId = listBody.data?.notifications?.find(
      (item) => item.status === 'unread'
    )?.id;
    expect(notificationId).toBeTruthy();

    const response = await userRequest.patch(
      `/api/notifications/${notificationId}/read`
    );
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const verifyResponse = await userRequest.get('/api/notifications?limit=50');
    const verifyBody = (await verifyResponse.json()) as {
      data?: {
        notifications?: Array<{ id: number; status: string; read_at: string | null }>;
      };
    };
    const updated = verifyBody.data?.notifications?.find(
      (item) => item.id === notificationId
    );
    expect(updated?.status).toBe('read');
    expect(updated?.read_at).toBeTruthy();

    await expectActivityLog(userRequest, 'notification.read', requestId!, 200);

    await adminRequest.dispose();
    await userRequest.dispose();
  });

  test('AC-14: PATCH read-all 200·unread 전부 read', async ({ playwright }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await userRequest.patch('/api/notifications/read-all');
    await updateUserFullName(adminRequest, userId, `E2E알림AC14a-${Date.now()}`);
    await updateUserFullName(adminRequest, userId, `E2E알림AC14b-${Date.now()}`);

    const response = await userRequest.patch('/api/notifications/read-all');
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const response = await userRequest.get('/api/notifications?limit=50');
        const body = (await response.json()) as {
          data?: { notifications?: Array<{ status: string }> };
        };
        return (
          body.data?.notifications?.filter((item) => item.status === 'unread').length ??
          0
        );
      })
      .toBe(0);

    await expectActivityLog(userRequest, 'notification.read_all', requestId!, 200);

    await adminRequest.dispose();
    await userRequest.dispose();
  });

  test('AC-15: 타인 알림 PATCH read 403', async ({ playwright }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const user2Request = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const user2Id = await resolveUserIdByEmail(adminRequest, user2Email!);
    await updateUserFullName(adminRequest, user2Id, `E2E알림AC15-${Date.now()}`);

    const listResponse = await adminRequest.get(
      `/api/notifications?notif_user=${encodeURIComponent(user2Id)}&limit=5`
    );
    const listBody = (await listResponse.json()) as {
      data?: { notifications?: Array<{ id: number }> };
    };
    const notificationId = listBody.data?.notifications?.[0]?.id;
    expect(notificationId).toBeTruthy();

    const response = await userRequest.patch(
      `/api/notifications/${notificationId}/read`
    );
    expect(response.status()).toBe(403);

    await adminRequest.dispose();
    await userRequest.dispose();
    await user2Request.dispose();
  });

  test('AC-16: admin GET notif_user={B.id}', async ({ request }) => {
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const user2Id = await resolveUserIdByEmail(request, user2Email!);
    await updateUserFullName(request, user2Id, `E2E알림AC16-${Date.now()}`);

    const response = await request.get(
      `/api/notifications?notif_user=${encodeURIComponent(user2Id)}&limit=10`
    );
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      data?: { notifications?: Array<{ title: string }> };
    };
    expect(body.success).toBe(true);
    expect((body.data?.notifications?.length ?? 0) > 0).toBe(true);
  });
});

test.describe('알림 API activity log', () => {
  test('AC-17: notification.read activity log 2xx', async ({ playwright }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await userRequest.patch('/api/notifications/read-all');
    await updateUserFullName(adminRequest, userId, `E2E알림AC17-${Date.now()}`);

    const listResponse = await userRequest.get('/api/notifications?limit=5');
    const listBody = (await listResponse.json()) as {
      data?: { notifications?: Array<{ id: number }> };
    };
    const notificationId = listBody.data?.notifications?.[0]?.id;
    expect(notificationId).toBeTruthy();

    const response = await userRequest.patch(
      `/api/notifications/${notificationId}/read`
    );
    expect(response.status()).toBe(200);
    await expectActivityLog(
      userRequest,
      'notification.read',
      response.headers()['x-request-id']!,
      200
    );

    await adminRequest.dispose();
    await userRequest.dispose();
  });

  test('AC-18: notification.read_all activity log 2xx', async ({ playwright }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await updateUserFullName(adminRequest, userId, `E2E알림AC18-${Date.now()}`);

    const response = await userRequest.patch('/api/notifications/read-all');
    expect(response.status()).toBe(200);
    await expectActivityLog(
      userRequest,
      'notification.read_all',
      response.headers()['x-request-id']!,
      200
    );

    await adminRequest.dispose();
    await userRequest.dispose();
  });

  test('AC-19: user.update log·알림 INSERT 별도 activity log 없음', async ({
    request
  }) => {
    const email = uniqueEmail('notif-ac19');
    const userId = await createUserViaApi(request, email, `AC19-${Date.now()}`);

    const response = await request.put(`/api/users/${userId}`, {
      data: {
        full_name: `AC19-updated-${Date.now()}`,
        affiliation: 'wake',
        rank: '경영진'
      }
    });
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await listActivityLogs(request, 'user.update');
        return logs.some(
          (item) =>
            item.request_id === requestId &&
            item.action === 'user.update' &&
            item.http_status === 200
        );
      })
      .toBe(true);

    const userUpdateLogs = await listActivityLogs(request, 'user.update');
    const matched = userUpdateLogs.find((item) => item.request_id === requestId);
    expect(JSON.stringify(matched?.metadata ?? {})).toContain('full_name');

    const allLogsResponse = await request.get(
      `/api/activity-logs?limit=50&log_user=${encodeURIComponent(userId)}`
    );
    expect(allLogsResponse.status()).toBe(200);
    const allLogsBody = (await allLogsResponse.json()) as {
      data?: { logs?: ActivityLogItem[] };
    };
    const requestLogs =
      allLogsBody.data?.logs?.filter((item) => item.request_id === requestId) ?? [];
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0]?.action).toBe('user.update');
  });
});
