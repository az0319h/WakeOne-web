import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import {
  applyThemeBeforeNavigation,
  expectNoHorizontalScroll,
  expectThemeApplied,
  gotoQuickRequest,
  VIEWPORT_DESKTOP,
  type ColorMode
} from '../quick-request/helpers';
import { expectPlacesMockServer, ikseonDocs, isUnconfiguredRun, openPlaceTab, placeRow, searchPlace } from './99-helpers';

/**
 * plan 99 AC-13 — THEMES(theme.config.ts) × light/dark 20조합 · 「장소 검색」 탭 결과 표시 (86 AC-19 · 87 AC-26 패턴)
 * - user2.json (분당 30회 한도를 UI spec(user.json)과 나눈다)
 * - grep(#hex 등) 부분은 99-place-search-grep.spec.ts
 */
const MODES: ColorMode[] = ['light', 'dark'];

test.describe('plan 99 D. 테마 20조합 (AC-13)', () => {
  test.skip(isUnconfiguredRun(), '미설정 서버 run에서는 99-place-search-unconfigured.spec.ts만 판정');
  test.use({ storageState: 'e2e/.auth/user2.json' });
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async () => {
    await expectPlacesMockServer();
  });

  test('AC-13: THEMES import (중복 없음 · THEMES × 2모드)', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    expect(new Set(THEMES.map((t) => t.value)).size).toBe(THEMES.length);
  });

  for (const { value: theme } of THEMES) {
    for (const mode of MODES) {
      test(`AC-13: ${theme} × ${mode} · 1280 장소 탭 결과(지번 배지 포함) 표시 · 글자색≠배경색 · scrollWidth <= clientWidth`, async ({
        page,
        baseURL
      }) => {
        const [road, jibun] = ikseonDocs();
        await applyThemeBeforeNavigation(page, baseURL!, theme, mode);
        await gotoQuickRequest(page, VIEWPORT_DESKTOP);
        await expectThemeApplied(page, theme, mode);

        const dialog = await openPlaceTab(page);
        await searchPlace(page, dialog, '익선');
        await expect(dialog.getByTestId('quick-request-place-0-name')).toHaveText(road.place_name);
        await expect(dialog.getByTestId('quick-request-place-1-name')).toHaveText(jibun.place_name);
        await expect(dialog.getByTestId('quick-request-place-1-jibun')).toBeVisible();

        // 시맨틱 토큰이 테마에서 풀려 글자가 배경과 같은 색이 되지 않는지 (보이지 않는 글자 방지)
        const colors = await placeRow(dialog, 0).evaluate((row) => {
          const name = row.querySelector('[data-testid="quick-request-place-0-name"]') as HTMLElement;
          const list = row.closest('ul') as HTMLElement;
          return {
            text: window.getComputedStyle(name).color,
            background: window.getComputedStyle(list).backgroundColor
          };
        });
        expect(colors.text, JSON.stringify(colors)).not.toBe(colors.background);

        await expectNoHorizontalScroll(page);
      });
    }
  }
});
