import { devices, expect, test } from '@playwright/test';

/** plan 91 — AC-10 iOS 설치 안내 배너·가이드 (chromium + iPhone 14 UA/viewport) */
test.describe('iOS 설치 안내', () => {
  test('AC-10: iPhone UA 미설치 → 배너 → 「방법 보기」 3단계 Dialog → 「닫기」 → 새로고침 후에도 없음 · Desktop UA 없음', async ({
    browser
  }) => {
    const iphone = devices['iPhone 14'];
    const iosContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
      userAgent: iphone.userAgent,
      viewport: iphone.viewport,
      deviceScaleFactor: iphone.deviceScaleFactor,
      isMobile: true,
      hasTouch: true
    });
    try {
      const page = await iosContext.newPage();
      await page.goto('/dashboard/overview');

      const banner = page.getByTestId('ios-install-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await expect(banner).toContainText('홈 화면에 추가하면 알림을 받을 수 있어요');

      await page.getByTestId('ios-install-guide-open').click();
      const dialog = page.getByTestId('ios-install-guide-dialog');
      await expect(dialog.getByRole('heading', { name: '아이폰에서 알림 받기' })).toBeVisible();
      const steps = dialog.getByRole('listitem');
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toContainText('공유 버튼');
      await expect(steps.nth(1)).toContainText('홈 화면에 추가');
      await expect(steps.nth(2)).toContainText('홈 화면의 WakeOne 아이콘으로 열고');
      await expect(steps.nth(2)).toContainText('휴대폰 알림을 켜세요');
      await expect(dialog.getByText('iOS 16.4 이상에서 지원됩니다.')).toBeVisible();
      await dialog.getByRole('button', { name: '확인' }).click();
      await expect(dialog).toBeHidden();

      await page.getByTestId('ios-install-banner-dismiss').click();
      await expect(banner).toBeHidden();

      const dismissedAt = await page.evaluate(() =>
        window.localStorage.getItem('wakeone.push.ios-banner-dismissed-at')
      );
      expect(Number(dismissedAt)).toBeGreaterThan(0);

      await page.reload();
      await expect(page.getByTestId('notification-bell')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('ios-install-banner')).toHaveCount(0);
    } finally {
      await iosContext.close();
    }

    const desktopContext = await browser.newContext({
      ...devices['Desktop Chrome'],
      storageState: 'e2e/.auth/user.json'
    });
    try {
      const page = await desktopContext.newPage();
      await page.goto('/dashboard/overview');
      await expect(page.getByTestId('notification-bell')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('ios-install-banner')).toHaveCount(0);
    } finally {
      await desktopContext.close();
    }
  });
});
