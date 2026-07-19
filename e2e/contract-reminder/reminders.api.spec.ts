import fs from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';
import { uniqueRunKey } from '../helpers/reminders';
import { resolveUserIdByEmail } from '../notifications/helpers';

type ReminderRunResponse = {
  success: boolean;
  run: { id: number; run_key: string } | null;
  recipients: Array<{ status: string; recipient_email: string }>;
  unmatched_targets: Array<{ author_name: string; document_numbers: string[]; reason: string }>;
};

function expectImportHeaders() {
  const headers = importAuthHeaders();
  expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();
  return headers!;
}

async function importMissingContract(
  request: APIRequestContext,
  documentNumber: string,
  authorName: string
) {
  const response = await request.post('/api/contracts/import', {
    headers: expectImportHeaders(),
    data: buildImportPayload(documentNumber, {
      author_name: authorName,
      author_email: null
    })
  });
  expect(response.status()).toBe(201);
}

async function postReminders(request: APIRequestContext, runKey: string) {
  return request.post('/api/contracts/reminders', {
    data: { run_key: runKey },
    timeout: 120_000
  });
}

test.describe('계약서 독촉 API', () => {
  test.setTimeout(180_000);

  test('AC-08: non-admin user cannot trigger reminders', async ({ browser }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const userRequest = userContext.request;

    const response = await userRequest.post('/api/contracts/reminders', {
      data: { run_key: uniqueRunKey('AC08') }
    });

    expect([401, 403]).toContain(response.status());
    await userContext.close();
  });

  test('AC-03: unmatched author is recorded without recipient row', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const runKey = uniqueRunKey('AC03');
      const documentNumber = uniqueDocumentNumber('AC03-UNMATCHED');

      await importMissingContract(adminRequest, documentNumber, `미등록작성자-${Date.now()}`);

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as ReminderRunResponse;
      expect(body.run).toBeTruthy();
      expect(body.unmatched_targets.length).toBeGreaterThan(0);
      expect(
        body.unmatched_targets.some((target) => target.document_numbers.includes(documentNumber))
      ).toBeTruthy();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-05: duplicate run_key skips re-send', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const runKey = uniqueRunKey('AC05');
      const first = await postReminders(adminRequest, runKey);
      expect(first.status()).toBe(200);

      const second = await postReminders(adminRequest, runKey);
      expect(second.status()).toBe(200);
      const body = (await second.json()) as ReminderRunResponse;
      expect(body.recipients).toEqual([]);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-13: reminder run records activity log', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const runKey = uniqueRunKey('AC13');
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC13-${Date.now()}`;

      await importMissingContract(adminRequest, uniqueDocumentNumber('AC13'), authorName);
      const userId = await resolveUserIdByEmail(adminRequest, userEmail);
      await adminRequest.put(`/api/users/${userId}`, {
        data: {
          full_name: authorName,
          affiliation: 'wake',
          rank: '경영진'
        }
      });

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as ReminderRunResponse;
      expect(body.run).toBeTruthy();
      expect(body.run?.run_key).toBe(runKey);

      const logsResponse = await adminRequest.get(
        `/api/activity-logs?action=contract.reminder_send&limit=100&log_user=all&search=${encodeURIComponent(userEmail)}`
      );
      expect(logsResponse.status()).toBe(200);
      const logsBody = await logsResponse.json();
      const logs = logsBody.data?.logs ?? [];
      expect(logs.some((log: { request_id?: string }) => log.request_id === requestId)).toBe(
        true
      );
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-01: matched profile triggers reminder run with recipients or unmatched summary', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const runKey = uniqueRunKey('AC01');
      const authorName = 'E2E 작성자';
      const documentNumber = uniqueDocumentNumber('AC01');

      await importMissingContract(adminRequest, documentNumber, authorName);

      const response = await postReminders(adminRequest, runKey);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as ReminderRunResponse;
      expect(body.run).toBeTruthy();
      expect(body.run?.run_key).toBe(runKey);
      expect(body.recipients.length + body.unmatched_targets.length).toBeGreaterThan(0);
    } finally {
      await adminRequest.dispose();
    }
  });
});
