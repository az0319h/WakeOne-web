import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';

function loadingSpinner(page: Page) {
  return page.getByRole('status', { name: 'Loading' });
}

async function delayMatchingRoutes(page: Page, pattern: RegExp, delayMs: number) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

async function gotoWithDelayedApi(
  page: Page,
  path: string,
  apiPattern: RegExp,
  {
    heading,
    blockedLocator
  }: {
    heading: string | RegExp;
    blockedLocator: Locator;
  }
) {
  await delayMatchingRoutes(page, apiPattern, 2_000);
  const navigation = page.goto(path, { waitUntil: 'commit' });

  await expect(page.getByRole('heading', { name: heading })).toBeVisible({
    timeout: 15_000
  });
  await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
  await expect(blockedLocator).toHaveCount(0);

  await navigation;
  await expect(blockedLocator).toBeVisible({ timeout: 20_000 });
}

test.describe('Dashboard loading spinner unification', () => {
  test('AC-02: users initial entry shows header and spinner without table skeleton', async ({
    page
  }) => {
    await gotoWithDelayedApi(page, '/dashboard/users', /\/api\/users/, {
      heading: '사용자 관리',
      blockedLocator: page.getByRole('columnheader', { name: /이름/ })
    });
    await expect(page.getByText(/500|Application error|Internal Server Error/i)).toHaveCount(0);
  });

  test('AC-03: users pagination refetch shows spinner and keeps page header', async ({
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
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await nextClick;

    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(/500|Application error|Internal Server Error/i)).toHaveCount(0);
  });

  test('AC-04: contracts page shows header and spinner instead of table skeleton', async ({
    page
  }) => {
    await gotoWithDelayedApi(page, '/dashboard/contracts', /\/api\/contracts/, {
      heading: '계약서 관리',
      blockedLocator: page.getByRole('columnheader', { name: '문서번호' })
    });
  });

  test('AC-06: logs self pagination keeps page 2 rows without table skeleton', async ({
    page
  }) => {
    await page.goto('/dashboard/logs?log_user=self&perPage=5');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();

    const nextButton = page.getByRole('button', { name: 'Go to next page' });
    const canPaginate = await nextButton.isEnabled();
    test.skip(!canPaginate, 'Not enough self activity logs for pagination');

    await delayMatchingRoutes(page, /\/api\/activity-logs/, 1_500);
    const nextClick = nextButton.click();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await nextClick;

    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/log_user=self/);
    await expect(page.getByRole('heading', { name: '활동 로그' })).toBeVisible();
    await expect(page.getByTestId('activity-logs-table')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText('Page 2 of')).toBeVisible();
  });

  test('AC-07: system-email-logs shows spinner instead of skeleton table', async ({ page }) => {
    await page.goto('/dashboard/system-email-logs');
    await expect(page.getByRole('heading', { name: '독촉 이메일 로그' })).toBeVisible();
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible();

    const nextButton = page.getByRole('button', { name: 'Go to next page' });
    const canPaginate = await nextButton.isEnabled();

    if (canPaginate) {
      await delayMatchingRoutes(page, /\/api\/system-email-logs/, 1_500);
      await nextButton.click();
      await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('system-email-logs-table')).toBeVisible({
        timeout: 15_000
      });
      return;
    }

    const navigation = page.reload({ waitUntil: 'commit' });
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '독촉 이메일 로그' })).toBeVisible({
      timeout: 15_000
    });
    await navigation;
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible({
      timeout: 20_000
    });
  });

  test('AC-08: contract detail sheet shows compact spinner while loading', async ({
    page,
    request
  }) => {
    const headers = importAuthHeaders();
    expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();

    const documentNumber = uniqueDocumentNumber('AC08');
    const importResponse = await request.post('/api/contracts/import', {
      headers: headers!,
      data: buildImportPayload(documentNumber)
    });
    expect(importResponse.status()).toBe(201);

    await page.goto(
      `/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`
    );
    const row = page.getByRole('row', { name: new RegExp(documentNumber) });
    await expect(row).toBeVisible();

    await delayMatchingRoutes(page, /\/api\/contracts\/\d+/, 2_000);
    await row.getByRole('button', { name: '계약서 작업 메뉴 열기' }).click();
    await page.getByRole('menuitem', { name: /상세 보기/ }).click();

    const detailDialog = page.getByRole('dialog', { name: '계약서 상세' });
    await expect(detailDialog).toBeVisible({ timeout: 10_000 });
    await expect(detailDialog.getByRole('status', { name: 'Loading' })).toBeVisible({
      timeout: 10_000
    });
    await expect(
      detailDialog.getByRole('heading', { name: documentNumber })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('AC-09: system email run detail dialog shows spinner while loading', async ({
    page,
    request
  }) => {
    const runKey = `E2E-SPINNER-${Date.now()}`;
    const trigger = await request.post('/api/contracts/reminders', {
      data: { run_key: runKey }
    });
    expect([200, 400]).toContain(trigger.status());

    await page.goto('/dashboard/system-email-logs');
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible();

    const firstRow = page.getByTestId('system-email-log-row').first();
    const rowCount = await firstRow.count();
    test.skip(rowCount === 0, 'No reminder runs available for dialog test');

    await delayMatchingRoutes(page, /\/api\/system-email-logs\/\d+/, 2_000);
    await firstRow.click();

    const dialog = page.getByTestId('system-email-log-detail-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('status', { name: 'Loading' })).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByTestId('system-email-log-recipients-table')).toBeVisible({
      timeout: 15_000
    });
  });

  test('AC-10: overview keeps skeleton UX without PageLoadingSpinner', async ({ page }) => {
    await page.goto('/dashboard/overview');

    await expect(
      page.getByRole('heading', { name: '안녕하세요, 다시 오셨군요 👋' })
    ).toBeVisible();
    await expect(loadingSpinner(page)).toHaveCount(0);
    await expect(page.getByText('총 매출')).toBeVisible();
  });

  test('AC-11: react-query page uses spinner on suspense fetch', async ({ page }) => {
    await page.goto('/dashboard/react-query');
    await expect(
      page.getByRole('heading', { name: 'React Query', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Pick a Pokemon')).toBeVisible();

    await delayMatchingRoutes(page, /pokeapi\.co/, 2_000);
    await page.getByRole('button', { name: '#150', exact: true }).click();
    await expect(loadingSpinner(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('mewtwo', { exact: true })).toBeVisible({
      timeout: 15_000
    });
  });
});
