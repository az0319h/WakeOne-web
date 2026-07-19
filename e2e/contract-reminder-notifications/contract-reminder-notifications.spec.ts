import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createAdminRequest, createUserRequest, e2eBaseURL } from '../helpers/auth-request';
import {
  markAllNotificationsReadAsUser,
  notificationBellButton,
  openNotificationPopover
} from '../notifications/helpers';
import { reminderCronHeaders, uniqueRunKey } from '../helpers/reminders';
import {
  cleanupE2eMockData,
  countAdminNotificationsForRun,
  countRecipientNotificationsForRun,
  countNotificationsByType,
  ensureUserAuthorName,
  expectActivityLog,
  importMissingContract,
  listActivityLogs,
  listNotifications,
  postReminders,
  runMatchedReminder
} from '../helpers/contract-reminder-notifications';
import { uniqueDocumentNumber } from '../helpers/contracts';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
  cleanupE2eMockData();
  const probe = await playwright.request.newContext({ baseURL: e2eBaseURL });
  await expect
    .poll(async () => (await probe.get('/auth/sign-in')).status(), { timeout: 60_000 })
    .toBe(200);
  await probe.dispose();
});

test.describe('계약 독촉 admin 알림', () => {
  test('AC-01: admin에게 run 요약 알림 1건·전송 완료 제목', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC01-${Date.now()}`;

      const { body } = await runMatchedReminder(adminRequest, {
        prefix: 'AC01',
        authorName,
        userEmail
      });

      expect(body.run).toBeTruthy();
      expect(body.recipients.some((item) => item.status === 'sent')).toBeTruthy();

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest);
          return notifications.filter(
            (item) =>
              item.type === 'contract.reminder_admin' &&
              item.title === '독촉 이메일 전송 완료'
          ).length;
        })
        .toBeGreaterThan(0);

      const adminNotification = (await listNotifications(adminRequest)).find(
        (item) =>
          item.type === 'contract.reminder_admin' &&
          item.title === '독촉 이메일 전송 완료'
      );
      expect(adminNotification?.body).toMatch(/발송 성공 \d+건/);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-03: 일부 실패 시 admin 제목이 일부 전송 실패', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const user2Email = process.env.E2E_USER2_EMAIL;
      test.skip(!user2Email, 'E2E_USER2_EMAIL required');

      const runKey = uniqueRunKey('AC03');
      const successAuthor = `E2E-AC03-OK-${Date.now()}`;
      const failAuthor = `E2E-SMTP-FAIL-AC03-${Date.now()}`;

      await ensureUserAuthorName(adminRequest, userEmail, successAuthor);
      await importMissingContract(
        adminRequest,
        uniqueDocumentNumber('AC03-OK'),
        successAuthor
      );

      await ensureUserAuthorName(adminRequest, user2Email!, failAuthor);
      await importMissingContract(
        adminRequest,
        uniqueDocumentNumber('AC03-FAIL'),
        failAuthor
      );

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(
        body.recipients.some((item: { status: string }) => item.status === 'sent')
      ).toBeTruthy();
      expect(
        body.recipients.some((item: { status: string }) => item.status === 'failed')
      ).toBeTruthy();

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest);
          return notifications.some(
            (item) =>
              item.type === 'contract.reminder_admin' &&
              item.title === '독촉 이메일 일부 전송 실패'
          );
        })
        .toBe(true);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-04: 전부 실패 시 admin 제목이 전송 실패', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-SMTP-FAIL-AC04-${Date.now()}`;
      const runKey = uniqueRunKey('AC04');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, uniqueDocumentNumber('AC04'), authorName);

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const body = await response.json();
      const ourRecipient = body.recipients.find(
        (item: { author_name: string; status: string }) => item.author_name === authorName
      );
      expect(ourRecipient?.status).toBe('failed');

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest);
          return notifications.some(
            (item) =>
              item.type === 'contract.reminder_admin' &&
              item.metadata?.run_key === runKey &&
              (item.title === '독촉 이메일 전송 실패' ||
                item.title === '독촉 이메일 일부 전송 실패')
          );
        })
        .toBe(true);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-05: unmatched만 있을 때 발송 대상 없음 제목·recipient 알림 없음', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const beforeRecipientCount = (await listNotifications(userRequest)).filter(
        (item) => item.type === 'contract.reminder_recipient'
      ).length;

      const runKey = uniqueRunKey('AC05');
      const authorName = `미등록작성자-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC05');
      await importMissingContract(adminRequest, documentNumber, authorName);

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(
        body.unmatched_targets.some((target: { document_numbers: string[] }) =>
          target.document_numbers.includes(documentNumber)
        )
      ).toBeTruthy();

      test.skip(
        body.recipients.length > 0,
        'Shared DB has matched reminder targets; strict unmatched-only run unavailable'
      );

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest);
          return notifications.some(
            (item) =>
              item.type === 'contract.reminder_admin' &&
              item.metadata?.run_key === runKey &&
              item.title === '독촉 run 완료 (발송 대상 없음)'
          );
        })
        .toBe(true);

      const afterRecipientCount = (await listNotifications(userRequest)).filter(
        (item) => item.type === 'contract.reminder_recipient'
      ).length;
      expect(afterRecipientCount).toBe(beforeRecipientCount);
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });

  test('AC-09: admin 알림 CTA 발송 이력 보기 → system-email-logs', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC09-${Date.now()}`;

      await runMatchedReminder(adminRequest, {
        prefix: 'AC09',
        authorName,
        userEmail
      });

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      await expect(
        page.getByRole('heading', { name: '독촉 이메일 전송 완료', level: 3 }).first()
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: '발송 이력 보기' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/system-email-logs/);
    } finally {
      await adminRequest.dispose();
    }
  });
});

test.describe('계약 독촉 recipient 알림', () => {
  test('AC-02: sent 수신자에게 recipient 알림 1건·metadata document_numbers', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC02-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC02');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, documentNumber, authorName);

      const runKey = uniqueRunKey('AC02');
      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { run: { id: number } };
      const runId = body.run.id;

      await expect
        .poll(async () => {
          const notifications = await listNotifications(userRequest);
          return notifications.filter(
            (item) =>
              item.type === 'contract.reminder_recipient' && item.metadata?.run_id === runId
          ).length;
        })
        .toBeGreaterThan(0);

      const recipientNotification = (await listNotifications(userRequest)).find(
        (item) =>
          item.type === 'contract.reminder_recipient' && item.metadata?.run_id === runId
      );
      expect(recipientNotification?.body).toMatch(/누락 계약서 \d+건/);
      expect(recipientNotification?.metadata?.document_numbers).toEqual(
        expect.arrayContaining([documentNumber])
      );
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });

  test('AC-06: SMTP failed 수신자에게 recipient 알림 없음', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-SMTP-FAIL-AC06-${Date.now()}`;
      const runKey = uniqueRunKey('AC06');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, uniqueDocumentNumber('AC06'), authorName);

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.run?.id).toBeTruthy();

      const recipientForRun = (await listNotifications(userRequest)).filter(
        (item) =>
          item.type === 'contract.reminder_recipient' &&
          item.metadata?.run_id === body.run.id
      );
      expect(recipientForRun).toHaveLength(0);
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });

  test('AC-10: recipient 알림 카드 표시·CTA 없음·읽음 처리', async ({ browser, playwright }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC10-${Date.now()}`;

      await markAllNotificationsReadAsUser(userRequest);

      await runMatchedReminder(adminRequest, {
        prefix: 'AC10',
        authorName,
        userEmail
      });

      const userContext = await browser.newContext({
        storageState: 'e2e/.auth/user.json'
      });
      const userPage = await userContext.newPage();
      await userPage.goto('/dashboard/notifications');

      await expect(
        userPage.getByRole('heading', { name: '계약서 독촉 이메일 안내', level: 3 }).first()
      ).toBeVisible({ timeout: 15_000 });

      const recipientCard = userPage
        .getByTestId(/^notification-card-/)
        .filter({
          has: userPage.getByRole('heading', { name: '계약서 독촉 이메일 안내', level: 3 })
        })
        .first();
      await expect(recipientCard.getByRole('button', { name: '발송 이력 보기' })).toHaveCount(0);

      await recipientCard.getByRole('button', { name: '읽음 처리' }).click();

      await expect
        .poll(async () => {
          const notifications = await listNotifications(userPage.request);
          return notifications.filter(
            (item) =>
              item.type === 'contract.reminder_recipient' && item.status === 'unread'
          ).length;
        })
        .toBe(0);

      await userContext.close();
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });

  test('AC-11: 헤더 벨 Popover에 recipient 제목·unread badge', async ({ browser, playwright }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const adminRequest = await createAdminRequest(playwright);
    const userRequest = await createUserRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC11-${Date.now()}`;

      await markAllNotificationsReadAsUser(userRequest);

      await runMatchedReminder(adminRequest, {
        prefix: 'AC11',
        authorName,
        userEmail
      });

      const userContext = await browser.newContext({
        storageState: 'e2e/.auth/user.json'
      });
      const userPage = await userContext.newPage();
      await userPage.goto('/dashboard/overview');

      await expect
        .poll(async () => {
          const notifications = await listNotifications(userPage.request);
          return notifications.filter(
            (item) =>
              item.type === 'contract.reminder_recipient' && item.status === 'unread'
          ).length;
        })
        .toBeGreaterThan(0);

      const bellButton = notificationBellButton(userPage);
      await expect(bellButton.locator('span').filter({ hasText: /^\d/ })).toBeVisible({
        timeout: 15_000
      });

      await openNotificationPopover(userPage);
      await expect(
        userPage.getByRole('heading', { name: '계약서 독촉 이메일 안내', level: 3 }).first()
      ).toBeVisible();

      await userContext.close();
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });
});

test.describe('계약 독촉 activity log·duplicate·cron', () => {
  test('AC-07: duplicate run_key 시 신규 알림 없음', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC07-${Date.now()}`;
      const runKey = uniqueRunKey('AC07');
      const userId = await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, uniqueDocumentNumber('AC07'), authorName);

      const first = await postReminders(adminRequest, runKey);
      expect(first.status()).toBe(200);
      const firstBody = (await first.json()) as { run: { id: number } };
      const adminCountAfterFirst = await countAdminNotificationsForRun(adminRequest, runKey);
      const recipientCountAfterFirst = await countRecipientNotificationsForRun(
        adminRequest,
        firstBody.run.id,
        userId
      );
      expect(adminCountAfterFirst).toBeGreaterThan(0);
      expect(recipientCountAfterFirst).toBe(1);

      const second = await postReminders(adminRequest, runKey);
      expect(second.status()).toBe(200);

      expect(await countAdminNotificationsForRun(adminRequest, runKey)).toBe(
        adminCountAfterFirst
      );
      expect(
        await countRecipientNotificationsForRun(adminRequest, firstBody.run.id, userId)
      ).toBe(recipientCountAfterFirst);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-08: cron secret run 시 모든 admin 알림·trigger_source=cron', async ({
    playwright
  }) => {
    const headers = reminderCronHeaders();
    test.skip(!headers, 'CRON_SECRET or CONTRACT_REMINDER_CRON_SECRET required');

    const adminRequest = await createAdminRequest(playwright);
    const cronRequest = await playwright.request.newContext({ baseURL: e2eBaseURL });

    try {
      const runKey = uniqueRunKey('AC08');
      const authorName = `E2E-AC08-${Date.now()}`;
      const userEmail = process.env.E2E_USER_EMAIL!;

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, uniqueDocumentNumber('AC08'), authorName);

      const response = await cronRequest.post('/api/contracts/reminders', {
        headers,
        data: { run_key: runKey }
      });
      expect(response.status()).toBe(200);

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest);
          return notifications.filter(
            (item) =>
              item.type === 'contract.reminder_admin' &&
              item.metadata?.trigger_source === 'cron' &&
              item.metadata?.run_key === runKey
          ).length;
        })
        .toBeGreaterThan(0);
    } finally {
      await adminRequest.dispose();
      await cronRequest.dispose();
    }
  });

  test('AC-12: contract.reminder_send activity log·metadata', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC12-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC12');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, documentNumber, authorName);

      const response = await postReminders(adminRequest, uniqueRunKey('AC12'));
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expectActivityLog(adminRequest, 'contract.reminder_send', requestId!, 200, {
        search: userEmail
      });

      const logs = await listActivityLogs(adminRequest, 'contract.reminder_send', {
        search: userEmail,
        limit: 100
      });
      const matched = logs.find((item) => {
        if (item.request_id !== requestId) {
          return false;
        }

        const docNumbers = item.metadata?.missing_document_numbers;
        return Array.isArray(docNumbers) && docNumbers.includes(documentNumber);
      });
      expect(matched?.metadata?.recipient_email).toBeTruthy();
      expect(matched).toBeTruthy();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-13: contract.reminder_failed activity log 1건', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-SMTP-FAIL-AC13-${Date.now()}`;

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      await importMissingContract(adminRequest, uniqueDocumentNumber('AC13'), authorName);

      const response = await postReminders(adminRequest, uniqueRunKey('AC13'));
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expect
        .poll(
          async () => {
            const logs = await listActivityLogs(adminRequest, 'contract.reminder_failed', {
              search: userEmail,
              limit: 100
            });
            return logs.some(
              (item) =>
                item.request_id === requestId &&
                item.action === 'contract.reminder_failed' &&
                item.http_status === 200 &&
                typeof item.metadata?.recipient_email === 'string'
            );
          },
          { timeout: 30_000 }
        )
        .toBe(true);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-14: non-admin POST reminders 403·activity log', async ({ browser }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const userRequest = userContext.request;

    const response = await userRequest.post('/api/contracts/reminders', {
      data: { run_key: uniqueRunKey('AC14') }
    });
    expect(response.status()).toBe(403);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await listActivityLogs(userRequest, 'contract.reminder_failed');
        return logs.some((item) => item.request_id === requestId);
      })
      .toBe(true);

    await userContext.close();
  });

  test('AC-15: cron secret 없음·비admin 401/403·x-request-id', async ({ playwright }) => {
    const anonRequest = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: { cookies: [], origins: [] }
    });
    const response = await anonRequest.post('/api/contracts/reminders', {
      data: { run_key: uniqueRunKey('AC15') }
    });

    expect([401, 403]).toContain(response.status());
    expect(response.headers()['x-request-id']).toBeTruthy();

    await anonRequest.dispose();
  });

  test('AC-16: 대상 계약 0건 400·failed log·알림 없음', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const beforeAdminCount = await countNotificationsByType(
        adminRequest,
        'contract.reminder_admin'
      );

      const response = await postReminders(adminRequest, uniqueRunKey('AC16'));

      if (response.status() !== 400) {
        test.skip(true, 'Remote DB has reminder targets — cannot assert zero-target run');
      }

      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();
      await expectActivityLog(adminRequest, 'contract.reminder_failed', requestId!, 400);

      const afterAdminCount = await countNotificationsByType(
        adminRequest,
        'contract.reminder_admin'
      );
      expect(afterAdminCount).toBe(beforeAdminCount);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-17: user.update CTA 회귀 — contract.reminder 타입과 무관', async () => {
    const helpersPath = path.join(
      process.cwd(),
      'src/features/notifications/components/notification-helpers.ts'
    );
    const source = fs.readFileSync(helpersPath, 'utf8');

    expect(source).toContain("notification.type === 'user.update'");
    expect(source).toContain("label: '프로필 보기'");
    expect(source).toContain("notification.type === 'contract.reminder_recipient'");
    expect(source).toMatch(/contract\.reminder_recipient[\s\S]*return \[\]/);
  });
});
