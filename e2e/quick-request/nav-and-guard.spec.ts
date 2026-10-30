import { expect, test } from '@playwright/test';
import { createPendingGoogleUser, signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import { fillKbarSearch, gotoDashboard, kbarSearchInput, submitKbarSelection } from '../kbar/helpers';
import {
  gotoQuickRequest,
  openQuickRequestNavLink,
  QUICK_REQUEST_PATH,
  quickRequestHeading,
  quickRequestOrderPage
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

// plan 86 — docs/plans/86_quick-request-kakao-redesign-plan.md
test.describe('퀵 배송 요청 nav · guard · kbar (plan 86)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  test('AC-04: loading.tsx PageLoadingSpinner → quick-request-order-page', async ({ page }) => {
    // 서버가 E2E_SLOW_QUICK_REQUEST=1(playwright.config webServer env)로 떠 있어야
    // page.tsx 2s 지연 동안 loading.tsx fallback이 스트리밍된다.
    const navigation = page.goto(QUICK_REQUEST_PATH, { waitUntil: 'commit' });
    await expect(page.getByRole('status', { name: 'Loading' })).toBeVisible({ timeout: 10_000 });
    await navigation;
    await expect(quickRequestOrderPage(page)).toBeVisible({ timeout: 30_000 });
  });

  test('AC-01: 사이드바 퀵 → 퀵 요청하기 → /dashboard/quick/request', async ({ page }) => {
    await openQuickRequestNavLink(page);
    await expect(page).toHaveURL(QUICK_REQUEST_PATH, { timeout: 30_000 });
    await expect(quickRequestHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(quickRequestOrderPage(page)).toBeVisible({ timeout: 30_000 });
  });

  // plan 89 U-1 — 퀵 그룹은 「퀵 대시보드」(/dashboard/quick) + 「퀵 요청하기」 2개 · 최장 일치만 활성(K10)
  test('AC-01: (89 U-1) 퀵 그룹 2개 · 퀵 대시보드 → /dashboard/quick · 요청 화면에서 퀵 요청하기만 활성', async ({
    page
  }) => {
    await openQuickRequestNavLink(page);
    await expect(page).toHaveURL(QUICK_REQUEST_PATH, { timeout: 30_000 });
    const dashboardLink = page.getByRole('link', { name: '퀵 대시보드', exact: true });
    const requestLink = page.getByRole('link', { name: '퀵 요청하기', exact: true });
    await expect(dashboardLink).toBeVisible();
    await expect(requestLink).toHaveAttribute('data-active', 'true');
    await expect(dashboardLink).toHaveAttribute('data-active', 'false');

    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard\/quick$/, { timeout: 30_000 });
    await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: '퀵 대시보드', exact: true })).toHaveAttribute(
      'data-active',
      'true'
    );
  });

  test('AC-01: active user 직접 URL 접근 허용', async ({ page }) => {
    await gotoQuickRequest(page);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);
  });

  test('AC-03: Cmd+K → 퀵 요청하기', async ({ page }) => {
    await gotoDashboard(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(kbarSearchInput(page)).toBeVisible({ timeout: 10_000 });
    await fillKbarSearch(page, '퀵 요청하기');
    await submitKbarSelection(page);
    await expect(page).toHaveURL(QUICK_REQUEST_PATH);
    await expect(quickRequestHeading(page)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('퀵 배송 요청 미인증 · pending guard (plan 86)', () => {
  test.describe.configure({ timeout: 90_000 });

  test('AC-02: 미로그인 → /auth/sign-in (dashboard 셸 미노출)', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] }
    });
    const page = await context.newPage();
    try {
      await page.goto(QUICK_REQUEST_PATH, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in/);
      await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Search/i })).toHaveCount(0);
      await expect(page.getByTestId('quick-request-order-page')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-02: pending user → /auth/sign-in?authStatus=pending_approval', async ({ browser }) => {
    const pending = await createPendingGoogleUser('quick-p86-ac02');
    const { storageState } = await signInWithSupabasePassword(pending.email, pending.password);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    try {
      await page.goto(QUICK_REQUEST_PATH, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth\/sign-in\?authStatus=pending_approval/);
      await expect(page.getByTestId('quick-request-order-page')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
