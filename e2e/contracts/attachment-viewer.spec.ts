import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractAttachmentViaApi,
  uploadContractPdfViaApi
} from '../helpers/contracts';

const PDF_FILE_NAME = '계약서.pdf';

async function openContractDetailSheet(page: Page, documentNumber: string) {
  await page.goto(
    `/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`
  );

  const row = page.getByRole('row', { name: new RegExp(documentNumber) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '계약서 작업 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: /상세 보기/ }).click();

  const sheet = page.getByRole('dialog', { name: '계약서 상세' });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function clickOpenAttachment(context: import('@playwright/test').BrowserContext, sheet: Locator, fileName: string) {
  const pagePromise = context.waitForEvent('page');
  await sheet.getByRole('button', { name: new RegExp(`${fileName}.*열기`) }).click();
  const newPage = await pagePromise;
  await newPage.waitForLoadState('domcontentloaded');
  return newPage;
}

test.describe('계약 첨부 Viewer (admin)', () => {
  test('AC-01: admin 계약 상세 PDF 열기 시 viewer URL과 탭 title에 file_name이 포함된다', async ({
    page,
    context,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC48-01');
    const contract = await importContractViaApi(request, documentNumber);

    const uploadResponse = await uploadContractPdfViaApi(
      request,
      contract.id,
      PDF_FILE_NAME
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    const sheet = await openContractDetailSheet(page, documentNumber);
    const viewerPage = await clickOpenAttachment(context, sheet, PDF_FILE_NAME);

    await expect(viewerPage).toHaveURL(
      new RegExp(
        `/dashboard/contracts/${contract.id}/attachments/${attachmentId}/view`
      )
    );
    await expect(viewerPage).toHaveTitle(new RegExp(PDF_FILE_NAME));
    await expect(viewerPage.locator('iframe')).toBeVisible();
    await viewerPage.close();
  });

  test('AC-04: inline 불가 첨부는 열기 버튼 없이 다운로드만 가능하다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC48-04');
    const contract = await importContractViaApi(request, documentNumber);
    const binFileName = 'ac48-noninline.bin';

    const uploadResponse = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      binFileName,
      1024
    );
    expect(uploadResponse.status()).toBe(201);

    const sheet = await openContractDetailSheet(page, documentNumber);
    await expect(
      sheet.getByRole('button', { name: new RegExp(`${binFileName}.*열기`) })
    ).toHaveCount(0);
    await expect(
      sheet.getByRole('button', { name: new RegExp(`${binFileName}.*다운로드`) })
    ).toBeVisible();
  });
});

test.describe('계약 첨부 Viewer RBAC (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-06: user가 admin contracts viewer URL 직접 접근 시 overview로 redirect된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const documentNumber = uniqueDocumentNumber('AC48-06');
      const contract = await importContractViaApi(adminRequest, documentNumber);

      const uploadResponse = await uploadContractPdfViaApi(
        adminRequest,
        contract.id,
        PDF_FILE_NAME
      );
      expect(uploadResponse.status()).toBe(201);
      const attachmentId = (await uploadResponse.json()).attachment.id as number;

      await page.goto(
        `/dashboard/contracts/${contract.id}/attachments/${attachmentId}/view`
      );

      await expect(page).toHaveURL(/\/dashboard\/overview/, { timeout: 15_000 });
      await expect(page.locator('iframe')).toHaveCount(0);
    } finally {
      await adminRequest.dispose();
    }
  });
});
