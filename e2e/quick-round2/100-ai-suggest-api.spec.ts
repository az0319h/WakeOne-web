import { expect, test } from '@playwright/test';
import { createAs, expectLogFor, fixtureUser, uniqueTag } from '../quick-workflow/helpers';
import { sendMessageAs } from '../quick-chat/helpers';
import { metadataText } from './98-helpers';
import {
  AI_TEXT,
  clearUsage,
  DAILY_LIMIT,
  expectAiEnabled,
  getUsage,
  kstDay,
  MAX_SUGGESTION_LENGTH,
  onlyInMode,
  readAiFixture,
  setUsage,
  SUGGEST_ACTION,
  suggestAs,
  type SuggestData
} from './100-helpers';

/**
 * plan 100 — 답장 추천 API (mock 모드 · `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=1`)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-04 · AC-06 · AC-07 · AC-10(200·429 행) + Route 409·400 보조
 */
test.describe('plan 100 B. POST …/messages/suggest (mock)', () => {
  onlyInMode('mock');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const fixture = readAiFixture();
  let userId = '';
  let requestNo = '';
  let vendorMessageId = 0;
  const vendorBody = '40분 뒤 가능할까요? 기사님 출발 전입니다.';

  test.beforeAll(async () => {
    userId = (await fixtureUser('user')).userId;
    await clearUsage([userId]);
    requestNo = (await createAs('user', uniqueTag('E2E100API'))).requestNo;
    await expectAiEnabled(requestNo, true);
    vendorMessageId = (await sendMessageAs('dongbang', requestNo, vendorBody)).id;
  });

  test.afterAll(async () => {
    await clearUsage([userId]);
  });

  test('AC-04: user 유효 호출 → 200 {suggestions:[4], source:ai, lastMessageId} · 각 ≤ 40자 · usage · x-request-id', async () => {
    const result = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.headers['x-request-id']).toBeTruthy();
    const data = result.body.data as SuggestData;
    expect(data.source).toBe('ai');
    expect(data.lastMessageId).toBe(vendorMessageId);
    expect(data.suggestions).toHaveLength(4);
    expect(data.suggestions).toEqual(fixture);
    for (const sentence of data.suggestions) {
      expect([...sentence].length, sentence).toBeLessThanOrEqual(MAX_SUGGESTION_LENGTH);
    }
    expect(data.usage).toEqual({ count: 1, limit: DAILY_LIMIT });
    expect(data.debugPrompt, 'debugPrompt는 echo 모드 전용').toBeUndefined();
    expect(await getUsage(userId, kstDay(0)), '카운터 +1 (Anthropic 호출 직전)').toBe(1);
  });

  test('Route 보조: 409 (이전 id · 마지막이 내 메시지) · 400 (형식) — 카운터 증가 0', async () => {
    const before = await getUsage(userId, kstDay(0));
    const stale = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId - 1 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ success: false, message: AI_TEXT.noNewMessage, reason: 'stale' });
    expect(stale.headers['x-request-id']).toBeTruthy();

    const invalid = await suggestAs('user', requestNo, { lastMessageId: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.headers['x-request-id']).toBeTruthy();

    // 동방 입장: 마지막이 자기 메시지 → 409
    const own = await suggestAs('dongbang', requestNo, { lastMessageId: vendorMessageId });
    expect(own.status).toBe(409);
    expect(own.body).toMatchObject({ reason: 'stale' });

    expect(await getUsage(userId, kstDay(0)), '409·400은 세지 않음').toBe(before);
  });

  test('AC-06: logistics(쓰기 역할 없음) → 403 · user2(조회 권한 없음) → 404', async () => {
    const logistics = await suggestAs('logistics', requestNo, { lastMessageId: vendorMessageId });
    expect(logistics.status, JSON.stringify(logistics.body)).toBe(403);
    expect(logistics.body).toMatchObject({ success: false, message: AI_TEXT.logisticsReadOnly });
    expect(logistics.headers['x-request-id']).toBeTruthy();

    const other = await suggestAs('user2', requestNo, { lastMessageId: vendorMessageId });
    expect(other.status, JSON.stringify(other.body)).toBe(404);
    expect(other.body).toMatchObject({ success: false, message: AI_TEXT.notFound });
    expect(other.headers['x-request-id']).toBeTruthy();
  });

  test('AC-07: usage 99 → 1번째 200(count 100) · 2번째 429 {reason:limit}(증가 없음) · KST 날짜가 바뀐 day면 다시 200', async () => {
    await setUsage(userId, kstDay(0), 99);

    const first = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect((first.body.data as SuggestData).usage).toEqual({ count: 100, limit: DAILY_LIMIT });

    const second = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(second.status, JSON.stringify(second.body)).toBe(429);
    expect(second.body).toMatchObject({ success: false, reason: 'limit', message: AI_TEXT.limit });
    expect(second.headers['x-request-id']).toBeTruthy();
    expect(await getUsage(userId, kstDay(0)), '한도 도달 후 증가 없음').toBe(100);

    // 자정을 넘긴 것과 같은 상태: 100회 행을 어제 day로 옮기면 오늘 행이 없다
    await clearUsage([userId]);
    await setUsage(userId, kstDay(-1), 100);
    const nextDay = await suggestAs('user', requestNo, { lastMessageId: vendorMessageId });
    expect(nextDay.status, JSON.stringify(nextDay.body)).toBe(200);
    expect((nextDay.body.data as SuggestData).usage).toEqual({ count: 1, limit: DAILY_LIMIT });
    expect(await getUsage(userId, kstDay(-1)), '어제 행은 그대로').toBe(100);
  });

  test('AC-10(200·429): 활동 로그 quick_request.chat_ai_suggest — source·message_count·latency_ms·토큰 · 본문·추천 문장 0', async () => {
    const ok = await expectLogFor(SUGGEST_ACTION, requestNo, 200);
    expect(ok.metadata).toMatchObject({ quick_request_no: requestNo, source: 'ai' });
    for (const key of ['message_count', 'latency_ms', 'input_tokens', 'output_tokens'] as const) {
      expect(typeof ok.metadata?.[key], `200 metadata.${key} 숫자`).toBe('number');
    }
    expect(ok.metadata?.message_count).toBe(1);

    const limited = await expectLogFor(SUGGEST_ACTION, requestNo, 429);
    expect(limited.metadata).toMatchObject({ quick_request_no: requestNo, source: 'rules', error_code: 'limit_exceeded' });

    const stale = await expectLogFor(SUGGEST_ACTION, requestNo, 409);
    expect(stale.metadata).toMatchObject({ error_code: 'conflict' });
    await expectLogFor(SUGGEST_ACTION, requestNo, 403);
    await expectLogFor(SUGGEST_ACTION, requestNo, 400);

    for (const item of [ok, limited, stale]) {
      const text = metadataText(item.metadata);
      expect(text, '메시지 본문 미기록').not.toContain('40분 뒤');
      expect(text).not.toContain('기사님');
      for (const sentence of fixture) {
        expect(text, '추천 문장 미기록').not.toContain(sentence);
      }
    }
  });
});
