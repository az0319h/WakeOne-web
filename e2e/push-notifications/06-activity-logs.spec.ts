import { expect, test } from '@playwright/test';
import { mockEndpoint, PUSH_SUBSCRIPTIONS_PATH, registerMockDevice } from '../helpers/push-mock';

/** plan 91 — AC-18 /dashboard/logs에 「휴대폰 알림 기기 등록」 행 · 성공 · 확장 시 request_id */
test.describe('활동 로그 페이지', () => {
  test('AC-18: 구독 등록 후 /dashboard/logs 최신 행 「휴대폰 알림 기기 등록」 · 성공 · 확장 시 Request ID', async ({
    page
  }) => {
    const endpoint = mockEndpoint('ok');
    const response = await registerMockDevice(page.request, endpoint, 'E2E AC18 device');
    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    try {
      await page.goto('/dashboard/logs');
      await expect(page.getByTestId('activity-logs-page')).toBeVisible();

      const firstRow = page.getByTestId('activity-log-row').first();
      await expect(firstRow).toContainText('휴대폰 알림 기기 등록', { timeout: 15_000 });
      await expect(firstRow).toContainText('성공');
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(requestId!);

      await firstRow.getByRole('button', { name: '행 펼치기' }).click();
      await expect(page.getByText('Request ID')).toBeVisible();
      await expect(page.getByText(requestId!)).toBeVisible();
    } finally {
      const cleanup = await page.request.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint } });
      expect(cleanup.status()).toBe(200);
    }
  });
});
