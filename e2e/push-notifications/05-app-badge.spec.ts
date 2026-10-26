import { expect, test } from '@playwright/test';
import { renameUserAsAdmin, resolveUserIdByEmail } from '../helpers/push-mock';

/** plan 91 — AC-16 앱 아이콘 배지 (`navigator.setAppBadge`/`clearAppBadge` stub) */
const BADGE_STUB = `
  window.__badgeCalls = [];
  Object.defineProperty(navigator, 'setAppBadge', {
    configurable: true,
    value: (n) => { window.__badgeCalls.push(['set', n]); return Promise.resolve(); }
  });
  Object.defineProperty(navigator, 'clearAppBadge', {
    configurable: true,
    value: () => { window.__badgeCalls.push(['clear']); return Promise.resolve(); }
  });
`;

type BadgeCall = ['set', number] | ['clear'];

test.describe('앱 아이콘 배지', () => {
  test('AC-16: 읽지 않은 알림 n≥1 → setAppBadge(n) 호출 · 「모두 읽음」 → clearAppBadge() 호출', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/admin.json' });
    const userRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/user.json' });
    try {
      const userId = await resolveUserIdByEmail(adminRequest, process.env.E2E_USER_EMAIL!);
      await userRequest.patch('/api/notifications/read-all');
      await renameUserAsAdmin(adminRequest, userId, `E2E푸시AC16-${Date.now()}`);

      await expect
        .poll(async () => {
          const response = await userRequest.get('/api/notifications?limit=10');
          const body = (await response.json()) as { data?: { notifications?: Array<{ status: string }> } };
          return body.data?.notifications?.filter((n) => n.status === 'unread').length ?? 0;
        })
        .toBeGreaterThan(0);

      await page.addInitScript(BADGE_STUB);
      await page.goto('/dashboard/overview');

      const readCalls = () =>
        page.evaluate(() => (window as unknown as { __badgeCalls: BadgeCall[] }).__badgeCalls);

      await expect
        .poll(
          async () => (await readCalls()).filter((c) => c[0] === 'set' && (c[1] as number) >= 1).length,
          { timeout: 20_000 }
        )
        .toBeGreaterThanOrEqual(1);

      await page.getByTestId('notification-bell').click();
      await expect(page.getByRole('heading', { name: '알림', level: 4 })).toBeVisible();
      await page.getByRole('button', { name: '모두 읽음' }).click();

      await expect
        .poll(async () => (await readCalls()).filter((c) => c[0] === 'clear').length, { timeout: 20_000 })
        .toBeGreaterThanOrEqual(1);
    } finally {
      await adminRequest.dispose();
      await userRequest.dispose();
    }
  });
});
