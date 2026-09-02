import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  uniqueAnnouncementTitle,
  uploadAnnouncementPdfViaApi
} from './helpers';

const PDF_FILE_NAME = '공지첨부.pdf';

test.describe('공지 첨부 Viewer (admin)', () => {
  test('AC-03: 공지 상세 PDF 바로가기 시 viewer URL과 탭 title에 file_name이 포함된다', async ({
    page,
    context,
    request
  }) => {
    const title = uniqueAnnouncementTitle('AC48-03');
    const announcement = await createAnnouncementOrThrow(request, {
      title,
      body: '첨부 viewer 테스트',
      defer_notify: true
    });

    const uploadResponse = await uploadAnnouncementPdfViaApi(
      request,
      announcement.id,
      PDF_FILE_NAME
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    await page.goto('/dashboard/announcements');
    await page.getByTestId(`announcement-row-${announcement.id}`).click();

    const detailDialog = page.getByTestId('announcement-detail-dialog');
    await expect(detailDialog).toBeVisible();

    const pagePromise = context.waitForEvent('page');
    await detailDialog
      .getByRole('button', { name: new RegExp(`${PDF_FILE_NAME}.*바로가기`) })
      .click();
    const viewerPage = await pagePromise;
    await viewerPage.waitForLoadState('domcontentloaded');

    await expect(viewerPage).toHaveURL(
      new RegExp(
        `/dashboard/announcements/${announcement.id}/attachments/${attachmentId}/view`
      )
    );
    await expect(viewerPage).toHaveTitle(new RegExp(PDF_FILE_NAME));
    await expect(viewerPage.locator('iframe')).toBeVisible();
    await viewerPage.close();
  });
});
