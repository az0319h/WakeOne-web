import { expect, test, type APIRequestContext } from '@playwright/test';
import { createActiveTestUser, createGuestRequestWithPassword } from '../helpers/supabase-direct-auth';
import {
  countPushSubscriptionsForUser,
  expectActivityLog,
  getPushPreferences,
  mockEndpoint,
  mockSubscriptionBody,
  PUSH_PREFERENCES_PATH,
  PUSH_SUBSCRIPTIONS_PATH,
  PUSH_TEST_PATH,
  registerMockDevice,
  renameUserAsAdmin,
  resetPushStateForUser,
  resolveUserIdByEmail
} from '../helpers/push-mock';

/**
 * plan 91 — docs/plans/91_pwa-web-push-notifications-plan.md
 * AC-05~07 · AC-11~15 · AC-19 (API · 활동 로그 · mock 전송기)
 */
test.describe.configure({ mode: 'serial' });

let userRequest: APIRequestContext;
let adminRequest: APIRequestContext;
let userBId: string;

async function unreadCount(request: APIRequestContext) {
  const response = await request.get('/api/notifications?limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data?: { notifications?: Array<{ status: string }> } };
  return body.data?.notifications?.filter((item) => item.status === 'unread').length ?? 0;
}

test.beforeAll(async ({ playwright }) => {
  userRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/user.json' });
  adminRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/admin.json' });
  userBId = await resolveUserIdByEmail(adminRequest, process.env.E2E_USER_EMAIL!);
  await resetPushStateForUser(userRequest);
});

test.afterAll(async () => {
  await resetPushStateForUser(userRequest);
  await userRequest.dispose();
  await adminRequest.dispose();
});

test.describe('구독 등록·해제 API', () => {
  const endpoint = mockEndpoint('ok');

  test('AC-05: POST subscriptions 201 → 재전송 200 멱등 · keys 누락 400 · 비로그인 401 · x-request-id · push_subscription.create 로그', async ({
    playwright
  }) => {
    const created = await registerMockDevice(userRequest, endpoint);
    expect(created.status()).toBe(201);
    const createdId = created.headers()['x-request-id'];
    expect(createdId).toBeTruthy();
    const createdBody = (await created.json()) as {
      success: boolean;
      data: { id: number; device_count: number };
    };
    expect(createdBody.success).toBe(true);
    expect(typeof createdBody.data.id).toBe('number');
    expect(createdBody.data.device_count).toBe(1);

    const again = await registerMockDevice(userRequest, endpoint);
    expect(again.status()).toBe(200);
    const againId = again.headers()['x-request-id'];
    expect(againId).toBeTruthy();
    const againBody = (await again.json()) as { data: { id: number; device_count: number } };
    expect(againBody.data.device_count).toBe(1);
    expect(againBody.data.id).toBe(createdBody.data.id);

    const invalid = await userRequest.post(PUSH_SUBSCRIPTIONS_PATH, {
      data: { endpoint: mockEndpoint('ok') }
    });
    expect(invalid.status()).toBe(400);
    const invalidId = invalid.headers()['x-request-id'];
    expect(invalidId).toBeTruthy();
    expect(((await invalid.json()) as { message: string }).message).toBe(
      '구독 정보가 올바르지 않습니다.'
    );

    const anon = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const unauthorized = await anon.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: mockSubscriptionBody(mockEndpoint('ok'))
      });
      expect(unauthorized.status()).toBe(401);
      expect(unauthorized.headers()['x-request-id']).toBeTruthy();
    } finally {
      await anon.dispose();
    }

    const log201 = await expectActivityLog(userRequest, 'push_subscription.create', createdId!, 201);
    expect(log201.metadata).toMatchObject({ created: true, device_count: 1, endpoint_host: 'e2e.invalid' });
    expect(JSON.stringify(log201.metadata)).not.toContain('/push/ok/');
    await expectActivityLog(userRequest, 'push_subscription.create', againId!, 200);
    await expectActivityLog(userRequest, 'push_subscription.create', invalidId!, 400);
  });

  test('AC-06: DELETE {endpoint} 200 device_count:0 → 재전송 404 · 타인(admin) DELETE 404 · push_subscription.delete 로그', async () => {
    // 타인 범위: admin이 user의 endpoint로 DELETE → 404 (소유자 범위 조회)
    const foreign = await adminRequest.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint } });
    expect(foreign.status()).toBe(404);
    expect(((await foreign.json()) as { message: string }).message).toBe('등록된 기기를 찾을 수 없습니다.');
    // 타인 DELETE 후에도 user 기기는 그대로
    expect((await getPushPreferences(userRequest)).device_count).toBe(1);

    const deleted = await userRequest.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint } });
    expect(deleted.status()).toBe(200);
    const deletedId = deleted.headers()['x-request-id'];
    expect(((await deleted.json()) as { data: { device_count: number } }).data.device_count).toBe(0);

    const again = await userRequest.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint } });
    expect(again.status()).toBe(404);
    const againId = again.headers()['x-request-id'];
    expect(((await again.json()) as { message: string }).message).toBe('등록된 기기를 찾을 수 없습니다.');

    const log200 = await expectActivityLog(userRequest, 'push_subscription.delete', deletedId!, 200);
    expect(log200.metadata).toMatchObject({ device_count: 0, endpoint_host: 'e2e.invalid' });
    await expectActivityLog(userRequest, 'push_subscription.delete', againId!, 404);
    await expectActivityLog(adminRequest, 'push_subscription.delete', foreign.headers()['x-request-id']!, 404);
  });
});

test.describe('그룹 설정 API', () => {
  test('AC-07: GET 기본값 → PUT ["announcement"] → GET 반영 → PUT ["nope"] 400 · push_preference.update 로그 · admin groups 9개', async () => {
    const initial = await getPushPreferences(userRequest);
    expect(initial.configured).toBe(true);
    expect(initial.disabled_groups).toEqual([]);
    expect(initial.device_count).toBe(0);
    expect(initial.devices).toEqual([]);
    // plan 103 — 「구독·비품 요청」(asset_request) 그룹 추가로 user 9 · admin 10
    expect(initial.groups).toHaveLength(9);
    expect(initial.groups.map((g) => g.key)).not.toContain('users');

    const updated = await userRequest.put(PUSH_PREFERENCES_PATH, {
      data: { disabled_groups: ['announcement'] }
    });
    expect(updated.status()).toBe(200);
    const updatedId = updated.headers()['x-request-id'];
    expect(updatedId).toBeTruthy();

    expect((await getPushPreferences(userRequest)).disabled_groups).toEqual(['announcement']);

    const invalid = await userRequest.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: ['nope'] } });
    expect(invalid.status()).toBe(400);
    expect(((await invalid.json()) as { message: string }).message).toBe('알림 종류가 올바르지 않습니다.');

    const log = await expectActivityLog(userRequest, 'push_preference.update', updatedId!, 200);
    expect(log.metadata).toMatchObject({ disabled_groups: ['announcement'] });
    await expectActivityLog(userRequest, 'push_preference.update', invalid.headers()['x-request-id']!, 400);

    const adminPrefs = await getPushPreferences(adminRequest);
    expect(adminPrefs.groups).toHaveLength(10);
    expect(adminPrefs.groups.map((g) => g.key)).toContain('users');

    const reset = await userRequest.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: [] } });
    expect(reset.status()).toBe(200);
  });
});

test.describe('테스트 발송 · mock 전송기', () => {
  test('AC-11: 구독 없음 → POST test 409 · push.test_send 로그 409', async () => {
    expect((await getPushPreferences(userRequest)).device_count).toBe(0);
    const response = await userRequest.post(PUSH_TEST_PATH);
    expect(response.status()).toBe(409);
    expect(((await response.json()) as { message: string }).message).toBe(
      '등록된 기기가 없습니다. 먼저 알림을 켜 주세요.'
    );
    await expectActivityLog(userRequest, 'push.test_send', response.headers()['x-request-id']!, 409);
  });

  test('AC-12: ok 1 + 410 1 → POST test {attempted:2, sent:1, removed:1} · device_count 1 · last_used_at 갱신 · 로그 200', async () => {
    const okEndpoint = mockEndpoint('ok');
    expect((await registerMockDevice(userRequest, okEndpoint, 'E2E ok device')).status()).toBe(201);
    expect((await registerMockDevice(userRequest, mockEndpoint('410'), 'E2E gone device')).status()).toBe(201);
    expect((await getPushPreferences(userRequest)).device_count).toBe(2);

    const response = await userRequest.post(PUSH_TEST_PATH);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { attempted: number; sent: number; removed: number };
    };
    expect(body.data).toEqual({ attempted: 2, sent: 1, removed: 1 });

    const after = await getPushPreferences(userRequest);
    expect(after.device_count).toBe(1);
    expect(after.devices).toHaveLength(1);
    expect(after.devices[0].user_agent).toBe('E2E ok device');
    expect(after.devices[0].last_used_at).not.toBeNull();

    const log = await expectActivityLog(userRequest, 'push.test_send', response.headers()['x-request-id']!, 200);
    expect(log.metadata).toMatchObject({ attempted: 2, sent: 1, removed: 1 });

    // 다음 테스트(AC-13)를 위해 ok 기기 1대는 남겨 둔다
  });
});

test.describe('발송 파이프라인 (insertNotifications → after → dispatchPush)', () => {
  test('AC-13: admin이 B 이름 변경 → B 구독 last_used_at 갱신(발송 1회) · 인앱 알림 「프로필 정보가 변경되었습니다」 생성', async () => {
    const before = await getPushPreferences(userRequest);
    expect(before.device_count).toBe(1);
    expect(before.disabled_groups).toEqual([]);
    const beforeUsed = before.devices[0].last_used_at;

    await userRequest.patch('/api/notifications/read-all');
    // last_used_at 비교가 밀리초 단위로 구분되도록 잠깐 대기
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const startedAt = Date.now();
    await renameUserAsAdmin(adminRequest, userBId, `E2E푸시AC13-${Date.now()}`);

    await expect
      .poll(
        async () => (await getPushPreferences(userRequest)).devices[0]?.last_used_at ?? null,
        { timeout: 15_000, intervals: [200, 300, 500, 1000] }
      )
      .not.toBe(beforeUsed);
    const elapsedMs = Date.now() - startedAt;
    test.info().annotations.push({ type: 'dispatch-latency-ms', description: String(elapsedMs) });

    const after = await getPushPreferences(userRequest);
    expect(after.devices[0].last_used_at).not.toBeNull();
    expect(new Date(after.devices[0].last_used_at!).getTime()).toBeGreaterThan(startedAt - 2000);

    const list = await userRequest.get('/api/notifications?limit=5');
    const body = (await list.json()) as {
      data?: { notifications?: Array<{ title: string; status: string; type: string }> };
    };
    const latest = body.data?.notifications?.[0];
    expect(latest?.type).toBe('user.update');
    expect(latest?.title).toBe('프로필 정보가 변경되었습니다');
    expect(latest?.status).toBe('unread');
  });

  test('AC-14: B가 profile 그룹 OFF → admin 이름 재변경 → last_used_at 불변 · 인앱 알림은 생성', async () => {
    const put = await userRequest.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: ['profile'] } });
    expect(put.status()).toBe(200);

    const before = await getPushPreferences(userRequest);
    expect(before.device_count).toBe(1);
    const beforeUsed = before.devices[0].last_used_at;
    expect(beforeUsed).not.toBeNull();

    await userRequest.patch('/api/notifications/read-all');
    expect(await unreadCount(userRequest)).toBe(0);

    await renameUserAsAdmin(adminRequest, userBId, `E2E푸시AC14-${Date.now()}`);

    // 인앱 알림은 생성된다 (설정은 푸시만 막는다)
    await expect.poll(async () => unreadCount(userRequest), { timeout: 15_000 }).toBeGreaterThan(0);
    // after() 발송 창(AC-13 지연 기준)보다 충분히 기다린 뒤 불변 확인
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const after = await getPushPreferences(userRequest);
    expect(after.devices[0].last_used_at).toBe(beforeUsed);

    const reset = await userRequest.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: [] } });
    expect(reset.status()).toBe(200);
  });

  test('AC-15: 구독 2개인 사용자 비활성화 → push_subscriptions 0 · user.deactivate 로그 · 재활성화 후 복구 안 됨', async ({
    playwright
  }) => {
    const disposable = await createActiveTestUser('push-ac15', {
      fullName: `E2E 푸시AC15 ${Date.now()}`
    });
    const disposableRequest = await createGuestRequestWithPassword(
      playwright,
      disposable.email,
      disposable.password
    );
    try {
      expect((await registerMockDevice(disposableRequest, mockEndpoint('ok'), 'E2E AC15 d1')).status()).toBe(201);
      expect((await registerMockDevice(disposableRequest, mockEndpoint('ok'), 'E2E AC15 d2')).status()).toBe(201);
      expect(await countPushSubscriptionsForUser(disposable.userId)).toBe(2);

      const deactivate = await adminRequest.delete(`/api/users/${disposable.userId}`);
      expect(deactivate.status()).toBe(200);
      const requestId = deactivate.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      expect(await countPushSubscriptionsForUser(disposable.userId)).toBe(0);
      await expectActivityLog(adminRequest, 'user.deactivate', requestId!, 200);

      const reactivate = await adminRequest.patch(`/api/users/${disposable.userId}`, {
        data: { action: 'reactivate' }
      });
      expect(reactivate.status()).toBe(200);
      expect(await countPushSubscriptionsForUser(disposable.userId)).toBe(0);
    } finally {
      await disposableRequest.dispose();
    }
  });
});

test.describe('동방특송 allowlist', () => {
  test('AC-19: dongbang.json GET preferences 200 (proxy 403 아님)', async ({ playwright }) => {
    const dongbangRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/dongbang.json'
    });
    try {
      const response = await dongbangRequest.get(PUSH_PREFERENCES_PATH);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { success: boolean; data: { configured: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.configured).toBe(true);
    } finally {
      await dongbangRequest.dispose();
    }
  });
});
