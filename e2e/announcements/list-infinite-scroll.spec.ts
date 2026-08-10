import { expect, test } from '@playwright/test';
import { announcementRows, seedAnnouncementsViaApi } from './helpers';

const ANNOUNCEMENTS_PAGE_SIZE = 10;

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('공지사항 무한 스크롤', () => {
  test('AC-11a: 11건 이상 seed 후 스크롤하면 추가 행이 lazy load된다', async ({
    page,
    playwright
  }) => {
    test.setTimeout(120_000);

    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    await seedAnnouncementsViaApi(adminRequest, 12, 'scroll');
    await adminRequest.dispose();

    await page.goto('/dashboard/announcements');
    const rows = announcementRows(page);
    await expect(rows).toHaveCount(ANNOUNCEMENTS_PAGE_SIZE, { timeout: 15_000 });

    const initialCount = await rows.count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => rows.count(), { timeout: 20_000 })
      .toBeGreaterThan(initialCount);

    const rowTestIds = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid'))
    );
    expect(new Set(rowTestIds).size).toBe(rowTestIds.length);
    expect(rowTestIds.length).toBeGreaterThan(ANNOUNCEMENTS_PAGE_SIZE);
  });
});
