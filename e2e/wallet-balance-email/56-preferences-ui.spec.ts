import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { updateUserFullName } from '../notifications/helpers';
import {
  createWalletSyncForName,
  ensureE2EUserNotDue,
  formatWalletBalanceEmailSlotSettingsLabel,
  patchWalletBalanceEmailPreferences,
  resolveE2EUserId
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('plan 56 — 슬롯별 설정 UI', () => {
  test('AC-05: slot2 enabled Sheet — slot1/slot2 fixed labels visible', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P56-AC05-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);
      await ensureE2EUserNotDue(adminRequest);

      await page.goto('/dashboard/wallet');
      await expect(page.getByTestId('wallet-page-content')).toBeVisible();
      await page.getByTestId('wallet-balance-email-settings-open').click();
      await expect(page.getByTestId('wallet-balance-email-settings-sheet')).toBeVisible();

      await page.getByTestId('wallet-balance-email-enabled-switch').click();
      await page.getByTestId('wallet-balance-email-add-slot').click();
      await expect(page.getByTestId('wallet-balance-email-slot2-row')).toBeVisible();

      await expect(
        page.getByText(formatWalletBalanceEmailSlotSettingsLabel(1))
      ).toBeVisible();
      await expect(
        page.getByText(formatWalletBalanceEmailSlotSettingsLabel(2))
      ).toBeVisible();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-06: enabled entry card — slot labels with schedule times', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P56-AC06-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: 12,
          minute: 15,
          slot2_enabled: true,
          hour2: 18,
          minute2: 30,
          exclude_weekends: false
        },
        userId
      );

      await page.goto('/dashboard/wallet');
      await expect(page.getByTestId('wallet-page-content')).toBeVisible();

      const scheduleSummary = page.getByTestId('wallet-balance-email-settings-entry-schedule');
      await expect(scheduleSummary).toContainText(
        `${formatWalletBalanceEmailSlotSettingsLabel(1)} 12:15`
      );
      await expect(scheduleSummary).toContainText(
        `${formatWalletBalanceEmailSlotSettingsLabel(2)} 18:30`
      );
    } finally {
      await adminRequest.dispose();
    }
  });
});
