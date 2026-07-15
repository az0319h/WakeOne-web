import { expect, test, type APIRequestContext } from '@playwright/test';

type PlaywrightRequestFixture = {
  request: {
    newContext: (options: { storageState: string }) => Promise<APIRequestContext>;
  };
};

type ActivityLogRow = {
  actor_user_id: string | null;
  target_user_id: string | null;
  action?: string;
};

async function fetchActivityLogs(
  request: APIRequestContext,
  query = ''
): Promise<ActivityLogRow[]> {
  const response = await request.get(`/api/activity-logs?limit=50${query}`);
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogRow[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

async function resolveUserIdByEmail(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const response = await request.get(
    `/api/users?search=${encodeURIComponent(email)}&limit=5`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    users?: Array<{ id: string; email: string }>;
  };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.id).toBeTruthy();
  return user!.id;
}

async function seedUserProfileFailure(playwright: PlaywrightRequestFixture, label: string) {
  const userRequest = await playwright.request.newContext({
    storageState: 'e2e/.auth/user.json'
  });
  const patchResponse = await userRequest.patch('/api/profile', {
    data: { full_name: label }
  });
  expect(patchResponse.status()).toBe(403);
  await userRequest.dispose();
}

function assertScopedToUser(logs: ActivityLogRow[], userId: string) {
  expect(logs.length).toBeGreaterThan(0);
  for (const log of logs) {
    const matchesActor = log.actor_user_id === userId;
    const matchesTarget = log.target_user_id === userId;
    expect(matchesActor || matchesTarget).toBe(true);
  }
}

test.describe('활동 로그 API scope', () => {
  test('AC-13: admin log_user=self returns admin actor or target rows', async ({
    request
  }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL!;
    const adminId = await resolveUserIdByEmail(request, adminEmail);
    const logs = await fetchActivityLogs(request, '&log_user=self');
    assertScopedToUser(logs, adminId);
  });

  test('AC-14: admin log_user uuid returns that user actor or target rows', async ({
    request,
    playwright
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(request, userEmail);
    await seedUserProfileFailure(playwright, 'AC14 scope check');

    const logs = await fetchActivityLogs(
      request,
      `&log_user=${encodeURIComponent(userId)}`
    );
    assertScopedToUser(logs, userId);
  });

  test('AC-15: admin log_user=all returns logs beyond single-user scope', async ({
    request
  }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL!;
    const adminId = await resolveUserIdByEmail(request, adminEmail);
    const allLogs = await fetchActivityLogs(request, '&log_user=all');
    const selfLogs = await fetchActivityLogs(request, '&log_user=self');

    expect(allLogs.length).toBeGreaterThanOrEqual(selfLogs.length);

    const hasOtherUserActivity = allLogs.some(
      (log) =>
        log.actor_user_id !== adminId &&
        log.target_user_id !== adminId &&
        log.actor_user_id !== null
    );
    expect(hasOtherUserActivity || allLogs.length > selfLogs.length).toBe(true);
  });
});

test.describe('활동 로그 API scope (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-12: user GET returns only own actor or target rows', async ({
    request,
    playwright
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    await seedUserProfileFailure(playwright, 'AC12 scope check');

    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await adminRequest.dispose();

    const logs = await fetchActivityLogs(request);
    assertScopedToUser(logs, userId);
  });
});
