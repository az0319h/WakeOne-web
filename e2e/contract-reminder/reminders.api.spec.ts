import fs from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';
import { uniqueRunKey } from '../helpers/reminders';

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
    data: { run_key: runKey }
  });
}

async function listActivityReminderLogs(request: APIRequestContext) {
  const response = await request.get(
    '/api/activity-logs?action=contract.reminder_send&limit=20'
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.data?.logs ?? [];
}

test.describe('계약서 독촉 API', () => {
  test('AC-08: non-admin user cannot trigger reminders', async ({ browser }) => {
    test.skip(!fs.existsSync('e2e/.auth/user.json'), 'E2E user auth state required');

    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const userRequest = userContext.request;

    const response = await userRequest.post('/api/contracts/reminders', {
      data: { run_key: uniqueRunKey('AC08') }
    });

    expect(response.status()).toBe(403);
    await userContext.close();
  });

  test('AC-03: unmatched author is recorded without recipient row', async ({ request }) => {
    const runKey = uniqueRunKey('AC03');
    const documentNumber = uniqueDocumentNumber('AC03-UNMATCHED');

    await importMissingContract(request, documentNumber, `미등록작성자-${Date.now()}`);

    const response = await postReminders(request, runKey);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ReminderRunResponse;
    expect(body.run).toBeTruthy();
    expect(body.unmatched_targets.length).toBeGreaterThan(0);
    expect(
      body.unmatched_targets.some((target) => target.document_numbers.includes(documentNumber))
    ).toBeTruthy();
  });

  test('AC-05: duplicate run_key skips re-send', async ({ request }) => {
    const runKey = uniqueRunKey('AC05');
    const first = await postReminders(request, runKey);
    expect(first.status()).toBe(200);

    const second = await postReminders(request, runKey);
    expect(second.status()).toBe(200);
    const body = (await second.json()) as ReminderRunResponse;
    expect(body.recipients).toEqual([]);
  });

  test('AC-13: successful reminder creates contract.reminder_send activity log', async ({
    request
  }) => {
    const runKey = uniqueRunKey('AC13');
    const response = await postReminders(request, runKey);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await listActivityReminderLogs(request);
        return logs.some(
          (log: { metadata?: { status?: string; recipient_email?: string } }) =>
            log.metadata?.status === 'duplicate_run' ||
            log.metadata?.status === 'completed' ||
            log.metadata?.status === 'partial_failed' ||
            Boolean(log.metadata?.recipient_email)
        );
      })
      .toBe(true);
  });

  test('AC-01: matched profile triggers reminder run with recipients or unmatched summary', async ({
    request
  }) => {
    const runKey = uniqueRunKey('AC01');
    const authorName = 'E2E 작성자';
    const documentNumber = uniqueDocumentNumber('AC01');

    await importMissingContract(request, documentNumber, authorName);

    const response = await postReminders(request, runKey);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as ReminderRunResponse;
    expect(body.run).toBeTruthy();
    expect(body.run?.run_key).toBe(runKey);
    expect(body.recipients.length + body.unmatched_targets.length).toBeGreaterThan(0);
  });
});
