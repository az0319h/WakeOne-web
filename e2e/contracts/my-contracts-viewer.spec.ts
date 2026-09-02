import { expect, test } from '@playwright/test';
import { ensureUserAuthorName } from '../helpers/contract-import-notifications';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber,
  uploadContractPdfViaApi
} from '../helpers/contracts';

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

  if (response.status() !== 201) {
    throw new Error(`import failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  return body.contract as { id: number; document_number: string };
}

test.describe('내 계약 첨부 Viewer (user)', () => {
  test('AC-02: user 내 계약 PDF 열기 시 viewer URL과 탭 title에 file_name이 포함된다', async ({
    page,
    context,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-AC48-02-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC48-02');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);
      const contract = await importContractForAuthor(
        adminRequest,
        documentNumber,
        authorName
      );

      const uploadResponse = await uploadContractPdfViaApi(
        adminRequest,
        contract.id,
        PDF_FILE_NAME
      );
      expect(uploadResponse.status()).toBe(201);
      const attachmentId = (await uploadResponse.json()).attachment.id as number;

      await page.goto(
        `/dashboard/my-contracts?search=${encodeURIComponent(documentNumber)}`
      );

      const row = page.getByRole('row', { name: new RegExp(documentNumber) });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: '상세 보기' }).click();

      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();

      const pagePromise = context.waitForEvent('page');
      await sheet
        .getByRole('button', { name: new RegExp(`${PDF_FILE_NAME}.*열기`) })
        .click();
      const viewerPage = await pagePromise;
      await viewerPage.waitForLoadState('domcontentloaded');

      await expect(viewerPage).toHaveURL(
        new RegExp(
          `/dashboard/my-contracts/${contract.id}/attachments/${attachmentId}/view`
        )
      );
      await expect(viewerPage).toHaveTitle(new RegExp(PDF_FILE_NAME));
      await expect(viewerPage.locator('iframe')).toBeVisible();
      await viewerPage.close();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-05: user A가 user B 계약 viewer URL 직접 접근 시 에러 UI만 표시된다', async ({
    page,
    playwright
  }) => {
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');
    const authorEmail = user2Email as string;

    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const authorName = `E2E-AC48-05-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC48-05');

      await ensureUserAuthorName(adminRequest, authorEmail, authorName);
      const contract = await importContractForAuthor(
        adminRequest,
        documentNumber,
        authorName
      );

      const uploadResponse = await uploadContractPdfViaApi(
        adminRequest,
        contract.id,
        PDF_FILE_NAME
      );
      expect(uploadResponse.status()).toBe(201);
      const attachmentId = (await uploadResponse.json()).attachment.id as number;

      await page.goto(
        `/dashboard/my-contracts/${contract.id}/attachments/${attachmentId}/view`
      );

      await expect(page.getByText('본인 작성 계약서만 조회할 수 있습니다.')).toBeVisible({
        timeout: 15_000
      });
      await expect(page.locator('iframe')).toHaveCount(0);
    } finally {
      await adminRequest.dispose();
    }
  });
});
