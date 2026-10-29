import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { getE2eServiceRoleClient, mockEndpoint } from '../helpers/push-mock';
import {
  enablePushFromProfile,
  expectedOwnerHash,
  installPushBrowserStub,
  loginOnDevice,
  logoutViaSidebarMenu,
  openDashboardAs,
  openDeviceBlankPage,
  PUSH_RESUME_BANNER_TEXT,
  PUSH_RESUME_TOAST_TEXT,
  readPushStub,
  readResumeMarkerOwner,
  readResumeMarkerRaw,
  resetPushStubCalls,
  trackPushRequests,
  writeResumeMarker,
  type DisposableUser,
  type PushStubState
} from '../helpers/push-browser-stub';
import { createActiveTestUser } from '../helpers/supabase-direct-auth';

/**
 * plan 105 — docs/plans/105_push-resume-after-relogin-plan.md
 * AC-01~07 · AC-09~13 · AC-15 · AC-16 · AC-18 (UI · DB) + AC-20 정적 검사(grep)
 *
 * 안전 규칙
 * - 로그아웃은 **일회용 계정만**(A·B·D). 공용 e2e/.auth/*.json 세션으로는 로그아웃하지 않는다.
 *   admin.json은 비활성화 Route 호출(AC-15)·로그 화면 확인(AC-18)에만 쓴다.
 * - 일회용 계정은 활동 로그가 남아 auth.admin.deleteUser가 실패한다(append-only 트리거) →
 *   afterAll에서는 push 행만 지우고, 계정·로그는 globalTeardown / `npm run e2e:cleanup`(E2E 이름 · @example.com)에 맡긴다.
 * - 메일 발송 Route(POST /api/contracts/reminders · 잔액 메일)는 호출하지 않는다.
 */
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const ROOT = process.cwd();

let userA: DisposableUser;
let userB: DisposableUser;

async function createDisposable(prefix: string, label: string): Promise<DisposableUser> {
  const fullName = `E2E 푸시복구105${label} ${Date.now()}`;
  const created = await createActiveTestUser(prefix, { fullName });
  return { ...created, fullName };
}

async function rowsByEndpoint(endpoint: string) {
  const admin = getE2eServiceRoleClient();
  const { data, error } = await admin.from('push_subscriptions').select('id, user_id').eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function countRowsByUser(userId: string) {
  const admin = getE2eServiceRoleClient();
  const { count, error } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function activityLogByRequestId(requestId: string) {
  const admin = getE2eServiceRoleClient();
  let row: {
    action: string;
    http_status: number;
    actor_user_id: string | null;
    target_user_id: string | null;
    metadata: Record<string, unknown> | null;
  } | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from('activity_logs')
          .select('action, http_status, actor_user_id, target_user_id, metadata')
          .eq('request_id', requestId)
          .maybeSingle();
        row = data;
        return Boolean(data);
      },
      { timeout: 15_000 }
    )
    .toBe(true);
  return row!;
}

async function newDevice(browser: Browser, initial: Partial<Omit<PushStubState, 'calls'>> = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installPushBrowserStub(context, initial);
  const page = await context.newPage();
  const tracker = trackPushRequests(page);
  return { context, page, tracker };
}

/** 대시보드 진입 후 판정(PushResumeSync)이 끝날 시간을 준다 — 서버 호출이 「없어야」 하는 AC용 */
async function settle(page: Page, ms = 4_000) {
  await page.waitForTimeout(ms);
}

async function expectToastOnce(page: Page) {
  const toast = page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true });
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await expect(toast).toHaveCount(1);
}

async function expectProfileStatus(page: Page, status: 'on' | 'off' | 'denied') {
  await page.goto('/dashboard/profile');
  const pushStatus = page.getByTestId('push-status');
  await expect(pushStatus).toHaveAttribute('data-status', status, { timeout: 30_000 });
  return pushStatus;
}

test.beforeAll(async () => {
  userA = await createDisposable('p105-resume-a', 'A');
  userB = await createDisposable('p105-resume-b', 'B');
});

test.afterAll(async () => {
  const admin = getE2eServiceRoleClient();
  for (const user of [userA, userB]) {
    if (user) await admin.from('push_subscriptions').delete().eq('user_id', user.userId);
  }
});

// ---------------------------------------------------------------------------
// 한 기기(같은 context)에서 A·B가 번갈아 로그인 — AC-01 ~ AC-07 · AC-18
// ---------------------------------------------------------------------------

test.describe('plan 105 한 기기 시나리오 (A·B 일회용)', () => {
  let device: BrowserContext;
  let page: Page;
  let tracker: ReturnType<typeof trackPushRequests>;
  let endpointA = '';

  test.beforeAll(async ({ browser }) => {
    ({ context: device, page, tracker } = await newDevice(browser, { permission: 'granted', endpoint: null }));
  });

  test.afterAll(async () => {
    await device?.close().catch(() => undefined);
  });

  test('AC-01: A Switch ON → 사이드바 「로그아웃」 → DELETE 200 sign_out · 통로 유지(unsubscribe 0) · 표시 owner=hash(A) · DB 행 0', async () => {
    await loginOnDevice(device, userA);
    await openDashboardAs(page, userA.fullName);
    await enablePushFromProfile(page);

    const stubOn = await readPushStub(page);
    expect(stubOn.endpoint).toMatch(/^https:\/\/e2e\.invalid\/push\/ok\//);
    endpointA = stubOn.endpoint!;
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userA.userId]);

    tracker.clear();
    await logoutViaSidebarMenu(page);
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    const deletes = tracker.deletes();
    expect(deletes).toHaveLength(1);
    expect(deletes[0].status).toBe(200);
    expect(deletes[0].body?.source).toBe('sign_out');

    const stub = await readPushStub(page);
    expect(stub.calls.unsubscribe).toBe(0);
    expect(stub.endpoint).toBe(endpointA);

    const raw = await readResumeMarkerRaw(page);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).owner).toBe(expectedOwnerHash(userA.userId));
    expect(raw).not.toContain(userA.userId);

    expect(await rowsByEndpoint(endpointA)).toHaveLength(0);
  });

  test('AC-02: A 재로그인 → POST 201 auto_resume · resume_marker_at ISO · 토스트 1회 · requestPermission 0 · subscribe 0 · 표시 삭제 · DB 행 A · 프로필 on', async () => {
    await resetPushStubCalls(page);
    tracker.clear();
    await loginOnDevice(device, userA);
    await page.goto('/dashboard/overview');

    await expect.poll(() => tracker.posts().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    const post = tracker.posts()[0];
    expect(post.status).toBe(201);
    expect(post.body?.source).toBe('auto_resume');
    expect(typeof post.body?.resume_marker_at).toBe('string');
    expect(Number.isNaN(Date.parse(String(post.body?.resume_marker_at)))).toBe(false);
    expect(String(post.body?.resume_marker_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(post.body?.endpoint).toBe(endpointA);

    await expectToastOnce(page);
    expect(tracker.posts()).toHaveLength(1);

    const stub = await readPushStub(page);
    expect(stub.calls.requestPermission).toBe(0);
    expect(stub.calls.subscribe).toBe(0);
    expect(await readResumeMarkerRaw(page)).toBeNull();
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userA.userId]);

    await expectProfileStatus(page, 'on');
    await expect(page.getByTestId('push-toggle')).toHaveAttribute('aria-checked', 'true');
  });

  test('AC-03: AC-02 직후 /dashboard/overview 새로고침 2회 → 추가 POST·detach 0 · 토스트·안내 줄 없음', async () => {
    await page.goto('/dashboard/overview');
    await expect(page.getByTestId('nav-user-display-name')).toHaveText(userA.fullName, { timeout: 30_000 });
    tracker.clear();
    for (let i = 0; i < 2; i += 1) {
      await page.reload();
      await expect(page.getByTestId('nav-user-display-name')).toHaveText(userA.fullName, { timeout: 30_000 });
      await settle(page, 3_500);
    }
    expect(tracker.posts()).toHaveLength(0);
    expect(tracker.detaches()).toHaveLength(0);
    await expect(page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('push-resume-banner')).toHaveCount(0);
  });

  test('AC-04: A 로그아웃(표시 A) → B 진입 → POST·detach 0 · 토스트·안내 줄 없음 · B 프로필 off · 표시 A 유지 · DB 행 0', async () => {
    await logoutViaSidebarMenu(page);
    expect(await readResumeMarkerOwner(page)).toBe(expectedOwnerHash(userA.userId));

    tracker.clear();
    await loginOnDevice(device, userB);
    await openDashboardAs(page, userB.fullName);
    await settle(page);
    expect(tracker.posts()).toHaveLength(0);
    expect(tracker.detaches()).toHaveLength(0);
    await expect(page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('push-resume-banner')).toHaveCount(0);

    const status = await expectProfileStatus(page, 'off');
    await expect(status).toContainText('알림이 꺼져 있어요');
    await expect(page.getByTestId('push-toggle')).toHaveAttribute('aria-checked', 'false');
    expect(await readResumeMarkerOwner(page)).toBe(expectedOwnerHash(userA.userId));
    expect(await rowsByEndpoint(endpointA)).toHaveLength(0);
    expect(tracker.posts()).toHaveLength(0);
  });

  test('AC-05: B 로그아웃 → DELETE 404 · unsubscribe 0 · 표시 A 유지 → A 진입 시 자동 복구 201 · 토스트 1회 (D-2 전반)', async () => {
    await resetPushStubCalls(page);
    tracker.clear();
    await logoutViaSidebarMenu(page);
    const deletes = tracker.deletes();
    expect(deletes).toHaveLength(1);
    expect(deletes[0].status).toBe(404);
    expect(deletes[0].body?.source).toBe('sign_out');
    expect((await readPushStub(page)).calls.unsubscribe).toBe(0);
    expect((await readPushStub(page)).endpoint).toBe(endpointA);
    expect(await readResumeMarkerOwner(page)).toBe(expectedOwnerHash(userA.userId));

    tracker.clear();
    await loginOnDevice(device, userA);
    await page.goto('/dashboard/overview');
    await expect.poll(() => tracker.posts().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(tracker.posts()[0].status).toBe(201);
    expect(tracker.posts()[0].body?.source).toBe('auto_resume');
    await expectToastOnce(page);
    expect(await readResumeMarkerRaw(page)).toBeNull();
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userA.userId]);
  });

  test('AC-06: A 로그아웃 → B Switch ON(manual · 같은 endpoint → B) · 표시 삭제 → B 로그아웃(표시 B) → A 진입 시 POST 0 · 토스트·안내 줄 없음 · A off (D-2 후반)', async () => {
    await logoutViaSidebarMenu(page);
    expect(await readResumeMarkerOwner(page)).toBe(expectedOwnerHash(userA.userId));

    await loginOnDevice(device, userB);
    await openDashboardAs(page, userB.fullName);
    await settle(page, 2_000);
    tracker.clear();
    await enablePushFromProfile(page);
    const manual = tracker.posts();
    expect(manual).toHaveLength(1);
    // plan 문구는 「200(같은 endpoint가 B로 이동)」이지만, A 로그아웃(DELETE 200)으로 A 행이 이미 지워져 있어
    // 같은 endpoint가 B 행으로 **새로** 만들어진다 → 201. 판정 핵심(같은 endpoint · B 소유 · manual)은 동일.
    expect([200, 201]).toContain(manual[0].status);
    test.info().annotations.push({ type: 'AC-06 B ON status', description: String(manual[0].status) });
    expect(manual[0].body?.source).toBe('manual');
    expect(manual[0].body?.endpoint).toBe(endpointA);
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userB.userId]);
    expect(await readResumeMarkerRaw(page)).toBeNull();

    tracker.clear();
    await logoutViaSidebarMenu(page);
    expect(tracker.deletes()[0]?.status).toBe(200);
    expect(await readResumeMarkerOwner(page)).toBe(expectedOwnerHash(userB.userId));

    tracker.clear();
    await loginOnDevice(device, userA);
    await openDashboardAs(page, userA.fullName);
    await settle(page);
    expect(tracker.posts()).toHaveLength(0);
    await expect(page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('push-resume-banner')).toHaveCount(0);
    await expectProfileStatus(page, 'off');
    expect(tracker.posts()).toHaveLength(0);
  });

  test('AC-07: A 켬 → 버튼 없이 clearCookies → B 진입 → detach 200 detached · previous_owner_hash=hash(A) · 행 0 · 표시 A · 로그(actor B · target A) → A 진입 자동 복구 (D-4)', async () => {
    // A 켬(행 A) — 스위치 ON 성공은 표시를 지운다
    await enablePushFromProfile(page);
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userA.userId]);
    expect(await readResumeMarkerRaw(page)).toBeNull();

    // 버튼 없이 세션 끊김(세션 만료 흉내) — 클라이언트 로그아웃 코드가 돌지 않는다
    await device.clearCookies();
    await resetPushStubCalls(page);

    tracker.clear();
    await loginOnDevice(device, userB);
    await openDashboardAs(page, userB.fullName);
    await expect.poll(() => tracker.detaches().length, { timeout: 15_000 }).toBe(1);
    const detach = tracker.detaches()[0];
    expect(detach.status).toBe(200);
    expect(detach.json?.data?.result).toBe('detached');
    expect(detach.json?.data?.previous_owner_hash).toBe(expectedOwnerHash(userA.userId));
    await expect.poll(() => readResumeMarkerOwner(page), { timeout: 5_000 }).toBe(expectedOwnerHash(userA.userId));
    expect(await rowsByEndpoint(endpointA)).toHaveLength(0);
    expect((await readPushStub(page)).calls.unsubscribe).toBe(0);
    expect((await readPushStub(page)).endpoint).toBe(endpointA);

    expect(detach.requestId).toBeTruthy();
    const log = await activityLogByRequestId(detach.requestId!);
    expect(log.action).toBe('push_subscription.detach');
    expect(log.http_status).toBe(200);
    expect(log.actor_user_id).toBe(userB.userId);
    expect(log.target_user_id).toBe(userA.userId);
    expect(log.metadata?.result).toBe('detached');
    expect(JSON.stringify(log.metadata)).not.toContain(endpointA);

    await expectProfileStatus(page, 'off');

    // 이어서 clearCookies → A 진입 → 자동 복구
    await device.clearCookies();
    tracker.clear();
    await loginOnDevice(device, userA);
    await page.goto('/dashboard/overview');
    await expect.poll(() => tracker.posts().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(tracker.posts()[0].status).toBe(201);
    expect(tracker.posts()[0].body?.source).toBe('auto_resume');
    await expectToastOnce(page);
    expect((await rowsByEndpoint(endpointA)).map((r) => r.user_id)).toEqual([userA.userId]);
  });

  test('AC-18: AC-07 직후 admin.json /dashboard/logs → 「휴대폰 알림 이전 사용자 연결 해제」·「휴대폰 알림 기기 등록」 행 · 성공(2xx)', async ({
    browser
  }) => {
    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      const adminPage = await adminContext.newPage();
      // 활동 로그 화면 기본값은 「본인」 → 관리자가 사용자 A를 선택한 상태(log_user=A)로 연다.
      // A 범위(actor 또는 target) 최신 2행 = AC-07의 자동 복구 등록(actor A) · detach(actor B → target A)
      await adminPage.goto(`/dashboard/logs?log_user=${userA.userId}`);
      await expect(adminPage.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      const rows = adminPage.getByTestId('activity-log-row');
      await expect(rows.nth(0)).toContainText('휴대폰 알림 기기 등록', { timeout: 15_000 });
      await expect(rows.nth(0)).toContainText('성공');
      await expect(rows.nth(1)).toContainText('휴대폰 알림 이전 사용자 연결 해제');
      await expect(rows.nth(1)).toContainText('성공');
      await expect(rows.nth(1)).toContainText(userB.fullName);
    } finally {
      await adminContext.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 기기 상태별 진입 판정 — AC-09 ~ AC-13
// ---------------------------------------------------------------------------

test.describe('plan 105 진입 판정 (새 기기)', () => {
  test('AC-09: B 로그인 · 통로 있음 · 표시 없음 · 서버 행 없음 → detach 200 none · unsubscribe 1 · 새로고침 후 detach 0', async ({
    browser
  }) => {
    const orphanEndpoint = mockEndpoint('ok');
    const { context, page, tracker } = await newDevice(browser, { permission: 'granted', endpoint: orphanEndpoint });
    try {
      await loginOnDevice(context, userB);
      await openDashboardAs(page, userB.fullName);
      await expect.poll(() => tracker.detaches().length, { timeout: 15_000 }).toBe(1);
      expect(tracker.detaches()[0].status).toBe(200);
      expect(tracker.detaches()[0].json?.data?.result).toBe('none');
      await expect.poll(async () => (await readPushStub(page)).calls.unsubscribe, { timeout: 5_000 }).toBe(1);
      expect((await readPushStub(page)).endpoint).toBeNull();
      expect(await readResumeMarkerRaw(page)).toBeNull();

      tracker.clear();
      await page.reload();
      await expect(page.getByTestId('nav-user-display-name')).toHaveText(userB.fullName, { timeout: 30_000 });
      await settle(page);
      expect(tracker.detaches()).toHaveLength(0);
      expect(tracker.posts()).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test('AC-10: 표시 A · granted · 구독 없음 · mode webkit → requestPermission 0 · subscribe 1 · POST 201 auto_resume · 토스트 1회 · 표시 삭제', async ({
    browser
  }) => {
    const { context, page, tracker } = await newDevice(browser, {
      permission: 'granted',
      endpoint: null,
      mode: 'webkit'
    });
    try {
      await openDeviceBlankPage(page);
      await writeResumeMarker(page, expectedOwnerHash(userA.userId));
      await resetPushStubCalls(page);

      await loginOnDevice(context, userA);
      await page.goto('/dashboard/overview');
      await expect.poll(() => tracker.posts().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
      expect(tracker.posts()[0].status).toBe(201);
      expect(tracker.posts()[0].body?.source).toBe('auto_resume');
      await expectToastOnce(page);

      const stub = await readPushStub(page);
      expect(stub.calls.requestPermission).toBe(0);
      expect(stub.calls.subscribe).toBe(1);
      expect(stub.endpoint).toBeTruthy();
      expect(await readResumeMarkerRaw(page)).toBeNull();
      expect((await rowsByEndpoint(stub.endpoint!)).map((r) => r.user_id)).toEqual([userA.userId]);
    } finally {
      await context.close();
    }
  });

  test('AC-11: 표시 A · granted · 구독 없음 · fail_subscribe → 안내 줄 문구·「다시 켜기」 → 클릭 → POST 201 manual · 토스트 · 안내 줄 사라짐 · 표시 삭제', async ({
    browser
  }) => {
    const { context, page, tracker } = await newDevice(browser, {
      permission: 'granted',
      endpoint: null,
      mode: 'fail_subscribe'
    });
    try {
      await openDeviceBlankPage(page);
      await writeResumeMarker(page, expectedOwnerHash(userA.userId));

      await loginOnDevice(context, userA);
      await openDashboardAs(page, userA.fullName);
      const banner = page.getByTestId('push-resume-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await expect(banner).toContainText(PUSH_RESUME_BANNER_TEXT);
      await expect(page.getByTestId('push-resume-enable')).toHaveText('다시 켜기');
      await expect(page.getByTestId('push-resume-dismiss')).toHaveAttribute('aria-label', '닫기');
      expect(tracker.posts()).toHaveLength(0);

      tracker.clear();
      await page.getByTestId('push-resume-enable').click();
      await expect(page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(banner).toHaveCount(0);
      expect(tracker.posts()).toHaveLength(1);
      expect(tracker.posts()[0].status).toBe(201);
      expect(tracker.posts()[0].body?.source).toBe('manual');
      expect(await readResumeMarkerRaw(page)).toBeNull();
    } finally {
      await context.close();
    }
  });

  test('AC-12: AC-11 Given → 안내 줄 「닫기」 → 안내 줄 사라짐 · 표시 삭제 · 새로고침 후 안내 줄·POST 0', async ({
    browser
  }) => {
    const { context, page, tracker } = await newDevice(browser, {
      permission: 'granted',
      endpoint: null,
      mode: 'fail_subscribe'
    });
    try {
      await openDeviceBlankPage(page);
      await writeResumeMarker(page, expectedOwnerHash(userA.userId));

      await loginOnDevice(context, userA);
      await openDashboardAs(page, userA.fullName);
      const banner = page.getByTestId('push-resume-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      const dismiss = banner.getByRole('button', { name: '닫기' });
      await expect(dismiss).toHaveAttribute('data-testid', 'push-resume-dismiss');
      await dismiss.click();
      await expect(banner).toHaveCount(0);
      expect(await readResumeMarkerRaw(page)).toBeNull();

      tracker.clear();
      await page.reload();
      await expect(page.getByTestId('nav-user-display-name')).toHaveText(userA.fullName, { timeout: 30_000 });
      await settle(page);
      await expect(banner).toHaveCount(0);
      expect(tracker.posts()).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test('AC-13: 표시 A · permission denied · 구독 있음 → POST 0 · 안내 줄·토스트 없음 · 표시 삭제 · 프로필 「알림이 차단되어 있어요…」', async ({
    browser
  }) => {
    const { context, page, tracker } = await newDevice(browser, {
      permission: 'denied',
      endpoint: mockEndpoint('ok')
    });
    try {
      await openDeviceBlankPage(page);
      await writeResumeMarker(page, expectedOwnerHash(userA.userId));

      await loginOnDevice(context, userA);
      await openDashboardAs(page, userA.fullName);
      await expect.poll(() => readResumeMarkerRaw(page), { timeout: 10_000 }).toBeNull();
      await settle(page, 2_000);
      expect(tracker.posts()).toHaveLength(0);
      await expect(page.getByTestId('push-resume-banner')).toHaveCount(0);
      await expect(page.getByText(PUSH_RESUME_TOAST_TEXT, { exact: true })).toHaveCount(0);

      const status = await expectProfileStatus(page, 'denied');
      await expect(status).toContainText(
        '알림이 차단되어 있어요. 브라우저 설정에서 WakeOne 알림을 허용해 주세요.'
      );
      expect(tracker.posts()).toHaveLength(0);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 강제 로그아웃 · 해제 실패 안전장치 — AC-15 · AC-16
// ---------------------------------------------------------------------------

test.describe('plan 105 로그아웃 예외 경로', () => {
  test('AC-15: D 켬 · 표시 D 심음 → admin DELETE /api/users/{D}(비활성화) → /auth/sign-in?accountDisabled=1 · unsubscribe 1 · 표시 삭제 · DB D 행 0', async ({
    browser,
    playwright
  }) => {
    const userD = await createDisposable('p105-resume-d', 'D');
    const { context, page, tracker } = await newDevice(browser, { permission: 'granted', endpoint: null });
    const adminRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      await loginOnDevice(context, userD);
      await openDashboardAs(page, userD.fullName);
      await enablePushFromProfile(page);
      expect(await countRowsByUser(userD.userId)).toBe(1);

      await writeResumeMarker(page, expectedOwnerHash(userD.userId));
      await resetPushStubCalls(page);
      // 비활성화 감지 realtime 채널이 붙을 시간
      await page.waitForTimeout(4_000);
      tracker.clear();

      const deactivate = await adminRequest.delete(`/api/users/${userD.userId}`);
      expect(deactivate.status()).toBe(200);

      await page.waitForURL(/\/auth\/sign-in\?.*accountDisabled=1/, { timeout: 30_000 });
      await expect.poll(async () => (await readPushStub(page)).calls.unsubscribe, { timeout: 5_000 }).toBe(1);
      expect(await readResumeMarkerRaw(page)).toBeNull();
      expect(await countRowsByUser(userD.userId)).toBe(0);

      const forced = tracker.deletes();
      test.info().annotations.push({
        type: 'AC-15 forced DELETE',
        description: forced.map((r) => `${r.status}:${String(r.body?.source)}`).join(',') || 'none'
      });
      if (forced.length > 0) expect(forced[0].body?.source).toBe('forced_sign_out');
    } finally {
      await adminRequest.dispose();
      await context.close();
      await getE2eServiceRoleClient().from('push_subscriptions').delete().eq('user_id', userD.userId);
    }
  });

  test('AC-16: A 켬 → DELETE abort 상태로 로그아웃 → /auth/sign-in 정상 · unsubscribe 1(안전장치) · 표시 기록 안 됨', async ({
    browser
  }) => {
    const { context, page } = await newDevice(browser, { permission: 'granted', endpoint: null });
    try {
      await loginOnDevice(context, userA);
      await openDashboardAs(page, userA.fullName);
      await enablePushFromProfile(page);
      const endpoint = (await readPushStub(page)).endpoint!;
      expect(endpoint).toBeTruthy();
      expect(await readResumeMarkerRaw(page)).toBeNull();
      await resetPushStubCalls(page);

      await page.route('**/api/notifications/push/subscriptions', (route) =>
        route.request().method() === 'DELETE' ? route.abort() : route.continue()
      );
      await logoutViaSidebarMenu(page);
      await page.unroute('**/api/notifications/push/subscriptions');

      await expect(page).toHaveURL(/\/auth\/sign-in/);
      const stub = await readPushStub(page);
      expect(stub.calls.unsubscribe).toBe(1);
      expect(stub.endpoint).toBeNull();
      expect(await readResumeMarkerRaw(page)).toBeNull();
      // 서버 행은 남았지만(DELETE 실패) 통로가 사라졌으므로 실제 발송 시 410으로 정리된다 — 테스트 행은 정리
      await getE2eServiceRoleClient().from('push_subscriptions').delete().eq('endpoint', endpoint);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-20 정적 검사 (grep) — 104 AC-09를 105 기준으로 읽음
// ---------------------------------------------------------------------------

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listSourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

test.describe('plan 105 정적 검사', () => {
  test("AC-20: confirm 0건 · nav-user signOut() · realtime signOut({ scope: 'global', reason: 'forced' }) · 푸시 처리가 supabase.auth.signOut( 보다 먼저", () => {
    const confirmOffenders = [
      ...listSourceFiles(path.join(ROOT, 'src/features/notifications')),
      path.join(ROOT, 'src/features/auth/api/service.ts')
    ].filter((file) => /window\.confirm|(?<![A-Za-z_.])confirm\(/.test(fs.readFileSync(file, 'utf8')));
    expect(confirmOffenders).toEqual([]);

    const navUser = readSource('src/components/nav-user.tsx');
    expect(navUser).toMatch(/await signOut\(\)/);
    expect(navUser).not.toMatch(/signOut\(\{/);

    const realtime = readSource('src/features/auth/components/profile-status-realtime.tsx');
    expect(realtime.match(/signOut\(\{\s*scope:\s*'global',\s*reason:\s*'forced'\s*\}\)/g) ?? []).toHaveLength(1);

    const service = readSource('src/features/auth/api/service.ts');
    const start = service.indexOf('export async function signOut(');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = service.slice(start, service.indexOf('\n}\n', start));
    const userPushAt = body.indexOf('await signOutPushOnThisDevice(');
    const forcedPushAt = body.indexOf('await unsubscribePushOnThisDevice()');
    const authSignOutAt = body.indexOf('supabase.auth.signOut(');
    expect(userPushAt).toBeGreaterThanOrEqual(0);
    expect(forcedPushAt).toBeGreaterThanOrEqual(0);
    expect(authSignOutAt).toBeGreaterThan(userPushAt);
    expect(authSignOutAt).toBeGreaterThan(forcedPushAt);
    expect(body).toMatch(/supabase\.auth\.signOut\(\{\s*scope:\s*options\?\.scope\s*\?\?\s*'local'\s*\}\)/);

    // 자동 복구 경로에는 requestPermission이 없다 (WebKit 제스처 제약)
    const client = readSource('src/features/notifications/lib/push-client.ts');
    const fnStart = client.indexOf('export async function subscribeExistingOrGranted(');
    const fnBody = client.slice(fnStart, client.indexOf('\n}\n', fnStart));
    expect(fnStart).toBeGreaterThanOrEqual(0);
    expect(fnBody).not.toContain('requestPermission');
  });
});
