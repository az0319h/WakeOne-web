import { expect, test } from '@playwright/test';
import { createAs, dbQuickRequest, fixtureUser, readAccountMeta, uniqueTag } from '../quick-workflow/helpers';
import { insertFixtureMessages } from '../quick-chat/helpers';
import {
  clearUsage,
  expectAiEnabled,
  onlyInMode,
  readAiFixture,
  suggestAs,
  type SuggestData
} from './100-helpers';

/**
 * plan 100 — 마스킹 (echo 모드 · `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=echo`)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-05
 * mock이 모델에 보낼 user content(JSON)를 `debugPrompt`로 돌려준다 → 원문 연락처·주소·이메일·이름 0 · 최근 10개
 */
test.describe('plan 100 C. 마스킹 echo (AC-05)', () => {
  onlyInMode('echo');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let userId = '';

  test.beforeAll(async () => {
    userId = (await fixtureUser('user')).userId;
    await clearUsage([userId]);
  });

  test.afterAll(async () => {
    await clearUsage([userId]);
  });

  test('AC-05: 010-1234-5678 · 서울 강남구 테헤란로 1 · 이메일 → [연락처]·[주소]·[이메일] · 원문 0 · 이름 0(역할만) · 메시지 ≤ 10개', async () => {
    const user = await fixtureUser('user');
    const vendor = readAccountMeta('dongbang');
    const created = await createAs('user', uniqueTag('E2E100ECH'));
    const requestNo = created.requestNo;
    await expectAiEnabled(requestNo, true);
    const row = await dbQuickRequest(requestNo);

    const base = Date.now() - 60 * 60_000;
    const at = (minute: number) => new Date(base + minute * 60_000).toISOString();
    // 오래된 2개(잘려야 함 · 표식 OLDEST-1/2) + 최근 10개
    const rows = [
      { authorUserId: user.userId, authorName: user.fullName, authorRole: 'requester' as const, body: 'OLDEST-1 오래된 메시지', createdAt: at(0) },
      { authorUserId: vendor.userId, authorName: vendor.fullName, authorRole: 'dongbang' as const, body: 'OLDEST-2 오래된 메시지', createdAt: at(1) },
      ...Array.from({ length: 6 }, (_, index) => ({
        authorUserId: index % 2 === 0 ? user.userId : vendor.userId,
        authorName: index % 2 === 0 ? user.fullName : vendor.fullName,
        authorRole: (index % 2 === 0 ? 'requester' : 'dongbang') as 'requester' | 'dongbang',
        body: `중간 메시지 ${index + 1}`,
        createdAt: at(2 + index)
      })),
      { authorUserId: user.userId, authorName: user.fullName, authorRole: 'requester' as const, body: '제 번호는 010-1234-5678 입니다.', createdAt: at(10) },
      { authorUserId: user.userId, authorName: user.fullName, authorRole: 'requester' as const, body: '도착지는 서울 강남구 테헤란로 1 입니다.', createdAt: at(11) },
      { authorUserId: user.userId, authorName: user.fullName, authorRole: 'requester' as const, body: '메일은 e2e.mask@example.com 으로 주세요.', createdAt: at(12) },
      { authorUserId: vendor.userId, authorName: vendor.fullName, authorRole: 'dongbang' as const, body: `${user.fullName}님 40분 뒤 가능할까요?`, createdAt: at(13) }
    ];
    const ids = await insertFixtureMessages(row.id, rows);
    const lastMessageId = ids[ids.length - 1]!;

    const result = await suggestAs('user', requestNo, { lastMessageId });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const data = result.body.data as SuggestData;
    expect(data.source).toBe('ai');
    expect(data.suggestions).toEqual(readAiFixture());
    expect(typeof data.debugPrompt, 'echo 모드 debugPrompt').toBe('string');

    const prompt = data.debugPrompt!;
    const parsed = JSON.parse(prompt) as {
      requestNo: string;
      status: string;
      viewerRole: string;
      messages: { from: string; me: boolean; text: string }[];
    };

    // 메시지 ≤ 10개 · 오래된 순 · 가장 오래된 2개 제외
    expect(parsed.messages.length).toBeLessThanOrEqual(10);
    expect(parsed.messages).toHaveLength(10);
    expect(prompt).not.toContain('OLDEST-1');
    expect(prompt).not.toContain('OLDEST-2');
    expect(parsed.messages[parsed.messages.length - 1]!.from).toBe('동방특송');
    expect(parsed.messages[parsed.messages.length - 1]!.me).toBe(false);
    expect(parsed.viewerRole).toBe('요청자');

    // 마스킹 표식 · 원문 0
    expect(prompt).toContain('[연락처]');
    expect(prompt).toContain('[주소]');
    expect(prompt).toContain('[이메일]');
    for (const raw of ['010-1234-5678', '01012345678', '1234-5678', '테헤란로', '강남구', 'e2e.mask@example.com']) {
      expect(prompt, `원문 ${raw} 0`).not.toContain(raw);
    }

    // 이름 미전송 (보낸 사람은 역할만) — 본문 속 요청자 이름도 [이름]
    expect(prompt, '요청자 이름 0').not.toContain(user.fullName);
    expect(prompt, '동방 이름 0').not.toContain(vendor.fullName);
    for (const message of parsed.messages) {
      expect(['요청자', '동방특송', '관리자', '참여자']).toContain(message.from);
      expect(Object.keys(message).sort()).toEqual(['from', 'me', 'text']);
    }
  });
});
