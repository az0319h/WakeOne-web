import { expect, test } from '@playwright/test';
import { ensureUserAuthorName } from '../helpers/contract-import-notifications';
import {
  buildImportPayload,
  importAuthHeaders,
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractPdfViaApi
} from '../helpers/contracts';
import {
  createAnnouncementOrThrow,
  uniqueAnnouncementTitle,
  uploadAnnouncementPdfViaApi
} from '../announcements/helpers';

const CONTRACT_PDF = 'ac48-contract.pdf';
const MY_CONTRACT_PDF = 'ac48-my-contract.pdf';
const ANNOUNCEMENT_PDF = 'ac48-announcement.pdf';

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
  return body.contract as { id: number };
}

test.describe('첨부 inline download API 회귀 (plan 48 AC-07)', () => {
  test.describe.configure({ mode: 'serial' });
  test('AC-07: contracts inline download는 200과 inline content-disposition을 반환한다', async ({
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC48-07C');
    const contract = await importContractViaApi(request, documentNumber);

    const uploadResponse = await uploadContractPdfViaApi(
      request,
      contract.id,
      CONTRACT_PDF
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    const response = await request.get(
      `/api/contracts/${contract.id}/attachments/${attachmentId}/download?disposition=inline`
    );

    expect(response.status()).toBe(200);
    const contentDisposition = response.headers()['content-disposition'] ?? '';
    expect(contentDisposition).toContain('inline');
    expect(contentDisposition).toContain(CONTRACT_PDF);
  });

  test('AC-07: my-contracts inline download는 200과 inline content-disposition을 반환한다', async ({
    playwright
  }) => {
    test.setTimeout(120_000);
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json',
      baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000'
    });
    try {
      const userEmail = process.env.E2E_USER2_EMAIL;
      test.skip(!userEmail, 'E2E_USER2_EMAIL required');

      const authorName = `E2E-AC48-07M-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC48-07M');

      await ensureUserAuthorName(adminRequest, userEmail as string, authorName);
      const contract = await importContractForAuthor(
        adminRequest,
        documentNumber,
        authorName
      );

      const uploadResponse = await uploadContractPdfViaApi(
        adminRequest,
        contract.id,
        MY_CONTRACT_PDF
      );
      expect(uploadResponse.status()).toBe(201);
      const attachmentId = (await uploadResponse.json()).attachment.id as number;

      const user2Request = await playwright.request.newContext({
        storageState: 'e2e/.auth/user2.json',
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000'
      });

      try {
        const response = await user2Request.get(
          `/api/my-contracts/${contract.id}/attachments/${attachmentId}/download?disposition=inline`
        );

        expect(response.status()).toBe(200);
        const contentDisposition = response.headers()['content-disposition'] ?? '';
        expect(contentDisposition).toContain('inline');
        expect(contentDisposition).toContain(MY_CONTRACT_PDF);
      } finally {
        await user2Request.dispose();
      }
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-07: announcements inline download는 200과 inline content-disposition을 반환한다', async ({
    request
  }) => {
    const announcement = await createAnnouncementOrThrow(request, {
      title: uniqueAnnouncementTitle('AC48-07A'),
      body: 'inline download regression',
      defer_notify: true
    });

    const uploadResponse = await uploadAnnouncementPdfViaApi(
      request,
      announcement.id,
      ANNOUNCEMENT_PDF
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    const response = await request.get(
      `/api/announcements/${announcement.id}/attachments/${attachmentId}/download?disposition=inline`
    );

    expect(response.status()).toBe(200);
    const contentDisposition = response.headers()['content-disposition'] ?? '';
    expect(contentDisposition).toContain('inline');
    expect(contentDisposition).toContain(ANNOUNCEMENT_PDF);
  });
});
