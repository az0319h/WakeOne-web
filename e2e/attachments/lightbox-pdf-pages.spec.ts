import { expect, test } from '@playwright/test';
import {
  importContractWithPdf,
  openAttachmentLightboxFromSheet,
  openContractDetailSheet,
  waitForPdfCanvas,
  waitForPdfPageIndicator,
  waitForPdfThumbnailRail
} from './helpers';

const PDF_FILE_NAME = '3page.pdf';

test.describe('첨부 Lightbox PDF 페이지 (admin)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);
  test('AC-11: PDF rail 2번째 썸네일 클릭 시 본문 2페이지가 표시된다', async ({
    page,
    request
  }) => {
    const { documentNumber } = await importContractWithPdf(
      request,
      'AC72-11',
      PDF_FILE_NAME,
      3
    );

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);
    await waitForPdfPageIndicator(lightbox, '1 / 3');
    await waitForPdfThumbnailRail(lightbox);

    await lightbox.getByRole('tab', { name: '2페이지' }).click();
    await waitForPdfPageIndicator(lightbox, '2 / 3');
  });

  test('AC-12: ArrowDown 키로 다음 PDF 페이지가 표시된다', async ({
    page,
    request
  }) => {
    const { documentNumber } = await importContractWithPdf(
      request,
      'AC72-12',
      PDF_FILE_NAME,
      3
    );

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);
    await waitForPdfPageIndicator(lightbox, '1 / 3');

    await lightbox.getByLabel(`${PDF_FILE_NAME} PDF 뷰어`).focus();
    await page.keyboard.press('ArrowDown');
    await waitForPdfPageIndicator(lightbox, '2 / 3');
  });

  test('모바일: 이전/다음 버튼으로 PDF 페이지를 명확히 이동한다', async ({
    page,
    request
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const { documentNumber } = await importContractWithPdf(
      request,
      'AC72-MOBILE-PAGES',
      PDF_FILE_NAME,
      3
    );

    const sheet = await openContractDetailSheet(page, documentNumber);
    const lightbox = await openAttachmentLightboxFromSheet(
      page,
      sheet,
      PDF_FILE_NAME
    );
    await waitForPdfCanvas(lightbox);

    const previousPage = lightbox.getByRole('button', {
      name: '이전 PDF 페이지'
    });
    const nextPage = lightbox.getByRole('button', {
      name: '다음 PDF 페이지'
    });
    const pageNavigation = lightbox.getByRole('navigation', {
      name: 'PDF 페이지 이동'
    });

    await expect(
      lightbox.getByRole('tablist', { name: 'PDF 페이지 목록' })
    ).toHaveCount(0);
    await expect(pageNavigation.getByText('1 / 3', { exact: true })).toBeVisible();
    await expect(previousPage).toBeDisabled();

    await nextPage.click();
    await expect(pageNavigation.getByText('2 / 3', { exact: true })).toBeVisible();
    await previousPage.click();
    await expect(pageNavigation.getByText('1 / 3', { exact: true })).toBeVisible();
  });
});
