import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import { CHAT_TEXT, expectNoHorizontalScroll, gotoChat, messagesLog } from '../quick-chat/helpers';
import { applyThemeBeforeNavigation, expectThemeApplied, type ColorMode } from '../quick-request/helpers';
import { createAs, uniqueTag } from '../quick-workflow/helpers';
import {
  MIME,
  ensureFixtures,
  fileCard,
  fileFromFixture,
  imageTile,
  sendWithAttachmentsAs,
  type ChatMessageWithAttachments
} from './98-helpers';

/**
 * plan 98 AC-21 — THEMES × light/dark 20조합 · 첨부 메시지(이미지 1 + 파일 1) 있는 대화 · 카드·썸네일 표시 · scrollWidth <= clientWidth
 */
const MODES: ColorMode[] = ['light', 'dark'];

test.describe('plan 98 C. 테마 20조합 (AC-21)', () => {
  test.describe.configure({ timeout: 90_000 });

  let requestNo = '';
  let message: ChatMessageWithAttachments;

  test.beforeAll(async () => {
    const fixtures = ensureFixtures();
    requestNo = (await createAs('user', uniqueTag('E2E98THEME'))).requestNo;
    message = await sendWithAttachmentsAs('user', requestNo, '테마 확인', [
      fileFromFixture(fixtures.png, MIME.png),
      fileFromFixture(fixtures.docx, MIME.docx)
    ]);
  });

  test('AC-21: THEMES import (중복 없음)', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    expect(new Set(THEMES.map((t) => t.value)).size).toBe(THEMES.length);
  });

  for (const { value: theme } of THEMES) {
    for (const mode of MODES) {
      test(`AC-21: ${theme} × ${mode} · 1280 첨부 카드·썸네일 표시 · scrollWidth <= clientWidth`, async ({ page, baseURL }) => {
        await applyThemeBeforeNavigation(page, baseURL!, theme, mode);
        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoChat(page, requestNo);
        await expectThemeApplied(page, theme, mode);
        await expect(page.getByRole('button', { name: CHAT_TEXT.send, exact: true })).toBeVisible({ timeout: 20_000 });
        const [image, file] = message.attachments;
        await expect(imageTile(page, image!.id)).toBeVisible({ timeout: 20_000 });
        await expect(fileCard(page, file!.id)).toBeVisible();
        await expect(fileCard(page, file!.id)).toContainText('sample.docx');
        await expectNoHorizontalScroll(page);
        const overflow = await messagesLog(page).evaluate((node) => node.scrollWidth - node.clientWidth);
        expect(overflow, 'quick-chat-messages 가로 넘침').toBeLessThanOrEqual(0);
        const messenger = page.getByTestId('quick-chat-messenger');
        const messengerOverflow = await messenger.evaluate((node) => node.scrollWidth - node.clientWidth);
        expect(messengerOverflow, 'messenger 가로 넘침').toBeLessThanOrEqual(0);
      });
    }
  }
});
