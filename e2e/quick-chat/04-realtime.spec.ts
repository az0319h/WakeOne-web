import { expect, test } from '@playwright/test';
import { createAs, fixtureUser, pageAs, readAccountMeta, uniqueTag } from '../quick-workflow/helpers';
import {
  CHAT_TEXT,
  NO_REALTIME_WAIT_MS,
  REALTIME_TIMEOUT_MS,
  SUBSCRIBE_SETTLE_MS,
  composerInput,
  createDongbang2WithSession,
  expectNoReload,
  gotoChat,
  gotoDetailChat,
  markNoReload,
  messageBubble,
  messagesLog,
  pageAsDongbang2,
  sendMessageAs,
  sendViaUi,
  waitForSubscribed
} from './helpers';
import type { AccountMeta } from '../quick-workflow/helpers';

/**
 * plan 93 §B 실시간 · §F 「입력 중…」 — docs/plans/93_quick-request-chat-plan.md (AC-12 · AC-13 · AC-14 · AC-36)
 * 2~3 context: 요청자 상세(xl aside) ↔ 동방 「퀵 대화」. 5초 안 반영 · 미반영 8초.
 */
test.describe('plan 93 B·F. 2 context 실시간 · 입력 중', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let user: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let dongbang2: AccountMeta;
  let requestNo = '';

  test.beforeAll(async ({ browser }) => {
    user = await fixtureUser('user');
    dongbang = readAccountMeta('dongbang');
    dongbang2 = await createDongbang2WithSession(browser);
    requestNo = (await createAs('user', uniqueTag('E2E93RT'))).requestNo;
  });

  test('AC-12: 동방이 「퀵 대화」에서 같은 건을 열어 둔 채 요청자 Enter 전송 → 5초 안 왼쪽 말풍선·「요청자」 배지 · 목록 맨 위·미리보기 갱신', async ({
    page,
    browser
  }) => {
    // 목록 정렬 판정용: 다른 건에 메시지를 먼저 남겨 두어 이 건이 맨 위가 아니게 만든다
    const other = await createAs('user', uniqueTag('E2E93RT2'));
    await sendMessageAs('user', other.requestNo, '다른 건 먼저');

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendor.page, requestNo);
      await waitForSubscribed(vendor.page);
      await expect(vendor.page.getByTestId('quick-chat-empty')).toBeVisible({ timeout: 20_000 });
      await vendor.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await markNoReload(vendor.page);

      await gotoDetailChat(page, requestNo);
      const body = '동방특송 담당자님 이건 취소해주세요';
      const { id } = await sendViaUi(page, body);

      const incoming = messageBubble(vendor.page, id);
      await expect(incoming).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(incoming).toHaveAttribute('data-mine', 'false');
      await expect(incoming).toContainText(CHAT_TEXT.roleRequester);
      await expect(incoming).toContainText(body);
      const logBox = await messagesLog(vendor.page).boundingBox();
      const bubbleBox = await incoming.locator('div').filter({ hasText: body }).last().boundingBox();
      expect(bubbleBox!.x, '상대 메시지는 왼쪽').toBeLessThan(logBox!.x + logBox!.width / 2);

      const firstItem = vendor.page.getByTestId('quick-chat-list').getByRole('listitem').first();
      await expect(firstItem.getByTestId(`quick-chat-list-item-${requestNo}`)).toBeVisible({
        timeout: REALTIME_TIMEOUT_MS
      });
      await expect(vendor.page.getByTestId(`quick-chat-list-item-${requestNo}`)).toContainText(
        `${user.fullName}: ${body}`,
        { timeout: REALTIME_TIMEOUT_MS }
      );
      await expectNoReload(vendor.page);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-13: 요청자 상세·동방 「퀵 대화」 — 동방 「알겠습니다」 → 5초 안 요청자 상세에 「동방특송」 배지 · 오름차순 · 자동 스크롤', async ({
    page,
    browser
  }) => {
    await gotoDetailChat(page, requestNo);
    await expect(messagesLog(page).locator('[data-message-id]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
    await markNoReload(page);

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendor.page, requestNo);
      await waitForSubscribed(vendor.page);
      const { id } = await sendViaUi(vendor.page, '알겠습니다');

      const incoming = messageBubble(page, id);
      await expect(incoming).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(incoming).toContainText(CHAT_TEXT.roleDongbang);
      await expect(incoming).toContainText(dongbang.fullName);
      await expect(incoming).toHaveAttribute('data-mine', 'false');

      const ids = await messagesLog(page)
        .locator('[data-message-id]')
        .evaluateAll((nodes) => nodes.map((node) => Number((node as HTMLElement).dataset.messageId)));
      expect(ids, '시간(id) 오름차순').toEqual([...ids].sort((a, b) => a - b));
      expect(ids[ids.length - 1]).toBe(id);

      await expect
        .poll(
          () =>
            messagesLog(page).evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight),
          { message: '맨 아래 근처면 자동 스크롤' }
        )
        .toBeLessThanOrEqual(120);
      await expectNoReload(page);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-14: user2가 「퀵 대화」를 열어 둔 채 user 건에 메시지 → 8초 동안 목록·대화 0건(RLS)', async ({ browser }) => {
    const other = await pageAs(browser, 'user2');
    try {
      await gotoChat(other.page);
      await waitForSubscribed(other.page);
      await other.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await markNoReload(other.page);

      const body = `RLS 확인 ${Date.now()}`;
      await sendMessageAs('user', requestNo, body);
      await other.page.waitForTimeout(NO_REALTIME_WAIT_MS);
      await expect(other.page.getByTestId(`quick-chat-list-item-${requestNo}`)).toHaveCount(0);
      await expect(other.page.getByText(requestNo, { exact: false })).toHaveCount(0);
      await expect(other.page.getByText(body)).toHaveCount(0);
      await expectNoReload(other.page);
    } finally {
      await other.context.close();
    }
  });

  test('AC-36: 3 context — 요청자 타이핑 → A 「{요청자}님이 입력 중…」 · B도 치면 「{요청자}님, {B}님이 입력 중…」 · B 화면은 요청자만 · 멈추면 5초 안 소멸 · 전송 즉시 소멸', async ({
    page,
    browser
  }) => {
    const vendorA = await pageAs(browser, 'dongbang');
    const vendorB = await pageAsDongbang2(browser);
    try {
      await gotoChat(vendorA.page, requestNo);
      await waitForSubscribed(vendorA.page);
      await gotoChat(vendorB.page, requestNo);
      await waitForSubscribed(vendorB.page);
      await gotoDetailChat(page, requestNo);
      await expect(composerInput(page)).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      const typingA = vendorA.page.getByTestId('quick-chat-typing');
      const typingB = vendorB.page.getByTestId('quick-chat-typing');
      const typingUser = page.getByTestId('quick-chat-typing');
      await expect(typingA).toHaveText('');

      await composerInput(page).fill('입력 중');
      await expect(typingA).toHaveText(`${user.fullName}님이 입력 중…`, { timeout: 2_000 });
      await expect(typingB).toHaveText(`${user.fullName}님이 입력 중…`, { timeout: 2_000 });
      await expect(typingUser, '본인 화면에는 본인 없음').toHaveText('');

      await composerInput(vendorB.page).fill('저도 입력');
      await expect(typingA).toHaveText(`${user.fullName}님, ${dongbang2.fullName}님이 입력 중…`, { timeout: 2_000 });
      await expect(typingB, '본인(B) 화면에는 요청자만').toHaveText(`${user.fullName}님이 입력 중…`);

      await expect(typingA, '타이핑 멈춘 뒤 5초 안에 사라짐').toHaveText('', { timeout: 6_000 });
      await expect(typingB).toHaveText('', { timeout: 6_000 });

      await composerInput(vendorB.page).fill('');
      await composerInput(page).fill(`전송하면 즉시 사라짐 ${Date.now()}`);
      await expect(typingA).toContainText(`${user.fullName}님이 입력 중…`, { timeout: 2_000 });
      const { id } = await sendViaUi(page, `전송하면 즉시 사라짐 ${Date.now()}`);
      await expect(messageBubble(vendorA.page, id)).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(typingA, '전송 시 즉시 소멸').toHaveText('', { timeout: 1_000 });
    } finally {
      await vendorA.context.close();
      await vendorB.context.close();
    }
  });
});
