import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  deleteAnnouncementViaApi,
  uniqueAnnouncementTitle
} from './helpers';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe.configure({ mode: 'serial' });

test.describe('공지사항 목록·상세 Dialog (user)', () => {
  test('AC-11: 목록 행 클릭 시 read-only detail Dialog가 열리고 page route로 이동하지 않는다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const title = uniqueAnnouncementTitle('detail');
    const announcement = await createAnnouncementOrThrow(adminRequest, {
      title,
      body: '상세 Dialog 본문 전체 텍스트'
    });
    await adminRequest.dispose();

    await page.goto('/dashboard/announcements');
    await page.getByTestId(`announcement-row-${announcement.id}`).click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/announcements\\?announcement=${announcement.id}`)
    );
    await expect(page).not.toHaveURL(
      new RegExp(`/dashboard/announcements/${announcement.id}$`)
    );

    const detailDialog = page.getByTestId('announcement-detail-dialog');
    await expect(detailDialog).toBeVisible();
    await expect(page.getByTestId('announcement-detail-body')).toHaveText(
      '상세 Dialog 본문 전체 텍스트'
    );
    await expect(detailDialog.getByRole('button', { name: '수정' })).toHaveCount(0);
  });

  test('AC-19: 삭제된 공지 deep-link 접근 시 empty state가 표시되고 앱이 크래시하지 않는다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const announcement = await createAnnouncementOrThrow(adminRequest, {
      title: uniqueAnnouncementTitle('deleted'),
      body: '삭제 예정 공지'
    });
    const deletedId = announcement.id;
    const deleteResponse = await deleteAnnouncementViaApi(adminRequest, deletedId);
    expect(deleteResponse.status()).toBe(200);
    await adminRequest.dispose();

    await page.goto(`/dashboard/announcements?announcement=${deletedId}`);
    await expect(page.getByTestId('announcement-detail-dialog')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId('announcement-deleted-empty')).toHaveText(
      '삭제된 공지입니다',
      { timeout: 15_000 }
    );
    await expect(page.getByTestId('announcements-page')).toBeVisible();
  });
});
