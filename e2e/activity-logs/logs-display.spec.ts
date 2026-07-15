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
