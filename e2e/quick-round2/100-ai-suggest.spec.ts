import { expect, test } from '@playwright/test';
import { createAs, fixtureUser, pageAs, uniqueTag, VIEWPORT_MOBILE } from '../quick-workflow/helpers';
import {
  composerInput,
  expectNoHorizontalScroll,
  expectTouchTarget,
  gotoChat,
  REQUESTER_REPLIES,
  sendMessageAs,
  sendViaUi,
  waitForSubscribed
} from '../quick-chat/helpers';
import {
  AI_READY_TIMEOUT_MS,
  AI_TEXT,
  aiBadge,
  clearUsage,
  countMessageSends,
  countSuggestPosts,
  expectAiChips,
  expectAiEnabled,
  expectNoToast,
  expectRuleChips,
  heightOf,
  kstDay,
  NO_CALL_WAIT_MS,
  onlyInMode,
  readAiFixture,
  repliesGroup,
  repliesRow,
  replyChips,
  sendFromUi,
  setUsage
} from './100-helpers';

/**
 * plan 100 — 퀵 대화 AI 답장 추천 UI (mock 모드 · `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=1`)
 * docs/plans/100_quick-chat-ai-reply-suggestions-plan.md — AC-01 · AC-02 · AC-03 · AC-07(FE) · AC-14
 * 요청자 = user.json · 상대 = dongbang.json. 매 test 새 context(sessionStorage 분리).
 */
test.describe('plan 100 A. AI 답장 추천 칩 (mock)', () => {
  onlyInMode('mock');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const fixture = readAiFixture();
  let userId = '';

  test.beforeAll(async () => {
    userId = (await fixtureUser('user')).userId;
    await clearUsage([userId]);
    const probe = (await createAs('user', uniqueTag('E2E100PRB'))).requestNo;
    await expectAiEnabled(probe, true);
  });

  test.afterAll(async () => {
    await clearUsage([userId]);
  });

  test('AC-01: (2 context) 동방 「40분 뒤 가능할까요?」 → 5초 안에 요청자 칩 4개(fixture) · 「AI 추천」 배지 · suggest 1회 · 칩 클릭 = 입력창만(전송 0)', async ({
    browser
  }) => {
    const requestNo = (await createAs('user', uniqueTag('E2E100A01'))).requestNo;
    const requester = await pageAs(browser, 'user');
    const vendor = await pageAs(browser, 'dongbang');
    try {
      const suggestPosts = countSuggestPosts(requester.page);
      const vendorSuggestPosts = countSuggestPosts(vendor.page);
      const messageSends = countMessageSends(requester.page);

      await gotoChat(requester.page, requestNo);
      await waitForSubscribed(requester.page);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);

      await gotoChat(vendor.page, requestNo);
      await sendViaUi(vendor.page, '40분 뒤 가능할까요?');

      await expectAiChips(requester.page, fixture, AI_READY_TIMEOUT_MS);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      expect(suggestPosts(), '요청자 페이지 suggest POST').toBe(1);
      expect(vendorSuggestPosts(), '보낸 쪽(동방)은 마지막이 자기 메시지라 호출 0').toBe(0);

      await replyChips(requester.page).nth(1).click();
      await expect(composerInput(requester.page)).toHaveValue(fixture[1]!);
      await requester.page.waitForTimeout(800);
      expect(messageSends(), '칩 클릭은 전송하지 않음 (C-14)').toBe(0);
      await expectNoToast(requester.page);
    } finally {
      await vendor.context.close();
      await requester.context.close();
    }
  });

  test('AC-02: 요청자가 답장 전송 → 규칙 3개로 복귀 · 배지 0 · suggest 0 → 다시 상대 메시지 → 1회', async ({ browser }) => {
    const requestNo = (await createAs('user', uniqueTag('E2E100A02'))).requestNo;
    await sendMessageAs('dongbang', requestNo, '40분 뒤 가능할까요?');
    const requester = await pageAs(browser, 'user');
    try {
      const suggestPosts = countSuggestPosts(requester.page);
      await gotoChat(requester.page, requestNo);
      await waitForSubscribed(requester.page);
      await expectAiChips(requester.page, fixture, 10_000);
      expect(suggestPosts()).toBe(1);

      await sendFromUi(requester.page, '네 가능합니다. 부탁드립니다.');
      await expectRuleChips(requester.page, REQUESTER_REPLIES, 5_000);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      expect(suggestPosts(), '내 메시지에는 호출하지 않음').toBe(1);
      await expect(aiBadge(requester.page)).toHaveCount(0);

      await sendMessageAs('dongbang', requestNo, '네 알겠습니다. 바로 출발하겠습니다.');
      await expectAiChips(requester.page, fixture, AI_READY_TIMEOUT_MS + 2_000);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      expect(suggestPosts(), '새 상대 메시지 → 1회 더').toBe(2);
      await expectNoToast(requester.page);
    } finally {
      await requester.context.close();
    }
  });

  test('AC-03: 대화 처음 열기(마지막 = 상대) → 1회 · 같은 탭 새로고침 → 같은 lastMessageId라 재호출 0(캐시)', async ({ browser }) => {
    const requestNo = (await createAs('user', uniqueTag('E2E100A03'))).requestNo;
    await sendMessageAs('dongbang', requestNo, '출발지 도착했습니다. 어디로 가면 될까요?');
    const requester = await pageAs(browser, 'user');
    try {
      const suggestPosts = countSuggestPosts(requester.page);
      await gotoChat(requester.page, requestNo);
      await expectAiChips(requester.page, fixture, 10_000);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      expect(suggestPosts(), '처음 열 때 1회').toBe(1);

      await requester.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(requester.page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
      await expectAiChips(requester.page, fixture, 10_000);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      expect(suggestPosts(), '새로고침 후 재호출 0').toBe(1);
    } finally {
      await requester.context.close();
    }
  });

  test('AC-07(FE): 오늘 사용량 100(한도) → suggest 429 → 규칙 칩 유지 · 배지 0 · 토스트 0', async ({ browser }) => {
    const requestNo = (await createAs('user', uniqueTag('E2E100A07'))).requestNo;
    await sendMessageAs('dongbang', requestNo, '40분 뒤 가능할까요?');
    await setUsage(userId, kstDay(0), 100);
    const requester = await pageAs(browser, 'user');
    try {
      const suggestPosts = countSuggestPosts(requester.page);
      const responsePromise = requester.page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().includes('/messages/suggest'),
        { timeout: 20_000 }
      );
      await gotoChat(requester.page, requestNo);
      const response = await responsePromise;
      expect(response.status(), 'suggest 429').toBe(429);
      // FE(service.ts)는 non-OK 본문 스트림을 cancel()하고 상태 코드로만 판단한다 → 브라우저에서 본문을 읽을 수 없다.
      // 본문 {reason:'limit'}은 API spec AC-07이 판정. 여기서는 FE가 「한도」로 인식했는지(그날 플래그)를 본다
      await expect
        .poll(() =>
          requester.page.evaluate((key) => window.sessionStorage.getItem(key), `wakeone:quick-chat-ai:limit:${kstDay(0)}`)
        )
        .toBe('1');

      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await requester.page.waitForTimeout(NO_CALL_WAIT_MS);
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      await expectNoToast(requester.page);
      expect(suggestPosts(), '429 뒤 재시도 0').toBe(1);
    } finally {
      await requester.context.close();
      await clearUsage([userId]);
    }
  });

  test('AC-14: 375 — 칩 줄 높이 규칙·로딩·AI 3상태 동일 · AI 4개 가로 스크롤 · 칩 ≥ 44px · 문서 가로 넘침 0', async ({ browser }) => {
    const requestNo = (await createAs('user', uniqueTag('E2E100A14'))).requestNo;
    await sendMessageAs('dongbang', requestNo, '확인 부탁드립니다.');
    await sendMessageAs('user', requestNo, '네 확인했습니다.');
    const requester = await pageAs(browser, 'user', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoChat(requester.page, requestNo);
      await waitForSubscribed(requester.page);
      // 규칙(마지막 = 내 메시지 · idle)
      await expectRuleChips(requester.page, REQUESTER_REPLIES);
      const rulesHeight = await heightOf(repliesRow(requester.page));
      await expectTouchTarget(replyChips(requester.page).first());

      // 로딩(상대 메시지 수신 → debounce 1초 동안 aria-busy)
      await sendMessageAs('dongbang', requestNo, '40분 뒤 가능할까요?');
      await expect(repliesGroup(requester.page)).toHaveAttribute('aria-busy', 'true', { timeout: AI_READY_TIMEOUT_MS });
      const loadingHeight = await heightOf(repliesRow(requester.page));

      // AI 4개 + 배지
      await expectAiChips(requester.page, fixture, AI_READY_TIMEOUT_MS + 2_000);
      await expect(repliesGroup(requester.page)).toHaveAttribute('aria-busy', 'false');
      const aiHeight = await heightOf(repliesRow(requester.page));

      expect(loadingHeight, `로딩 ${loadingHeight} = 규칙 ${rulesHeight}`).toBe(rulesHeight);
      expect(aiHeight, `AI ${aiHeight} = 규칙 ${rulesHeight}`).toBe(rulesHeight);

      const { scrollWidth, clientWidth } = await repliesGroup(requester.page).evaluate((node) => ({
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth
      }));
      expect(scrollWidth, `칩 줄 가로 스크롤 (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`).toBeGreaterThan(
        clientWidth
      );
      const chips = replyChips(requester.page);
      for (let index = 0; index < (await chips.count()); index += 1) {
        await expectTouchTarget(chips.nth(index));
      }
      // 배지는 높이를 늘리지 않는다 (줄 안에 수직 중앙)
      const badgeBox = await aiBadge(requester.page).boundingBox();
      expect(badgeBox!.height).toBeLessThanOrEqual(rulesHeight);
      await expectNoHorizontalScroll(requester.page);
      await expect(aiBadge(requester.page)).toHaveAccessibleName(new RegExp(AI_TEXT.badge));
    } finally {
      await requester.context.close();
    }
  });
});
