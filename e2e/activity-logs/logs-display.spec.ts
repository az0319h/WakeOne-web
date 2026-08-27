import { expect, test, type Browser } from '@playwright/test';

async function openLogsAsUser(browser: Browser) {
  const context = await browser.newContext({
    storageState: 'e2e/.auth/user.json'
  });
  const page = await context.newPage();
  await page.goto('/dashboard/logs');
  await expect(page.getByTestId('activity-logs-page')).toBeVisible();
  return { context, page };
}

test.describe('활동 로그 표시', () => {
  test('AC-01: user sees own logs with Korean columns including endpoint', async ({ browser }) => {
    const { context, page } = await openLogsAsUser(browser);

    try {
      await expect(page.getByRole('heading', { name: '활동 로그' })).toBeVisible();
      await expect(
        page.getByText('본인과 관련된 활동 이력을 확인합니다.')
      ).toBeVisible();

      for (const header of ['시간', '행위자', '활동', 'Endpoint', '대상', '결과']) {
        await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
      }

      await expect(page.getByRole('columnheader', { name: 'Method' })).toHaveCount(0);
      await expect(page.getByTestId('log-user-combobox')).toHaveCount(0);
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(
        'Request ID'
      );
    } finally {
      await context.close();
    }
  });

  test('AC-45-8: admin sees auth.sign_in row as 로그인 without action code', async ({
    page,
    request
  }) => {
    const email = `ac45-8-signin-${Date.now()}@example.com`;
    const createResponse = await request.post('/api/users', {
      data: {
        email,
        full_name: 'AC45 로그인 라벨',
        affiliation: 'wake',
        rank: '경영진',
        system_role: 'user',
        birthday: '1990-01-01',
        phone: '01012345678'
      }
    });
    expect(createResponse.status()).toBe(201);

    const guestContext = await page.context().browser()!.newContext({
      storageState: { cookies: [], origins: [] }
    });
    const guestRequest = guestContext.request;

    try {
      const signInResponse = await guestRequest.post('/api/auth/sign-in', {
        data: { email, password: '12341234a' }
      });
      expect(signInResponse.status()).toBe(200);

      await page.goto('/dashboard/logs?log_user=all&action=auth.sign_in');
      await expect(page.getByTestId('activity-logs-page')).toBeVisible();
      await expect(page.getByText('로그인').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(
        'auth.sign_in'
      );
    } finally {
      await guestContext.close();
    }
  });

  test('AC-02: activity column shows Korean label without action code', async ({ browser }) => {
    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const page = await userContext.newPage();

    try {
      const patchResponse = await userContext.request.patch('/api/profile', {
        data: { full_name: 'AC02 한국어라벨' }
      });
      expect(patchResponse.status()).toBe(403);

      await page.goto('/dashboard/logs');
      await expect(page.getByTestId('activity-logs-table')).toBeVisible();
      await expect(page.getByText('프로필 수정').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(
        'profile.update'
      );
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(
        'user.invite'
      );
    } finally {
      await userContext.close();
    }
  });
});
