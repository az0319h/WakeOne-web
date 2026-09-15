import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { updateUserFullName } from '../notifications/helpers';
import { createWalletSyncForName, resolveE2EUserId } from './helpers';

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
});
