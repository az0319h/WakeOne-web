import { expect, test } from '@playwright/test';
import {
  createAs,
  dbChatNotifications,
  dbQuickRequest,
  fixtureUser,
  gotoDashboard,
  pageAs,
  readAccountMeta,
  uniqueTag,
  VIEWPORT_MOBILE,
  type AccountMeta
} from '../quick-workflow/helpers';
import {
  ABSOLUTE_DATE_RE,
  CHAT_TEXT,
  REALTIME_TIMEOUT_MS,
  SUBSCRIBE_SETTLE_MS,
  apiAsDongbang2,
  bellCount,
  chatHref,
  createDongbang2WithSession,
  dbNotificationsStatus,
  dbRead,
  getConversationsAs,
  gotoChat,
  gotoDetailChat,
  markReadAs,
  markReadAsDongbang2,
  messageBubble,
  pageAsDongbang2,
  receipt,
  scrollMessagesToBottom,
  sendMessageAs,
  sendViaUi,
  waitForSubscribed
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 93 §C 안 읽은 수·읽음 표시 — docs/plans/93_quick-request-chat-plan.md (AC-16 ~ AC-21)
 * dongbang2(일회용 · 브라우저 세션)로 「새 대화 N」·목록 배지·구분선·알림 자동 읽음·✓✓를 판정한다.
 */
test.describe('plan 93 C. 안 읽은 수 · 읽음 표시', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let user: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let dongbang2: AccountMeta;
  let requestNo = '';
  let requestId = '';
  let messageIds: number[] = [];

  async function markAllReadAsDongbang2() {
    await apiAsDongbang2(async (api) => {
      // 안 읽음 탭은 한 번에 20건씩 — 공유 dev DB에 안 읽은 대화가 20건을 넘으면 비워질 때까지 반복 (plan 106 verifier)
      for (let round = 0; round < 30; round += 1) {
        const response = await api.get('/api/quick-request/conversations?tab=unread');
        expect(response.status()).toBe(200);
        const { data } = (await response.json()) as {
          data: { conversations: { requestNo: string; lastMessage: { id: number } | null }[] };
        };
        const pending = data.conversations.filter((conversation) => conversation.lastMessage);
        if (pending.length === 0) break;
        for (const conversation of pending) {
          await api.put(`/api/quick-request/${conversation.requestNo}/messages/read`, {
            data: { lastMessageId: conversation.lastMessage!.id }
          });
        }
      }
    });
  }

  test.beforeAll(async ({ browser }) => {
    user = await fixtureUser('user');
    dongbang = readAccountMeta('dongbang');
    dongbang2 = await createDongbang2WithSession(browser);
    await markAllReadAsDongbang2();
    const created = await createAs('user', uniqueTag('E2E93UNREAD'));
    requestNo = created.requestNo;
    requestId = (await dbQuickRequest(requestNo)).id;
  });

  test('AC-16: dongbang2가 /dashboard/quick을 열어 둔 채 요청자 메시지 2개 → 5초 안 표 행 「새 대화 2」 · 375 카드 동일 · 배지 클릭 → 퀵 대화', async ({
    browser
  }) => {
    const vendor = await pageAsDongbang2(browser);
    try {
      await gotoDashboard(vendor.page);
      await expect(vendor.page.getByTestId(`quick-row-detail-${requestNo}`)).toBeVisible({ timeout: 30_000 });
      await expect(vendor.page.getByTestId(`quick-unread-${requestNo}`)).toHaveCount(0);
      await vendor.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      const first = await sendMessageAs('user', requestNo, '동방특송 담당자님 이건 취소해주세요');
      const second = await sendMessageAs('user', requestNo, '빠른 확인 부탁드립니다');
      messageIds = [first.id, second.id];

      const badge = vendor.page.getByTestId(`quick-unread-${requestNo}`).filter({ visible: true });
      await expect(badge).toHaveText('새 대화 2', { timeout: REALTIME_TIMEOUT_MS });
      await badge.click();
      await expect(vendor.page).toHaveURL(new RegExp(`/dashboard/quick/chat\\?request=${requestNo}`));
      await expect(vendor.page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
    } finally {
      await vendor.context.close();
    }

    const mobile = await pageAsDongbang2(browser, VIEWPORT_MOBILE);
    try {
      await gotoDashboard(mobile.page);
      const card = mobile.page.getByTestId(`quick-card-${requestNo}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      const badge = mobile.page.getByTestId(`quick-unread-${requestNo}`).filter({ visible: true });
      await expect(badge).toHaveText('새 대화 2');
      await expect(badge).toHaveAttribute('href', chatHref(requestNo));
    } finally {
      await mobile.context.close();
    }
  });

  test('AC-17: dongbang2 「퀵 대화」 목록 — 원형 배지 2 · 「안 읽음」 탭에 그 건 · 「안 읽은 대화 1건」', async ({ browser }) => {
    const vendor = await pageAsDongbang2(browser);
    try {
      await gotoChat(vendor.page);
      await expect(vendor.page.getByTestId(`quick-chat-list-unread-${requestNo}`)).toHaveText('2', { timeout: 20_000 });
      await expect(vendor.page.getByTestId('quick-chat-list-summary')).toContainText('안 읽은 대화 1건');
      await vendor.page.getByRole('tab', { name: /^안 읽음/ }).click();
      await expect(vendor.page).toHaveURL(/tab=unread/);
      await expect(vendor.page.getByTestId(`quick-chat-list-item-${requestNo}`)).toBeVisible({ timeout: 20_000 });
      await expect(vendor.page.getByTestId('quick-chat-list').getByRole('listitem')).toHaveCount(1);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-18: 대화 열기 — 「여기부터 새 메시지」 · 맨 아래 보이면 목록 배지 소멸 · 대시보드 배지 0(다른 탭) · 새로고침 후 0 · 벨 N−2 즉시 · 알림 페이지 「읽음」 · 다른 퀵 알림 unread 유지 · DB read', async ({
    browser
  }) => {
    const chatRows = await dbChatNotifications(requestNo);
    const mine = chatRows.filter((row) => row.recipient_user_id === dongbang2.userId);
    expect(mine, 'dongbang2 채팅 알림 2건 unread').toHaveLength(2);
    expect(mine.every((row) => row.status === 'unread')).toBe(true);

    const dashboard = await pageAsDongbang2(browser);
    const vendor = await pageAsDongbang2(browser);
    try {
      await gotoDashboard(dashboard.page);
      await expect(dashboard.page.getByTestId(`quick-unread-${requestNo}`).filter({ visible: true })).toHaveText(
        '새 대화 2',
        { timeout: 30_000 }
      );
      await dashboard.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      await gotoChat(vendor.page);
      await waitForSubscribed(vendor.page);
      await expect(vendor.page.getByTestId(`quick-chat-list-unread-${requestNo}`)).toHaveText('2', { timeout: 20_000 });
      const bell = bellCount(vendor.page);
      await expect(bell).toBeVisible({ timeout: 20_000 });
      const bellBefore = (await bell.innerText()).trim();
      const unreadBefore = await apiAsDongbang2(async (api) => {
        const response = await api.get('/api/notifications?limit=50');
        const body = (await response.json()) as { data?: { notifications?: { status: string }[] } };
        return (body.data?.notifications ?? []).filter((item) => item.status === 'unread').length;
      });
      expect(unreadBefore).toBeGreaterThanOrEqual(2);

      await vendor.page.getByTestId(`quick-chat-list-item-${requestNo}`).click();
      const divider = vendor.page.getByTestId('quick-chat-unread-divider');
      await expect(divider).toHaveText(CHAT_TEXT.unreadDivider, { timeout: 20_000 });
      const dividerBox = await divider.boundingBox();
      const firstBox = await messageBubble(vendor.page, messageIds[0]).boundingBox();
      expect(dividerBox!.y, '첫 안 읽은 메시지 위').toBeLessThan(firstBox!.y);

      await scrollMessagesToBottom(vendor.page);
      await expect(vendor.page.getByTestId(`quick-chat-list-unread-${requestNo}`)).toHaveCount(0, { timeout: 2_000 });
      const expectedAfter = unreadBefore - 2;
      const expectedBellText = expectedAfter <= 0 ? null : expectedAfter > 9 ? '9+' : String(expectedAfter);
      if (expectedBellText === null) {
        await expect(bell).toHaveCount(0, { timeout: 1_000 });
      } else if (expectedBellText !== bellBefore) {
        await expect(bell).toHaveText(expectedBellText, { timeout: 1_000 });
      }

      await expect(dashboard.page.getByTestId(`quick-unread-${requestNo}`)).toHaveCount(0, {
        timeout: REALTIME_TIMEOUT_MS
      });

      await vendor.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(vendor.page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
      await expect(vendor.page.getByTestId(`quick-chat-list-item-${requestNo}`)).toBeVisible({ timeout: 20_000 });
      await expect(vendor.page.getByTestId(`quick-chat-list-unread-${requestNo}`)).toHaveCount(0);

      await vendor.page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
      await expect(vendor.page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
      for (const row of mine) {
        const card = vendor.page.getByTestId(`notification-card-${row.id}`);
        await expect(card).toBeVisible({ timeout: 20_000 });
        await expect(card.getByRole('button', { name: '읽음 처리' }), '채팅 알림은 읽음').toHaveCount(0);
      }
      const createdRows = (
        await (async () => {
          const { serviceClient } = await import('../quick-workflow/helpers');
          const { data } = await serviceClient()
            .from('notifications')
            .select('id, status')
            .eq('recipient_user_id', dongbang2.userId)
            .eq('metadata->>quick_request_no', requestNo)
            .neq('type', 'quick_request.chat_message');
          return (data ?? []) as { id: string; status: string }[];
        })()
      );
      expect(createdRows.length, '다른 퀵 알림(등록) 존재').toBeGreaterThan(0);
      for (const row of createdRows) {
        expect(row.status, '다른 퀵 알림은 unread 유지').toBe('unread');
        await expect(
          vendor.page.getByTestId(`notification-card-${row.id}`).getByRole('button', { name: '읽음 처리' })
        ).toHaveCount(1);
      }
    } finally {
      await dashboard.context.close();
      await vendor.context.close();
    }

    const statuses = await dbNotificationsStatus(mine.map((row) => row.id));
    expect(statuses.every((row) => row.status === 'read'), 'DB status=read').toBe(true);
  });

  test('AC-19: reads(dongbang2, 그 건).last_read_message_id = 마지막 id · 더 작은 id PUT → 200 · 값 유지', async () => {
    const lastId = messageIds[messageIds.length - 1];
    await expect.poll(async () => (await dbRead(dongbang2.userId, requestId))?.last_read_message_id).toBe(lastId);
    const back = await markReadAsDongbang2(requestNo, messageIds[0]);
    expect(back.status).toBe(200);
    expect(back.body.data?.lastReadMessageId).toBe(lastId);
    expect((await dbRead(dongbang2.userId, requestId))?.last_read_message_id).toBe(lastId);
  });

  test('AC-20: 요청자가 보낸 메시지는 본인 안 읽은 수 0 · 요청자 대시보드 그 행 배지 없음', async ({ page }) => {
    const { conversations } = await getConversationsAs('user');
    const mine = conversations.find((item) => item.requestNo === requestNo);
    expect(mine, '요청자 목록에 그 건').toBeTruthy();
    expect(mine!.unreadCount).toBe(0);
    await gotoDashboard(page);
    await expect(page.getByTestId(`quick-row-detail-${requestNo}`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`quick-unread-${requestNo}`)).toHaveCount(0);
  });

  test('AC-21: ✓✓ — ① B가 읽으면 요청자 화면 「읽음」+tooltip · A도 읽으면 2명 · 구매물류만 읽으면 「전송됨」 ② A 메시지는 B가 읽어도 「전송됨」, 요청자가 읽으면 「읽음」', async ({
    page,
    browser
  }) => {
    const fresh = await createAs('user', uniqueTag('E2E93RCPT'));
    const no = fresh.requestNo;
    await gotoDetailChat(page, no);
    await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
    const { id: first } = await sendViaUi(page, '읽음 확인용 메시지');
    await expect(receipt(page, first)).toHaveAttribute('data-state', 'sent');

    // 구매물류팀만 읽음 → ✓ 전송됨 유지
    await markReadAs('logistics', no, first);
    await page.waitForTimeout(3_000);
    await expect(receipt(page, first), '구매물류만 읽음 → 전송됨 유지').toHaveAttribute('data-state', 'sent');

    const vendorB = await pageAsDongbang2(browser);
    const vendorA = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendorB.page, no);
      await waitForSubscribed(vendorB.page);
      await expect(messageBubble(vendorB.page, first)).toBeVisible({ timeout: 20_000 });
      await scrollMessagesToBottom(vendorB.page);

      const firstReceipt = receipt(page, first);
      await expect(firstReceipt).toHaveAttribute('data-state', 'read', { timeout: REALTIME_TIMEOUT_MS });
      await expect(firstReceipt).toContainText(CHAT_TEXT.receiptRead);
      await firstReceipt.hover();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible({ timeout: 5_000 });
      await expect(tooltip).toContainText(`${dongbang2.fullName} · `);
      await expect(tooltip).toContainText(new RegExp(`${ABSOLUTE_DATE_RE.source} \\d{2}:\\d{2}:\\d{2} 읽음`));
      await expect(tooltip).not.toContainText(dongbang.fullName);
      await page.mouse.move(0, 0);

      await gotoChat(vendorA.page, no);
      await waitForSubscribed(vendorA.page);
      await expect(messageBubble(vendorA.page, first)).toBeVisible({ timeout: 20_000 });
      await scrollMessagesToBottom(vendorA.page);
      await expect
        .poll(
          async () => {
            await firstReceipt.hover();
            const text = await page.getByRole('tooltip').first().innerText().catch(() => '');
            await page.mouse.move(0, 0);
            return text.includes(dongbang.fullName) && text.includes(dongbang2.fullName);
          },
          { timeout: REALTIME_TIMEOUT_MS + 5_000, message: 'tooltip에 2명' }
        )
        .toBe(true);

      // ② A 「알겠습니다」 → B(동료)가 읽어도 A 화면은 전송됨 · 요청자가 읽으면 읽음
      // 요청자 화면이 맨 아래에 열려 있으면 수신 즉시 자동 읽음이 되므로, 요청자는 먼저 다른 화면으로 보낸다
      await page.goto('/dashboard/quick', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
      const freshId = (await dbQuickRequest(no)).id;
      const { id: second } = await sendViaUi(vendorA.page, '알겠습니다');
      await expect(messageBubble(vendorB.page, second)).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await scrollMessagesToBottom(vendorB.page);
      await expect
        .poll(async () => (await dbRead(dongbang2.userId, freshId))?.last_read_message_id, { timeout: 10_000 })
        .toBe(second);
      await vendorA.page.waitForTimeout(2_000);
      expect((await dbRead(user.userId, freshId))?.last_read_message_id ?? 0, '요청자는 아직 안 읽음').toBeLessThan(second);
      await expect(receipt(vendorA.page, second), '동료 동방이 읽어도 전송됨').toHaveAttribute('data-state', 'sent');

      await gotoDetailChat(page, no);
      await expect(messageBubble(page, second)).toBeVisible({ timeout: 20_000 });
      await scrollMessagesToBottom(page);
      await expect(receipt(vendorA.page, second)).toHaveAttribute('data-state', 'read', { timeout: REALTIME_TIMEOUT_MS });
      await receipt(vendorA.page, second).hover();
      await expect(vendorA.page.getByRole('tooltip')).toContainText(`${user.fullName} · `, { timeout: 5_000 });
    } finally {
      await vendorA.context.close();
      await vendorB.context.close();
    }
  });
});
