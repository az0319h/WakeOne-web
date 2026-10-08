import { expect, test } from '@playwright/test';
import { ensureUserAuthorName } from '../helpers/contract-import-notifications';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';
import {
  attachmentLightboxDialog,
  uploadContractPdfFixtureViaApi,
  waitForPdfCanvas
} from './helpers';

const PDF_FILE_NAME = '내계약서.pdf';

async function importContractForAuthor(
  request: import('@playwright/test').APIRequestContext,
  documentNumber: string,
  authorName: string
) {
  const headers = importAuthHeaders();
  if (!headers) {
    throw new Error('CONTRACT_IMPORT_TOKEN is required in .env');
  }

  const response = await request.post('/api/contracts/import', {
    headers,
    data: buildImportPayload(documentNumber, {
      author_name: authorName,
      author_email: null
    })
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.contract as { id: number; document_number: string };
}

test.describe('내 계약 첨부 Lightbox (user)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-02: user 내 계약 PDF 열기 시 Dialog에 canvas가 표시된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC72-02-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC72-02');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      const contract = await importContractForAuthor(
        adminRequest,
        documentNumber,
        authorName
      );
      await uploadContractPdfFixtureViaApi(
        adminRequest,
        contract.id,
        PDF_FILE_NAME
      );

      await page.goto(
        `/dashboard/my-contracts?search=${encodeURIComponent(documentNumber)}`
      );

      const row = page.getByRole('row', { name: new RegExp(documentNumber) });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: '상세 보기' }).click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible({ timeout: 30_000 });
      await expect(sheet.getByText(PDF_FILE_NAME, { exact: true })).toBeVisible({
        timeout: 30_000
      });

      const pagesBefore = page.context().pages().length;
      await sheet.getByRole('button', { name: `${PDF_FILE_NAME} 열기` }).click();
      expect(page.context().pages().length).toBe(pagesBefore);

      const lightbox = attachmentLightboxDialog(page, PDF_FILE_NAME);
      await expect(lightbox).toBeVisible({ timeout: 30_000 });
      await waitForPdfCanvas(lightbox);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-05: user A가 user B 계약 download API 직접 호출 시 403이 반환된다', async ({
    playwright
  }) => {
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    try {
      const authorName = `E2E-AC72-05-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC72-05');

      await ensureUserAuthorName(adminRequest, user2Email as string, authorName);
      const contract = await importContractForAuthor(
        adminRequest,
        documentNumber,
        authorName
      );
      const attachment = await uploadContractPdfFixtureViaApi(
        adminRequest,
        contract.id,
        PDF_FILE_NAME
      );

      const response = await userRequest.get(
        `/api/my-contracts/${contract.id}/attachments/${attachment.id}/download`
      );
      expect(response.status()).toBe(403);
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });
});
