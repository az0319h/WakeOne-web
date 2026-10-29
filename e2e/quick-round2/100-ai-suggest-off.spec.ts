import { expect, test } from '@playwright/test';
import { createAs, expectLogFor, pageAs, uniqueTag } from '../quick-workflow/helpers';
import { getMessagesAs, gotoChat, REQUESTER_REPLIES, sendMessageAs, VENDOR_REPLIES } from '../quick-chat/helpers';
import {
  AI_TEXT,
  countSuggestPosts,
  expectAiEnabled,
  expectNoToast,
  expectRuleChips,
  NO_CALL_WAIT_MS,
  onlyInMode,
  SUGGEST_ACTION,
  suggestAs
} from './100-helpers';

/**
 * plan 100 — 꺼짐 (기본 서버 · `QUICK_CHAT_AI_SUGGEST` 없음)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-09 (+ AC-10 503 행)
 */
test.describe('plan 100 E. AI 추천 OFF (AC-09)', () => {
  onlyInMode('off');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let requestNo = '';
  let vendorMessageId = 0;
  let vendorRequestNo = '';

  test.beforeAll(async () => {
    // 요청자 화면용: 마지막 = 동방 메시지 / 동방 화면용: 마지막 = 요청자 메시지
    requestNo = (await createAs('user', uniqueTag('E2E100OFF'))).requestNo;
    vendorMessageId = (await sendMessageAs('dongbang', requestNo, '40분 뒤 가능할까요?')).id;
    vendorRequestNo = (await createAs('user', uniqueTag('E2E100OFV'))).requestNo;
    await sendMessageAs('user', vendorRequestNo, '언제 도착하나요?');
  });

  test('AC-09(API): GET …/messages aiSuggest.enabled=false (요청자·동방) · 직접 POST → 503 「답장 추천이 꺼져 있습니다.」', async () => {
    await expectAiEnabled(requestNo, false);
    const vendor = await getMessagesAs('dongbang', requestNo);
    expect(vendor.status).toBe(200);
    expect((vendor.body.data as { aiSuggest?: { enabled: boolean } }).aiSuggest).toEqual({ enabled: false });

    const result = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(result.status, JSON.stringify(result.body)).toBe(503);
    expect(result.body).toMatchObject({ success: false, message: AI_TEXT.disabled, reason: 'disabled' });
    expect(result.headers['x-request-id']).toBeTruthy();
  });

  test('AC-09(UI): 요청자 대화(마지막 = 상대) → 규칙 칩 3개 · suggest 0 / 동방 대화(마지막 = 요청자) → 규칙 칩 4개 · suggest 0', async ({
    browser
  }) => {
    const requester = await pageAs(browser, 'user');
    const vendor = await pageAs(browser, 'dongbang');
    try {
      const requesterPosts = countSuggestPosts(requester.page);
      const vendorPosts = countSuggestPosts(vendor.page);
      await gotoChat(requester.page, requestNo);
      await gotoChat(vendor.page, vendorRequestNo);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await expectRuleChips(vendor.page, VENDOR_REPLIES);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await expectRuleChips(vendor.page, VENDOR_REPLIES);
      expect(requesterPosts(), '요청자 suggest 호출 0').toBe(0);
      expect(vendorPosts(), '동방 suggest 호출 0').toBe(0);
      await expectNoToast(requester.page);
    } finally {
      await vendor.context.close();
      await requester.context.close();
    }
  });

  test('AC-10(503): OFF 호출도 활동 로그 행 — error_code ai_disabled · source rules', async () => {
    const log = await expectLogFor(SUGGEST_ACTION, requestNo, 503);
    expect(log.metadata).toMatchObject({ error_code: 'ai_disabled', source: 'rules' });
  });
});
