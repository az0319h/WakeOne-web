import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  ensureUserAuthorName,
  runMatchedReminder
} from '../helpers/contract-reminder-notifications';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';
import { resolveUserIdByEmail, updateUserFullName } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('스냅샷 필드 불변', () => {
  const userEmail = process.env.E2E_USER_EMAIL!;
  let adminRequest: APIRequestContext;
  let userId: string;

  test.beforeAll(async ({ playwright }) => {
    adminRequest = await createAdminRequest(playwright);
    userId = await resolveUserIdByEmail(adminRequest, userEmail);
  });

  test.afterAll(async () => {
    await adminRequest.dispose();
  });

  test('AC-11: system-email-logs author_name은 발송 당시 스냅샷을 유지한다', async ({
    page
  }) => {
    const snapshotAuthorName = `E2E-P29-AC11-${Date.now()}`;

    const { body, runKey } = await runMatchedReminder(adminRequest, {
      prefix: 'P29AC11',
      authorName: snapshotAuthorName,
      userEmail
    });
    expect(body.recipients.some((item) => item.status === 'sent')).toBeTruthy();

    await updateUserFullName(adminRequest, userId, `E2E-P29-AC11-LIVE-${Date.now()}`);

    await page.goto('/dashboard/system-email-logs');
    await expect(page.getByTestId('system-email-logs-table')).toBeVisible();

    const targetRow = page.getByTestId('system-email-log-row').filter({ hasText: runKey });
    await expect(targetRow).toBeVisible({ timeout: 15_000 });
    await targetRow.click();

    const dialog = page.getByTestId('system-email-log-detail-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(snapshotAuthorName).first()).toBeVisible();
  });

  test('AC-12: 계약서 author_name은 사용자 이름 변경 후에도 유지된다', async ({ page }) => {
    const snapshotAuthorName = `E2E-P29-AC12-${Date.now()}`;
    const documentNumber = uniqueDocumentNumber('P29AC12');

    await ensureUserAuthorName(adminRequest, userEmail, snapshotAuthorName);

    const headers = importAuthHeaders();
    expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();

    const importResponse = await adminRequest.post('/api/contracts/import', {
      headers: headers!,
      data: buildImportPayload(documentNumber, {
        author_name: snapshotAuthorName,
        author_email: null
      })
    });
    expect(importResponse.status()).toBe(201);

    await updateUserFullName(adminRequest, userId, `E2E-P29-AC12-LIVE-${Date.now()}`);

    await page.goto(`/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`);
    const row = page.getByRole('row', { name: new RegExp(documentNumber) });
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: snapshotAuthorName })).toBeVisible({
      timeout: 15_000
    });

    await row.getByRole('button', { name: '계약서 작업 메뉴 열기' }).click();
    await page.getByRole('menuitem', { name: /상세 보기/ }).click();

    const detailDialog = page.getByRole('dialog', { name: '계약서 상세' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText(snapshotAuthorName).first()).toBeVisible();
  });
});
