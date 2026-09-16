import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createAdminRequest, createUserRequest } from '../helpers/auth-request';
import {
  createDisposableUser,
  createDisposableUserWithEmail,
  createWalletSyncForName,
  enableDuePreferencesForUser,
  expectActivityLog,
  getKstParts,
  isDryRunEnabled,
  listActivityLogs,
  parseAllowlist,
  patchWalletBalanceEmailPreferences,
  postWalletBalanceEmailDispatch,
  resolveE2EUserId
} from './helpers';

type DispatchResponse = {
  success?: boolean;
  run?: { id: number; run_key: string } | null;
  recipients?: Array<{
    status: string;
    recipient_email: string;
    user_id: string;
  }>;
};

test.describe.configure({ mode: 'serial' });

test.describe('식대 잔액 이메일 dispatch/preferences API', () => {
  test.setTimeout(120_000);

  test('AC-07: user cannot PATCH another user preferences — 403 + activity log', async ({
    playwright
  }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const { userId: targetUserId } = await createDisposableUser(
        adminRequest,
        'wbe-ac07'
      );
      const uniqueName = `E2E-WBE-AC07-${Date.now()}`;
      await adminRequest.put(`/api/users/${targetUserId}`, {
        data: {
          full_name: uniqueName,
          affiliation: 'wake',
          rank: '경영진',
          phone: '01012345678'
        }
      });
      await createWalletSyncForName(adminRequest, uniqueName);

      const response = await patchWalletBalanceEmailPreferences(
        userRequest,
        { enabled: true },
        targetUserId
      );

      expect(response.status()).toBe(403);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();
      await expectActivityLog(
        userRequest,
        'wallet.balance_email_pref_update',
        requestId,
        403
      );
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });

  test('AC-15: preferences PATCH records wallet.balance_email_pref_update activity log', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-AC15-${Date.now()}`;
      await adminRequest.put(`/api/users/${userId}`, {
        data: {
          full_name: uniqueName,
          affiliation: 'wake',
          rank: '경영진',
          phone: '01012345678'
        }
      });
      await createWalletSyncForName(adminRequest, uniqueName);

      const response = await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: false,
          hour: 12,
          minute: 15,
          exclude_weekends: true
        },
        userId
      );
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();
      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_pref_update',
        requestId,
        200
      );
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-NEW-01: due=0 dispatch — run null, no dispatch activity log', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const { userId, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-new01'
      );
      await createWalletSyncForName(adminRequest, fullName);

      const parts = getKstParts();
      const differentMinute = (parts.minute + 1) % 60;
      const differentHour =
        parts.minute === 59 ? (parts.hour + 1) % 24 : parts.hour;

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: differentHour,
          minute: differentMinute,
          exclude_weekends: false
        },
        userId
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeNull();

      const logs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_dispatch',
        { logUser: 'all' }
      );
      expect(
        logs.some(
          (item) =>
            item.request_id === requestId &&
            item.action === 'wallet.balance_email_dispatch'
        )
      ).toBe(false);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-16: E2E simulated SMTP failure — failed recipient + activity log', async ({
    playwright
  }) => {
    test.skip(
      !isDryRunEnabled(),
      'Dry-run must be on so allowlist does not block E2E-SMTP-FAIL before SMTP simulate'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const email = `E2E-SMTP-FAIL-wbe-ac16-${Date.now()}@example.com`;
      const { userId, fullName } = await createDisposableUserWithEmail(
        adminRequest,
        email,
        'wbe-ac16'
      );
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as DispatchResponse & {
        run?: { status?: string } | null;
      };
      expect(body.run).toBeTruthy();

      let recipient = body.recipients?.find((item) => item.user_id === userId);
      if (!recipient && body.run?.id) {
        const detailResponse = await adminRequest.get(
          `/api/wallet/balance-email/logs/${body.run.id}`
        );
        expect(detailResponse.status()).toBe(200);
        const detailBody = (await detailResponse.json()) as {
          data?: { recipients?: DispatchResponse['recipients'] };
        };
        recipient = detailBody.data?.recipients?.find(
          (item) => item.user_id === userId
        );
      }

      expect(recipient?.status).toBe('failed');
      expect(['failed', 'partial_failed']).toContain(body.run?.status);

      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_failed',
        requestId,
        200,
        { logUser: 'all' }
      );
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-04: exclude_weekends=true on KST weekend — skipped recipient, run created', async ({
    playwright
  }) => {
    const parts = getKstParts();
    test.skip(
      parts.weekday !== 0 && parts.weekday !== 6,
      'AC-04 requires KST Saturday or Sunday'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const { userId, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-ac04'
      );
      await createWalletSyncForName(adminRequest, fullName);
      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: parts.hour,
          minute: parts.minute,
          exclude_weekends: true
        },
        userId
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse & {
        run?: { skipped_count?: number } | null;
      };
      expect(body.run).toBeTruthy();
      expect(body.run?.skipped_count).toBeGreaterThanOrEqual(1);

      const recipient = body.recipients?.find((item) => item.user_id === userId);
      expect(recipient?.status).toBe('skipped');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-NEW-02: dispatch activity log actor is wakeone.ops@gmail.com', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const { userId, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-new02'
      );
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_dispatch',
        requestId,
        200,
        { logUser: 'all' }
      );

      const logs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_dispatch',
        { logUser: 'all' }
      );
      const dispatchLog = logs.find((item) => item.request_id === requestId);
      expect(dispatchLog?.actor_email).toBe('wakeone.ops@gmail.com');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-NEW-03: due 2 users — sent + blocked in one run', async ({
    playwright
  }) => {
    test.skip(
      isDryRunEnabled(),
      'Dry-run bypasses allowlist — mixed sent+blocked requires E2E_WALLET_BALANCE_EMAIL_DRY_RUN unset'
    );

    const allowlist = parseAllowlist();
    const allowlistedEmail = [...allowlist].find((email) =>
      email.endsWith('@example.com')
    );
    test.skip(
      !allowlistedEmail,
      'Add an @example.com address to WALLET_BALANCE_EMAIL_ALLOWLIST for AC-NEW-03'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const blockedUser = await createDisposableUser(adminRequest, 'wbe-new03-blocked');
      await createWalletSyncForName(adminRequest, blockedUser.fullName);
      await enableDuePreferencesForUser(
        adminRequest,
        blockedUser.userId,
        getKstParts()
      );

      const sentUser = await createDisposableUserWithEmail(
        adminRequest,
        allowlistedEmail!,
        'wbe-new03-sent'
      );
      await createWalletSyncForName(adminRequest, sentUser.fullName);
      await enableDuePreferencesForUser(
        adminRequest,
        sentUser.userId,
        getKstParts()
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      const blockedRecipient = body.recipients?.find(
        (item) => item.user_id === blockedUser.userId
      );
      const sentRecipient = body.recipients?.find(
        (item) => item.user_id === sentUser.userId
      );

      expect(blockedRecipient?.status).toBe('blocked');
      expect(sentRecipient?.status).toBe('sent');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-09: allowlist blocks non-allowlist email — blocked recipient, no real send', async ({
    playwright
  }) => {
    test.skip(
      isDryRunEnabled(),
      'Dry-run bypasses allowlist gate — run with E2E_WALLET_BALANCE_EMAIL_DRY_RUN unset to verify AC-09'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const { userId, email, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-ac09'
      );
      expect(parseAllowlist().has(email.toLowerCase())).toBe(false);

      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      let recipient = body.recipients?.find((item) => item.user_id === userId);
      if (!recipient && body.run?.id) {
        const detailResponse = await adminRequest.get(
          `/api/wallet/balance-email/logs/${body.run.id}`
        );
        expect(detailResponse.status()).toBe(200);
        const detailBody = (await detailResponse.json()) as {
          data?: { recipients?: DispatchResponse['recipients'] };
        };
        recipient = detailBody.data?.recipients?.find(
          (item) => item.user_id === userId
        );
      }

      expect(recipient?.status).toBe('blocked');

      if ((body.recipients ?? []).length > 0) {
        await expectActivityLog(
          adminRequest,
          'wallet.balance_email_blocked',
          requestId,
          200,
          { logUser: 'all' }
        );
      }
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-10: E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 — dispatch records run without SMTP', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const { userId, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-ac10'
      );
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      let recipient = body.recipients?.find((item) => item.user_id === userId);
      if (!recipient && body.run?.id) {
        const detailResponse = await adminRequest.get(
          `/api/wallet/balance-email/logs/${body.run.id}`
        );
        expect(detailResponse.status()).toBe(200);
        const detailBody = (await detailResponse.json()) as {
          data?: { recipients?: DispatchResponse['recipients'] };
        };
        recipient = detailBody.data?.recipients?.find(
          (item) => item.user_id === userId
        );
      }

      expect(recipient?.status).toBe('sent');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('SAFETY: allowlist외 @wakecorp.com sent recipient 0건 (dry-run)', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      await postWalletBalanceEmailDispatch(adminRequest);

      const logsResponse = await adminRequest.get(
        '/api/wallet/balance-email/logs?limit=5'
      );
      expect(logsResponse.status()).toBe(200);
      const logsBody = (await logsResponse.json()) as {
        data?: { items?: Array<{ id: number }> };
      };
      const latestRunId = logsBody.data?.items?.[0]?.id;
      test.skip(!latestRunId, 'No dispatch runs to verify');

      const detailResponse = await adminRequest.get(
        `/api/wallet/balance-email/logs/${latestRunId}`
      );
      expect(detailResponse.status()).toBe(200);
      const detailBody = (await detailResponse.json()) as {
        data?: {
          recipients?: Array<{ recipient_email: string; status: string }>;
        };
      };

      const allowlist = parseAllowlist();
      const unsafeSent = (detailBody.data?.recipients ?? []).filter((item) => {
        if (item.status !== 'sent') {
          return false;
        }
        const email = item.recipient_email.trim().toLowerCase();
        if (email.endsWith('@example.com')) {
          return false;
        }
        return !allowlist.has(email);
      });

      expect(unsafeSent).toEqual([]);
    } finally {
      await adminRequest.dispose();
    }
  });
});
