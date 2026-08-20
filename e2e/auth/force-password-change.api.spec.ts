import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest, e2eBaseURL } from '../helpers/auth-request';

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: unknown;
};

const INITIAL_PASSWORD = '12341234a';
const NEW_PASSWORD = 'NewPass123';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const E2E_TEST_PHONE = '01012345678';

function createUserPayload(email: string, fullName = 'E2E ForceChange API') {
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

async function createUserViaAdmin(request: APIRequestContext, email: string) {
  await expect
    .poll(async () => {
      const response = await request.post('/api/users', {
        data: createUserPayload(email)
      });
      return response.status();
    }, { timeout: 15_000 })
    .toBe(201);
  return email;
}

async function createEmptyRequestContext(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } }
) {
  return playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });
}

async function createMustChangeRequest(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } },
  email: string
) {
  const context = await createEmptyRequestContext(playwright);

  await expect
    .poll(async () => {
      const signInResponse = await context.post('/api/auth/sign-in', {
        data: { email, password: INITIAL_PASSWORD }
      });
      if (signInResponse.status() !== 200) {
        return null;
      }
      const body = (await signInResponse.json()) as { mustChange?: boolean };
      return body.mustChange === true ? true : null;
    }, { timeout: 30_000 })
    .toBe(true);

  return context;
}

async function createSessionWithoutMustChangeCookie(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } },
  adminRequest: APIRequestContext,
  email: string,
  newPassword: string
) {
  const mustChangeRequest = await createMustChangeRequest(playwright, email);
  const changeResponse = await mustChangeRequest.patch('/api/auth/force-password-change', {
    data: {
      new_password: newPassword,
      confirm_password: newPassword
    }
  });
  expect(changeResponse.status()).toBe(200);
  await mustChangeRequest.dispose();

  const sessionRequest = await createEmptyRequestContext(playwright);
  await expect
    .poll(async () => {
      const signInResponse = await sessionRequest.post('/api/auth/sign-in', {
        data: { email, password: newPassword }
      });
      if (signInResponse.status() !== 200) {
        return null;
      }
      const body = (await signInResponse.json()) as { mustChange?: boolean };
      return body.mustChange === false ? true : null;
    }, { timeout: 30_000 })
    .toBe(true);
  return sessionRequest;
}

async function listForcePasswordChangeLogs(request: APIRequestContext) {
  const response = await request.get(
    '/api/activity-logs?action=auth.force_password_change&limit=50&log_user=all'
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function expectForcePasswordChangeLog(
  request: APIRequestContext,
  requestId: string,
  status: number
) {
  await expect
    .poll(
      async () => {
        const logs = await listForcePasswordChangeLogs(request);
        const matched = logs.find(
          (item) =>
            item.request_id === requestId &&
            item.action === 'auth.force_password_change' &&
            item.http_status === status
        );
        return matched ? JSON.stringify(matched.metadata ?? {}) : null;
      },
      { timeout: 15_000 }
    )
    .not.toBeNull();

  const logs = await listForcePasswordChangeLogs(request);
  return logs.find(
    (item) =>
      item.request_id === requestId &&
      item.action === 'auth.force_password_change' &&
      item.http_status === status
  );
}

test.describe('초기 비밀번호 강제 변경 API', () => {
  test.describe.configure({ mode: 'serial' });

  test('AC-4: force-change 세션에서 allowlist 외 API는 403이다', async ({
    playwright,
    request
  }) => {
    const email = uniqueEmail('ac4-force-api');
    await createUserViaAdmin(request, email);

    const mustChangeRequest = await createMustChangeRequest(playwright, email);
    const response = await mustChangeRequest.get('/api/notifications');

    expect(response.status()).toBe(403);
    const body = (await response.json()) as { success?: boolean };
    expect(body.success).toBe(false);

    await mustChangeRequest.dispose();
  });

  test('AC-10: 성공 변경 직후 auth.force_password_change 로그 1건 (평문 PW 없음)', async ({
    playwright,
    request
  }) => {
    const email = uniqueEmail('ac10-force-api');
    await createUserViaAdmin(request, email);

    const mustChangeRequest = await createMustChangeRequest(playwright, email);
    const patchResponse = await mustChangeRequest.patch('/api/auth/force-password-change', {
      data: {
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD
      }
    });

    expect(patchResponse.status()).toBe(200);
    const requestId = patchResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const adminRequest = await createAdminRequest(playwright);
    const log = await expectForcePasswordChangeLog(adminRequest, requestId, 200);
    const metadata = JSON.stringify(log?.metadata ?? {});
    expect(metadata).not.toContain(NEW_PASSWORD);
    expect(metadata).not.toContain(INITIAL_PASSWORD);
    expect(metadata).not.toContain('password');

    await mustChangeRequest.dispose();
    await adminRequest.dispose();
  });

  test('AC-11: 401 미인증 PATCH는 auth.force_password_change 로그 1건', async ({
    playwright
  }) => {
    const unauthRequest = await createEmptyRequestContext(playwright);
    const response = await unauthRequest.patch('/api/auth/force-password-change', {
      data: {
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD
      }
    });

    expect(response.status()).toBe(401);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const adminRequest = await createAdminRequest(playwright);
    await expectForcePasswordChangeLog(adminRequest, requestId, 401);

    await unauthRequest.dispose();
    await adminRequest.dispose();
  });

  test('AC-11: 403 쿠키 없는 세션 PATCH는 auth.force_password_change 로그 1건', async ({
    playwright,
    request
  }) => {
    const email = uniqueEmail('ac11-403-force');
    const changedPassword = `NoCookie${Date.now()}c3`;
    await createUserViaAdmin(request, email);

    const sessionRequest = await createSessionWithoutMustChangeCookie(
      playwright,
      request,
      email,
      changedPassword
    );

    const nextPassword = `Another${Date.now()}d4`;
    const response = await sessionRequest.patch('/api/auth/force-password-change', {
      data: {
        new_password: nextPassword,
        confirm_password: nextPassword
      }
    });

    expect(response.status()).toBe(403);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const adminRequest = await createAdminRequest(playwright);
    await expectForcePasswordChangeLog(adminRequest, requestId, 403);

    await sessionRequest.dispose();
    await adminRequest.dispose();
  });

  test('AC-11: 400 validation PATCH는 auth.force_password_change 로그 1건', async ({
    playwright,
    request
  }) => {
    const email = uniqueEmail('ac11-val-force');
    await createUserViaAdmin(request, email);

    const mustChangeRequest = await createMustChangeRequest(playwright, email);
    const response = await mustChangeRequest.patch('/api/auth/force-password-change', {
      data: {
        new_password: INITIAL_PASSWORD,
        confirm_password: INITIAL_PASSWORD
      }
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const adminRequest = await createAdminRequest(playwright);
    const log = await expectForcePasswordChangeLog(adminRequest, requestId, 400);
    expect(JSON.stringify(log?.metadata ?? {})).not.toContain(INITIAL_PASSWORD);

    await mustChangeRequest.dispose();
    await adminRequest.dispose();
  });

  test('AC-11: 500 invalid JSON PATCH는 auth.force_password_change 로그 1건', async ({
    playwright,
    request
  }) => {
    const email = uniqueEmail('ac11-500-force');
    await createUserViaAdmin(request, email);

    const mustChangeRequest = await createMustChangeRequest(playwright, email);
    const storage = await mustChangeRequest.storageState();
    const cookieHeader = storage.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    const response = await fetch(`${e2eBaseURL}/api/auth/force-password-change`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: 'not-json'
    });

    expect(response.status).toBe(500);
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    if (!requestId) {
      throw new Error('Missing x-request-id header');
    }

    const adminRequest = await createAdminRequest(playwright);
    await expectForcePasswordChangeLog(adminRequest, requestId, 500);

    await mustChangeRequest.dispose();
    await adminRequest.dispose();
  });
});
