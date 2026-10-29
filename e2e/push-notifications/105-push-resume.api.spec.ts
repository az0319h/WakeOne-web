import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { e2eBaseURL } from '../helpers/auth-request';
import {
  getE2eServiceRoleClient,
  mockEndpoint,
  mockSubscriptionBody,
  PUSH_SUBSCRIPTIONS_PATH,
  registerMockDevice
} from '../helpers/push-mock';
import { PUSH_DETACH_PATH } from '../helpers/push-browser-stub';
import { createActiveTestUser, createGuestRequestWithPassword } from '../helpers/supabase-direct-auth';

/**
 * plan 105 — docs/plans/105_push-resume-after-relogin-plan.md
 * AC-08(detach API) · AC-14(auto_resume 409 가드) · AC-17(source 검증·metadata) — API · 활동 로그
 *
 * - 일회용 계정(A·B)은 로그아웃하지 않는다(request context만). 계정·로그 정리는 globalTeardown / `npm run e2e:cleanup`.
 * - admin.json은 비활성화·재활성화 Route 호출에만 쓴다(두 Route는 메일을 보내지 않는다 — 코드 확인).
 * - 메일 발송 Route는 호출하지 않는다.
 */
test.describe.configure({ mode: 'serial' });

const INVALID_MESSAGE = '구독 정보가 올바르지 않습니다.';
const DEACTIVATED_MESSAGE = '계정이 비활성화된 적이 있어 휴대폰 알림을 자동으로 다시 켜지 않았어요.';
const OWNED_BY_OTHER_MESSAGE = '이 기기는 다른 계정이 알림을 켜 두어서 자동으로 다시 켜지 않았어요.';

type LogRow = {
  action: string;
  http_status: number;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
};

async function logByRequestId(requestId: string): Promise<LogRow> {
  const admin = getE2eServiceRoleClient();
  let row: LogRow | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from('activity_logs')
          .select('action, http_status, actor_user_id, target_user_id, metadata')
          .eq('request_id', requestId)
          .maybeSingle();
        row = data as LogRow | null;
        return Boolean(data);
      },
      { timeout: 15_000 }
    )
    .toBe(true);
  return row!;
}

async function rowsByEndpoint(endpoint: string) {
  const { data, error } = await getE2eServiceRoleClient()
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function expectJsonMessage(response: APIResponse, status: number, message: string) {
  expect(response.status()).toBe(status);
  const body = (await response.json()) as { success?: boolean; message?: string };
  expect(body.success).toBe(false);
  expect(body.message).toBe(message);
}

function requestIdOf(response: APIResponse) {
  const id = response.headers()['x-request-id'];
  expect(id, 'x-request-id').toBeTruthy();
  return id!;
}

const userIds: string[] = [];

test.afterAll(async () => {
  const admin = getE2eServiceRoleClient();
  for (const id of userIds) {
    await admin.from('push_subscriptions').delete().eq('user_id', id);
  }
});

test.describe('plan 105 detach API', () => {
  test('AC-08: detach ① body 없음 400 ② http URL 400 ③ 본인 endpoint 200 mine(행 유지) ④ 없는 endpoint 200 none ⑤ 비로그인 401 · ①~④ x-request-id · detach 로그(400·400·200·200)', async ({
    playwright
  }) => {
    const b = await createActiveTestUser('p105-api-b', { fullName: `E2E 푸시복구105API-B ${Date.now()}` });
    userIds.push(b.userId);
    const requestB = await createGuestRequestWithPassword(playwright, b.email, b.password);
    // project 기본 storageState(user.json)를 물려받지 않도록 빈 상태를 명시한다
    const anonymous = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      // ① body 없음
      const r1 = await requestB.post(PUSH_DETACH_PATH);
      await expectJsonMessage(r1, 400, INVALID_MESSAGE);
      const id1 = requestIdOf(r1);

      // ② http URL
      const r2 = await requestB.post(PUSH_DETACH_PATH, { data: { endpoint: 'http://x' } });
      await expectJsonMessage(r2, 400, INVALID_MESSAGE);
      const id2 = requestIdOf(r2);

      // ③ 본인 등록 endpoint
      const own = mockEndpoint('ok');
      expect((await registerMockDevice(requestB, own, 'E2E p105 AC08')).status()).toBe(201);
      const r3 = await requestB.post(PUSH_DETACH_PATH, { data: { endpoint: own } });
      expect(r3.status()).toBe(200);
      expect(((await r3.json()) as { data?: { result?: string } }).data?.result).toBe('mine');
      const id3 = requestIdOf(r3);
      expect((await rowsByEndpoint(own)).map((r) => r.user_id)).toEqual([b.userId]);

      // ④ 어디에도 없는 endpoint
      const r4 = await requestB.post(PUSH_DETACH_PATH, { data: { endpoint: mockEndpoint('ok') } });
      expect(r4.status()).toBe(200);
      const body4 = (await r4.json()) as { data?: { result?: string; previous_owner_hash?: string } };
      expect(body4.data?.result).toBe('none');
      expect(body4.data?.previous_owner_hash).toBeUndefined();
      const id4 = requestIdOf(r4);

      // ⑤ 비로그인 — proxy 가드 401 (plan 92 OQ-4: x-request-id·로그 없음 → 상태 코드만 판정)
      const r5 = await anonymous.post(PUSH_DETACH_PATH, { data: { endpoint: own } });
      expect(r5.status()).toBe(401);

      const expected: Array<[string, number, string | undefined]> = [
        [id1, 400, undefined],
        [id2, 400, undefined],
        [id3, 200, 'mine'],
        [id4, 200, 'none']
      ];
      for (const [requestId, status, result] of expected) {
        const log = await logByRequestId(requestId);
        expect(log.action).toBe('push_subscription.detach');
        expect(log.http_status).toBe(status);
        expect(log.actor_user_id).toBe(b.userId);
        if (result) {
          expect(log.metadata?.result).toBe(result);
          expect(log.metadata?.endpoint_host).toBe('e2e.invalid');
          expect(log.target_user_id).toBe(b.userId);
        }
        expect(JSON.stringify(log.metadata ?? {})).not.toContain('https://e2e.invalid/push');
      }
    } finally {
      await requestB.dispose();
      await anonymous.dispose();
    }
  });
});

test.describe('plan 105 auto_resume 가드', () => {
  test('AC-14: ① 비활성화·재활성화 후 marker T0 → 409 deactivated ② marker 재활성화 이후 → 201 ③ marker 누락 400 ④ B 소유 endpoint → 409 owned_by_other(행 B 유지) · 로그 source auto_resume · reason', async ({
    playwright
  }) => {
    const stamp = Date.now();
    const a = await createActiveTestUser('p105-api-a', { fullName: `E2E 푸시복구105API-A ${stamp}` });
    const b = await createActiveTestUser('p105-api-b2', { fullName: `E2E 푸시복구105API-B2 ${stamp}` });
    userIds.push(a.userId, b.userId);
    const adminRequest: APIRequestContext = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: 'e2e/.auth/admin.json'
    });
    const requestB = await createGuestRequestWithPassword(playwright, b.email, b.password);
    let requestA: APIRequestContext | null = null;
    try {
      const deactivate = await adminRequest.delete(`/api/users/${a.userId}`);
      expect(deactivate.status()).toBe(200);
      const reactivate = await adminRequest.patch(`/api/users/${a.userId}`, { data: { action: 'reactivate' } });
      expect(reactivate.status()).toBe(200);

      // 활동 로그는 응답 뒤에 기록될 수 있다(dev 부하 시 수 초 지연) → user.deactivate 행이 생길 때까지 기다리고,
      // ②의 「재활성화 이후 시각」은 로컬 시계가 아니라 그 로그의 서버 created_at 기준으로 잡는다.
      const deactivateLog = await logByRequestId(requestIdOf(deactivate));
      expect(deactivateLog.action).toBe('user.deactivate');
      expect(deactivateLog.target_user_id).toBe(a.userId);
      const { data: deactivateRow } = await getE2eServiceRoleClient()
        .from('activity_logs')
        .select('created_at')
        .eq('request_id', requestIdOf(deactivate))
        .single();
      const deactivatedAt = new Date(String(deactivateRow?.created_at));
      expect(Number.isNaN(deactivatedAt.getTime())).toBe(false);
      // T0 = 비활성화 1초 전(로그아웃 때 표시를 남긴 시각 흉내 · 서버 시계 기준)
      const t0 = new Date(deactivatedAt.getTime() - 1_000).toISOString();

      // 재활성화 후 A 새 세션
      requestA = await createGuestRequestWithPassword(playwright, a.email, a.password);

      // ① marker = T0(비활성화 이전) → 409
      const endpoint1 = mockEndpoint('ok');
      const r1 = await requestA.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: { ...mockSubscriptionBody(endpoint1, 'E2E p105 AC14'), source: 'auto_resume', resume_marker_at: t0 }
      });
      await expectJsonMessage(r1, 409, DEACTIVATED_MESSAGE);
      const log1 = await logByRequestId(requestIdOf(r1));
      expect(log1.action).toBe('push_subscription.create');
      expect(log1.http_status).toBe(409);
      expect(log1.metadata?.source).toBe('auto_resume');
      expect(log1.metadata?.reason).toBe('deactivated_after_marker');
      expect(await rowsByEndpoint(endpoint1)).toHaveLength(0);

      // ② marker = 재활성화 이후 → 201
      const afterReactivate = new Date(deactivatedAt.getTime() + 1_000).toISOString();
      const r2 = await requestA.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: {
          ...mockSubscriptionBody(endpoint1, 'E2E p105 AC14'),
          source: 'auto_resume',
          resume_marker_at: afterReactivate
        }
      });
      expect(r2.status()).toBe(201);
      const log2 = await logByRequestId(requestIdOf(r2));
      expect(log2.http_status).toBe(201);
      expect(log2.metadata?.source).toBe('auto_resume');
      expect((await rowsByEndpoint(endpoint1)).map((r) => r.user_id)).toEqual([a.userId]);

      // ③ auto_resume + marker 누락 → 400
      const r3 = await requestA.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: { ...mockSubscriptionBody(mockEndpoint('ok'), 'E2E p105 AC14'), source: 'auto_resume' }
      });
      await expectJsonMessage(r3, 400, INVALID_MESSAGE);
      const log3 = await logByRequestId(requestIdOf(r3));
      expect(log3.http_status).toBe(400);
      expect(log3.metadata?.source).toBe('auto_resume');

      // ④ B가 등록해 둔 endpoint를 A가 auto_resume → 409 · 행 B 유지
      const endpointB = mockEndpoint('ok');
      expect((await registerMockDevice(requestB, endpointB, 'E2E p105 AC14 B')).status()).toBe(201);
      const r4 = await requestA.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: {
          ...mockSubscriptionBody(endpointB, 'E2E p105 AC14'),
          source: 'auto_resume',
          resume_marker_at: new Date().toISOString()
        }
      });
      await expectJsonMessage(r4, 409, OWNED_BY_OTHER_MESSAGE);
      expect((await rowsByEndpoint(endpointB)).map((r) => r.user_id)).toEqual([b.userId]);
      const log4 = await logByRequestId(requestIdOf(r4));
      expect(log4.http_status).toBe(409);
      expect(log4.metadata?.source).toBe('auto_resume');
      expect(log4.metadata?.reason).toBe('owned_by_other');
    } finally {
      await requestA?.dispose();
      await requestB.dispose();
      await adminRequest.dispose();
    }
  });
});

test.describe('plan 105 source 검증 (user.json · 로그아웃 없음)', () => {
  test("AC-17: source 'nope' POST·DELETE 400 · source 없이 POST 201 / DELETE 200 · 로그 metadata source 'manual'", async ({
    playwright
  }) => {
    const userRequest = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: 'e2e/.auth/user.json'
    });
    const endpoint = mockEndpoint('ok');
    try {
      const badPost = await userRequest.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: { ...mockSubscriptionBody(endpoint, 'E2E p105 AC17'), source: 'nope' }
      });
      await expectJsonMessage(badPost, 400, INVALID_MESSAGE);
      expect(await rowsByEndpoint(endpoint)).toHaveLength(0);

      const post = await userRequest.post(PUSH_SUBSCRIPTIONS_PATH, {
        data: mockSubscriptionBody(endpoint, 'E2E p105 AC17')
      });
      expect(post.status()).toBe(201);
      const postLog = await logByRequestId(requestIdOf(post));
      expect(postLog.action).toBe('push_subscription.create');
      expect(postLog.metadata?.source).toBe('manual');

      const badDelete = await userRequest.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint, source: 'nope' } });
      await expectJsonMessage(badDelete, 400, INVALID_MESSAGE);
      expect(await rowsByEndpoint(endpoint)).toHaveLength(1);

      const del = await userRequest.delete(PUSH_SUBSCRIPTIONS_PATH, { data: { endpoint } });
      expect(del.status()).toBe(200);
      const deleteLog = await logByRequestId(requestIdOf(del));
      expect(deleteLog.action).toBe('push_subscription.delete');
      expect(deleteLog.metadata?.source).toBe('manual');
      expect(await rowsByEndpoint(endpoint)).toHaveLength(0);
    } finally {
      await getE2eServiceRoleClient().from('push_subscriptions').delete().eq('endpoint', endpoint);
      await userRequest.dispose();
    }
  });
});
