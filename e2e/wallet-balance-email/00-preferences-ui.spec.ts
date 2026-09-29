import { expect, test, type Page } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { updateUserFullName } from '../notifications/helpers';
import {
  createWalletSyncForName,
  ensureE2EUserNotDue,
  getWalletBalanceEmailPreferences,
  patchWalletBalanceEmailPreferences,
  resolveE2EUserId
} from './helpers';

async function selectScheduleOption(page: Page, testId: string, label: string) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: label }).click();
}

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('식대 잔액 이메일 설정 UI', () => {
  test('AC-01: matched sync 0 — empty state, no settings card or banner', async ({
    page,
    request
  }) => {
    const walletResponse = await request.get('/api/wallet');
    expect(walletResponse.status()).toBe(200);
    const walletBody = (await walletResponse.json()) as {
      data?: { snapshot?: unknown };
    };

    test.skip(
      walletBody.data?.snapshot != null,
      'E2E user already has matched wallet sync — AC-01 requires zero matched syncs'
    );

    await page.goto('/dashboard/wallet');
    await expect(page.getByTestId('wallet-page-content')).toBeVisible();
    await expect(
      page.getByText('식대 잔액 업데이트 내역이 없습니다.')
    ).toBeVisible();
    await expect(
      page.getByTestId('wallet-balance-email-settings-section')
    ).not.toBeVisible();
    await expect(page.getByTestId('wallet-balance-email-off-banner')).not.toBeVisible();
  });

  test('AC-02: matched sync exists — settings card OFF, banner visible', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-AC02-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);
      await ensureE2EUserNotDue(adminRequest);

      await page.goto('/dashboard/wallet');
      await expect(page.getByTestId('wallet-page-content')).toBeVisible();
      await expect(
        page.getByTestId('wallet-balance-email-settings-section')
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('wallet-balance-email-settings-entry')).toBeVisible();
      await expect(page.getByTestId('wallet-balance-email-off-banner')).toBeVisible();
      await page.getByTestId('wallet-balance-email-settings-open').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).toBeVisible();
      await expect(page.getByTestId('wallet-balance-email-enabled-switch')).not.toBeChecked();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-09: 알림 추가 — slot2 저장 후 summary 2시각', async ({ page, playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P55-AC09-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);
      await ensureE2EUserNotDue(adminRequest);

      await page.goto('/dashboard/wallet');
      await expect(page.getByTestId('wallet-page-content')).toBeVisible();
      await expect(
        page.getByTestId('wallet-balance-email-settings-section')
      ).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('wallet-balance-email-settings-open').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).toBeVisible();

      await page.getByTestId('wallet-balance-email-enabled-switch').click();
      await selectScheduleOption(page, 'wallet-balance-email-hour', '09시');
      await selectScheduleOption(page, 'wallet-balance-email-minute', '00분');

      await page.getByTestId('wallet-balance-email-add-slot').click();
      await expect(page.getByTestId('wallet-balance-email-slot2-row')).toBeVisible();
      await selectScheduleOption(page, 'wallet-balance-email-slot2-hour', '18시');
      await selectScheduleOption(page, 'wallet-balance-email-slot2-minute', '30분');

      await page.getByTestId('wallet-balance-email-save').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).not.toBeVisible({
        timeout: 15_000
      });

      const scheduleSummary = page.getByTestId('wallet-balance-email-settings-entry-schedule');
      await expect(scheduleSummary).toContainText('09:00');
      await expect(scheduleSummary).toContainText('18:30');

      const prefs = await getWalletBalanceEmailPreferences(adminRequest, userId);
      expect(prefs.slot2_enabled).toBe(true);
      expect(prefs.hour).toBe(9);
      expect(prefs.minute).toBe(0);
      expect(prefs.hour2).toBe(18);
      expect(prefs.minute2).toBe(30);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-10: slot2 삭제 — summary 1시각, slot2_enabled=false', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P55-AC10-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: 9,
          minute: 0,
          slot2_enabled: true,
          hour2: 18,
          minute2: 30,
          exclude_weekends: false
        },
        userId
      );

      await page.goto('/dashboard/wallet');
      await expect(page.getByTestId('wallet-page-content')).toBeVisible();
      await page.getByTestId('wallet-balance-email-settings-open').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).toBeVisible();
      await expect(page.getByTestId('wallet-balance-email-slot2-row')).toBeVisible();

      await page.getByTestId('wallet-balance-email-remove-slot2').click();
      await expect(page.getByTestId('wallet-balance-email-slot2-row')).not.toBeVisible();
      await expect(page.getByTestId('wallet-balance-email-add-slot')).toBeVisible();

      await page.getByTestId('wallet-balance-email-save').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).not.toBeVisible({
        timeout: 15_000
      });

      const scheduleSummary = page.getByTestId('wallet-balance-email-settings-entry-schedule');
      await expect(scheduleSummary).toContainText('09:00');
      await expect(scheduleSummary).not.toContainText('18:30');

      const prefs = await getWalletBalanceEmailPreferences(adminRequest, userId);
      expect(prefs.slot2_enabled).toBe(false);
    } finally {
      await adminRequest.dispose();
    }
  });
});
