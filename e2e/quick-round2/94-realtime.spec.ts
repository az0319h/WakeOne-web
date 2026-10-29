import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createAs,
  dbChatNotifications,
  dbQuickRequest,
  fixtureUser,
  gotoDashboard,
  listActiveDongbangIds,
  pageAs,
  uniqueTag
} from '../quick-workflow/helpers';
import {
  expectNoReload,
  expectSetEqual,
  gotoChat,
  markNoReload,
  messageBubble,
  postMessageAs,
  sendMessageAs,
  waitForSubscribed
} from '../quick-chat/helpers';
import {
  NO_REALTIME_WAIT_MS,
  POLLING_TIMEOUT_MS,
  SRC_ROOT,
  SUBSCRIBE_SETTLE_MS,
  TEXT,
  grepDir,
  readSource,
  subscribePrivateTopicAs
} from './helpers';

/**
 * plan 94 §A 실시간 — docs/plans/94_quick-realtime-and-small-fixes-plan.md
 * AC-01(vercel.json) · AC-02(after() 알림) · AC-03(postgres_changes 0건) · AC-07(topic 권한) · AC-09(WebSocket 차단 → 폴링)
 * AC-05·06은 e2e/quick-workflow/realtime.spec.ts(92 AC-19·20) · AC-08은 e2e/quick-chat 회귀로 판정한다.
 * AC-04(SQL)·AC-10(수동 QA)은 spec 밖.
 */
test.describe('plan 94 A. 실시간 (Vercel region · after() · Broadcast · 폴링)', () => {
  test.describe.configure({ timeout: 150_000 });

  test('AC-01: vercel.json — JSON 파싱 · regions = ["icn1"] · 그 밖의 설정 키 없음($schema 제외)', async () => {
    const raw = fs.readFileSync(path.join(SRC_ROOT, 'vercel.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.regions).toEqual(['icn1']);
    const keys = Object.keys(parsed).filter((key) => key !== '$schema');
    expect(keys, 'regions 외 설정 키 없음').toEqual(['regions']);
  });

  test('AC-02: POST …/messages 201 → 1초 안 dev DB chat_message 알림(active 동방 전원) · 응답에 recipientCount 없음 · Route는 after() 안에서만 알림 호출', async () => {
    // grep — `notifyQuickRequestChatMessage`는 `after(` 콜백 안 · `await notifyQuickRequestChatMessage` 0건
    const route = readSource('src/app/api/quick-request/[requestNo]/messages/route.ts');
    expect(route.includes('await notifyQuickRequestChatMessage'), 'await notifyQuickRequestChatMessage 0건').toBe(false);
    const afterIndex = route.search(/^\s*after\(\(\) =>/m);
    const notifyCallIndex = route.indexOf('notifyQuickRequestChatMessage({');
    expect(afterIndex, 'after( 존재').toBeGreaterThan(-1);
    expect(notifyCallIndex, '알림 호출은 after( 뒤').toBeGreaterThan(afterIndex);
    expect(route.slice(afterIndex, notifyCallIndex)).not.toContain('return ');

    const dongbangIds = await listActiveDongbangIds();
    expect(dongbangIds.length, 'active 동방 1명 이상').toBeGreaterThanOrEqual(1);
    const { requestNo } = await createAs('user', uniqueTag('E2E94AFT'));
    // 워밍업 1회(dev 서버 모듈 컴파일) — 판정은 두 번째 전송
    await sendMessageAs('user', requestNo, '워밍업');

    const result = await postMessageAs('user', requestNo, { body: '즉시 응답 확인' });
    const respondedAt = Date.now();
    expect(result.status).toBe(201);
    expect(result.headers['x-request-id']).toBeTruthy();
    const data = result.body.data as { message: { id: number } } & Record<string, unknown>;
    expect(Object.keys(data).sort(), '응답 body는 message만').toEqual(['message']);
    expect('recipientCount' in data).toBe(false);
    expect('recipient_count' in data).toBe(false);

    let rows: Awaited<ReturnType<typeof dbChatNotifications>> = [];
    await expect
      .poll(
        async () => {
          rows = await dbChatNotifications(requestNo, data.message.id);
          return rows.length;
        },
        { timeout: 1_000, intervals: [50, 100, 100, 150, 200, 250, 250], message: '201 후 1초 안 알림 insert' }
      )
      .toBeGreaterThanOrEqual(1);
    const elapsed = Date.now() - respondedAt;
    expect(elapsed, `알림 반영 ${elapsed}ms ≤ 1,000ms`).toBeLessThanOrEqual(1_000);
    await expect
      .poll(async () => (await dbChatNotifications(requestNo, data.message.id)).length, { timeout: 5_000 })
      .toBe(dongbangIds.length);
    rows = await dbChatNotifications(requestNo, data.message.id);
    expectSetEqual(new Set(rows.map((row) => row.recipient_user_id)), dongbangIds, '요청자 메시지 → active 동방 전원');
  });

  test('AC-03: grep — postgres_changes 0건(features/quick-request · app/dashboard/quick) · private: true ≥ 1 · 공용 훅 파일 존재', async () => {
    const legacy = [
      ...grepDir('src/features/quick-request', 'postgres_changes'),
      ...grepDir('src/app/dashboard/quick', 'postgres_changes')
    ];
    expect(legacy, 'postgres_changes 0건').toEqual([]);
    expect(grepDir('src/features/quick-request', 'private: true').length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(SRC_ROOT, 'src/features/quick-request/lib/use-quick-realtime-channel.ts'))).toBe(true);
  });

  test('AC-07: user2 「퀵 대화」·대시보드를 열어 둔 채 user 건 메시지·등록 → 8초 동안 0건 · user2 세션 quick-request:{user 건} private 구독 CHANNEL_ERROR(본인 quick-user 토픽은 SUBSCRIBED)', async ({
    browser
  }) => {
    const user2 = await fixtureUser('user2');
    const target = await createAs('user', uniqueTag('E2E94RLS'));
    const targetId = (await dbQuickRequest(target.requestNo)).id;

    // 1) topic 권한 — Node supabase-js로 user2 세션 private 채널 구독 (plan의 page.evaluate와 같은 판정: subscribe 콜백 status)
    const denied = await subscribePrivateTopicAs('user2', `quick-request:${targetId}`, 'CHANNEL_ERROR');
    expect(denied.statuses).toContain('CHANNEL_ERROR');
    expect(denied.statuses).not.toContain('SUBSCRIBED');
    const allowed = await subscribePrivateTopicAs('user2', `quick-user:${user2.userId}`, 'SUBSCRIBED');
    expect(allowed.statuses, '본인 quick-user 토픽은 구독 성공(정책 양방향 확인)').toContain('SUBSCRIBED');
    const deniedAll = await subscribePrivateTopicAs('user2', 'quick-requests:all', 'CHANNEL_ERROR');
    expect(deniedAll.statuses, 'viewer-all이 아닌 user2는 quick-requests:all 거부').not.toContain('SUBSCRIBED');

    // 2) 화면 — user2 「퀵 대화」 + 대시보드 2탭 · user가 메시지·등록 → 8초 동안 0건
    const { context, page } = await pageAs(browser, 'user2');
    const dashboard = await context.newPage();
    try {
      await gotoChat(page);
      await waitForSubscribed(page);
      await gotoDashboard(dashboard);
      await expect(dashboard.getByRole('heading', { name: '나의 퀵 내역', exact: true }).first()).toBeVisible();
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await markNoReload(page);
      await markNoReload(dashboard);

      const body = `권한 밖 메시지 ${Date.now()}`;
      await sendMessageAs('user', target.requestNo, body);
      const created = await createAs('user', uniqueTag('E2E94RLS2'));
      await page.waitForTimeout(NO_REALTIME_WAIT_MS);

      await expect(page.getByTestId(`quick-chat-list-item-${target.requestNo}`)).toHaveCount(0);
      await expect(page.getByText(body)).toHaveCount(0);
      await expect(page.getByText(target.requestNo, { exact: false })).toHaveCount(0);
      await expect(dashboard.getByTestId(`quick-row-detail-${created.requestNo}`)).toHaveCount(0);
      await expect(dashboard.getByTestId(`quick-card-${created.requestNo}`)).toHaveCount(0);
      await expect(dashboard.getByText(created.requestNo, { exact: true })).toHaveCount(0);
      await expectNoReload(page);
      await expectNoReload(dashboard);
    } finally {
      await context.close();
    }
  });

  test('AC-09: 동방 · WebSocket 차단(routeWebSocket) → 배지 「폴링」(data-state=polling) · 다른 context 메시지 10초 안 목록·대화 반영 · 차단 해제 후 20초 안 「실시간」', async ({
    browser
  }) => {
    const user = await fixtureUser('user');
    const { requestNo } = await createAs('user', uniqueTag('E2E94POLL'));
    await sendMessageAs('user', requestNo, '폴링 판정 전 첫 메시지');

    const { context, page } = await pageAs(browser, 'dongbang');
    let blocked = true;
    // Playwright `page.route`는 WebSocket을 가로채지 못한다 → `context.routeWebSocket`(FE 핸드오프 §5)
    await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      if (blocked) {
        ws.close();
        return;
      }
      ws.connectToServer();
    });
    try {
      await gotoChat(page, requestNo);
      const badge = page.getByTestId('quick-chat-realtime-status');
      await expect(badge).toHaveAttribute('data-state', 'polling', { timeout: 15_000 });
      await expect(badge).toHaveText(TEXT.realtimePolling);
      await expect(badge).toHaveAttribute('aria-label', /폴링 — 실시간 연결이 안 돼 5초마다 새로고침합니다/);
      await expect(page.getByTestId('quick-chat-messages')).toContainText('폴링 판정 전 첫 메시지', { timeout: 20_000 });
      await markNoReload(page);

      const body = `폴링으로 받는 메시지 ${Date.now()}`;
      const message = await sendMessageAs('user', requestNo, body);
      await expect(messageBubble(page, message.id)).toBeVisible({ timeout: POLLING_TIMEOUT_MS });
      await expect(messageBubble(page, message.id)).toHaveAttribute('data-mine', 'false');
      await expect(page.getByTestId(`quick-chat-list-item-${requestNo}`)).toContainText(`${user.fullName}: ${body}`, {
        timeout: POLLING_TIMEOUT_MS
      });
      await expect(badge).toHaveAttribute('data-state', 'polling');
      await expectNoReload(page);

      blocked = false;
      await expect(badge).toHaveAttribute('data-state', 'live', { timeout: 20_000 });
      await expect(badge).toHaveText(TEXT.realtimeLive);
      await expectNoReload(page);
    } finally {
      await context.close();
    }
  });
});
