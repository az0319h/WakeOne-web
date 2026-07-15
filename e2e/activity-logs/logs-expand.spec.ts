import { expect, test, type Page } from '@playwright/test';

async function expandFirstExpandableRow(page: Page) {
  const expandButton = page.getByRole('button', { name: '행 펼치기' }).first();
  await expect(expandButton).toBeVisible({ timeout: 15_000 });
  await expandButton.click();
  await expect(page.getByRole('button', { name: '행 접기' }).first()).toBeVisible();
}

test.describe('활동 로그 행 확장', () => {
  test('AC-10: failure log expand shows Korean message and http_status number', async ({
    browser
  }) => {
    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const userPage = await userContext.newPage();

    const patchResponse = await userContext.request.patch('/api/profile', {
      data: { full_name: '실패로그검증' }
    });
    expect(patchResponse.status()).toBe(403);

    try {
      await userPage.goto('/dashboard/logs');
      await expect(userPage.getByTestId('activity-logs-page')).toBeVisible();
      await expect(userPage.getByText('권한 없음').first()).toBeVisible({ timeout: 15_000 });

      await expandFirstExpandableRow(userPage);

      await expect(userPage.getByText('실패 상세')).toBeVisible();
      await expect(userPage.getByText('HTTP 상태')).toBeVisible();
      await expect(
        userPage.getByRole('definition').filter({ hasText: '403' })
      ).toBeVisible();
      await expect(userPage.getByText('profile_edit_disabled')).toBeVisible();
    } finally {
      await userContext.close();
    }
  });

  test('AC-11: success log expand shows technical details only inside panel', async ({
    page,
    request
  }) => {
    const marker = `ac11-${Date.now()}@example.com`;
    const createResponse = await request.post('/api/users', {
      data: {
        email: marker,
        full_name: `AC11 ${Date.now()}`,
        affiliation: 'wake',
        rank: '경영진',
        system_role: 'user',
        birthday: '1990-01-01'
      }
    });
    expect(createResponse.status()).toBe(201);
    const body = (await createResponse.json()) as { user_id?: string };
    const userId = body.user_id;
    expect(userId).toBeTruthy();

    const updateResponse = await request.put(`/api/users/${userId}`, {
      data: { full_name: `AC11-updated-${Date.now()}` }
    });
    expect(updateResponse.status()).toBe(200);
    const requestId = updateResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await page.goto(
      '/dashboard/logs?log_user=all&action=user.update&search=' + encodeURIComponent(marker)
    );
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();
    await expect(
      page.getByTestId('activity-log-row').getByText('사용자 정보 수정')
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId('activity-logs-table-root')).not.toContainText('POST');
    await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(requestId!);

    await expandFirstExpandableRow(page);

    await expect(page.getByText('기술 정보')).toBeVisible();
    await expect(page.getByText('Method')).toBeVisible();
    await expect(page.getByText('Request ID')).toBeVisible();
    await expect(page.getByText(requestId!)).toBeVisible();
    await expect(page.getByText('PUT', { exact: true })).toBeVisible();
  });
});
