import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  deleteBenefitDocumentByNumber,
  getProfileForBenefitsFixture,
  insertBenefitDocumentForE2e
} from '../helpers/benefits-fixture';

function readUserIdFromStorage(storagePath: string): string {
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), storagePath), 'utf8'));
  const authCookie = (state.cookies as Array<{ name: string; value: string }>).find(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );
  if (!authCookie?.value) {
    throw new Error(`Missing auth cookie in ${storagePath}`);
  }
  const decoded = decodeURIComponent(authCookie.value);
  const session = JSON.parse(
    decoded.startsWith('base64-') ? Buffer.from(decoded.slice(7), 'base64').toString('utf8') : decoded
  ) as { user?: { id?: string } };
  const userId = session.user?.id;
  if (!userId) throw new Error(`Could not parse user id from ${storagePath}`);
  return userId;
}

test.describe('복지비 문서 취소·복구 API', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: 'e2e/.auth/admin.json' });

  const stamp = Date.now();
  const documentNumber = `E2E-CANCEL-${stamp}`;
  const taskKey = `e2e-cancel-task-${stamp}`;
  let documentId: number;

  test.beforeAll(async () => {
    const applicantUserId = readUserIdFromStorage('e2e/.auth/user.json');
    const { fullName: applicantName } = await getProfileForBenefitsFixture(applicantUserId);
    const row = await insertBenefitDocumentForE2e({
      applicantUserId,
      applicantName,
      documentNumber,
      taskKey,
      documentCreatedAt: '2026-10-15',
      amount: 50_000
    });
    documentId = row.id;
  });

  test.afterAll(async () => {
    await deleteBenefitDocumentByNumber(documentNumber);
  });

  test('AC-06: cancel 200 + activity log', async ({ request }) => {
    const response = await request.patch(`/api/benefits/documents/${documentId}/cancel`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.cancelled_at).toBeTruthy();
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await request.get(
          '/api/activity-logs?action=benefit.document_cancel&limit=20&log_user=all'
        );
        const logsBody = await logs.json();
        return (logsBody.data?.logs ?? []).some(
          (log: { request_id?: string }) => log.request_id === requestId
        );
      })
      .toBe(true);
  });

  test('AC-07: cancel on cancelled document 409', async ({ request }) => {
    const response = await request.patch(`/api/benefits/documents/${documentId}/cancel`);
    expect(response.status()).toBe(409);
  });

  test('AC-08: restore 200', async ({ request }) => {
    const response = await request.patch(`/api/benefits/documents/${documentId}/restore`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.cancelled_at).toBeNull();
  });
});

test.describe('복지비 문서 취소 API — user', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-09: user cancel 403', async ({ request }) => {
    const response = await request.patch('/api/benefits/documents/1/cancel');
    expect(response.status()).toBe(403);
  });
});
