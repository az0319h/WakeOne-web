import { expect, test } from '@playwright/test';
import {
  acceptAs,
  createAs,
  dbChatNotifications,
  dbQuickRequest,
  findActivityLog,
  fixtureUser,
  listActiveAdminIds,
  listActiveDongbangIds,
  listActiveLogisticsIds,
  readAccountMeta,
  serviceClient,
  uniqueTag,
  type AccountMeta
} from '../quick-workflow/helpers';
import {
  CHAT_TEXT,
  apiAsDongbang2,
  chatRecipientsOf,
  createDongbang2WithSession,
  dbMessages,
  expectSetEqual,
  markReadAs,
  messageBubble,
  postMessageAs,
  sendMessageAs,
  setProfileStatus,
  type ChatMessage
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 93 §D 알림 · §E 활동 로그 — docs/plans/93_quick-request-chat-plan.md (AC-22 ~ AC-27 · AC-29)
 * 수신 규칙(r3): 참여자(요청자 + active 동방 전원 + 글 쓴 admin) − 보낸 사람 − 비활성.
 * active 동방 목록은 dev DB 기준(`listActiveDongbangIds`)으로 계산한다 — 동방 A(dongbang.json)·B(dongbang2) 포함.
 */
test.describe('plan 93 D·E. 알림 수신자 · 문구 · 활동 로그', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let user: { userId: string; fullName: string };
  let admin: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let dongbang2: AccountMeta;
  let logistics: AccountMeta;
  let dongbangIds: string[] = [];
  let adminIds: string[] = [];
  let logisticsIds: string[] = [];
  let flowNo = '';
  let flowId = '';
  let adminMessage: ChatMessage | null = null;

  /** 94 D-13 `buildChatNotificationTitle`과 같은 규칙 — 이름 20자 · 전체 30자 */
  const chatTitle = (requestNo: string, senderName: string) => {
    const no = requestNo.trim();
    const budget = Math.max(1, Math.min(20, 30 - 3 - no.length));
    return `${senderName.replace(/\s+/g, ' ').trim().slice(0, budget)} · ${no}`;
  };

  const without = (ids: Iterable<string>, ...exclude: string[]) => [...ids].filter((id) => !exclude.includes(id));

  async function sendAsDongbang2(requestNo: string, body: string): Promise<ChatMessage> {
    return apiAsDongbang2(async (api) => {
      const response = await api.post(`/api/quick-request/${requestNo}/messages`, { data: { body } });
      expect(response.status(), `dongbang2 POST ${await response.text()}`).toBe(201);
      const json = (await response.json()) as { data: { message: ChatMessage } };
      return json.data.message;
    });
  }

  async function expectTitleBody(requestNo: string, messageId: number, senderName: string, body: string) {
    const rows = await dbChatNotifications(requestNo, messageId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // plan 94 D-13 — 제목 `{이름(20)} · {번호}` · 전체 ≤30자(U-7)라 번호가 길면 이름을 더 줄인다 (옛 `{번호} · {이름} 메시지` 교체)
      expect(row.title).toBe(chatTitle(requestNo, senderName));
      expect(row.body).toBe(body);
      expect(row.metadata.quick_request_event).toBe('chat_message');
      expect(row.metadata.quick_request_message_id).toBe(messageId);
    }
  }

  test.beforeAll(async ({ browser }) => {
    user = await fixtureUser('user');
    admin = await fixtureUser('admin');
    dongbang = readAccountMeta('dongbang');
    logistics = readAccountMeta('logistics');
    dongbang2 = await createDongbang2WithSession(browser);
    [dongbangIds, adminIds, logisticsIds] = await Promise.all([
      listActiveDongbangIds(),
      listActiveAdminIds(),
      listActiveLogisticsIds()
    ]);
    expect(dongbangIds, '동방 A·B active').toEqual(expect.arrayContaining([dongbang.userId, dongbang2.userId]));
    expect(adminIds).toContain(admin.userId);
    expect(logisticsIds).toContain(logistics.userId);
  });

  test.afterAll(async () => {
    await setProfileStatus(dongbang2.userId, 'active');
  });

  test('AC-22: 새 requested 건 · 요청자 메시지 → active 동방 전원 각 1건 · admin·구매물류·요청자 0 · 제목 「{이름} · {번호}」(94 D-13) · 본문 일치', async () => {
    const created = await createAs('user', uniqueTag('E2E93NTF'));
    flowNo = created.requestNo;
    flowId = (await dbQuickRequest(flowNo)).id;
    const body = '동방특송 담당자님 이건 취소해주세요';
    const message = await sendMessageAs('user', flowNo, body);
    const recipients = await chatRecipientsOf(flowNo, message.id, dongbangIds.length);
    expectSetEqual(recipients, dongbangIds, '요청자 → active 동방 전원');
    for (const id of [user.userId, ...adminIds, ...logisticsIds]) expect(recipients.has(id), id).toBe(false);
    await expectTitleBody(flowNo, message.id, user.fullName, body);
  });

  test('AC-23: A 접수(dispatching) 후 요청자 메시지 → A·B 모두 1건(접수 전/후 구분 없음) · admin 0', async () => {
    await acceptAs('dongbang', flowNo);
    const message = await sendMessageAs('user', flowNo, '담당자님 이건 40분 뒤로 시간 변경해주세요');
    const recipients = await chatRecipientsOf(flowNo, message.id, dongbangIds.length);
    expectSetEqual(recipients, dongbangIds, '접수 후에도 동방 전원');
    expect(recipients.has(dongbang.userId)).toBe(true);
    expect(recipients.has(dongbang2.userId)).toBe(true);
    for (const id of adminIds) expect(recipients.has(id)).toBe(false);
    const rows = await dbChatNotifications(flowNo, message.id);
    for (const id of [dongbang.userId, dongbang2.userId]) {
      expect(rows.filter((row) => row.recipient_user_id === id), `${id} 1건`).toHaveLength(1);
    }
  });

  test('AC-24: A 「불가능합니다」 → 요청자+B · admin 「제가 확인했습니다」 → 요청자+A+B · 요청자 「알겠습니다」 → A+B+admin · B 「확인했습니다」 → 요청자+A+admin · 보낸 사람·구매물류 0', async () => {
    const a = await sendMessageAs('dongbang', flowNo, '불가능합니다');
    expectSetEqual(
      await chatRecipientsOf(flowNo, a.id),
      [user.userId, ...without(dongbangIds, dongbang.userId)],
      '① A → 요청자 + 다른 동방 (admin 0)'
    );

    adminMessage = await sendMessageAs('admin', flowNo, '제가 확인했습니다');
    expectSetEqual(await chatRecipientsOf(flowNo, adminMessage.id), [user.userId, ...dongbangIds], '② admin → 요청자 + 동방 전원');
    await expectTitleBody(flowNo, adminMessage.id, admin.fullName, '제가 확인했습니다');

    const u = await sendMessageAs('user', flowNo, '알겠습니다');
    expectSetEqual(await chatRecipientsOf(flowNo, u.id), [...dongbangIds, admin.userId], '③ 요청자 → 동방 전원 + 참여한 admin');

    const b = await sendAsDongbang2(flowNo, '확인했습니다');
    expectSetEqual(
      await chatRecipientsOf(flowNo, b.id),
      [user.userId, ...without(dongbangIds, dongbang2.userId), admin.userId],
      '④ B → 요청자 + A + admin'
    );
    for (const [message, sender] of [
      [a, dongbang.userId],
      [adminMessage, admin.userId],
      [u, user.userId],
      [b, dongbang2.userId]
    ] as const) {
      const rows = await dbChatNotifications(flowNo, message.id);
      expect(rows.some((row) => row.recipient_user_id === sender), '보낸 사람 0').toBe(false);
      for (const id of logisticsIds) expect(rows.some((row) => row.recipient_user_id === id), '구매물류 0').toBe(false);
    }
  });

  test('AC-25: B(dongbang2) inactive — 요청자 메시지 수신 B 0 · A 메시지 수신 B 0 · fixture 원복', async () => {
    const created = await createAs('user', uniqueTag('E2E93INACT'));
    await setProfileStatus(dongbang2.userId, 'inactive');
    try {
      const activeNow = await listActiveDongbangIds();
      expect(activeNow).not.toContain(dongbang2.userId);
      const fromUser = await sendMessageAs('user', created.requestNo, '비활성 동방 제외 확인');
      expectSetEqual(await chatRecipientsOf(created.requestNo, fromUser.id), activeNow, '요청자 → active 동방만 (B 0)');
      expect((await chatRecipientsOf(created.requestNo, fromUser.id)).has(dongbang2.userId)).toBe(false);

      const fromA = await sendMessageAs('dongbang', created.requestNo, '확인했습니다');
      const recipients = await chatRecipientsOf(created.requestNo, fromA.id);
      expectSetEqual(recipients, [user.userId, ...without(activeNow, dongbang.userId)], 'A → 요청자 (+ 다른 active 동방) · B 0');
      expect(recipients.has(dongbang2.userId)).toBe(false);
    } finally {
      await setProfileStatus(dongbang2.userId, 'active');
    }
    expect(await listActiveDongbangIds()).toContain(dongbang2.userId);
  });

  test('AC-26: 300자 메시지 — 알림 본문 200자·「…」 종료 · DB body 300자', async () => {
    const body = '가'.repeat(300);
    const message = await sendMessageAs('user', flowNo, body);
    const rows = await dbChatNotifications(flowNo, message.id);
    await expect.poll(async () => (await dbChatNotifications(flowNo, message.id)).length).toBeGreaterThan(0);
    const latest = rows.length ? rows : await dbChatNotifications(flowNo, message.id);
    for (const row of latest) {
      expect(row.body.length).toBe(200);
      expect(row.body.endsWith('…')).toBe(true);
    }
    const stored = (await dbMessages(flowId)).find((row) => row.id === message.id);
    expect(stored?.body.length).toBe(300);
  });

  test('AC-27: user /dashboard/notifications 「채팅 보기」 → /dashboard/quick/chat?request= · 대화 선택 · 최신 메시지 보임 · 다른 퀵 알림은 「퀵 요청 보기」', async ({
    page
  }) => {
    expect(adminMessage).not.toBeNull();
    const chatRow = (await dbChatNotifications(flowNo, adminMessage!.id)).find((row) => row.recipient_user_id === user.userId);
    expect(chatRow, '요청자 채팅 알림').toBeTruthy();
    const { data: accepted } = await serviceClient()
      .from('notifications')
      .select('id')
      .eq('recipient_user_id', user.userId)
      .eq('metadata->>quick_request_no', flowNo)
      .eq('metadata->>quick_request_event', 'accepted')
      .limit(1);
    expect(accepted?.length, '접수 알림').toBe(1);

    await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
    const acceptedCard = page.getByTestId(`notification-card-${accepted![0].id}`);
    await expect(acceptedCard).toBeVisible({ timeout: 20_000 });
    await expect(acceptedCard.getByRole('button', { name: '퀵 요청 보기' })).toBeVisible();
    await expect(acceptedCard.getByRole('button', { name: '채팅 보기' })).toHaveCount(0);

    const chatCard = page.getByTestId(`notification-card-${chatRow!.id}`);
    await expect(chatCard).toBeVisible({ timeout: 20_000 });
    await expect(chatCard).toContainText(chatTitle(flowNo, admin.fullName));
    // hydration 전 클릭은 무시될 수 있어 URL이 바뀔 때까지 다시 누른다 (plan 106 verifier · 타이밍)
    await expect(async () => {
      if (!page.url().includes('/dashboard/quick/chat')) {
        await chatCard.getByRole('button', { name: '채팅 보기' }).click({ timeout: 5_000 });
      }
      await expect(page).toHaveURL(new RegExp(`/dashboard/quick/chat\\?request=${flowNo}`), { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`quick-chat-list-item-${flowNo}`)).toHaveAttribute('aria-current', 'true', {
      timeout: 20_000
    });
    const messages = await dbMessages(flowId);
    const latest = messages[messages.length - 1];
    const bubble = messageBubble(page, latest.id);
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    await expect(bubble).toBeInViewport();
  });

  test('AC-29: 활동 로그 — user /dashboard/logs 「퀵 대화 메시지 전송」 · admin API 201 metadata(no·body_length, recipient_count·body 없음 · 94 D-2) · 구매물류 403 · x-request-id · 읽음 PUT 로그 0', async ({
    page
  }) => {
    const logNo = (await createAs('user', uniqueTag('E2E93LOG'))).requestNo;
    const body = '로그 검증 메시지입니다';
    const post = await postMessageAs('user', logNo, { body });
    expect(post.status).toBe(201);
    expect(post.headers['x-request-id']).toBeTruthy();
    const forbidden = await postMessageAs('logistics', logNo, { body: '구매물류 전송 시도' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers['x-request-id']).toBeTruthy();

    const ok = await findActivityLog(
      'quick_request.message_create',
      (item) => item.target_label === logNo && item.http_status === 201,
      `message_create 201 ${logNo}`
    );
    expect(ok.metadata?.quick_request_no).toBe(logNo);
    expect(ok.metadata?.body_length).toBe(body.length);
    expect(ok.metadata && 'recipient_count' in ok.metadata, 'recipient_count 제거(94 D-2)').toBe(false);
    expect(ok.metadata?.message_id).toBeTruthy();
    expect(ok.metadata && 'body' in ok.metadata, '본문 미포함').toBe(false);
    expect(JSON.stringify(ok.metadata)).not.toContain(body);

    const denied = await findActivityLog(
      'quick_request.message_create',
      (item) => item.target_label === logNo && item.http_status === 403,
      `message_create 403 ${logNo}`
    );
    expect(denied.metadata?.quick_request_no).toBe(logNo);

    await page.goto('/dashboard/logs', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
    const row = page.getByTestId('activity-log-row').filter({ hasText: logNo }).filter({ hasText: CHAT_TEXT.logLabel }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('성공');
    await expect(row).not.toContainText(body);

    // 읽음 갱신 PUT → 로그 0 (DB http_path)
    const readResult = await markReadAs('user', logNo, (post.body.data as { message: { id: number } }).message.id);
    expect(readResult.status).toBe(200);
    await markReadAs('dongbang', logNo, (post.body.data as { message: { id: number } }).message.id);
    const { data: readLogs, error } = await serviceClient()
      .from('activity_logs')
      .select('id')
      .like('http_path', `%/quick-request/${logNo}/messages/read%`);
    expect(error).toBeNull();
    expect(readLogs ?? []).toHaveLength(0);
  });
});
