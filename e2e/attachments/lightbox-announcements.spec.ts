import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  uniqueAnnouncementTitle
} from '../announcements/helpers';
import { buildSinglePagePdfBuffer } from '../helpers/attachment-fixtures';
import { attachmentLightboxDialog, waitForPdfCanvas } from './helpers';

const PDF_FILE_NAME = '공지첨부.pdf';

test.describe('공지 첨부 Lightbox (admin)', () => {
  test.setTimeout(90_000);

  test('AC-03: 공지 상세 PDF 바로가기 시 Dialog에 canvas가 표시된다', async ({
    page,
    request
  }) => {
    const title = uniqueAnnouncementTitle('AC72-03');
    const announcement = await createAnnouncementOrThrow(request, {
      title,
      body: '첨부 lightbox 테스트',
      defer_notify: true
    });

    const buffer = buildSinglePagePdfBuffer();
    const uploadResponse = await request.post(
      `/api/announcements/${announcement.id}/attachments`,
      {
        multipart: {
          file: {
            name: PDF_FILE_NAME,
            mimeType: 'application/pdf',
            buffer
          }
        }
      }
    );
    expect(uploadResponse.status()).toBe(201);

    await page.goto('/dashboard/announcements');
    await page.getByTestId(`announcement-row-${announcement.id}`).click();

    const detailDialog = page.getByTestId('announcement-detail-dialog');
    await expect(detailDialog).toBeVisible();

    const pagesBefore = page.context().pages().length;
    await detailDialog
      .getByRole('button', { name: new RegExp(`${PDF_FILE_NAME}.*바로가기`) })
      .click();
    expect(page.context().pages().length).toBe(pagesBefore);

    const lightbox = attachmentLightboxDialog(page, PDF_FILE_NAME);
    await expect(lightbox).toBeVisible({ timeout: 30_000 });
    await waitForPdfCanvas(lightbox);
  });
});
