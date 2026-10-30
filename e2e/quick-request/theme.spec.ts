import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import {
  applyThemeBeforeNavigation,
  type ColorMode,
  expectNoHorizontalScroll,
  expectThemeApplied,
  gotoQuickRequest,
  openAddressPicker,
  quickRequestOrderPage,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

// plan 86 AC-19 — THEMES(theme.config.ts) 전체 × light/dark · 1280 스모크 (테마 목록 하드코딩 금지)
const MODES: ColorMode[] = ['light', 'dark'];

test.describe('퀵 배송 요청 테마 스모크 (plan 86 AC-19)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  test('AC-19: THEMES 목록 import (중복 없음)', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    expect(new Set(THEMES.map((t) => t.value)).size).toBe(THEMES.length);
  });

  for (const { value: theme } of THEMES) {
    for (const mode of MODES) {
      test(`AC-19: ${theme} × ${mode} · 1280 렌더 · scrollWidth <= clientWidth`, async ({
        page,
        baseURL
      }) => {
        await applyThemeBeforeNavigation(page, baseURL!, theme, mode);
        await gotoQuickRequest(page, VIEWPORT_DESKTOP);
        await expectThemeApplied(page, theme, mode);

        const orderPage = quickRequestOrderPage(page);
        await expect(orderPage).toBeVisible();
        await expect(orderPage.getByTestId('quick-request-register-button')).toBeVisible();
        await expectNoHorizontalScroll(page);
      });
    }
  }

  // plan 87 AC-26 — vercel · 375 · 주소 검색 dialog 열림 스모크
  test('AC-26: vercel × light · 375 주소 검색 dialog 열림 · scrollWidth <= clientWidth', async ({
    page,
    baseURL
  }) => {
    await applyThemeBeforeNavigation(page, baseURL!, 'vercel', 'light');
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    await expectThemeApplied(page, 'vercel', 'light');
    await expect(quickRequestOrderPage(page)).toBeVisible();
    const dialog = await openAddressPicker(page);
    await expect(dialog.getByTestId('quick-request-address-picker-postcode')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
