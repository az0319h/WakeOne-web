import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  createAnnouncementViaApi,
  uniqueAnnouncementTitle,
  unpinAllAnnouncements
} from './helpers';

test.describe('공지사항 overview 위젯 (admin)', () => {
  test('AC-10: overview에 pin 우선 최대 3건과 전체 보기 링크가 표시된다', async ({
    page,
    request
  }) => {
    await unpinAllAnnouncements(request);

    const titles = [
      uniqueAnnouncementTitle('overview-a'),
      uniqueAnnouncementTitle('overview-b'),
      uniqueAnnouncementTitle('overview-c'),
      uniqueAnnouncementTitle('overview-d')
    ];

    const pinned = await createAnnouncementOrThrow(request, {
      title: titles[0]!,
      body: 'overview pinned',
      is_pinned: true
    });

    for (let index = 1; index < titles.length; index += 1) {
      const response = await createAnnouncementViaApi(request, {
        title: titles[index]!,
        body: `overview seed ${index}`
      });
      expect(response.status()).toBe(201);
    }

    await page.goto('/dashboard/overview');
    const card = page.getByTestId('announcements-overview-card');
    await expect(card).toBeVisible({ timeout: 15_000 });

    const overviewItems = page.locator('[data-testid^="announcements-overview-item-"]');
    await expect(overviewItems).toHaveCount(3);

    await expect(page.getByTestId(`announcements-overview-item-${pinned.id}`)).toBeVisible();
    await expect(card.getByText(titles[0]!)).toBeVisible();

    await page.getByRole('link', { name: '전체 보기' }).click();
    await expect(page).toHaveURL('/dashboard/announcements');
    await expect(page.getByTestId('announcements-page')).toBeVisible();
  });
});
