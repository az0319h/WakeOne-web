import { expect, test } from '@playwright/test';
import { createAs, expectLogFor, fixtureUser, pageAs, uniqueTag } from '../quick-workflow/helpers';
import { gotoChat, REQUESTER_REPLIES, sendMessageAs } from '../quick-chat/helpers';
import { metadataText } from './98-helpers';
import {
  AI_TEXT,
  clearUsage,
  countSuggestPosts,
  expectAiEnabled,
  expectNoToast,
  expectRuleChips,
  getUsage,
  kstDay,
  NO_CALL_WAIT_MS,
  onlyInMode,
  SUGGEST_ACTION,
  suggestAs
} from './100-helpers';

/**
 * plan 100 — 모델 실패 (fail 모드 · `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=fail`)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-08 · AC-10(502 행)
 */
test.describe('plan 100 D. 모델 실패 502 (fail)', () => {
  onlyInMode('fail');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let userId = '';
  let requestNo = '';
  let vendorMessageId = 0;
  const vendorBody = '실패 모드 확인용 메시지입니다. 40분 뒤 가능할까요?';

  test.beforeAll(async () => {
    userId = (await fixtureUser('user')).userId;
    await clearUsage([userId]);
    requestNo = (await createAs('user', uniqueTag('E2E100FAI'))).requestNo;
    await expectAiEnabled(requestNo, true);
    vendorMessageId = (await sendMessageAs('dongbang', requestNo, vendorBody)).id;
  });

  test.afterAll(async () => {
    await clearUsage([userId]);
  });

  test('AC-08(API): 502 「답장 추천을 불러오지 못했습니다.」 {reason:failed} · x-request-id · 카운터는 +1(AI까지 간 호출)', async () => {
    const result = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(result.status, JSON.stringify(result.body)).toBe(502);
    expect(result.body).toMatchObject({ success: false, message: AI_TEXT.failed, reason: 'failed' });
    expect(result.headers['x-request-id']).toBeTruthy();
    expect(await getUsage(userId, kstDay(0)), 'D-6 수정: 호출 직전 +1 · 실패도 센다').toBe(1);
  });

  test('AC-08(FE): 대화 열기 → suggest 502 → 규칙 칩 유지 · 배지 0 · 토스트 0', async ({ browser }) => {
    const requester = await pageAs(browser, 'user');
    try {
      const suggestPosts = countSuggestPosts(requester.page);
      const responsePromise = requester.page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().includes('/messages/suggest'),
        { timeout: 20_000 }
      );
      await gotoChat(requester.page, requestNo);
      const response = await responsePromise;
      expect(response.status()).toBe(502);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await expectNoToast(requester.page);
      expect(suggestPosts(), '실패 뒤 자동 재시도 0 (retry false)').toBe(1);
    } finally {
      await requester.context.close();
    }
  });

  test('AC-10(502): 활동 로그 502 행 — source rules · error_code ai_upstream_error · message_count·latency_ms 숫자 · 본문 0', async () => {
    const log = await expectLogFor(SUGGEST_ACTION, requestNo, 502);
    expect(log.metadata).toMatchObject({
      quick_request_no: requestNo,
      source: 'rules',
      error_code: 'ai_upstream_error',
      message_count: 1
    });
    expect(typeof log.metadata?.latency_ms).toBe('number');
    const text = metadataText(log.metadata);
    expect(text).not.toContain('실패 모드 확인용');
    expect(text).not.toContain('40분 뒤');
  });
});
