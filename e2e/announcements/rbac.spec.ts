import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  uniqueAnnouncementTitle,
  uploadAnnouncementAttachmentViaApi
} from './helpers';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('공지사항 RBAC (user)', () => {
  test('AC-09: non-admin은 CUD UI 없이 Read·첨부 다운로드만 가능하다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    const title = uniqueAnnouncementTitle('rbac');
    const announcement = await createAnnouncementOrThrow(adminRequest, {
      title,
      body: 'RBAC 첨부 테스트 본문',
      defer_notify: true
    });

    const uploadResponse = await uploadAnnouncementAttachmentViaApi(
      adminRequest,
      announcement.id,
      'rbac-sample.bin',
      1024
    );
    expect(uploadResponse.status()).toBe(201);
    await notifyIfNeeded(adminRequest, announcement.id);
    await adminRequest.dispose();

    await page.goto('/dashboard/announcements');
    await expect(page.getByTestId('announcements-page')).toBeVisible();
    await expect(page.getByTestId('announcement-create-button')).toHaveCount(0);
    await expect(
      page.getByTestId(`announcement-row-action-${announcement.id}`)
    ).toHaveCount(0);

    await page.getByTestId(`announcement-row-${announcement.id}`).click();
    const detailDialog = page.getByTestId('announcement-detail-dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByRole('button', { name: '수정' })).toHaveCount(0);
    await expect(detailDialog.getByRole('button', { name: '삭제' })).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await detailDialog
      .getByRole('button', { name: 'rbac-sample.bin 다운로드' })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('rbac-sample.bin');
  });
});

async function notifyIfNeeded(
  adminRequest: import('@playwright/test').APIRequestContext,
  announcementId: number
) {
  await adminRequest.post(`/api/announcements/${announcementId}/notify`);
}
