import { expect, test } from '@playwright/test';
import {
  acceptAs,
  approveAs,
  cancelAs,
  createAs,
  createDisposableDongbang,
  dbNotificationsByEvent,
  dispatchAs,
  expectDetailStatus,
  fixtureUser,
  listActiveAdminIds,
  listActiveDongbangIds,
  listActiveLogisticsIds,
  NOTIFY_TITLE,
  NOTIFY_TYPE,
  notificationsOf,
  readAccountMeta,
  setFinalAs,
  STATUS_LABEL,
  type AccountMeta,
  type QuickNotificationRow,
  type QuickNotifyEvent
} from './helpers';

/**
 * plan 92 §B 알림 수신자·문구 — docs/plans/92_quick-web-only-notifications-plan.md (AC-10~18)
 * 수신자 매트릭스(D-4)·문구표(D-5)를 dev DB `notifications`(service role)로 판정한다.
 * AC-10~14는 한 건을 순서대로 진행하므로 serial.
 */
test.describe('plan 92 B. 알림 수신자 · 문구', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let user: { userId: string; fullName: string };
  let admin: { userId: string; fullName: string };
  let dongbang: AccountMeta;
  let dongbang2: AccountMeta;
  let logistics: AccountMeta;
  let dongbangIds: string[] = [];
  let adminIds: string[] = [];
  let logisticsIds: string[] = [];
  let flowNo = '';

  const recipientSet = (rows: QuickNotificationRow[]) => new Set(rows.map((row) => row.recipient_user_id));
  const expectSetEqual = (actual: Set<string>, expected: Iterable<string>, label: string) => {
    expect([...actual].sort(), label).toEqual([...new Set(expected)].sort());
  };
  const expectOne = (
    rows: QuickNotificationRow[],
    userId: string,
    expected: { type: string; title: string; body: string },
    label: string
  ) => {
    const mine = notificationsOf(rows, userId);
    expect(mine, `${label} 1건`).toHaveLength(1);
    expect(mine[0].type, `${label} type`).toBe(expected.type);
    expect(mine[0].title, `${label} title`).toBe(expected.title);
    expect(mine[0].body, `${label} body`).toBe(expected.body);
  };
  const expectNone = (rows: QuickNotificationRow[], userIds: string[], label: string) => {
    for (const userId of userIds) expect(notificationsOf(rows, userId), `${label} ${userId} 0건`).toHaveLength(0);
  };
  const rowsFor = async (no: string, event: QuickNotifyEvent) => {
    let rows: QuickNotificationRow[] = [];
    await expect
      .poll(
        async () => {
          rows = await dbNotificationsByEvent(no, event);
          return rows.length;
        },
        { timeout: 15_000, message: `notifications ${event} ${no}` }
      )
      .toBeGreaterThan(0);
    return rows;
  };

  test.beforeAll(async () => {
    dongbang2 = await createDisposableDongbang();
    dongbang = readAccountMeta('dongbang');
    logistics = readAccountMeta('logistics');
    user = await fixtureUser('user');
    admin = await fixtureUser('admin');
    [dongbangIds, adminIds, logisticsIds] = await Promise.all([
      listActiveDongbangIds(),
      listActiveAdminIds(),
      listActiveLogisticsIds()
    ]);
    expect(dongbangIds, '동방 2명 active').toEqual(expect.arrayContaining([dongbang.userId, dongbang2.userId]));
    expect(adminIds, 'admin fixture active').toContain(admin.userId);
    expect(logisticsIds, '구매물류팀 fixture active').toContain(logistics.userId);
  });

  test('AC-10: 등록 → 동방 2명 + admin 전원 + 구매물류팀 전원(vendor) · 요청자 0건 · 「새 퀵 요청 {번호}」 · 본문 `{요청자} · … → …`', async () => {
    const created = await createAs('user');
    flowNo = created.requestNo;
    const rows = await rowsFor(flowNo, 'created');

    const expected = [...dongbangIds, ...adminIds, ...logisticsIds].filter((id) => id !== user.userId);
    expectSetEqual(recipientSet(rows), expected, '등록 수신자');
    expectNone(rows, [user.userId], '요청자');
    for (const row of rows) {
      expect(row.type).toBe(NOTIFY_TYPE.vendor);
      expect(row.title).toBe(NOTIFY_TITLE.created(flowNo));
      expect(row.title.length).toBeLessThanOrEqual(30);
      expect(row.body.startsWith(`${user.fullName} · `), row.body).toBe(true);
      expect(row.body).toContain(' → ');
      expect(row.body.length).toBeLessThanOrEqual(120);
    }
    for (const id of [dongbang.userId, dongbang2.userId, admin.userId, logistics.userId]) {
      expect(notificationsOf(rows, id), id).toHaveLength(1);
    }
  });

  test('AC-11: 동방1 접수 → 동방2 1건(vendor 「{동방1}님이 접수했습니다.」) · 요청자 1건(requester) · 행위자·admin·구매물류 0건', async () => {
    await acceptAs('dongbang', flowNo);
    const rows = await rowsFor(flowNo, 'accepted');
    const title = NOTIFY_TITLE.accepted(flowNo);
    expectOne(rows, dongbang2.userId, { type: NOTIFY_TYPE.vendor, title, body: `${dongbang.fullName}님이 접수했습니다.` }, '동방2');
    expectOne(
      rows,
      user.userId,
      { type: NOTIFY_TYPE.requester, title, body: '동방특송이 접수해 배차를 진행하고 있습니다.' },
      '요청자'
    );
    expectNone(rows, [dongbang.userId, ...adminIds, ...logisticsIds], '행위자·admin·구매물류');
    expectSetEqual(
      recipientSet(rows),
      [...dongbangIds.filter((id) => id !== dongbang.userId), user.userId],
      '접수 수신자'
    );
  });

  test('AC-12: 동방1 배차완료 → 동방2·요청자 각 1건 「퀵 {번호} 배차완료」 · 본문 `21마 6543 · 기사 홍길동 · 예상 20,000원` · 010 없음', async () => {
    await dispatchAs('dongbang', flowNo);
    const rows = await rowsFor(flowNo, 'dispatched');
    const title = NOTIFY_TITLE.dispatched(flowNo);
    const body = '21마 6543 · 기사 홍길동 · 예상 20,000원';
    expectOne(rows, dongbang2.userId, { type: NOTIFY_TYPE.vendor, title, body }, '동방2');
    expectOne(rows, user.userId, { type: NOTIFY_TYPE.requester, title, body }, '요청자');
    for (const row of rows) expect(row.body).not.toContain('010');
    expectNone(rows, [dongbang.userId, ...adminIds, ...logisticsIds], '행위자·admin·구매물류');
  });

  test('AC-13: admin 최종금액 23000 → 동방 2명 각 1건 「최종금액 23,000원 · {admin}님 입력」 · 요청자 「…확인 후 승인해 주세요.」 · admin 0건', async () => {
    await setFinalAs('admin', flowNo, 23000);
    const rows = await rowsFor(flowNo, 'final_amount_set');
    const title = NOTIFY_TITLE.final_amount_set(flowNo);
    for (const id of [dongbang.userId, dongbang2.userId]) {
      expectOne(rows, id, { type: NOTIFY_TYPE.vendor, title, body: `최종금액 23,000원 · ${admin.fullName}님 입력` }, id);
    }
    expectOne(
      rows,
      user.userId,
      { type: NOTIFY_TYPE.requester, title, body: '최종금액 23,000원 · 확인 후 승인해 주세요.' },
      '요청자'
    );
    expectNone(rows, [admin.userId, ...logisticsIds], 'admin·구매물류');
  });

  test('AC-14: 요청자 승인 → 동방 2명 각 1건 「퀵 {번호} 승인됨」 · 요청자(행위자) 0건 · admin·구매물류 0건', async () => {
    await approveAs('user', flowNo);
    const rows = await rowsFor(flowNo, 'approved');
    const title = NOTIFY_TITLE.approved(flowNo);
    for (const id of [dongbang.userId, dongbang2.userId]) {
      expectOne(
        rows,
        id,
        { type: NOTIFY_TYPE.vendor, title, body: `최종금액 23,000원 · ${user.fullName}님이 승인했습니다.` },
        id
      );
    }
    expectNone(rows, [user.userId, ...adminIds, ...logisticsIds], '요청자·admin·구매물류');
  });

  test('AC-15: 요청자가 사유 「날짜 변경」으로 취소 → 동방 2명 + admin + 구매물류팀 각 1건(vendor) · 「{요청자}님이 취소했습니다. 사유: 날짜 변경」 · 요청자 0건', async () => {
    const { requestNo } = await createAs('user');
    await cancelAs('user', requestNo, '날짜 변경');
    const rows = await rowsFor(requestNo, 'cancelled');
    const expected = [...dongbangIds, ...adminIds, ...logisticsIds].filter((id) => id !== user.userId);
    expectSetEqual(recipientSet(rows), expected, '취소 수신자');
    for (const id of [dongbang.userId, dongbang2.userId, admin.userId, logistics.userId]) {
      expectOne(
        rows,
        id,
        {
          type: NOTIFY_TYPE.vendor,
          title: NOTIFY_TITLE.cancelled(requestNo),
          body: `${user.fullName}님이 취소했습니다. 사유: 날짜 변경`
        },
        id
      );
    }
    expectNone(rows, [user.userId], '요청자');
  });

  test('AC-16: 구매물류팀이 등록한 건을 동방1이 취소 → 구매물류 요청자는 requester 1건만 · 동방2·admin 각 1건 · 동방1 0건', async () => {
    const { requestNo } = await createAs('logistics');
    await cancelAs('dongbang', requestNo);
    const rows = await rowsFor(requestNo, 'cancelled');
    const title = NOTIFY_TITLE.cancelled(requestNo);
    const body = `${dongbang.fullName}님이 취소했습니다.`;
    expectOne(rows, logistics.userId, { type: NOTIFY_TYPE.requester, title, body }, '구매물류 요청자');
    expectOne(rows, dongbang2.userId, { type: NOTIFY_TYPE.vendor, title, body }, '동방2');
    expectOne(rows, admin.userId, { type: NOTIFY_TYPE.vendor, title, body }, 'admin');
    expectNone(rows, [dongbang.userId], '행위자');
    expect(rows.filter((row) => row.recipient_user_id === logistics.userId && row.type === NOTIFY_TYPE.vendor)).toHaveLength(0);
  });

  test('AC-17: 사유 150자 취소 → 본문 길이 ≤ 120 · `…`로 끝남', async () => {
    const reason = '일정이 바뀌어 취소합니다 '.repeat(20).slice(0, 150);
    expect(reason).toHaveLength(150);
    const { requestNo } = await createAs('user');
    await cancelAs('user', requestNo, reason);
    const rows = await rowsFor(requestNo, 'cancelled');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.body.length, row.body).toBeLessThanOrEqual(120);
      expect(row.body.endsWith('…'), row.body).toBe(true);
      expect(row.body.startsWith(`${user.fullName}님이 취소했습니다. 사유: `), row.body).toBe(true);
    }
  });

  test('AC-18: 요청자 /dashboard/notifications 접수 알림 「퀵 요청 보기」 → /dashboard/quick/{번호} · 「접수 및 배차중」', async ({
    page
  }) => {
    const { requestNo } = await createAs('user');
    await acceptAs('dongbang', requestNo);
    await rowsFor(requestNo, 'accepted');

    await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
    const card = page
      .getByTestId(/^notification-card-/)
      .filter({ hasText: NOTIFY_TITLE.accepted(requestNo) })
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('동방특송이 접수해 배차를 진행하고 있습니다.');
    await card.getByRole('button', { name: '퀵 요청 보기' }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/quick/${requestNo}$`), { timeout: 30_000 });
    await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
    await expectDetailStatus(page, 'dispatching');
    await expect(page.getByTestId('quick-detail-status')).toHaveText(STATUS_LABEL.dispatching);
  });
});
