import { expect, test } from '@playwright/test';
import {
  activeManagerIds,
  changeStatusViaApi,
  createEquipmentFixture,
  createRequestViaApi,
  createSubscriptionFixture,
  expectApiError,
  json,
  MSG,
  notificationsForRequest,
  pageAs,
  postCommentViaApi,
  uniqueTag,
  UI_TIMEOUT,
  userIdOf,
  waitNotifications,
  withApi,
  type NotificationRow
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-39 요청 생성 알림(권한자 전원) · AC-40 댓글 알림(담당자 전/후) · AC-41 담당자 지정 알림
 * AC-42 알림 클릭 이동 · AC-43 푸시 그룹 「구독·비품 요청」
 * 푸시는 mock 전송기(.env E2E_WEB_PUSH_MOCK=1) · 메일 없음.
 */

const CREATED_METADATA_KEYS = ['kind', 'asset_request_id', 'asset_target_type', 'request_type'];
const ALLOWED_METADATA_KEYS = [...CREATED_METADATA_KEYS, 'previous_status', 'new_status', 'comment_id', 'is_reply'];

function recipients(rows: NotificationRow[]): string[] {
  return rows.map((row) => row.recipient_user_id).sort();
}

function byComment(rows: NotificationRow[], commentId: number): NotificationRow[] {
  return rows.filter((row) => String(row.metadata?.comment_id) === String(commentId));
}

/** 권한자 집합이 테스트 중(다른 세션의 일회용 hr 계정 등)으로 바뀌어도 판정이 흔들리지 않게 전후 교집합/합집합으로 비교 */
function expectManagerRecipients(actual: string[], before: string[], after: string[], exclude: string[] = []) {
  const union = new Set([...before, ...after].filter((id) => !exclude.includes(id)));
  const intersection = before.filter((id) => after.includes(id) && !exclude.includes(id));
  expect(new Set(actual).size, '중복 수신 없음').toBe(actual.length);
  for (const id of actual) expect(union.has(id), `수신자 ${id}는 active 권한자`).toBe(true);
  for (const id of intersection) expect(actual, `권한자 ${id} 수신`).toContain(id);
}

async function newEquipmentRequest(playwright: Parameters<typeof withApi>[0], tag: string) {
  const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 알림 모니터` });
  return withApi(playwright, 'staff', (api) =>
    createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id, body: `E2E ${tag} 비밀 본문` })
  );
}

test.describe('plan 103 · 알림 · 푸시 그룹', () => {
  test('AC-39: 직원 요청 생성 → asset_request.created = active 권한자 전원 · 본인·직원·동방 0 · metadata 키 ⊆ {kind, asset_request_id, asset_target_type, request_type}', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const before = await activeManagerIds();
    const request = await newEquipmentRequest(playwright, tag);
    const after = await activeManagerIds();

    const minimum = before.filter((id) => after.includes(id)).length;
    const rows = await waitNotifications(request.id, 'asset_request.created', (items) => items.length >= minimum);
    const actual = recipients(rows);
    expectManagerRecipients(actual, before, after);
    for (const role of ['admin', 'hr', 'accounting'] as const) expect(actual).toContain(userIdOf(role));
    for (const role of ['staff', 'teammate', 'other', 'dongbang'] as const) expect(actual).not.toContain(userIdOf(role));
    for (const row of rows) {
      const keys = Object.keys(row.metadata ?? {});
      expect(keys.every((key) => CREATED_METADATA_KEYS.includes(key)), `metadata keys ${keys.join(',')}`).toBe(true);
      expect(row.metadata?.asset_request_id).toBeTruthy();
      expect(`${row.title} ${row.body ?? ''} ${JSON.stringify(row.metadata)}`).not.toContain('비밀 본문');
    }
    expect(rows[0]?.title).toBe('새 비품 요청');
  });

  test('AC-40: ① 처리 전 직원 댓글 → 권한자 전원 ② 처리 시작 → 직원 status_changed ③ 직원 댓글 → 담당자 hr만 ④ hr 댓글 → 직원만 · 글쓴이 0', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const request = await newEquipmentRequest(playwright, tag);
    const staffId = userIdOf('staff');
    const hrId = userIdOf('hr');

    // ①
    const before = await activeManagerIds();
    const c1 = await withApi(playwright, 'staff', (api) => postCommentViaApi(api, request.id, `E2E ${tag} 첫 댓글`));
    const after = await activeManagerIds();
    const minimum = before.filter((id) => after.includes(id)).length;
    const first = byComment(
      await waitNotifications(request.id, 'asset_request.comment_created', (rows) => byComment(rows, c1.id).length >= minimum),
      c1.id
    );
    expectManagerRecipients(recipients(first), before, after);
    expect(recipients(first)).not.toContain(staffId);

    // ②
    await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, request.id, 'in_progress'));
    const status = await waitNotifications(request.id, 'asset_request.status_changed', (rows) => rows.length >= 1);
    expect(recipients(status)).toEqual([staffId]);
    expect(status[0].metadata?.new_status).toBe('in_progress');

    // ③
    const c3 = await withApi(playwright, 'staff', (api) => postCommentViaApi(api, request.id, `E2E ${tag} 담당자에게`));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const third = byComment(await notificationsForRequest(request.id, 'asset_request.comment_created'), c3.id);
    expect(recipients(third), '담당자(hr)에게만').toEqual([hrId]);

    // ④
    const c4 = await withApi(playwright, 'hr', (api) => postCommentViaApi(api, request.id, `E2E ${tag} 요청자에게`));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const fourth = byComment(await notificationsForRequest(request.id, 'asset_request.comment_created'), c4.id);
    expect(recipients(fourth), '요청자(직원)에게만').toEqual([staffId]);

    for (const row of [...first, ...status, ...third, ...fourth]) {
      const keys = Object.keys(row.metadata ?? {});
      expect(keys.every((key) => ALLOWED_METADATA_KEYS.includes(key)), `metadata keys ${keys.join(',')}`).toBe(true);
    }
  });

  test('AC-41: 회계팀이 담당자를 자신 → 다시 hr로 변경 → hr에게 assigned 1건 · 자기 선택 0 · 직원 0', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const request = await newEquipmentRequest(playwright, tag);
    await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, request.id, 'in_progress'));

    await withApi(playwright, 'accounting', async (api) => {
      const toSelf = await api.patch(`/api/asset-requests/${request.id}/assignee`, {
        data: { assignee_user_id: userIdOf('accounting') }
      });
      expect(toSelf.status()).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(await notificationsForRequest(request.id, 'asset_request.assigned'), '자기 자신 선택은 알림 0').toHaveLength(0);

      const toHr = await api.patch(`/api/asset-requests/${request.id}/assignee`, {
        data: { assignee_user_id: userIdOf('hr') }
      });
      expect(toHr.status()).toBe(200);
    });
    const assigned = await waitNotifications(request.id, 'asset_request.assigned', (rows) => rows.length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const final = await notificationsForRequest(request.id, 'asset_request.assigned');
    expect(recipients(final)).toEqual([userIdOf('hr')]);
    expect(assigned[0].title).toBe('요청 담당자로 지정됐어요');
    expect(recipients(final)).not.toContain(userIdOf('staff'));
  });

  test('AC-42: 직원 알림 카드 「요청 보기」 → /dashboard/equipment?view=requests&request={id} · 요청 Dialog 자동 열림 (구독은 /dashboard/subscriptions)', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipmentRequest = await newEquipmentRequest(playwright, tag);
    const subscriptionId = await createSubscriptionFixture({ name: `E2E ${tag} 알림 구독` });
    const subscriptionRequest = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'subscription', target_id: subscriptionId, request_type: 'cancel' })
    );
    await withApi(playwright, 'hr', async (api) => {
      await changeStatusViaApi(api, equipmentRequest.id, 'in_progress');
      await changeStatusViaApi(api, subscriptionRequest.id, 'in_progress');
    });
    const [equipmentNotification] = await waitNotifications(
      equipmentRequest.id,
      'asset_request.status_changed',
      (rows) => rows.length >= 1
    );
    const [subscriptionNotification] = await waitNotifications(
      subscriptionRequest.id,
      'asset_request.status_changed',
      (rows) => rows.length >= 1
    );

    const { context, page } = await pageAs(browser, 'staff');
    try {
      for (const [notification, path, requestId, dialogTestId] of [
        [equipmentNotification, '/dashboard/equipment', equipmentRequest.id, 'equipment-detail-dialog'],
        [subscriptionNotification, '/dashboard/subscriptions', subscriptionRequest.id, 'subscription-detail-dialog']
      ] as const) {
        await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: UI_TIMEOUT });
        const card = page.getByTestId(`notification-card-${notification.id}`);
        await expect(card).toBeVisible({ timeout: UI_TIMEOUT });
        await card.getByRole('button', { name: '요청 보기', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${path}\\?(?=.*view=requests)(?=.*request=${requestId}(&|$)).*$`), {
          timeout: UI_TIMEOUT
        });
        const url = new URL(page.url());
        expect(url.pathname).toBe(path);
        expect(url.searchParams.get('view')).toBe('requests');
        expect(url.searchParams.get('request')).toBe(String(requestId));
        await expect(page.getByTestId(dialogTestId).getByTestId('asset-request-detail')).toBeVisible({
          timeout: UI_TIMEOUT
        });
      }
    } finally {
      await context.close();
    }
  });

  test('AC-43: 푸시 그룹 — 직원 groups에 asset_request 「구독·비품 요청」 · PUT 200 / 동방 groups에 없음 · PUT 400 「알림 종류가 올바르지 않습니다.」', async ({
    playwright
  }) => {
    type Prefs = { groups: Array<{ key: string; label: string }>; disabled_groups: string[] };
    await withApi(playwright, 'staff', async (api) => {
      const response = await api.get('/api/notifications/push/preferences');
      expect(response.status()).toBe(200);
      const prefs = (await json<{ data: Prefs }>(response)).data;
      const group = prefs.groups.find((item) => item.key === 'asset_request');
      expect(group, 'asset_request 그룹').toBeTruthy();
      expect(group?.label).toBe('구독·비품 요청');

      const put = await api.put('/api/notifications/push/preferences', { data: { disabled_groups: ['asset_request'] } });
      expect(put.status()).toBe(200);
      const after = (await json<{ data: Prefs }>(await api.get('/api/notifications/push/preferences'))).data;
      expect(after.disabled_groups).toEqual(['asset_request']);
      expect((await api.put('/api/notifications/push/preferences', { data: { disabled_groups: [] } })).status()).toBe(200);
    });

    await withApi(playwright, 'dongbang', async (api) => {
      const response = await api.get('/api/notifications/push/preferences');
      expect(response.status()).toBe(200);
      const prefs = (await json<{ data: Prefs }>(response)).data;
      expect(prefs.groups.map((item) => item.key)).not.toContain('asset_request');
      await expectApiError(
        await api.put('/api/notifications/push/preferences', { data: { disabled_groups: ['asset_request'] } }),
        400,
        MSG.invalidPushGroup
      );
    });
  });
});
