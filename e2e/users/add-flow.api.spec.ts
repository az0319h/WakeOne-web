import { expect, test, type APIRequestContext } from '@playwright/test';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
  target_label?: string;
};

type ActivityAction =
  | 'user.create'
  | 'user.update'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'profile.update';

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
    birthday: '1990-01-01'
  };
}

async function listActivityLogs(request: APIRequestContext, action: ActivityAction) {
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
  return expectActivityLog(request, 'user.create', requestId, status);
}

async function expectActivityLog(
  request: APIRequestContext,
  action: ActivityAction,
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
      { timeout: 10_000 }
    )
    .not.toBeNull();

  const logs = await listActivityLogs(request, action);
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === action &&
      item.http_status === status
  );
}

async function createUserViaApi(request: APIRequestContext, prefix: string) {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/users', {
    data: createUserPayload(email)
  });

  expect(response.status()).toBe(201);
  expect(response.headers()['x-request-id']).toBeTruthy();

  const body = (await response.json()) as { user_id?: string };
  expect(body.user_id).toBeTruthy();

  return { email, userId: body.user_id as string };
}

test.describe('사용자 추가 API와 activity log', () => {
  test('AC-06: 성공 생성은 x-request-id와 user.create 성공 로그를 남긴다', async ({
    request
  }) => {
    const email = uniqueEmail('ac06-user');
    const response = await request.post('/api/users', {
      data: createUserPayload(email)
    });

    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as {
      success?: boolean;
      user_id?: string;
      password?: string;
      initial_password?: string;
    };
    expect(body.success).toBe(true);
    expect(body.user_id).toBeTruthy();
    expect(body.password).toBeUndefined();
    expect(body.initial_password).toBeUndefined();

    const log = await expectUserCreateLog(request, requestId, 201);
    expect(log?.target_label).toBe(email);
    expect(JSON.stringify(log?.metadata ?? {})).not.toContain('12341234a');
  });

  test('AC-07: 필수값 누락은 400과 user.create 실패 로그를 남긴다', async ({ request }) => {
    const email = uniqueEmail('ac07-user');
    const response = await request.post('/api/users', {
      data: { email }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = (await response.json()) as { success?: boolean; message?: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('입력값');

    const log = await expectUserCreateLog(request, requestId, 400);
    const metadata = JSON.stringify(log?.metadata ?? {});
    expect(metadata).toContain('validation');
    expect(metadata).not.toContain('12341234a');
    expect(metadata).not.toContain('password');
  });

  test('AC-11: department·job_title 포함 생성은 400 validation이다', async ({ request }) => {
    const email = uniqueEmail('ac11-user');
    const response = await request.post('/api/users', {
      data: {
        ...createUserPayload(email),
        department: '콘텐츠팀',
        job_title: '팀장'
      }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    await expectUserCreateLog(request, requestId, 400);
  });

  test('AC-10: 관리자 사용자 수정은 user.update 로그를 남긴다', async ({ request }) => {
    const { userId } = await createUserViaApi(request, 'ac10-user');
    const response = await request.put(`/api/users/${userId}`, {
      data: {
        full_name: 'E2E 수정이름',
        affiliation: 'wake',
        rank: '마케팅팀',
        system_role: 'user',
        birthday: '1991-02-02'
      }
    });

    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectActivityLog(request, 'user.update', requestId, 200);
    expect(JSON.stringify(log?.metadata ?? {})).toContain('full_name');
    expect(JSON.stringify(log?.metadata ?? {})).toContain('changed_fields');
  });

  test('AC-13/14: 비활성화와 재활성화는 각각 로그를 남긴다', async ({ request }) => {
    const { userId } = await createUserViaApi(request, 'ac13-user');
    const deactivateResponse = await request.delete(`/api/users/${userId}`);

    expect(deactivateResponse.status()).toBe(200);
    const deactivateRequestId = deactivateResponse.headers()['x-request-id'];
    expect(deactivateRequestId).toBeTruthy();
    await expectActivityLog(request, 'user.deactivate', deactivateRequestId, 200);

    const reactivateResponse = await request.patch(`/api/users/${userId}`, {
      data: { action: 'reactivate' }
    });

    expect(reactivateResponse.status()).toBe(200);
    const reactivateRequestId = reactivateResponse.headers()['x-request-id'];
    expect(reactivateRequestId).toBeTruthy();
    await expectActivityLog(request, 'user.reactivate', reactivateRequestId, 200);
  });
});

test.describe('프로필 API와 activity log', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-06 plan21: 일반 사용자 PATCH /api/profile은 403이다', async ({ request }) => {
    const response = await request.patch('/api/profile', {
      data: {
        phone: '01012345678',
        birthday: '1992-03-03'
      }
    });

    expect(response.status()).toBe(403);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectActivityLog(request, 'profile.update', requestId, 403);
    expect(JSON.stringify(log?.metadata ?? {})).toContain('profile_edit_disabled');
  });

  test('AC-12: 일반 사용자는 관리자 전용 프로필 필드를 수정할 수 없다', async ({
    request
  }) => {
    const response = await request.patch('/api/profile', {
      data: {
        full_name: '변경 시도',
        affiliation: 'wake'
      }
    });

    expect(response.status()).toBe(403);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const log = await expectActivityLog(
      request,
      'profile.update',
      requestId,
      response.status()
    );
    expect(JSON.stringify(log?.metadata ?? {})).toContain('profile_edit_disabled');
  });
});
