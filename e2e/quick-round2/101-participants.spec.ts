import { expect, test } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  createAs,
  createDisposableDongbang,
  dbQuickRequest,
  findActivityLog,
  fixtureUser,
  gotoDashboard,
  listActiveAdminIds,
  listActiveDongbangIds,
  pageAs,
  readAccountMeta,
  serviceClient,
  uniqueTag,
  withApi,
  type AccountMeta
} from '../quick-workflow/helpers';
import {
  CHAT_TEXT,
  chatRecipientsOf,
  composerInput,
  dbMessages,
  getMessagesAs,
  getMessagesDataAs,
  gotoChat,
  gotoDetailChat,
  markAllConversationsReadAs,
  markReadAs,
  messageBubble,
  receipt,
  sendMessageAs,
  sendViaUi,
  waitForSubscribed,
  getConversationsAs
} from '../quick-chat/helpers';
import { REALTIME_TIMEOUT_MS, SUBSCRIBE_SETTLE_MS, grepDir } from './helpers';
import {
  ACTION_ADD,
  ACTION_REMOVE,
  PARTICIPANT_REPLIES,
  PART_TEXT,
  candidateListAs,
  candidatesAs,
  createDisposableEmployee,
  dbParticipantNotifications,
  dbParticipants,
  inviteAs,
  openParticipants,
  participantRow,
  participantsButton,
  systemLines
} from './101-helpers';

/**
 * plan 101 — 퀵 채팅 참여자 추가(직원 초대 · 목록 · 제외 · 알림) · docs/plans/101_quick-chat-participants-plan.md (r1)
 * AC-01~15 · AC-17 (AC-16 SQL = Dev MCP · AC-18 = 101-participants-mobile.spec.ts · AC-19 = CLI)
 * 계정: user(요청자) · user2(초대 대상) · admin · dongbang(동방 A) · logistics + 일회용(pending · 다른 직원 · 다른 admin)
 * 한 건(R)을 serial로 진행: 초대 → 열람 → 발신 → 수신 → ✓✓ → 실시간 → 권한 경계 → 제외 → 재초대 → 나가기 → admin → 로그
 */
test.describe('plan 101. 퀵 채팅 참여자 (초대 · 목록 · 제외 · 알림)', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let user: { userId: string; fullName: string };
  let user2: { userId: string; fullName: string };
  let admin: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let logistics: AccountMeta;
  let pending: { userId: string; fullName: string };
  let otherEmployee: { userId: string; fullName: string };
  let otherAdmin: { userId: string; fullName: string };
  let dongbangIds: string[] = [];
  let adminIds: string[] = [];
  let requestNo = '';
  let requestId = '';
  let initialMessageIds: number[] = [];

  test.beforeAll(async () => {
    user = await fixtureUser('user');
    user2 = await fixtureUser('user2');
    admin = await fixtureUser('admin');
    dongbang = readAccountMeta('dongbang');
    logistics = readAccountMeta('logistics');
    const stamp = Date.now();
    // pending 사용자 — 이름에 user2 검색어(앞 2자)를 넣어 「후보에서 빠졌는지」를 같은 검색으로 판정한다
    pending = await createDisposableEmployee('pending101', `E2E ${user2.fullName.slice(0, 2)}대기 ${stamp}`, {
      status: 'pending_approval'
    });
    otherEmployee = await createDisposableEmployee('emp101', `E2E 다른직원 ${stamp}`);
    otherAdmin = await createDisposableEmployee('admin101', `E2E 관리자후보 ${stamp}`, { systemRole: 'admin' });
    // 참여자 목록이 길 때(동방 다수) Popover가 화면 밖으로 잘리지 않는지 AC-01에서 보려고 동방 일회용 6명을 더 둔다
    for (let index = 0; index < 6; index += 1) {
      await createDisposableDongbang(`dongbang101x${index}`);
    }
    dongbangIds = await listActiveDongbangIds();
    adminIds = await listActiveAdminIds();
    expect(dongbangIds.length, 'active 동방 1명 이상').toBeGreaterThanOrEqual(1);
    expect(dongbangIds).toContain(dongbang.userId);

    const created = await createAs('user', uniqueTag('E2E101'));
    requestNo = created.requestNo;
    requestId = (await dbQuickRequest(requestNo)).id;
    const m1 = await sendMessageAs('user', requestNo, '첫 메시지 — 시간 확인 부탁드립니다');
    const m2 = await sendMessageAs('dongbang', requestNo, '둘째 메시지 — 확인했습니다');
    const m3 = await sendMessageAs('user', requestNo, '셋째 메시지 — 감사합니다');
    initialMessageIds = [m1.id, m2.id, m3.id];
  });

  test('AC-01: 요청자 상세 「요청 대화」 「참여자 N」 → 요청자(「요청자」)·동방 전원(「동방특송」) · 「참여자 추가」 버튼 · 동방 세션은 「참여자 추가」 없음', async ({
    page,
    browser
  }) => {
    const before = await getMessagesAs('user2', requestNo);
    expect(before.status, '초대 전 user2 messages 404').toBe(404);

    await gotoDetailChat(page, requestNo);
    const button = participantsButton(page);
    await expect(button).toHaveAttribute('data-count', String(1 + dongbangIds.length), { timeout: 30_000 });
    await expect(button).toHaveText(`참여자 ${1 + dongbangIds.length}`);
    const popover = await openParticipants(page);
    const requesterRow = participantRow(popover, user.userId);
    await expect(requesterRow).toHaveAttribute('data-role', 'requester');
    await expect(requesterRow).toContainText(PART_TEXT.roleRequester);
    for (const id of dongbangIds) {
      const row = participantRow(popover, id);
      await expect(row).toHaveAttribute('data-role', 'dongbang');
      await expect(row).toContainText(PART_TEXT.roleDongbang);
    }
    await expect(popover.getByTestId('quick-chat-add-participant')).toBeVisible();
    await expect(popover.getByTestId('quick-chat-add-participant')).toHaveText(PART_TEXT.addParticipant);
    // 목록이 길어도(동방 7명+) Popover 머리(「참여자 추가」)가 화면 안 · Popover 전체가 viewport 안
    await expect(popover.getByTestId('quick-chat-add-participant'), '「참여자 추가」 화면 안').toBeInViewport({ ratio: 1 });
    const popoverBox = await popover.boundingBox();
    const viewport = page.viewportSize()!;
    expect(popoverBox!.y, 'Popover 위쪽이 화면 안').toBeGreaterThanOrEqual(0);
    expect(popoverBox!.y + popoverBox!.height, 'Popover 아래쪽이 화면 안').toBeLessThanOrEqual(viewport.height);

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoDetailChat(vendor.page, requestNo);
      const vendorPopover = await openParticipants(vendor.page);
      await expect(participantRow(vendorPopover, user.userId)).toBeVisible();
      await expect(vendorPopover.getByTestId('quick-chat-add-participant')).toHaveCount(0);
      await expect(vendorPopover.getByTestId(`quick-chat-participant-remove-${user.userId}`)).toHaveCount(0);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-02: 「참여자 추가」 → user2 이름 2자 → 후보에 user2 있음 · 동방·요청자 본인·pending·admin 없음 · admin 이름 API 0건 · 선택 → toast · 목록 「참여자」·「초대: 요청자」 · 시스템 줄 · DB 행 1 · POST 201', async ({
    page
  }) => {
    const q = user2.fullName.slice(0, 2);
    // 서버 측 제외(API)
    const apiCandidates = await candidateListAs('user', requestNo, q);
    const apiIds = apiCandidates.map((c) => c.userId);
    expect(apiIds, '후보에 user2').toContain(user2.userId);
    expect(apiIds, '요청자 본인 없음').not.toContain(user.userId);
    expect(apiIds, 'pending 없음').not.toContain(pending.userId);
    expect(apiCandidates.length).toBeLessThanOrEqual(20);
    for (const id of [...dongbangIds, ...adminIds]) expect(apiIds, '동방·admin 없음').not.toContain(id);
    const byAdminName = await candidateListAs('user', requestNo, admin.fullName);
    expect(
      byAdminName.filter((c) => adminIds.includes(c.userId) || c.userId === otherAdmin.userId),
      `q=${admin.fullName} admin 0건`
    ).toHaveLength(0);
    expect(await candidateListAs('user', requestNo, '관리자후보'), '일회용 admin 0건').toHaveLength(0);
    expect(
      (await candidateListAs('user', requestNo, '동방')).filter((c) => dongbangIds.includes(c.userId)),
      '동방 0건'
    ).toHaveLength(0);
    expect(await candidateListAs('user', requestNo, ''), '빈 q → []').toHaveLength(0);

    // UI
    await gotoDetailChat(page, requestNo);
    const popover = await openParticipants(page);
    await popover.getByTestId('quick-chat-add-participant').click();
    await expect(popover.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'add');
    const input = popover.getByTestId('quick-chat-add-participant-input');
    await expect(input).toHaveAttribute('placeholder', PART_TEXT.searchPlaceholder);
    await input.fill(q);
    const candidate = popover.getByTestId(`quick-chat-candidate-${user2.userId}`);
    await expect(candidate).toBeVisible({ timeout: 15_000 });
    await expect(candidate).toContainText(user2.fullName);
    await expect(popover.getByTestId(`quick-chat-candidate-${user.userId}`)).toHaveCount(0);
    await expect(popover.getByTestId(`quick-chat-candidate-${pending.userId}`)).toHaveCount(0);
    for (const id of [...dongbangIds, ...adminIds]) {
      await expect(popover.getByTestId(`quick-chat-candidate-${id}`)).toHaveCount(0);
    }

    const postPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/quick-request/${requestNo}/participants`) && response.request().method() === 'POST'
    );
    await candidate.click();
    const post = await postPromise;
    expect(post.status(), 'POST participants 201').toBe(201);
    expect(post.headers()['x-request-id']).toBeTruthy();
    await expect(page.getByText(PART_TEXT.invitedToast(user2.fullName), { exact: true })).toBeVisible({ timeout: 10_000 });

    await expect(participantsButton(page)).toHaveAttribute('data-count', String(2 + dongbangIds.length), {
      timeout: 10_000
    });
    if (!(await page.getByTestId('quick-chat-participants-popover').isVisible())) {
      await openParticipants(page);
    }
    const listPopover = page.getByTestId('quick-chat-participants-popover');
    await expect(listPopover.getByTestId('quick-chat-participants-panel')).toHaveAttribute('data-mode', 'list');
    const row = participantRow(listPopover, user2.userId);
    await expect(row).toHaveAttribute('data-role', 'participant');
    await expect(row).toContainText(PART_TEXT.roleParticipant);
    await expect(row).toContainText(PART_TEXT.invitedBy(user.fullName));
    await expect(row).toContainText(ABSOLUTE_DATETIME_RE);
    await page.keyboard.press('Escape');

    const joined = systemLines(page, 'joined', user2.userId).filter({ visible: true }).first();
    await expect(joined).toBeVisible({ timeout: 10_000 });
    await expect(joined).toContainText(PART_TEXT.systemJoined(user2.fullName));
    await expect(joined).toContainText(ABSOLUTE_DATETIME_RE);

    const rows = await dbParticipants(requestId);
    expect(rows, 'DB 행 1').toHaveLength(1);
    expect(rows[0].user_id).toBe(user2.userId);
    expect(rows[0].invited_by).toBe(user.userId);
    expect(rows[0].removed_at).toBeNull();
  });

  test('AC-03: user2 — 알림 「퀵 {번호} 대화 초대」 「채팅 보기」 → 퀵 대화 그 건 · 이전 메시지 3개 · 「여기부터 새 메시지」 첫 메시지 위 · 칩 4개(참여자) · 대시보드 「참여」 · 상세 200 · 액션바 0 · 「수정」 0', async ({
    browser
  }) => {
    let invite = await dbParticipantNotifications(requestNo, 'participant_invited', user2.userId);
    await expect
      .poll(async () => (invite = await dbParticipantNotifications(requestNo, 'participant_invited', user2.userId)).length, {
        timeout: 15_000
      })
      .toBe(1);
    expect(invite[0].title).toBe(PART_TEXT.inviteTitle(requestNo));
    expect(invite[0].type).toBe('quick_request.requester_event');
    expect(invite[0].body).toContain(`${user.fullName}님이 대화에 초대했습니다.`);

    const { context, page } = await pageAs(browser, 'user2');
    try {
      await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
      const card = page.getByTestId(`notification-card-${invite[0].id}`);
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText(PART_TEXT.inviteTitle(requestNo));
      await card.getByRole('button', { name: '채팅 보기' }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/quick/chat\\?request=${requestNo}`), { timeout: 20_000 });
      await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId(`quick-chat-list-item-${requestNo}`)).toHaveAttribute('aria-current', 'true', {
        timeout: 20_000
      });
      for (const id of initialMessageIds) {
        await expect(messageBubble(page, id)).toBeAttached({ timeout: 20_000 });
      }
      const divider = page.getByTestId('quick-chat-unread-divider');
      await expect(divider).toHaveText(CHAT_TEXT.unreadDivider, { timeout: 20_000 });
      const dividerBox = await divider.boundingBox();
      const firstBox = await messageBubble(page, initialMessageIds[0]).boundingBox();
      expect(dividerBox!.y, '「여기부터 새 메시지」가 첫 메시지 위').toBeLessThan(firstBox!.y);
      await expect(composerInput(page)).toBeVisible();
      const chips = page.getByTestId('quick-chat-quick-replies').getByRole('button');
      await expect(chips).toHaveCount(4);
      await expect(chips).toHaveText([...PARTICIPANT_REPLIES]);
      // 참여자는 초대·제외 불가 · 본인 「나가기」만
      const popover = await openParticipants(page);
      await expect(popover.getByTestId('quick-chat-add-participant')).toHaveCount(0);
      await expect(popover.getByTestId('quick-chat-participant-leave')).toBeVisible();
      await page.keyboard.press('Escape');

      await gotoDashboard(page);
      const badge = page.getByTestId(`quick-participant-badge-${requestNo}`).filter({ visible: true });
      await expect(badge).toHaveText(PART_TEXT.dashboardBadge, { timeout: 20_000 });

      const detailApi = await withApi('user2', async (api) => api.get(`/api/quick-request/${requestNo}`).then((r) => r.status()));
      expect(detailApi, '상세 API 200').toBe(200);
      await gotoDetailChat(page, requestNo);
      await expect(page.getByTestId('quick-detail-section-request')).toBeVisible();
      await expect(page.getByTestId('quick-detail-not-found')).toHaveCount(0);
      for (const id of ['cancel', 'edit', 'accept', 'dispatch', 'set-final', 'approve']) {
        await expect(page.getByTestId(`quick-detail-${id}`), `액션바 ${id} 0`).toHaveCount(0);
      }
      await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-04: (2 context) 요청자·동방 A 대화 열어 둠 → user2 「확인했습니다」 전송 → 201 · 배지 「참여자」 · 두 화면 5초 안 · 알림 요청자+동방 전원 각 1 · user2 0', async ({
    browser
  }) => {
    const requester = await pageAs(browser, 'user');
    const vendor = await pageAs(browser, 'dongbang');
    const sender = await pageAs(browser, 'user2');
    try {
      await gotoChat(requester.page, requestNo);
      await gotoChat(vendor.page, requestNo);
      await gotoChat(sender.page, requestNo);
      await waitForSubscribed(requester.page);
      await waitForSubscribed(vendor.page);
      await requester.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      await sender.page.getByTestId('quick-chat-quick-replies').getByRole('button', { name: '확인했습니다' }).click();
      await expect(composerInput(sender.page)).toHaveValue('확인했습니다');
      const { id, bubble } = await sendViaUi(sender.page, '확인했습니다');
      await expect(bubble).toHaveAttribute('data-author-role', 'participant');

      for (const viewer of [requester.page, vendor.page]) {
        const remote = messageBubble(viewer, id);
        await expect(remote).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
        await expect(remote).toHaveAttribute('data-author-role', 'participant');
        await expect(remote).toContainText(PART_TEXT.roleParticipant);
      }

      const recipients = await chatRecipientsOf(requestNo, id, 1 + dongbangIds.length);
      expect([...recipients].sort(), '요청자 + 동방 전원').toEqual([user.userId, ...dongbangIds].sort());
      expect(recipients.has(user2.userId), 'user2 본인 0').toBe(false);
      const stored = (await dbMessages(requestId)).find((row) => row.id === id);
      expect(stored?.author_role).toBe('participant');
    } finally {
      await requester.context.close();
      await vendor.context.close();
      await sender.context.close();
    }
  });

  test('AC-05: 요청자 → 동방 A → admin 메시지 — 각각 user2 1건씩 수신(참여자 전원 규칙)', async () => {
    for (const account of ['user', 'dongbang', 'admin'] as const) {
      const message = await sendMessageAs(account, requestNo, `${account} → 참여자 수신 확인 ${Date.now()}`);
      const recipients = await chatRecipientsOf(requestNo, message.id, 1);
      await expect
        .poll(async () => (await chatRecipientsOf(requestNo, message.id, 1)).has(user2.userId), {
          timeout: 15_000,
          message: `${account} 메시지 → user2 수신`
        })
        .toBe(true);
      const { data } = await serviceClient()
        .from('notifications')
        .select('id')
        .eq('type', 'quick_request.chat_message')
        .eq('recipient_user_id', user2.userId)
        .eq('metadata->>quick_request_message_id', String(message.id));
      expect(data ?? [], `${account} 메시지 user2 정확히 1건`).toHaveLength(1);
      expect(recipients.size).toBeGreaterThanOrEqual(1);
    }
  });

  test('AC-15: (2 context) 요청자 메시지 → user2 읽음 · 동방 A 미읽음 → 요청자 화면 ✓✓ 「읽음」 · tooltip user2 이름', async ({
    page
  }) => {
    await gotoChat(page, requestNo);
    await waitForSubscribed(page);
    await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
    const { id } = await sendViaUi(page, `읽음 확인 — 참여자 ${Date.now()}`);
    const mark = receipt(page, id);
    await expect(mark).toHaveAttribute('data-state', 'sent');

    const read = await markReadAs('user2', requestNo, id);
    expect(read.status, 'user2 읽음 PUT').toBe(200);
    await expect(mark).toHaveAttribute('data-state', 'read', { timeout: REALTIME_TIMEOUT_MS });
    await expect(mark).toContainText(CHAT_TEXT.receiptRead);
    await mark.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });
    await expect(tooltip).toContainText(`${user2.fullName} · `);
    await expect(tooltip).not.toContainText(dongbang.fullName);
  });

  test('AC-13: (2 context) user2 대시보드·사이드바 열어 둠 → 요청자 메시지 → 5초 안 「새 대화 1」·사이드바 배지 1 · 읽으면 0', async ({
    browser
  }) => {
    await markAllConversationsReadAs('user2');
    const { context, page } = await pageAs(browser, 'user2');
    try {
      await gotoDashboard(page);
      const sidebar = page.locator('[data-slot="sidebar"][data-collapsible]').first();
      if ((await sidebar.getAttribute('data-state')) === 'collapsed') {
        await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
      }
      await expect(sidebar).toHaveAttribute('data-state', 'expanded');
      await expect(page.getByTestId(`quick-participant-badge-${requestNo}`).filter({ visible: true })).toBeVisible({
        timeout: 20_000
      });
      const sidebarBadge = page.getByTestId('quick-chat-sidebar-badge');
      const rowBadge = page.getByTestId(`quick-unread-${requestNo}`).filter({ visible: true });
      await expect(sidebarBadge).toHaveCount(0);
      await expect(rowBadge).toHaveCount(0);
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      const message = await sendMessageAs('user', requestNo, `참여자 대시보드 실시간 ${Date.now()}`);
      await expect(rowBadge).toHaveText('새 대화 1', { timeout: REALTIME_TIMEOUT_MS });
      await expect(sidebarBadge).toHaveText('1', { timeout: REALTIME_TIMEOUT_MS });

      const read = await markReadAs('user2', requestNo, message.id);
      expect(read.status).toBe(200);
      await expect(sidebarBadge).toHaveCount(0, { timeout: REALTIME_TIMEOUT_MS });
      await expect(rowBadge).toHaveCount(0, { timeout: REALTIME_TIMEOUT_MS });
    } finally {
      await context.close();
    }
  });

  test('AC-06: user2(참여자) PATCH·accept·approve·cancel·초대 403 · 상세 permissions 전부 false + isParticipant · 요청자 → admin 초대 400 「초대할 수 없는 사용자입니다.」 · DB 행 0', async () => {
    const results = await withApi('user2', async (api) => {
      const responses = {
        patch: await api.patch(`/api/quick-request/${requestNo}`, { data: { finalAmount: 10000 } }),
        accept: await api.post(`/api/quick-request/${requestNo}/accept`),
        approve: await api.post(`/api/quick-request/${requestNo}/approve`),
        cancel: await api.post(`/api/quick-request/${requestNo}/cancel`, { data: {} }),
        invite: await api.post(`/api/quick-request/${requestNo}/participants`, { data: { userId: otherEmployee.userId } }),
        detail: await api.get(`/api/quick-request/${requestNo}`)
      };
      return {
        patch: responses.patch.status(),
        accept: responses.accept.status(),
        approve: responses.approve.status(),
        cancel: responses.cancel.status(),
        invite: responses.invite.status(),
        inviteBody: (await responses.invite.json()) as { message?: string },
        detail: responses.detail.status(),
        detailBody: (await responses.detail.json()) as { data?: { permissions?: Record<string, boolean> } }
      };
    });
    expect(results.patch, 'PATCH 403').toBe(403);
    expect(results.accept, 'accept 403').toBe(403);
    expect(results.approve, 'approve 403').toBe(403);
    expect(results.cancel, 'cancel 403').toBe(403);
    expect(results.invite, '참여자의 초대 403').toBe(403);
    expect(results.inviteBody.message).toBe(PART_TEXT.inviteForbidden);
    expect(results.detail).toBe(200);
    const permissions = results.detailBody.data?.permissions ?? {};
    expect(permissions.isParticipant, 'isParticipant:true').toBe(true);
    const others = Object.entries(permissions).filter(([key]) => key !== 'isParticipant');
    expect(others.length).toBeGreaterThan(0);
    for (const [key, value] of others) expect(value, `permissions.${key} false`).toBe(false);

    const adminInvite = await inviteAs('user', requestNo, admin.userId);
    expect(adminInvite.status, '요청자 → admin 초대 400').toBe(400);
    expect(adminInvite.body.message).toBe(PART_TEXT.cannotInvite);
    const otherAdminInvite = await inviteAs('user', requestNo, otherAdmin.userId);
    expect(otherAdminInvite.status).toBe(400);
    const rows = await dbParticipants(requestId);
    expect(rows.filter((row) => row.user_id === admin.userId || row.user_id === otherAdmin.userId), 'admin DB 행 0').toHaveLength(0);
    expect(rows.filter((row) => row.user_id === otherEmployee.userId), '참여자 초대 시도 DB 행 0').toHaveLength(0);
  });

  test('AC-07: 요청자 초대 — 동방 400 · 본인 400 · user2(이미 참여) 409 · pending 400 · zzz 404', async () => {
    const vendor = await inviteAs('user', requestNo, dongbang.userId);
    expect(vendor.status).toBe(400);
    expect(vendor.body.message).toBe(PART_TEXT.cannotInvite);
    const self = await inviteAs('user', requestNo, user.userId);
    expect(self.status).toBe(400);
    expect(self.body.message).toBe(PART_TEXT.cannotInvite);
    const dup = await inviteAs('user', requestNo, user2.userId);
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe(PART_TEXT.alreadyJoined);
    const pend = await inviteAs('user', requestNo, pending.userId);
    expect(pend.status).toBe(400);
    expect(pend.body.message).toBe(PART_TEXT.cannotInvite);
    const missing = await inviteAs('user', requestNo, 'zzz');
    expect(missing.status).toBe(404);
    for (const result of [vendor, self, dup, pend, missing]) expect(result.headers['x-request-id']).toBeTruthy();
    expect((await dbParticipants(requestId)).map((row) => row.user_id), 'DB 행은 user2 1건 유지').toEqual([user2.userId]);
  });

  test('AC-08: 동방·구매물류·user2(참여자) — POST participants 403 「참여자를 추가할 권한이 없습니다.」 · 후보 403', async () => {
    for (const account of ['dongbang', 'logistics', 'user2'] as const) {
      const post = await inviteAs(account, requestNo, otherEmployee.userId);
      expect(post.status, `${account} POST 403`).toBe(403);
      expect(post.body.message).toBe(PART_TEXT.inviteForbidden);
      const candidates = await candidatesAs(account, requestNo, '테');
      expect(candidates.status, `${account} 후보 403`).toBe(403);
    }
    expect(logistics.userId).toBeTruthy();
  });

  test('AC-09: 요청자 목록 user2 ✕ → AlertModal(「참여자 제외」·이름) → 「제외」 → DELETE 200 · 시스템 줄 「제외되었습니다」 · user2 알림 「퀵 {번호} 대화에서 제외됨」 · window.confirm 0', async ({
    page
  }) => {
    await gotoDetailChat(page, requestNo);
    const popover = await openParticipants(page);
    await popover.getByTestId(`quick-chat-participant-remove-${user2.userId}`).click();
    const dialog = page.getByRole('dialog', { name: PART_TEXT.removeTitle });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(PART_TEXT.removeDescription(user2.fullName));
    const deletePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/quick-request/${requestNo}/participants/${user2.userId}`) &&
        response.request().method() === 'DELETE'
    );
    await dialog.getByRole('button', { name: PART_TEXT.removeConfirm, exact: true }).click();
    const response = await deletePromise;
    expect(response.status(), 'DELETE 200').toBe(200);
    expect(((await response.json()) as { data: { self: boolean } }).data.self).toBe(false);
    await expect(page.getByText(PART_TEXT.removedToast(user2.fullName), { exact: true })).toBeVisible({ timeout: 10_000 });
    const removedLine = systemLines(page, 'removed', user2.userId).filter({ visible: true }).first();
    await expect(removedLine).toBeVisible({ timeout: 10_000 });
    await expect(removedLine).toContainText(PART_TEXT.systemRemoved(user2.fullName));

    await expect
      .poll(async () => (await dbParticipantNotifications(requestNo, 'participant_removed', user2.userId)).length, {
        timeout: 15_000
      })
      .toBe(1);
    const [removed] = await dbParticipantNotifications(requestNo, 'participant_removed', user2.userId);
    expect(removed.title).toBe(PART_TEXT.removedTitle(requestNo));
    expect(removed.body).toBe(`${user.fullName}님이 대화에서 제외했습니다.`);

    const confirmHits = [
      ...grepDir('src/features', /window\.confirm|[^.\w]confirm\(/),
      ...grepDir('src/app', /window\.confirm|[^.\w]confirm\(/)
    ];
    expect(confirmHits, 'window.confirm 0').toEqual([]);
  });

  test('AC-10: 제외 후 user2 — 상세·대화·GET messages 404 · 대시보드 0 · 「퀵 대화」 0 · 이후 메시지 알림 0', async ({
    browser
  }) => {
    const messages = await getMessagesAs('user2', requestNo);
    expect(messages.status, 'messages 404').toBe(404);
    const detail = await withApi('user2', (api) => api.get(`/api/quick-request/${requestNo}`).then((r) => r.status()));
    expect(detail, '상세 API 404').toBe(404);
    const participants = await withApi('user2', (api) =>
      api.get(`/api/quick-request/${requestNo}/participants`).then((r) => r.status())
    );
    expect(participants, 'participants 404').toBe(404);
    const { conversations } = await getConversationsAs('user2');
    expect(conversations.filter((item) => item.requestNo === requestNo), '「퀵 대화」 0').toHaveLength(0);

    const { context, page } = await pageAs(browser, 'user2');
    try {
      await page.goto(`/dashboard/quick/${requestNo}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-detail-not-found')).toBeVisible({ timeout: 30_000 });
      await gotoChat(page, requestNo);
      await expect(page.getByText(CHAT_TEXT.notFound)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(`quick-chat-list-item-${requestNo}`)).toHaveCount(0);
      await gotoDashboard(page);
      await expect(page.getByRole('heading', { name: '나의 퀵 내역', exact: true }).first()).toBeVisible();
      await page.waitForTimeout(1_500);
      await expect(page.getByTestId(`quick-row-detail-${requestNo}`)).toHaveCount(0);
      await expect(page.getByTestId(`quick-card-${requestNo}`)).toHaveCount(0);
    } finally {
      await context.close();
    }

    const after = await sendMessageAs('user', requestNo, `제외 후 메시지 ${Date.now()}`);
    await chatRecipientsOf(requestNo, after.id, dongbangIds.length);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const recipients = await chatRecipientsOf(requestNo, after.id, 0);
    expect(recipients.has(user2.userId), '제외 후 user2 알림 0').toBe(false);
  });

  test('AC-11: 같은 user2 재초대 → 201 · 같은 행 removed_at null · 시스템 줄 「참여했습니다」 다시 · user2 이전 기록 전부 열람', async ({
    page
  }) => {
    const before = await dbParticipants(requestId);
    expect(before).toHaveLength(1);
    expect(before[0].removed_at).not.toBeNull();
    const result = await inviteAs('user', requestNo, user2.userId);
    expect(result.status, '재초대 201').toBe(201);
    const after = await dbParticipants(requestId);
    expect(after, '행 수 1 유지(복구)').toHaveLength(1);
    expect(after[0].id, '같은 행').toBe(before[0].id);
    expect(after[0].removed_at).toBeNull();
    expect(after[0].removed_by).toBeNull();

    const data = await getMessagesDataAs('user2', requestNo);
    const all = await dbMessages(requestId);
    expect(data.messages.map((m) => m.id), '이전 기록 전부').toEqual(all.map((row) => row.id));
    expect(data.viewer.role).toBe('participant');

    await gotoDetailChat(page, requestNo);
    const joined = systemLines(page, 'joined', user2.userId).filter({ visible: true }).first();
    await expect(joined).toBeVisible({ timeout: 15_000 });
    await expect(joined).toContainText(PART_TEXT.systemJoined(user2.fullName));
  });

  test('AC-12: user2 「참여자 N」 → 「나가기」 → AlertModal 확인 → 200 · 시스템 줄 「나갔습니다」 · 알림 0 · 로그 self:true', async ({
    browser,
    page
  }) => {
    const removedBefore = (await dbParticipantNotifications(requestNo, 'participant_removed', user2.userId)).length;
    const { context, page: participant } = await pageAs(browser, 'user2');
    try {
      await gotoChat(participant, requestNo);
      const popover = await openParticipants(participant);
      await popover.getByTestId('quick-chat-participant-leave').click();
      const dialog = participant.getByRole('dialog', { name: PART_TEXT.leaveTitle });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const deletePromise = participant.waitForResponse(
        (response) =>
          response.url().includes(`/api/quick-request/${requestNo}/participants/${user2.userId}`) &&
          response.request().method() === 'DELETE'
      );
      await dialog.getByRole('button', { name: PART_TEXT.leaveConfirm, exact: true }).click();
      const response = await deletePromise;
      expect(response.status()).toBe(200);
      expect(((await response.json()) as { data: { self: boolean } }).data.self).toBe(true);
      await expect(participant.getByText(PART_TEXT.leftToast, { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(participant).not.toHaveURL(new RegExp(`request=${requestNo}`), { timeout: 10_000 });
    } finally {
      await context.close();
    }

    await gotoDetailChat(page, requestNo);
    const left = systemLines(page, 'left', user2.userId).filter({ visible: true }).first();
    await expect(left).toBeVisible({ timeout: 15_000 });
    await expect(left).toContainText(PART_TEXT.systemLeft(user2.fullName));

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(
      (await dbParticipantNotifications(requestNo, 'participant_removed', user2.userId)).length,
      '본인 나가기 알림 0'
    ).toBe(removedBefore);
    const log = await findActivityLog(
      ACTION_REMOVE,
      (item) => item.target_label === requestNo && item.http_status === 200 && item.metadata?.self === true,
      `participant_remove self:true ${requestNo}`
    );
    expect(log.metadata?.participant_user_id).toBe(user2.userId);
  });

  test('AC-14: admin — 다른 사람 건에서 「참여자 추가」 → 다른 admin 이름 후보 0 · user2 초대 201 · 「초대: {admin}」 · 제외 200', async ({
    browser,
    page
  }) => {
    const adminSession = await pageAs(browser, 'admin');
    try {
      await gotoDetailChat(adminSession.page, requestNo);
      const popover = await openParticipants(adminSession.page);
      await popover.getByTestId('quick-chat-add-participant').click();
      const input = popover.getByTestId('quick-chat-add-participant-input');
      await input.fill('관리자후보');
      await expect(popover.getByTestId('quick-chat-candidates-empty')).toHaveText(PART_TEXT.candidatesEmpty, {
        timeout: 15_000
      });
      await expect(popover.getByTestId(`quick-chat-candidate-${otherAdmin.userId}`)).toHaveCount(0);
      expect(await candidateListAs('admin', requestNo, otherAdmin.fullName), 'API: 다른 admin 0건').toHaveLength(0);

      await input.fill(user2.fullName.slice(0, 2));
      const candidate = popover.getByTestId(`quick-chat-candidate-${user2.userId}`);
      await expect(candidate).toBeVisible({ timeout: 15_000 });
      const postPromise = adminSession.page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/quick-request/${requestNo}/participants`) && response.request().method() === 'POST'
      );
      await candidate.click();
      expect((await postPromise).status(), 'admin 초대 201').toBe(201);
      await expect(adminSession.page.getByText(PART_TEXT.invitedToast(user2.fullName), { exact: true })).toBeVisible({
        timeout: 10_000
      });
    } finally {
      await adminSession.context.close();
    }

    await gotoDetailChat(page, requestNo);
    const listPopover = await openParticipants(page);
    const row = participantRow(listPopover, user2.userId);
    await expect(row).toContainText(PART_TEXT.invitedBy(admin.fullName), { timeout: 15_000 });
    await page.keyboard.press('Escape');
    const rows = await dbParticipants(requestId);
    expect(rows[0].invited_by, 'invited_by = admin').toBe(admin.userId);

    const adminRemove = await pageAs(browser, 'admin');
    try {
      await gotoDetailChat(adminRemove.page, requestNo);
      const popover = await openParticipants(adminRemove.page);
      await popover.getByTestId(`quick-chat-participant-remove-${user2.userId}`).click();
      const dialog = adminRemove.page.getByRole('dialog', { name: PART_TEXT.removeTitle });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const deletePromise = adminRemove.page.waitForResponse(
        (response) =>
          response.url().includes(`/api/quick-request/${requestNo}/participants/${user2.userId}`) &&
          response.request().method() === 'DELETE'
      );
      await dialog.getByRole('button', { name: PART_TEXT.removeConfirm, exact: true }).click();
      expect((await deletePromise).status(), 'admin 제외 200').toBe(200);
    } finally {
      await adminRemove.context.close();
    }
  });

  test('AC-17: 활동 로그 — participant_add 201·409·403 · participant_remove 200(self false·true) · metadata participant_user_id · GET 미기록 · /dashboard/logs 라벨', async ({
    page
  }) => {
    const ok = await findActivityLog(
      ACTION_ADD,
      (item) => item.target_label === requestNo && item.http_status === 201,
      `participant_add 201 ${requestNo}`
    );
    expect(ok.metadata?.quick_request_no).toBe(requestNo);
    expect(ok.metadata?.participant_user_id).toBe(user2.userId);
    const conflict = await findActivityLog(
      ACTION_ADD,
      (item) => item.target_label === requestNo && item.http_status === 409,
      `participant_add 409 ${requestNo}`
    );
    expect(conflict.metadata?.participant_user_id).toBe(user2.userId);
    expect(conflict.metadata?.error_code).toBeTruthy();
    const forbidden = await findActivityLog(
      ACTION_ADD,
      (item) => item.target_label === requestNo && item.http_status === 403,
      `participant_add 403 ${requestNo}`
    );
    expect(forbidden.metadata?.error_code).toBe('forbidden');
    const invalid = await findActivityLog(
      ACTION_ADD,
      (item) => item.target_label === requestNo && item.http_status === 400,
      `participant_add 400 ${requestNo}`
    );
    expect(invalid.metadata?.participant_user_id).toBeTruthy();
    await findActivityLog(
      ACTION_ADD,
      (item) => item.target_label === requestNo && item.http_status === 404,
      `participant_add 404 ${requestNo}`
    );
    const removed = await findActivityLog(
      ACTION_REMOVE,
      (item) => item.target_label === requestNo && item.http_status === 200 && item.metadata?.self === false,
      `participant_remove 200 self:false ${requestNo}`
    );
    expect(removed.metadata?.participant_user_id).toBe(user2.userId);
    await findActivityLog(
      ACTION_REMOVE,
      (item) => item.target_label === requestNo && item.http_status === 200 && item.metadata?.self === true,
      `participant_remove 200 self:true ${requestNo}`
    );

    // Read Out — GET participants · candidates · messages 로그 0
    const { data: getLogs, error } = await serviceClient()
      .from('activity_logs')
      .select('id, http_method, http_path')
      .like('http_path', `%/quick-request/${requestNo}/%`)
      .eq('http_method', 'GET');
    expect(error).toBeNull();
    expect(getLogs ?? [], 'GET 로그 0').toHaveLength(0);

    await page.goto('/dashboard/logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
    const addRow = page.getByTestId('activity-log-row').filter({ hasText: requestNo }).filter({ hasText: PART_TEXT.logAdd }).first();
    await expect(addRow).toBeVisible({ timeout: 20_000 });
    const removeRow = page
      .getByTestId('activity-log-row')
      .filter({ hasText: requestNo })
      .filter({ hasText: PART_TEXT.logRemove })
      .first();
    await expect(removeRow).toBeVisible({ timeout: 20_000 });
  });
});
