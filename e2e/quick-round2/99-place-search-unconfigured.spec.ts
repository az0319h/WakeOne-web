import { expect, request as playwrightRequest, test } from '@playwright/test';
import { gotoQuickRequest, openAddressPicker, VIEWPORT_DESKTOP } from '../quick-request/helpers';
import { AUTH, BASE_URL } from '../quick-workflow/helpers';
import { isUnconfiguredRun, PLACE_TEXT, PLACES_PATH } from './99-helpers';

/**
 * plan 99 AC-10 — 키 미설정 서버: 「장소 검색」 탭 없음 · Route 503.
 * 기본 e2e 서버(mock)는 설정된 상태이므로 이 spec은 `E2E_KAKAO_PLACES_UNCONFIGURED=1`일 때만 판정한다 (91 AC-20 패턴):
 *   서버:  E2E_KAKAO_PLACES_UNCONFIGURED=1 E2E_KAKAO_PLACES_MOCK=1 npx next dev -p 3000   (UNCONFIGURED가 MOCK보다 우선)
 *   실행:  E2E_KAKAO_PLACES_UNCONFIGURED=1 npx playwright test e2e/quick-round2/99-place-search-unconfigured.spec.ts
 *   (playwright.config webServer env는 `...process.env`라 Playwright가 서버를 띄우는 경우에도 같은 값이 넘어간다)
 */
test.describe('plan 99 E. 키 미설정 (E2E_KAKAO_PLACES_UNCONFIGURED=1 서버)', () => {
  test.skip(!isUnconfiguredRun(), 'E2E_KAKAO_PLACES_UNCONFIGURED=1 + 미설정 서버 필요 (AC-10 별도 실행)');
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  test('AC-10: API — GET places?q=익선 → 503 「장소 검색이 아직 설정되지 않았습니다.」 · x-request-id', async () => {
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: AUTH.user });
    try {
      const response = await api.get(`${PLACES_PATH}?q=${encodeURIComponent('익선')}`);
      expect(response.status()).toBe(503);
      expect(await response.json()).toEqual({ success: false, message: PLACE_TEXT.notConfigured });
      expect(response.headers()['x-request-id']).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('AC-10: 요청 페이지 Dialog — tab 2개(「주소 검색」「최근 이용 내역」) · 「장소 검색」 없음 · 설명 문구 기존 그대로', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openAddressPicker(page, 'quick-request-origin');
    await expect(dialog.getByRole('tab')).toHaveText([...PLACE_TEXT.tabsUnconfigured]);
    await expect(dialog.getByRole('tab', { name: PLACE_TEXT.tab, exact: true })).toHaveCount(0);
    await expect(dialog.getByTestId('quick-request-address-picker-tab-place')).toHaveCount(0);
    await expect(dialog.getByTestId('quick-request-place-input')).toHaveCount(0);
    await expect(dialog.getByText('도로명·건물명·지번으로 검색하거나 최근 이용 내역에서 선택하세요.', { exact: true })).toBeVisible();
  });
});
