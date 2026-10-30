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
test.describe('plan 93 A. 375 — 목록↔대화 전환 · 상세 「대화」 버튼 (plan 106 판정: 탭 바 · 전체 화면 한 줄 상단바)', () => {
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
      // plan 106 D-4 — 대화 목록은 퀵 하단 탭 바가 보인다
      await expect(page.getByTestId('quick-mobile-tabbar')).toBeVisible();
      await expectNoHorizontalScroll(page);

      const item = page.getByTestId(`quick-chat-list-item-${requestNo}`);
      await expect(item).toBeVisible({ timeout: 20_000 });
      await expectTouchTarget(item);
      await item.click();
      await expect(page).toHaveURL(new RegExp(`request=${requestNo}`));
      await expect(conversation).toBeVisible();
      await expect(list).toBeHidden();
      // plan 106 D-12 — 대화방은 전체 화면: 한 줄 상단바(quick-chat-header) · 공통 상단바·탭 바 숨김
      await expect(page.getByTestId('quick-chat-header')).toBeVisible();
      await expect(page.getByRole('banner')).toBeHidden();
      await expect(page.getByTestId('quick-mobile-tabbar')).toHaveCount(0);
      await expect(page.getByTestId('quick-chat-messages')).toContainText('모바일 확인용 메시지', { timeout: 20_000 });
      await expectNoHorizontalScroll(page);

      await expectTouchTarget(composerInput(page));
      await expectTouchTarget(sendButton(page));
      const chips = page.getByTestId('quick-chat-quick-replies').getByRole('button');
      await expect(chips).toHaveCount(4);
      await expectTouchTarget(chips.first());
      const backButton = page.getByRole('button', { name: CHAT_TEXT.backToList });
      await expect(backButton).toHaveAttribute('data-testid', 'quick-chat-back');
      await expectTouchTarget(backButton);
      await backButton.click();
      await expect(page).not.toHaveURL(/request=/);
      await expect(list).toBeVisible();
      await expect(conversation).toBeHidden();

      // 브라우저 뒤로가기로도 대화 ↔ 목록 (history push)
      // plan 96 verifier — nuqs `history:'push'`는 throttle(50ms)·transition 뒤에 pushState → URL 반영을 기다린 뒤 goBack (spec 레이스 · 앱 버그 아님)
      await item.click();
      await expect(page).toHaveURL(new RegExp(`request=${requestNo}`));
      await expect(conversation).toBeVisible();
      await page.goBack();
      await expect(page).not.toHaveURL(/request=/);
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
      // plan 106 D-12 — 휴대폰 상세 대화는 한 줄 상단바(요청번호 + 상태 · 「⋯」) — PC 「요청 대화」 제목 대신
      const header = page.getByTestId('quick-chat-header');
      await expect(header).toBeVisible();
      await expect(header.getByRole('heading', { name: fresh.requestNo })).toBeVisible();
      await expect(page.getByRole('banner')).toBeHidden();
      await expect(page.getByTestId('quick-chat-empty')).toHaveText(CHAT_TEXT.emptyWritable, { timeout: 20_000 });
      await expect(composerInput(page)).toBeVisible();
      await expect(page.getByRole('button', { name: CHAT_TEXT.send, exact: true })).toBeVisible();
      await expectTouchTarget(composerInput(page));
      // mobile-ux 2차 #3 — 빈 입력창은 placeholder가 줄바꿈되지 않아 1줄(44px)
      const inputBox = await composerInput(page).boundingBox();
      expect(inputBox!.height, `empty composer height ${inputBox!.height}`).toBeLessThanOrEqual(46);
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
