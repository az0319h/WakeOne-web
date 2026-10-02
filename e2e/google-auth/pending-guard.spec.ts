import { expect, test } from '@playwright/test';
import {
  createGuestRequestWithPassword,
  createPendingGoogleUser,
  signInWithSupabasePassword
} from '../helpers/supabase-direct-auth';

test.describe('pending 사용자 dashboard guard', () => {
  test('AC-05: pending 세션 GET /dashboard/overview는 sign-in으로 redirect (브라우저, loop 없음)', async ({
    browser
  }) => {
    const pending = await createPendingGoogleUser('ac05-browser');
    const { storageState } = await signInWithSupabasePassword(pending.email, pending.password);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    try {
      await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in\?authStatus=pending_approval/);
      await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
      await expect(
        page.getByText('관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.')
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('AC-05: pending 세션 GET /dashboard/overview는 sign-in으로 redirect (API)', async ({
    playwright
  }) => {
    const pending = await createPendingGoogleUser('ac05-guard');
    const guestRequest = await createGuestRequestWithPassword(
      playwright,
      pending.email,
      pending.password
    );

    try {
      const response = await guestRequest.get('/dashboard/overview', {
        maxRedirects: 0
      });

      expect([302, 307, 303]).toContain(response.status());
      const location = response.headers()['location'] ?? '';
      expect(location).toMatch(/\/auth\/sign-in/);
    } finally {
      await guestRequest.dispose();
    }
  });
});
