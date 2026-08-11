import { expect, test, type Page } from '@playwright/test';

function loadingSpinner(page: Page) {
  return page.getByRole('status', { name: 'Loading' });
}

function announcementsListBody(page: Page) {
  return page
    .getByTestId('announcements-infinite-list')
    .or(page.getByTestId('announcements-empty'));
}

async function delayMatchingRoutes(page: Page, pattern: RegExp, delayMs: number) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

test.describe('Filter shell loading UX', () => {
  test('AC-1: users search keeps toolbar visible during refetch', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/users/, 1_500);
    const searchInput = page.getByPlaceholder('사용자 검색…');
    await searchInput.fill('e2e-filter-shell');
    await expect(searchInput).toBeVisible();
    await expect(page.getByRole('toolbar')).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await expect(searchInput).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible({
      timeout: 15_000
    });
  });

  test('AC-2: users pagination keeps toolbar visible during refetch', async ({
    page,
    request
  }) => {
    const usersResponse = await request.get('/api/users?limit=1');
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as { total_users: number };
    test.skip(usersBody.total_users <= 10, 'Pagination requires more than 10 users');

    await page.goto('/dashboard/users');
    await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/users/, 1_500);
    const nextClick = page.getByRole('button', { name: 'Go to next page' }).click();
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByPlaceholder('사용자 검색…')).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await nextClick;

    await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible({
      timeout: 15_000
    });
  });

  test('AC-3: logs combobox scope change keeps shell visible during refetch', async ({ page }) => {
    await page.goto('/dashboard/logs?log_user=self');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();
    await expect(page.getByTestId('activity-logs-table')).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/activity-logs/, 1_500);
    const combobox = page.getByTestId('log-user-combobox');
    await combobox.click();
    const scopeChange = page.getByRole('option', { name: '전체', exact: true }).click();
    await expect(page.getByRole('heading', { name: '활동 로그' })).toBeVisible();
    await expect(combobox).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await scopeChange;
    await expect(page.getByTestId('activity-logs-table')).toBeVisible({ timeout: 15_000 });
  });

  test('AC-4: logs pagination keeps combobox visible during refetch', async ({ page }) => {
    await page.goto('/dashboard/logs?log_user=self&perPage=5');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();

    const nextButton = page.getByRole('button', { name: 'Go to next page' });
    const canPaginate = await nextButton.isEnabled();
    test.skip(!canPaginate, 'Not enough self activity logs for pagination');

    await delayMatchingRoutes(page, /\/api\/activity-logs/, 1_500);
    const nextClick = nextButton.click();
    await expect(page.getByTestId('log-user-combobox')).toBeVisible();
    await expect(page.getByRole('toolbar')).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await nextClick;
    await expect(page.getByTestId('activity-logs-table')).toBeVisible({ timeout: 15_000 });
  });

  test('AC-5: announcements search keeps filter shell visible during refetch', async ({
    page
  }) => {
    await page.goto('/dashboard/announcements');
    await expect(page.getByTestId('announcements-page')).toBeVisible();
    await expect(page.getByTestId('announcements-infinite-list')).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/announcements/, 1_500);
    const searchInput = page.getByTestId('announcements-search-input');
    await searchInput.fill('filter-shell-e2e');
    await expect(page.getByTestId('announcements-list-filters')).toBeVisible();
    await expect(page.getByTestId('announcement-create-button')).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('announcements-list-filters')).toBeVisible();
    await expect(announcementsListBody(page)).toBeVisible({
      timeout: 15_000
    });
  });

  test('AC-6: announcements priority filter keeps filter shell visible during refetch', async ({
    page
  }) => {
    await page.goto('/dashboard/announcements');
    await expect(page.getByTestId('announcements-infinite-list')).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/announcements/, 1_500);
    await page.getByTestId('announcements-priority-filter').click();
    const filterChange = page.getByRole('option', { name: '중요' }).click();
    await expect(page.getByTestId('announcements-list-filters')).toBeVisible();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await filterChange;
    await expect(announcementsListBody(page)).toBeVisible({
      timeout: 15_000
    });
  });
});
