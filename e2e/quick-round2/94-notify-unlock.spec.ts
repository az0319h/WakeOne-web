import { expect, test } from '@playwright/test';
import {
  MSG,
  NOTIFY_TITLE,
  NOTIFY_TYPE,
  callAs,
  createAs,
  findActivityLog,
  fixtureUser,
  gotoDetail,
  listActiveAdminIds,
  listActiveDongbangIds,
  listActiveLogisticsIds,
  pageAs,
  readAccountMeta,
  seedQuickRequest,
  uniqueTag,
  type AccountMeta
} from '../quick-workflow/helpers';
import {
  REALTIME_TIMEOUT_MS,
  SUBSCRIBE_SETTLE_MS,
  chatRecipientsOf,
  composerInput,
  expectNoReload,
  gotoChat,
  gotoDetailChat,
  markNoReload,
  messageBubble,
  messagesLog,
  postMessageAs,
  sendMessageAs,
  sendViaUi,
  waitForSubscribed
} from '../quick-chat/helpers';
import { TEXT, dbQuickNotificationsByEvent, expectedChatTitle, grepDir, readSource, waitQuickNotifications } from './helpers';

/**
 * plan 94 §D 수정 알림(14) · 잠금 해제(15) · 푸시 제목(19) · §E 로그 — docs/plans/94_quick-realtime-and-small-fixes-plan.md
 * AC-20 · AC-21 · AC-22 · AC-23 · AC-25 (AC-24는 수동 QA)
 */
test.describe('plan 94 D·E. 수정 알림 · 채팅 잠금 해제 · 푸시 제목 · 활동 로그', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let user: { userId: string; fullName: string };
  let admin: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let updatedNo = '';
  let approvedNo = '';
  let approvedMessageId = 0;

  test.beforeAll(async () => {
    user = await fixtureUser('user');
    admin = await fixtureUser('admin');
    dongbang = readAccountMeta('dongbang');
  });

  test('AC-20: 동방이 수정 Sheet로 도착 상세주소·차량 종류 변경 → 요청자 알림 1건(requester_event · updated · 「퀵 {no} 수정됨」 · 본문 라벨 2개) · 동방2·admin·구매물류 0 · 「퀵 요청 보기」 → 상세', async ({
    browser,
    page
  }) => {
    const { requestNo } = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E94UPD'));
    updatedNo = requestNo;
    const newDetail = `E2E94 수정 도착 ${Date.now()}`;

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(vendor.page, requestNo);
      await vendor.page.getByTestId('quick-detail-edit').click();
      const sheet = vendor.page.getByTestId('quick-edit-sheet');
      await expect(sheet).toBeVisible();
      await sheet.getByTestId('quick-request-destination-detail-address').fill(newDetail);
      const damas = sheet.getByTestId('quick-request-vehicle-다마스');
      const motorcycle = sheet.getByTestId('quick-request-vehicle-오토바이');
      await damas.click();
      await expect(damas).toHaveAttribute('aria-pressed', 'true');
      await motorcycle.click();
      await expect(motorcycle).toHaveAttribute('aria-pressed', 'false');
      const patchPromise = vendor.page.waitForResponse(
        (res) => res.url().endsWith(`/api/quick-request/${requestNo}`) && res.request().method() === 'PATCH'
      );
      await sheet.getByTestId('quick-edit-save').click();
      const patch = await patchPromise;
      expect(patch.status(), await patch.text()).toBe(200);
      await expect(sheet).toBeHidden({ timeout: 15_000 });
    } finally {
      await vendor.context.close();
    }

    const rows = await waitQuickNotifications(requestNo, 'updated', 1);
    expect(rows, '요청자 1건만').toHaveLength(1);
    const [row] = rows;
    expect(row.recipient_user_id).toBe(user.userId);
    expect(row.type).toBe(NOTIFY_TYPE.requester);
    expect(row.metadata.quick_request_event).toBe('updated');
    expect(row.metadata.quick_request_no).toBe(requestNo);
    expect(row.title).toBe(TEXT.updatedTitle(requestNo));
    expect(row.body).toBe(TEXT.updatedBody(dongbang.fullName, '도착지 상세주소, 차량 종류'));
    expect(row.body.length).toBeLessThanOrEqual(120);
    const [adminIds, dongbangIds, logisticsIds] = await Promise.all([
      listActiveAdminIds(),
      listActiveDongbangIds(),
      listActiveLogisticsIds()
    ]);
    for (const id of [...adminIds, ...dongbangIds, ...logisticsIds]) {
      expect(id, '업무 측 수신 없음').not.toBe(row.recipient_user_id);
    }

    await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
    const card = page.getByTestId(`notification-card-${row.id}`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(TEXT.updatedTitle(requestNo));
    await expect(card).toContainText('도착지 상세주소, 차량 종류');
    await card.getByRole('button', { name: TEXT.viewQuickRequest }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/quick/${requestNo}$`), { timeout: 15_000 });
    await expect(page.getByTestId('quick-detail-section-route')).toContainText(newDetail, { timeout: 30_000 });
  });

  test('AC-21: admin ① 최종금액만 → final_amount_set 1(updated 0) ② 최종금액+차량 대수 → 둘 다 1건씩 ③ 4개 항목 → 「(…, …, … 외 1개)」 · ≤120자', async () => {
    const { requestNo } = await seedQuickRequest('dispatched', 'user', uniqueTag('E2E94UP3'));
    const patchAsAdmin = (data: Record<string, unknown>) =>
      callAs('admin', (api) => api.patch(`/api/quick-request/${requestNo}`, { data }));
    const requesterRows = async (event: string) =>
      (await dbQuickNotificationsByEvent(requestNo, event)).filter((row) => row.recipient_user_id === user.userId);

    // ① 최종금액만
    const first = await patchAsAdmin({ finalAmount: 23000 });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    await waitQuickNotifications(requestNo, 'final_amount_set', 1);
    expect(await requesterRows('final_amount_set')).toHaveLength(1);
    expect((await requesterRows('final_amount_set'))[0].title).toBe(NOTIFY_TITLE.final_amount_set(requestNo));
    expect(await requesterRows('updated'), '① updated 0').toHaveLength(0);

    // ② 최종금액 + 차량 대수 (itemDescription은 goodsSize!=='other'면 빈 값 강제 → 다른 항목으로)
    const second = await patchAsAdmin({ finalAmount: 24000, vehicleCount: 2 });
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    await waitQuickNotifications(requestNo, 'updated', 1);
    await expect.poll(async () => (await requesterRows('final_amount_set')).length, { timeout: 15_000 }).toBe(2);
    const updatedOnce = await requesterRows('updated');
    expect(updatedOnce).toHaveLength(1);
    expect(updatedOnce[0].title).toBe(TEXT.updatedTitle(requestNo));
    expect(updatedOnce[0].body).toBe(TEXT.updatedBody(admin.fullName, '차량 대수'));
    expect(updatedOnce[0].type).toBe(NOTIFY_TYPE.requester);

    // ③ 4개 항목
    const third = await patchAsAdmin({
      goodsSize: 'm',
      vehicleTypes: ['다마스'],
      freightPayment: 'collect',
      driverName: '김기사'
    });
    expect(third.status, JSON.stringify(third.body)).toBe(200);
    await waitQuickNotifications(requestNo, 'updated', 2);
    const updatedTwice = await requesterRows('updated');
    expect(updatedTwice).toHaveLength(2);
    const latest = updatedTwice[updatedTwice.length - 1];
    expect(latest.body).toBe(TEXT.updatedBody(admin.fullName, '물품 크기, 차량 종류, 운임 외 1개'));
    expect(latest.body.length).toBeLessThanOrEqual(120);
    expect(await requesterRows('final_amount_set'), '③ final_amount_set 그대로 2').toHaveLength(2);

    // 요청자 본인(admin 등록 건)이 직접 고친 경우 0건
    const own = await seedQuickRequest('dispatching', 'admin', uniqueTag('E2E94OWN'));
    const ownPatch = await callAs('admin', (api) =>
      api.patch(`/api/quick-request/${own.requestNo}`, { data: { vehicleCount: 3 } })
    );
    expect(ownPatch.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(await dbQuickNotificationsByEvent(own.requestNo, 'updated'), '행위자 본인 제외 → 0건').toHaveLength(0);
  });

  test('AC-22: approved·cancelled 건 — 입력창·칩 보임 · POST 201(동방·요청자·admin) · 상대 Realtime 반영·알림 · 잠금 문구 0(grep) · PATCH·accept 409 · 구매물류 403', async ({
    browser,
    page
  }) => {
    expect(grepDir('src', TEXT.chatLockedLegacy), '「승인되었거나 취소된 요청은…」 0건').toEqual([]);
    expect(grepDir('src', "'locked'").filter((hit) => hit.includes('quick-request-chat') || hit.includes('messages.server'))).toEqual([]);

    const approved = await seedQuickRequest('approved', 'user', uniqueTag('E2E94APR'));
    const cancelled = await seedQuickRequest('cancelled', 'user', uniqueTag('E2E94CAN'));
    approvedNo = approved.requestNo;

    for (const no of [approved.requestNo, cancelled.requestNo]) {
      for (const account of ['dongbang', 'user', 'admin'] as const) {
        const result = await postMessageAs(account, no, { body: `${account} 잠금 해제 메시지` });
        expect(result.status, `${account} ${no}`).toBe(201);
        expect(result.headers['x-request-id']).toBeTruthy();
        if (no === approved.requestNo && account === 'dongbang') {
          approvedMessageId = (result.body.data as { message: { id: number } }).message.id;
        }
      }
      const logistics = await postMessageAs('logistics', no, { body: '구매물류 시도' });
      expect(logistics.status, `logistics ${no}`).toBe(403);
      const patch = await callAs('dongbang', (api) => api.patch(`/api/quick-request/${no}`, { data: { itemDescription: '잠금 중 수정' } }));
      expect(patch.status, `PATCH ${no}`).toBe(409);
      expect(patch.body.message).toBe(MSG.locked);
      const accept = await callAs('dongbang', (api) => api.post(`/api/quick-request/${no}/accept`));
      expect(accept.status, `accept ${no}`).toBe(409);
    }

    // 상대(요청자 상세 aside)에 Realtime 반영 + 알림 수신
    await gotoDetailChat(page, approved.requestNo);
    await expect(messagesLog(page).locator('[data-message-id]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('quick-chat-read-only')).toHaveCount(0);
    await expect(composerInput(page)).toBeVisible();
    await expect(page.getByTestId('quick-chat-quick-replies')).toBeVisible();
    await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
    await markNoReload(page);

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendor.page, approved.requestNo);
      await waitForSubscribed(vendor.page);
      await expect(vendor.page.getByTestId('quick-chat-read-only')).toHaveCount(0);
      await expect(composerInput(vendor.page)).toBeVisible();
      await expect(vendor.page.getByTestId('quick-chat-quick-replies')).toBeVisible();
      const { id } = await sendViaUi(vendor.page, '승인 후에도 대화합니다');
      await expect(messageBubble(page, id)).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(messageBubble(page, id)).toHaveAttribute('data-mine', 'false');
      await expectNoReload(page);
      const recipients = await chatRecipientsOf(approved.requestNo, id);
      expect(recipients.has(user.userId), '요청자 알림 수신').toBe(true);
      expect(recipients.has(dongbang.userId), '보낸 사람 제외').toBe(false);
    } finally {
      await vendor.context.close();
    }

    const cancelledPage = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(cancelledPage.page, cancelled.requestNo);
      await expect(cancelledPage.page.getByTestId('quick-chat-read-only')).toHaveCount(0);
      await expect(composerInput(cancelledPage.page)).toBeVisible();
      await expect(cancelledPage.page.getByTestId('quick-chat-quick-replies')).toBeVisible();
    } finally {
      await cancelledPage.context.close();
    }
  });

  test('AC-23: 요청자 「알겠습니다」 → 알림 제목 「{요청자 이름} · {번호}」 · 본문 그대로 · 옛 제목 형식 0건(grep) · 동방 인앱 목록 제목 동일', async ({
    browser
  }) => {
    const server = readSource('src/features/quick-request/api/notifications.server.ts');
    expect(server.includes('메시지`'), '옛 제목 형식 「… 메시지」 0건').toBe(false);
    const copy = readSource('src/features/quick-request/lib/quick-notification-copy.ts');
    expect(copy.includes('메시지`')).toBe(false);

    const { requestNo } = await createAs('user', uniqueTag('E2E94TTL'));
    const message = await sendMessageAs('user', requestNo, '알겠습니다');
    await chatRecipientsOf(requestNo, message.id);
    const rows = await dbQuickNotificationsByEvent(requestNo, 'chat_message');
    const mine = rows.filter((row) => Number(row.metadata.quick_request_message_id) === message.id);
    expect(mine.length).toBeGreaterThanOrEqual(1);
    const title = expectedChatTitle(requestNo, user.fullName);
    for (const row of mine) {
      expect(row.title).toBe(title);
      expect(row.title.length).toBeLessThanOrEqual(30);
      expect(row.body).toBe('알겠습니다');
    }
    const forDongbang = mine.find((row) => row.recipient_user_id === dongbang.userId);
    expect(forDongbang, '동방 수신').toBeTruthy();

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await vendor.page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
      await expect(vendor.page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
      const card = vendor.page.getByTestId(`notification-card-${forDongbang!.id}`);
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText(title);
      await expect(card).toContainText('알겠습니다');
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-25: 활동 로그 — quick_request.update metadata changedFields 유지 · message_create 201(approved 건) metadata에 recipient_count·body 없음 · /dashboard/logs 행 · 신규 action 0', async ({
    browser
  }) => {
    expect(updatedNo, 'AC-20 선행').not.toBe('');
    expect(approvedNo, 'AC-22 선행').not.toBe('');

    const update = await findActivityLog(
      'quick_request.update',
      (item) => item.target_label === updatedNo && item.http_status === 200,
      `update 200 ${updatedNo}`
    );
    const changed = (update.metadata?.changedFields ?? []) as string[];
    expect(changed).toEqual(expect.arrayContaining(['destination', 'vehicleTypes']));
    expect(update.metadata && 'recipient_count' in update.metadata).toBe(false);

    const created = await findActivityLog(
      'quick_request.message_create',
      (item) => item.target_label === approvedNo && item.http_status === 201,
      `message_create 201 ${approvedNo}`
    );
    expect(created.metadata?.quick_request_no).toBe(approvedNo);
    expect(typeof created.metadata?.message_id).toBe('number');
    expect(typeof created.metadata?.body_length).toBe('number');
    expect(created.metadata && 'recipient_count' in created.metadata, 'recipient_count 없음').toBe(false);
    expect(created.metadata && 'body' in created.metadata, 'body 없음').toBe(false);
    expect(approvedMessageId).toBeGreaterThan(0);

    // 신규 action 0 — 활동 로그 allowlist(types.ts)·quick_request 액션 집합이 plan 08·89·93 범위 안
    const KNOWN = new Set([
      'quick_request.create',
      'quick_request.accept',
      'quick_request.dispatch',
      'quick_request.final_amount_set',
      'quick_request.update',
      'quick_request.approve',
      'quick_request.cancel',
      'quick_request.message_create',
      'quick_request.note_create',
      'quick_request.note_update',
      'quick_request.note_delete',
      'quick_request.recent_address_record',
      'quick_request.openchat_resend',
      // plan 98 — 퀵 대화 첨부 (prepare · pending 취소)
      'quick_request.message_attachment_prepare',
      'quick_request.message_attachment_delete',
      // plan 101 D-13 — 퀵 대화 참여자 (초대 · 제외/나가기)
      'quick_request.participant_add',
      'quick_request.participant_remove',
      // plan 100 D-10 — 퀵 대화 AI 답장 추천 (전 분기 기록 · 본문 미기록)
      'quick_request.chat_ai_suggest'
    ]);
    const types = readSource('src/features/activity-logs/api/types.ts');
    const quickActions = [...types.matchAll(/["'](quick_request\.[a-z_]+)["']/g)].map((match) => match[1]);
    expect(quickActions.length).toBeGreaterThan(0);
    for (const action of quickActions) expect(KNOWN.has(action), `알 수 없는 action ${action}`).toBe(true);
    const recipientCountCodeLines = types
      .split(/\r?\n/)
      .filter((line) => line.includes('recipient_count') && !/^\s*(\/\/|\*|\/\*)/.test(line));
    expect(recipientCountCodeLines, 'allowlist 코드에서 recipient_count 제거(주석 제외)').toEqual([]);

    const adminPage = await pageAs(browser, 'admin');
    try {
      await adminPage.page.goto('/dashboard/logs', { waitUntil: 'domcontentloaded' });
      await expect(adminPage.page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      const row = adminPage.page.getByTestId('activity-log-row').filter({ hasText: approvedNo }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
    } finally {
      await adminPage.context.close();
    }
  });
});
