import { expect, test } from '@playwright/test';
import { createAs, pageAs, uniqueTag, VIEWPORT_MOBILE } from '../quick-workflow/helpers';
import {
  CHAT_TEXT,
  composerInput,
  expectNoHorizontalScroll,
  expectTouchTarget,
  gotoChat,
  sendButton,
  sendMessageAs
} from './helpers';

/**
 * plan 93 §A 모바일(375) — docs/plans/93_quick-request-chat-plan.md (AC-03 · AC-04 375)
 */
test.describe('plan 93 A. 375 — 목록↔대화 전환 · 상세 「대화」 버튼', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let requestNo = '';

  test.beforeAll(async () => {
    requestNo = (await createAs('user', uniqueTag('E2E93MOB'))).requestNo;
    await sendMessageAs('user', requestNo, '모바일 확인용 메시지');
  });

  test('AC-03: 동방 375 — 처음 목록만 · 항목 탭 → 대화만(?request=) · 「목록」으로 복귀 · 가로 스크롤 없음 · 터치 영역 ≥ 44px', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoChat(page);
      const list = page.getByTestId('quick-chat-list');
      const conversation = page.getByTestId('quick-chat-conversation');
      await expect(list).toBeVisible();
      await expect(conversation).toBeHidden();
      await expectNoHorizontalScroll(page);

      const item = page.getByTestId(`quick-chat-list-item-${requestNo}`);
      await expect(item).toBeVisible({ timeout: 20_000 });
      await expectTouchTarget(item);
      await item.click();
      await expect(page).toHaveURL(new RegExp(`request=${requestNo}`));
      await expect(conversation).toBeVisible();
      await expect(list).toBeHidden();
      await expect(page.getByTestId('quick-chat-messages')).toContainText('모바일 확인용 메시지', { timeout: 20_000 });
      await expectNoHorizontalScroll(page);

      await expectTouchTarget(composerInput(page));
      await expectTouchTarget(sendButton(page));
      const chips = page.getByTestId('quick-chat-quick-replies').getByRole('button');
      await expect(chips).toHaveCount(4);
      await expectTouchTarget(chips.first());
      const backButton = page.getByRole('button', { name: CHAT_TEXT.backToList });
      await expectTouchTarget(backButton);
      await backButton.click();
      await expect(page).not.toHaveURL(/request=/);
      await expect(list).toBeVisible();
      await expect(conversation).toBeHidden();

      // 브라우저 뒤로가기로도 대화 ↔ 목록 (history push)
      await item.click();
      await expect(conversation).toBeVisible();
      await page.goBack();
      await expect(list).toBeVisible({ timeout: 10_000 });
      await expect(conversation).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('AC-04 (375): 요청자 상세 하단 「대화」 버튼 1번 탭 → 대화(?chat=1) 열림 · 입력창·「전송」 · 가로 스크롤 없음', async ({
    browser
  }) => {
    const fresh = await createAs('user', uniqueTag('E2E93MOB4'));
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_MOBILE });
    try {
      // Next dev-tools 플로팅 버튼(좌하단)이 375에서 액션바 「대화」와 겹친다 → dev 전용 오버레이만 숨긴다
      await page.addInitScript(() => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
      });
      await page.goto(`/dashboard/quick/${fresh.requestNo}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
      const button = page.getByTestId('quick-detail-chat-button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText(CHAT_TEXT.chatButton);
      await expectTouchTarget(button);
      await expectNoHorizontalScroll(page);

      await button.click();
      await expect(page).toHaveURL(/chat=1/);
      const full = page.getByTestId('quick-detail-chat');
      await expect(full).toBeVisible();
      await expect(full).toHaveAttribute('data-mode', 'full');
      await expect(full.getByRole('heading', { name: CHAT_TEXT.detailChatTitle })).toBeVisible();
      await expect(page.getByTestId('quick-chat-empty')).toHaveText(CHAT_TEXT.emptyWritable, { timeout: 20_000 });
      await expect(page.getByPlaceholder(CHAT_TEXT.composerPlaceholder)).toBeVisible();
      await expect(page.getByRole('button', { name: CHAT_TEXT.send, exact: true })).toBeVisible();
      await expectTouchTarget(composerInput(page));
      await expectTouchTarget(sendButton(page));
      await expectNoHorizontalScroll(page);

      await page.getByRole('button', { name: '상세로' }).click();
      await expect(page).not.toHaveURL(/chat=1/);
      await expect(button).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
