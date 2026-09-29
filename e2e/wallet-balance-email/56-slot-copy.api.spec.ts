import { expect, test } from '@playwright/test';
import { buildWalletBalanceEmailContent } from '@/lib/mail/wallet-balance-email-content';
import { createAdminRequest } from '../helpers/auth-request';
import {
  createDisposableUser,
  createWalletSyncForName,
  enableSlot1OnlyPreferences,
  enableSlot2DuePreferences,
  expectWalletBalanceEmailNotificationSlot,
  findWalletBalanceEmailNotificationForRun,
  getKstParts,
  isDryRunEnabled,
  postWalletBalanceEmailDispatch,
  WALLET_BALANCE_EMAIL_SLOT_COPY
} from './helpers';

type DispatchResponse = {
  run?: { id: number } | null;
  recipients?: Array<{ status: string; user_id: string }>;
};

test.describe.configure({ mode: 'serial' });

test.describe('plan 56 — 슬롯별 copy API', () => {
  test.setTimeout(120_000);

  test('AC-01: slot1 dispatch — sent notification with slot1 copy and metadata.slot=1', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const parts = getKstParts();
      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p56-ac01');
      await createWalletSyncForName(adminRequest, fullName);
      await enableSlot1OnlyPreferences(adminRequest, userId, parts.hour, parts.minute);

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      const recipient = body.recipients?.find((item) => item.user_id === userId);
      expect(recipient?.status).toBe('sent');

      await expect
        .poll(async () =>
          findWalletBalanceEmailNotificationForRun(adminRequest, userId, body.run!.id)
        )
        .toBeTruthy();

      const notification = await findWalletBalanceEmailNotificationForRun(
        adminRequest,
        userId,
        body.run!.id
      );
      expectWalletBalanceEmailNotificationSlot(notification, 1);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-02: slot2 dispatch — notification slot2 copy and metadata.slot=2', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const parts = getKstParts();
      const slot1Hour = (parts.hour + 1) % 24;
      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p56-ac02');
      await createWalletSyncForName(adminRequest, fullName);
      await enableSlot2DuePreferences(
        adminRequest,
        userId,
        { hour: slot1Hour, minute: parts.minute },
        { hour: parts.hour, minute: parts.minute }
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      const recipient = body.recipients?.find((item) => item.user_id === userId);
      expect(recipient?.status).toBe('sent');

      await expect
        .poll(async () =>
          findWalletBalanceEmailNotificationForRun(adminRequest, userId, body.run!.id)
        )
        .toBeTruthy();

      const notification = await findWalletBalanceEmailNotificationForRun(
        adminRequest,
        userId,
        body.run!.id
      );
      expectWalletBalanceEmailNotificationSlot(notification, 2);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-03: slot2 email content — subject and HTML subtitle (SMTP stub)', async () => {
    const copy = WALLET_BALANCE_EMAIL_SLOT_COPY[2];
    const { subject, html } = buildWalletBalanceEmailContent({
      slot: 2,
      monthlyLimit: 300_000,
      monthlyRemaining: 150_000,
      syncedAt: new Date().toISOString(),
      walletUrl: 'https://example.com/wallet',
      settingsUrl: 'https://example.com/wallet#settings'
    });

    expect(subject).toBe(copy.emailSubject);
    expect(html).toContain(copy.emailHtmlSubtitle);
  });

  test('AC-04: slot1 email content — subject and HTML subtitle (SMTP stub)', async () => {
    const copy = WALLET_BALANCE_EMAIL_SLOT_COPY[1];
    const { subject, html } = buildWalletBalanceEmailContent({
      slot: 1,
      monthlyLimit: 300_000,
      monthlyRemaining: 150_000,
      syncedAt: new Date().toISOString(),
      walletUrl: 'https://example.com/wallet',
      settingsUrl: 'https://example.com/wallet#settings'
    });

    expect(subject).toBe(copy.emailSubject);
    expect(html).toContain(copy.emailHtmlSubtitle);
  });
});
