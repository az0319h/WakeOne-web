import { expect, test, type APIRequestContext } from '@playwright/test';
import { e2eBaseURL } from '../helpers/auth-request';
import { INITIAL_USER_PASSWORD, resolveE2EPassword } from '../helpers/e2e-credentials';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  http_path?: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  target_user_id?: string | null;
  metadata?: Record<string, unknown>;
};

const E2E_TEST_PHONE = '01012345678';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function createUserPayload(email: string, fullName = 'E2E SignIn API') {
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

async function createEmptyRequestContext(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } }
) {
  return playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });
}

async function createUserViaAdmin(request: APIRequestContext, prefix: string) {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/users', {
    data: createUserPayload(email)
  });
  expect(response.status()).toBe(201);

  const body = (await response.json()) as { user_id?: string };
  expect(body.user_id).toBeTruthy();
  return { email, userId: body.user_id as string };
}

async function listSignInLogs(request: APIRequestContext, query = '&log_user=all') {
  const response = await request.get(
    `/api/activity-logs?action=auth.sign_in&limit=50${query}`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function countSignInLogs(request: APIRequestContext) {
  const logs = await listSignInLogs(request);
  return logs.length;
}

async function expectSignInLog(
  request: APIRequestContext,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listSignInLogs(request);
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === 'auth.sign_in' &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched) : null;
      },
      { timeout: 15_000 }
    )
    .not.toBeNull();

  const logs = await listSignInLogs(request);
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === 'auth.sign_in' &&
      item.http_status === status
  );
}

async function expectNoNewSignInLog(
  request: APIRequestContext,
  baselineCount: number
) {
  await expect
    .poll(
      async () => countSignInLogs(request),
      { timeout: 5_000 }
    )
    .toBe(baselineCount);
}

function assertNoSensitiveMetadata(metadata: unknown, password?: string) {
  const json = JSON.stringify(metadata ?? {});
  expect(json).not.toMatch(/password/i);
  expect(json).not.toMatch(/token/i);
  if (password) {
    expect(json).not.toContain(password);
  }
}

test.describe('로그인 API activity log', () => {
  test.describe.configure({ mode: 'serial' });

  let userAEmail = '';
  let userAId = '';
  let userASignInRequestId = '';
  let userASession: APIRequestContext | null = null;

  test.afterAll(async () => {
    if (userASession) {
      await userASession.dispose();
    }
  });

  test('AC-1: 성공 sign-in은 x-request-id와 auth.sign_in 200 로그를 남긴다', async ({
    playwright,
    request
  }) => {
    const created = await createUserViaAdmin(request, 'ac1-signin');
    userAEmail = created.email;
    userAId = created.userId;

    userASession = await createEmptyRequestContext(playwright);
    const signInResponse = await userASession.post('/api/auth/sign-in', {
      data: { email: userAEmail, password: INITIAL_USER_PASSWORD }
    });

    expect(signInResponse.status()).toBe(200);
    userASignInRequestId = signInResponse.headers()['x-request-id'];
    expect(userASignInRequestId).toBeTruthy();

    const log = await expectSignInLog(request, userASignInRequestId, 200);
    expect(log?.http_path).toBe('/api/auth/sign-in');
    expect(log?.actor_user_id).toBe(userAId);
    expect(log?.target_user_id).toBe(userAId);
    assertNoSensitiveMetadata(log?.metadata, INITIAL_USER_PASSWORD);
  });

  test('AC-2: 잘못된 비밀번호 sign-in은 401이며 activity log를 남기지 않는다', async ({
    playwright,
    request
  }) => {
    const created = await createUserViaAdmin(request, 'ac2-signin');
    const guestRequest = await createEmptyRequestContext(playwright);
    const wrongPassword = `Wrong${Date.now()}!`;
    const baselineCount = await countSignInLogs(request);

    const signInResponse = await guestRequest.post('/api/auth/sign-in', {
      data: { email: created.email, password: wrongPassword }
    });

    expect(signInResponse.status()).toBe(401);
    expect(signInResponse.headers()['x-request-id']).toBeFalsy();
    await expectNoNewSignInLog(request, baselineCount);

    await guestRequest.dispose();
  });

  test('AC-3: inactive user sign-in은 403이며 activity log를 남기지 않는다', async ({
    playwright,
    request
  }) => {
    const created = await createUserViaAdmin(request, 'ac3-signin');
    const deactivateResponse = await request.delete(`/api/users/${created.userId}`);
    expect(deactivateResponse.status()).toBe(200);

    const guestRequest = await createEmptyRequestContext(playwright);
    const baselineCount = await countSignInLogs(request);

    const signInResponse = await guestRequest.post('/api/auth/sign-in', {
      data: { email: created.email, password: INITIAL_USER_PASSWORD }
    });

    expect(signInResponse.status()).toBe(403);
    expect(signInResponse.headers()['x-request-id']).toBeFalsy();
    await expectNoNewSignInLog(request, baselineCount);

    await guestRequest.dispose();
  });

  test('AC-4: email 형식 오류 sign-in은 400이며 activity log를 남기지 않는다', async ({
    playwright,
    request
  }) => {
    const guestRequest = await createEmptyRequestContext(playwright);
    const baselineCount = await countSignInLogs(request);

    const signInResponse = await guestRequest.post('/api/auth/sign-in', {
      data: { email: 'not-an-email', password: 'any-password' }
    });

    expect(signInResponse.status()).toBe(400);
    expect(signInResponse.headers()['x-request-id']).toBeFalsy();
    await expectNoNewSignInLog(request, baselineCount);

    await guestRequest.dispose();
  });

  test('AC-5: admin GET auth.sign_in 로그에 AC-1 user 성공 행이 포함된다', async ({
    request
  }) => {
    test.skip(!userASignInRequestId, 'AC-1 sign-in request id required');

    const logs = await listSignInLogs(request);
    const matched = logs.find(
      (item) =>
        item.request_id === userASignInRequestId &&
        item.action === 'auth.sign_in' &&
        item.http_status === 200 &&
        item.actor_user_id === userAId
    );
    expect(matched).toBeTruthy();
  });

  test('AC-6: user A 세션 GET activity-logs는 본인 actor/target만 포함한다', async () => {
    test.skip(!userASession || !userAId, 'AC-1 user session required');

    const response = await userASession!.get('/api/activity-logs?limit=50');
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      data?: { logs?: ActivityLogItem[] };
    };
    expect(body.success).toBe(true);

    const logs = body.data?.logs ?? [];
    expect(logs.length).toBeGreaterThan(0);

    for (const log of logs) {
      const matchesActor = log.actor_user_id === userAId;
      const matchesTarget = log.target_user_id === userAId;
      expect(matchesActor || matchesTarget).toBe(true);
    }

    const signInLog = logs.find(
      (item) =>
        item.request_id === userASignInRequestId &&
        item.action === 'auth.sign_in' &&
        item.http_status === 200
    );
    expect(signInLog).toBeTruthy();
  });

  test('AC-7: user B 세션 GET activity-logs에 user A sign-in 행이 없다', async ({
    playwright
  }) => {
    test.skip(!userASignInRequestId, 'AC-1 sign-in request id required');

    const user2Email = process.env.E2E_USER2_EMAIL;
    const user2Password = resolveE2EPassword(process.env.E2E_USER2_PASSWORD);
    test.skip(!user2Email || !user2Password, 'E2E_USER2 credentials required');

    const userBSession = await createEmptyRequestContext(playwright);
    const signInResponse = await userBSession.post('/api/auth/sign-in', {
      data: { email: user2Email, password: user2Password }
    });
    expect(signInResponse.status()).toBe(200);

    const response = await userBSession.get('/api/activity-logs?limit=50');
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      data?: { logs?: ActivityLogItem[] };
    };
    expect(body.success).toBe(true);

    const logs = body.data?.logs ?? [];
    const leaked = logs.find((item) => item.request_id === userASignInRequestId);
    expect(leaked).toBeUndefined();

    await userBSession.dispose();
  });

  test('AC-9: sign-in 성공(200) metadata에 password·token 필드가 없다', async ({
    playwright,
    request
  }) => {
    const created = await createUserViaAdmin(request, 'ac9-signin');
    const guestRequest = await createEmptyRequestContext(playwright);

    const successResponse = await guestRequest.post('/api/auth/sign-in', {
      data: { email: created.email, password: INITIAL_USER_PASSWORD }
    });
    expect(successResponse.status()).toBe(200);
    const successRequestId = successResponse.headers()['x-request-id'];
    expect(successRequestId).toBeTruthy();
    const successLog = await expectSignInLog(request, successRequestId, 200);
    assertNoSensitiveMetadata(successLog?.metadata, INITIAL_USER_PASSWORD);

    await guestRequest.dispose();
  });
});
