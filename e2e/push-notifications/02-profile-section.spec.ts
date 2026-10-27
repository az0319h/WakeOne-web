import { expect, test } from '@playwright/test';
import {
  NOTIFICATION_PERMISSION_DEFAULT_STUB,
  PUSH_PREFERENCES_PATH,
  resetPushStateForUser,
  resolveUserIdByEmail
} from '../helpers/push-mock';

/**
 * plan 91 — AC-04 (프로필 섹션) · AC-08 (설정 Dialog) · AC-09 (알림 페이지 배너)
 * 헤드리스 Chromium은 `Notification.permission === 'denied'`를 보고하므로(환경 제약),
 * `off` 분기 판정이 필요한 테스트는 `addInitScript`로 `default`를 stub한다.
 */
test.describe.configure({ mode: 'serial' });

test.describe('프로필 「휴대폰 알림」 섹션', () => {
  test.beforeAll(async ({ playwright }) => {
    const userRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/user.json' });
    await resetPushStateForUser(userRequest);
    await userRequest.dispose();
  });

  test('AC-04: user.json 섹션 제목·Switch·「알림 종류 설정」·「등록된 기기 0대」 · 상태 문구(permission default stub → 꺼져 있어요)', async ({
    page
  }) => {
    await page.addInitScript(NOTIFICATION_PERMISSION_DEFAULT_STUB);
    await page.goto('/dashboard/profile');

    const section = page.getByTestId('push-settings-section');
    await expect(section.getByRole('heading', { name: '휴대폰 알림', level: 2 })).toBeVisible();
    await expect(page.getByTestId('push-toggle')).toBeVisible();
    await expect(section.getByRole('button', { name: '알림 종류 설정' })).toBeVisible();
    await expect(page.getByTestId('push-device-count')).toHaveText('등록된 기기 0대');

    const status = page.getByTestId('push-status');
    await expect(status).toHaveText(/알림이 꺼져 있어요|이 브라우저에서는 알림을 켤 수 없어요/, {
      timeout: 15_000
    });
    await expect(page.getByTestId('push-toggle')).toHaveAttribute('aria-checked', 'false');
  });

  test('AC-04 (헤드리스 기본): permission denied → 「알림이 차단되어 있어요…」 · Switch disabled (환경 제약 기록)', async ({
    page
  }) => {
    await page.goto('/dashboard/profile');
    const status = page.getByTestId('push-status');
    await expect(status).toHaveAttribute('data-status', /denied|off|unsupported/, { timeout: 15_000 });
    const dataStatus = await status.getAttribute('data-status');
    if (dataStatus === 'denied') {
      await expect(status).toContainText('알림이 차단되어 있어요. 브라우저 설정에서 WakeOne 알림을 허용해 주세요.');
      await expect(page.getByTestId('push-toggle')).toBeDisabled();
    }
    test.info().annotations.push({ type: 'headless-permission', description: dataStatus ?? 'null' });
  });

  test('AC-04: admin.json에도 같은 섹션이 보인다', async ({ browser }) => {
    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      const adminPage = await adminContext.newPage();
      await adminPage.goto('/dashboard/profile');
      const section = adminPage.getByTestId('push-settings-section');
      await expect(section.getByRole('heading', { name: '휴대폰 알림', level: 2 })).toBeVisible();
      await expect(adminPage.getByTestId('push-toggle')).toBeVisible();
      await expect(section.getByRole('button', { name: '알림 종류 설정' })).toBeVisible();
      await expect(adminPage.getByTestId('push-device-count')).toContainText('등록된 기기');
    } finally {
      await adminContext.close();
    }
  });
});

test.describe('알림 페이지 「휴대폰 알림 설정」 Dialog', () => {
  test('AC-08: user Dialog 8개 Switch(사용자 승인 요청 없음) · 공지사항 OFF → toast · 새로고침 후 OFF 유지', async ({
    page
  }) => {
    await page.goto('/dashboard/notifications');
    await page.getByTestId('push-preferences-open').click();

    const dialog = page.getByTestId('push-preferences-dialog');
    await expect(dialog.getByRole('heading', { name: '휴대폰 알림 설정' })).toBeVisible();
    await expect(dialog.getByRole('switch')).toHaveCount(8);
    await expect(dialog.getByText('사용자 승인 요청')).toHaveCount(0);

    const announcement = page.getByTestId('push-group-announcement');
    await expect(announcement).toHaveAttribute('aria-checked', 'true');
    await announcement.click();
    await expect(page.getByText('알림 설정을 저장했습니다.')).toBeVisible();
    await expect(announcement).toHaveAttribute('aria-checked', 'false');

    await page.reload();
    await page.getByTestId('push-preferences-open').click();
    await expect(page.getByTestId('push-group-announcement')).toHaveAttribute('aria-checked', 'false');

    // 복구
    await page.getByTestId('push-group-announcement').click();
    await expect(page.getByText('알림 설정을 저장했습니다.')).toBeVisible();
    await expect(page.getByTestId('push-group-announcement')).toHaveAttribute('aria-checked', 'true');

    const prefs = await page.request.get(PUSH_PREFERENCES_PATH);
    const body = (await prefs.json()) as { data: { disabled_groups: string[] } };
    expect(body.data.disabled_groups).toEqual([]);
  });

  test('AC-08: admin Dialog Switch 9개 · ?notif_user={B}에서는 버튼 없음', async ({
    browser,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/admin.json' });
    const userBId = await resolveUserIdByEmail(adminRequest, process.env.E2E_USER_EMAIL!);
    await adminRequest.dispose();

    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      const adminPage = await adminContext.newPage();
      await adminPage.goto('/dashboard/notifications');
      await adminPage.getByTestId('push-preferences-open').click();
      const dialog = adminPage.getByTestId('push-preferences-dialog');
      await expect(dialog.getByRole('heading', { name: '휴대폰 알림 설정' })).toBeVisible();
      await expect(dialog.getByRole('switch')).toHaveCount(9);
      await expect(dialog.getByText('사용자 승인 요청')).toBeVisible();
      await adminPage.keyboard.press('Escape');

      await adminPage.goto(`/dashboard/notifications?notif_user=${encodeURIComponent(userBId)}`);
      await expect(adminPage.getByTestId('notifications-page')).toBeVisible();
      await expect(adminPage.getByTestId('notif-user-combobox')).toBeVisible();
      await expect(adminPage.getByTestId('push-preferences-open')).toHaveCount(0);
      await expect(adminPage.getByTestId('push-status-banner')).toHaveCount(0);
    } finally {
      await adminContext.close();
    }
  });
});

test.describe('알림 페이지 상단 배너', () => {
  test('AC-09: 구독 없음(permission default stub) → 배너 문구 + 「켜기」 → /dashboard/profile#push 섹션', async ({
    page
  }) => {
    await page.addInitScript(NOTIFICATION_PERMISSION_DEFAULT_STUB);
    await page.goto('/dashboard/notifications');

    const banner = page.getByTestId('push-status-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('휴대폰 알림을 켜면 사이트를 열지 않아도 알림을 받을 수 있어요');

    const link = page.getByTestId('push-status-banner-link');
    await expect(link).toHaveText('켜기');
    await link.click();

    await expect(page).toHaveURL(/\/dashboard\/profile#push$/);
    await expect(
      page.getByTestId('push-settings-section').getByRole('heading', { name: '휴대폰 알림', level: 2 })
    ).toBeVisible();
  });
});
