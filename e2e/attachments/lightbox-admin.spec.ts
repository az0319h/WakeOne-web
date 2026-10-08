import { expect, test } from '@playwright/test';
import { waitForDashboardPresenceReady } from '../live-users/helpers';
import {
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractAttachmentViaApi
} from '../helpers/contracts';
import {
  attachmentLightboxDialog,
  importContractWithPdf,
  openAttachmentLightboxFromSheet,
  openContractDetailSheet,
  uploadContractPdfFixtureViaApi,
  uploadContractPngFixtureViaApi,
  waitForAttachmentInSheet,
  waitForPdfCanvas
} from './helpers';

const PDF_FILE_NAME = '계약서.pdf';
const PNG_FILE_NAME = '첨부.png';

test.describe('첨부 Lightbox (admin)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);
  test('AC-01: admin 계약 PDF 열기 시 같은 탭 Dialog에 canvas가 표시된다', async ({
    page,
    request
  }) => {
    const { documentNumber } = await importContractWithPdf(
      request,
      'AC72-01',
      PDF_FILE_NAME
    );

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );

    await waitForPdfCanvas(lightbox);
    expect(page.context().pages().length).toBe(1);
  });

  test('AC-04: inline 불가 첨부는 열기 버튼 없이 다운로드만 가능하다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC72-04');
    const contract = await importContractViaApi(request, documentNumber);
    const binFileName = 'ac72-noninline.bin';

    const uploadResponse = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      binFileName,
      1024
    );
    expect(uploadResponse.status()).toBe(201);

    const sheet = await openContractDetailSheet(page, documentNumber);
    await waitForAttachmentInSheet(sheet, binFileName);
    await expect(
      sheet.getByRole('button', { name: new RegExp(`${binFileName}.*열기`) })
    ).toHaveCount(0);
    await expect(
      sheet.getByRole('button', { name: new RegExp(`${binFileName}.*다운로드`) })
    ).toBeVisible();
  });

  test('AC-08: PDF+PNG 2개 첨부에서 carousel 다음 슬라이드로 이미지가 표시된다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC72-08');
    const contract = await importContractViaApi(request, documentNumber);
    // created_at desc → PDF를 나중에 업로드해야 carousel index 0에서 Next로 PNG 이동 가능
    await uploadContractPngFixtureViaApi(request, contract.id, PNG_FILE_NAME);
    await uploadContractPdfFixtureViaApi(request, contract.id, PDF_FILE_NAME);

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);

    await lightbox.getByRole('button', { name: 'Next slide' }).click();

    const imageLightbox = attachmentLightboxDialog(page, PNG_FILE_NAME);
    await expect(imageLightbox).toBeVisible();
    await expect(imageLightbox.getByRole('img', { name: PNG_FILE_NAME })).toBeVisible({
      timeout: 30_000
    });
    await expect(imageLightbox.getByRole('tablist', { name: 'PDF 페이지 목록' })).toHaveCount(
      0
    );
  });

  test('AC-09: carousel 이전 슬라이드로 PDF rail이 복귀한다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC72-09');
    const contract = await importContractViaApi(request, documentNumber);
    await uploadContractPngFixtureViaApi(request, contract.id, PNG_FILE_NAME);
    await uploadContractPdfFixtureViaApi(request, contract.id, PDF_FILE_NAME);

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);

    await lightbox.getByRole('button', { name: 'Next slide' }).click();
    await expect(
      attachmentLightboxDialog(page, PNG_FILE_NAME)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Previous slide' }).click();

    const pdfLightbox = attachmentLightboxDialog(page, PDF_FILE_NAME);
    await expect(pdfLightbox).toBeVisible();
    await waitForPdfCanvas(pdfLightbox);
    await expect(
      pdfLightbox.getByRole('tablist', { name: 'PDF 페이지 목록' })
    ).toBeVisible({ timeout: 30_000 });
  });

  test('AC-10: Escape 키로 lightbox Dialog가 닫힌다', async ({ page, request }) => {
    const { documentNumber } = await importContractWithPdf(
      request,
      'AC72-10',
      PDF_FILE_NAME
    );

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);

    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden({ timeout: 10_000 });
  });

  test('AC-13: overview는 dashboard layout DashboardPresenceTrack을 상속한다', async ({
    page
  }) => {
    await page.goto('/dashboard/overview');
    await expect(
      page.getByRole('heading', { name: /안녕하세요, 다시 오셨군요/ })
    ).toBeVisible({
      timeout: 30_000
    });
    await waitForDashboardPresenceReady(page);
  });
});

test.describe('첨부 Lightbox viewer route 제거 (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-06: plan 48 viewer URL 직접 접근 시 404가 반환된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const { contract, attachment } = await importContractWithPdf(
        adminRequest,
        'AC72-06',
        PDF_FILE_NAME
      );

      const response = await page.goto(
        `/dashboard/contracts/${contract.id}/attachments/${attachment.id}/view`
      );
      expect(response?.status()).toBe(404);
    } finally {
      await adminRequest.dispose();
    }
  });
});
