import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import { applyThemeBeforeNavigation, expectThemeApplied, type ColorMode } from '../quick-request/helpers';
import { createAs, uniqueTag } from '../quick-workflow/helpers';
import { CHAT_TEXT, expectNoHorizontalScroll, gotoChat } from './helpers';

/**
 * plan 93 AC-31 — THEMES(theme.config.ts) 전체 × light/dark · 1280 「퀵 대화」 스모크 (user.json · 본인 건 선택)
 */
const MODES: ColorMode[] = ['light', 'dark'];

test.describe('plan 93 E. 테마 스모크 (AC-31)', () => {
  test.describe.configure({ timeout: 90_000 });

  let requestNo = '';

  test.beforeAll(async () => {
    requestNo = (await createAs('user', uniqueTag('E2E93THEME'))).requestNo;
  });

  test('AC-31: THEMES import (중복 없음)', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    expect(new Set(THEMES.map((t) => t.value)).size).toBe(THEMES.length);
  });

  for (const { value: theme } of THEMES) {
    for (const mode of MODES) {
      test(`AC-31: ${theme} × ${mode} · 1280 quick-chat-messenger·전송 버튼 표시 · scrollWidth <= clientWidth`, async ({
        page,
        baseURL
      }) => {
        await applyThemeBeforeNavigation(page, baseURL!, theme, mode);
        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoChat(page, requestNo);
        await expectThemeApplied(page, theme, mode);
        await expect(page.getByTestId('quick-chat-messenger')).toBeVisible();
        await expect(page.getByRole('button', { name: CHAT_TEXT.send, exact: true })).toBeVisible({ timeout: 20_000 });
        await expectNoHorizontalScroll(page);
        const messenger = page.getByTestId('quick-chat-messenger');
        const overflow = await messenger.evaluate((node) => node.scrollWidth - node.clientWidth);
        expect(overflow, 'messenger 가로 넘침').toBeLessThanOrEqual(0);
      });
    }
  }
});
