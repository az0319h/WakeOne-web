import { expect, test } from '@playwright/test';
import { openAnnouncementsNavLink } from './helpers';

test.describe('공지사항 nav', () => {
  test('AC-01: Overview 사이드바에 공지사항 링크가 표시되고 목록 페이지로 이동한다', async ({
    page
  }) => {
    await page.goto('/dashboard/overview');
    await openAnnouncementsNavLink(page);
    await expect(page).toHaveURL('/dashboard/announcements');
    await expect(page.getByTestId('announcements-page')).toBeVisible();
  });
});
