import { expect, test } from '@playwright/test';
import { getResultBadgeClass, getResultLabel } from '../../src/features/activity-logs/labels';
import {
  createFreshPendingGoogleUser,
  triggerFirstPendingApprovalAdminNotifications
} from '../helpers/google-pending-notifications';
test.describe('활동 로그 302/303 결과 라벨', () => {
  test('AC-01: getResultLabel(302/303)은 리다이렉트', () => {
    expect(getResultLabel(302)).toBe('리다이렉트');
    expect(getResultLabel(303)).toBe('리다이렉트');
  });

  test('AC-02: getResultBadgeClass(302)는 green success 클래스', () => {
    expect(getResultBadgeClass(302)).toBe(getResultBadgeClass(200));
    expect(getResultBadgeClass(302)).toContain('green');
  });

  test('AC-03: admin auth.sign_in 302 행은 리다이렉트 green Badge', async ({ page }) => {
    await page.goto('/dashboard/logs?log_user=all&action=auth.sign_in');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();

    const table = page.getByTestId('activity-logs-table-root');
    await expect(table.getByText('리다이렉트').first()).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('알 수 없음')).toHaveCount(0);
  });

  test('AC-04: admin user.approval_request 302 행은 리다이렉트 green Badge', async ({
    page,
    request
  }) => {
    const pending = await createFreshPendingGoogleUser('ac04-redirect-label');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    await page.goto('/dashboard/logs?log_user=all&action=user.approval_request');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();

    const table = page.getByTestId('activity-logs-table-root');
    await expect(table.getByText('리다이렉트').first()).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('사용자 승인 요청').first()).toBeVisible();

    const logsResponse = await request.get(
      `/api/activity-logs?action=user.approval_request&limit=20&log_user=all`
    );
    expect(logsResponse.status()).toBe(200);
    const logsBody = (await logsResponse.json()) as {
      data?: { logs?: Array<{ target_user_id?: string; http_status?: number }> };
    };
    const matched = logsBody.data?.logs?.find(
      (log) => log.target_user_id === pending.userId && log.http_status === 302
    );
    expect(matched).toBeTruthy();
  });
});
