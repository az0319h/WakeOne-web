import { expect, test, type Page } from '@playwright/test';

async function gotoAllLogs(page: Page) {
  await page.goto('/dashboard/logs?log_user=all&perPage=5');
  await expect(page.getByTestId('activity-logs-page')).toBeVisible();
}

test.describe('활동 로그 pagination and sort', () => {
  test('AC-08: admin pagination keeps filters on page 2', async ({ page }) => {
    await gotoAllLogs(page);

    const nextButton = page.getByRole('button', { name: 'Go to next page' });
    const canPaginate = await nextButton.isEnabled();
    test.skip(!canPaginate, 'Not enough activity logs for pagination');

    await nextButton.click();

    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/log_user=all/);
    await expect(page).toHaveURL(/perPage=5/);
    await expect(page.getByText('Page 2 of')).toBeVisible();
  });

  test('AC-09: admin can toggle created_at sort order', async ({ page }) => {
    await gotoAllLogs(page);

    const timeHeader = page.getByRole('columnheader', { name: '시간' });
    await timeHeader.getByRole('button').click();
    await page.getByText('Asc', { exact: true }).click();

    await expect(page).toHaveURL(/sort=/, { timeout: 10_000 });

    await timeHeader.getByRole('button').click();
    await page.getByText('Desc', { exact: true }).click();

    await expect(page).toHaveURL(/sort=/, { timeout: 10_000 });
    await expect(page.getByTestId('activity-logs-table')).toBeVisible();
  });
});
