import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page
} from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { e2eBaseURL } from '../helpers/auth-request';
import {
  getE2eServiceRoleClient,
  mockEndpoint,
  registerMockDevice
} from '../helpers/push-mock';
import {
  createActiveTestUser,
  setProfileStatus,
  signInWithSupabasePassword
} from '../helpers/supabase-direct-auth';

/**
 * plan 104 — docs/plans/104_logout-this-device-only-plan.md
 * 로그아웃 「이 기기만」(scope local) · 비활성 계정은 모든 기기(scope global).
 *
 * 안전 규칙
 * - 공용 e2e/.auth/*.json 세션으로는 절대 로그아웃하지 않는다 → 일회용 사용자 U·V만 사용.
 * - afterAll에서 U·V를 auth.admin.deleteUser로 지운다(AC-10).
 * - 메일 발송 Route·관리자 Route는 호출하지 않는다. V 비활성은 service-role로 profiles.status만 바꾼다.
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

type StorageState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;
type DisposableUser = { userId: string; email: string; password: string; fullName: string };

const NOTIFICATIONS_PROBE = '/api/notifications?limit=1';
const ROOT = process.cwd();

let userU: DisposableUser | null = null;
let userV: DisposableUser | null = null;

/** AC-01 → AC-02·03이 이어서 쓰는 상태 */
let flowContextA: BrowserContext | null = null;
let flowContextB: BrowserContext | null = null;
let flowPageB: Page | null = null;
let savedStateA: StorageState | null = null;

function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and publishable/anon key are required.');
  }
  return { url, key };
}

async function newUserContext(browser: Browser, storageState: StorageState) {
  const context = await browser.newContext({ baseURL: e2eBaseURL, storageState });
  // Next dev-tools 「N Issue」 배지(좌하단)가 접힌 사이드바의 사용자 메뉴 버튼을 가린다 → dev 전용 오버레이만 숨긴다 (96·08-mobile 동일)
  await context.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });
  return context;
}

async function newProbeRequest(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } },
  storageState: StorageState
) {
  return playwright.request.newContext({ baseURL: e2eBaseURL, storageState });
}

async function openDashboard(page: Page, fullName: string) {
  await page.goto('/dashboard/overview');
  await expect(page).toHaveURL(/\/dashboard\/overview/);
  await expect(page.getByTestId('nav-user-display-name')).toHaveText(fullName, { timeout: 30_000 });
}

/** 사이드바 사용자 메뉴 트리거 — 접힌(아이콘) 사이드바에서도 보이는 버튼 */
function navUserTrigger(page: Page) {
  return page.getByRole('button').filter({ has: page.getByTestId('nav-user-display-name') });
}

async function openNavUserMenu(page: Page) {
  await navUserTrigger(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

async function clickSidebarLogout(page: Page) {
  await openNavUserMenu(page);
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 30_000 });
}

async function waitForServiceWorkerReady(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration('/');
          return Boolean(registration);
        }),
      { timeout: 20_000 }
    )
    .toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

async function countSubscriptionsByEndpoint(endpoint: string) {
  const admin = getE2eServiceRoleClient();
  const { count, error } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countSubscriptionsByUser(userId: string) {
  const admin = getE2eServiceRoleClient();
  const { count, error } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * 일회용 사용자 삭제.
 * U는 AC-04에서 push_subscription.create/delete 활동 로그가 남는다. activity_logs는 append-only 트리거
 * (`trg_activity_logs_no_update`)가 있어 FK `ON DELETE SET NULL`이 막히고 deleteUser가
 * 「Database error deleting user」로 실패한다 → 그때만 globalTeardown·`npm run e2e:cleanup`과 같은
 * `cleanup_e2e_mock_data` RPC(일회용 사용자·로그 정리)로 지운다.
 */
async function deleteDisposableUser(user: DisposableUser | null): Promise<'deleteUser' | 'cleanup-rpc' | 'none'> {
  if (!user) return 'none';
  const admin = getE2eServiceRoleClient();
  await admin.from('push_subscriptions').delete().eq('user_id', user.userId);
  const { error } = await admin.auth.admin.deleteUser(user.userId);
  if (!error) return 'deleteUser';
  if (/not.?found/i.test(error.message)) return 'none';

  const { count: logCount } = await admin
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .or(`actor_user_id.eq.${user.userId},target_user_id.eq.${user.userId}`);
  if (!(logCount && logCount > 0)) {
    throw new Error(`deleteUser(${user.email}) failed: ${error.message}`);
  }
  const { error: rpcError } = await admin.rpc('cleanup_e2e_mock_data');
  if (rpcError) {
    throw new Error(`cleanup_e2e_mock_data failed for ${user.email}: ${rpcError.message}`);
  }
  return 'cleanup-rpc';
}

async function closeFlowContexts() {
  await flowContextA?.close().catch(() => undefined);
  await flowContextB?.close().catch(() => undefined);
  flowContextA = null;
  flowContextB = null;
  flowPageB = null;
}

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function countMatches(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function listSourceFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

test.beforeAll(async () => {
  const stamp = Date.now();
  const fullNameU = `E2E 로그아웃104U ${stamp}`;
  const fullNameV = `E2E 로그아웃104V ${stamp}`;
  const createdU = await createActiveTestUser('p104-logout-u', { fullName: fullNameU });
  userU = { ...createdU, fullName: fullNameU };
  const createdV = await createActiveTestUser('p104-logout-v', { fullName: fullNameV });
  userV = { ...createdV, fullName: fullNameV };
});

test.afterAll(async () => {
  await closeFlowContexts();
  // AC-10 테스트가 먼저 지웠으면 no-op (멱등 안전망) — 실패해도 globalTeardown cleanup이 한 번 더 지운다
  for (const user of [userV, userU]) {
    await deleteDisposableUser(user).catch((error: unknown) => {
      console.warn(`[plan 104] afterAll cleanup: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
});

test.describe('plan 104 로그아웃 — 이 기기만 (같은 계정 2개 컨텍스트)', () => {
  test('AC-01: A에서 사이드바 「로그아웃」 → /auth/sign-in · A로 /dashboard/overview 재진입 시 /auth/sign-in?redirectTo', async ({
    browser
  }) => {
    const u = userU!;
    const sessionA = await signInWithSupabasePassword(u.email, u.password);
    const sessionB = await signInWithSupabasePassword(u.email, u.password);
    expect(sessionA.session.access_token).not.toBe(sessionB.session.access_token);

    flowContextA = await newUserContext(browser, sessionA.storageState);
    flowContextB = await newUserContext(browser, sessionB.storageState);
    const pageA = await flowContextA.newPage();
    flowPageB = await flowContextB.newPage();

    await openDashboard(pageA, u.fullName);
    await openDashboard(flowPageB, u.fullName);

    // A 쿠키를 로그아웃 직전에 저장 (AC-03 (2)에서 사용)
    savedStateA = (await flowContextA.storageState()) as StorageState;
    expect(savedStateA.cookies.some((cookie) => cookie.name.startsWith('sb-'))).toBe(true);

    await clickSidebarLogout(pageA);
    await expect(pageA).toHaveURL(/\/auth\/sign-in/);

    await pageA.goto('/dashboard/overview');
    await expect(pageA).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fdashboard%2Foverview/);
  });

  test('AC-02: AC-01 직후 B 새로고침 → /dashboard/notifications 이동 → 로그인 화면으로 가지 않고 사이드바에 U 이름', async () => {
    const u = userU!;
    const pageB = flowPageB!;
    await pageB.reload();
    await expect(pageB).toHaveURL(/\/dashboard\/overview/);

    await pageB.goto('/dashboard/notifications');
    await expect(pageB).toHaveURL(/\/dashboard\/notifications/);
    await expect(pageB).not.toHaveURL(/\/auth\/sign-in/);
    await expect(pageB.getByTestId('nav-user-display-name')).toHaveText(u.fullName, { timeout: 30_000 });

    // 사이드바 사용자 메뉴가 보이고, 열면 U 이름이 보인다 (접힌 사이드바에서는 이름이 메뉴 안에 표시됨)
    await expect(navUserTrigger(pageB)).toBeVisible();
    await openNavUserMenu(pageB);
    await expect(pageB.getByRole('menu').getByText(u.fullName, { exact: true })).toBeVisible();
    await pageB.keyboard.press('Escape');
    await expect(pageB.getByRole('menu')).toBeHidden();
  });

  test('AC-03: AC-01 직후 B request GET /api/notifications → 200 · 저장해 둔 A 쿠키로 같은 요청 → 401', async ({
    playwright
  }) => {
    const responseB = await flowContextB!.request.get(NOTIFICATIONS_PROBE);
    expect(responseB.status()).toBe(200);

    const requestA = await newProbeRequest(playwright, savedStateA!);
    try {
      const responseA = await requestA.get(NOTIFICATIONS_PROBE);
      expect(responseA.status()).toBe(401);
    } finally {
      await requestA.dispose();
    }

    await closeFlowContexts();
  });

  test('AC-04: U의 A·B 각자 mock 구독 EA·EB → A(현재 구독 EA stub)에서 「로그아웃」 → EA 0행 · EB 1행', async ({
    browser
  }) => {
    const u = userU!;
    const sessionA = await signInWithSupabasePassword(u.email, u.password);
    const sessionB = await signInWithSupabasePassword(u.email, u.password);
    const endpointA = mockEndpoint('ok');
    const endpointB = mockEndpoint('ok');

    const contextA = await newUserContext(browser, sessionA.storageState);
    const contextB = await newUserContext(browser, sessionB.storageState);
    try {
      expect((await registerMockDevice(contextA.request, endpointA, 'E2E p104 A')).status()).toBe(201);
      expect((await registerMockDevice(contextB.request, endpointB, 'E2E p104 B')).status()).toBe(201);
      expect(await countSubscriptionsByUser(u.userId)).toBe(2);
      expect(await countSubscriptionsByEndpoint(endpointA)).toBe(1);
      expect(await countSubscriptionsByEndpoint(endpointB)).toBe(1);

      // A 브라우저의 「현재 구독」이 EA로 보이도록 stub (헤드리스는 실제 구독 불가)
      await contextA.addInitScript((endpoint: string) => {
        if (typeof PushManager === 'undefined') return;
        const fakeSubscription = {
          endpoint,
          expirationTime: null,
          options: { userVisibleOnly: true, applicationServerKey: null },
          getKey: () => null,
          toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'stub', auth: 'stub' } }),
          unsubscribe: async () => true
        };
        PushManager.prototype.getSubscription = async function getSubscription() {
          return fakeSubscription as unknown as PushSubscription;
        };
      }, endpointA);

      const pageA = await contextA.newPage();
      await openDashboard(pageA, u.fullName);
      await waitForServiceWorkerReady(pageA);
      const stubbedEndpoint = await pageA.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription?.endpoint ?? null;
      });
      expect(stubbedEndpoint).toBe(endpointA);

      const deleteResponse = pageA.waitForResponse(
        (response) =>
          response.url().includes('/api/notifications/push/subscriptions') &&
          response.request().method() === 'DELETE',
        { timeout: 15_000 }
      );
      await clickSidebarLogout(pageA);
      expect((await deleteResponse).status()).toBe(200);

      await expect.poll(() => countSubscriptionsByEndpoint(endpointA), { timeout: 10_000 }).toBe(0);
      expect(await countSubscriptionsByEndpoint(endpointB)).toBe(1);

      // B 세션은 그대로 살아 있다 (덤 확인)
      expect((await contextB.request.get(NOTIFICATIONS_PROBE)).status()).toBe(200);
    } finally {
      await contextA.close().catch(() => undefined);
      await contextB.close().catch(() => undefined);
    }
  });

  test("AC-05: 새 세션 C·D → C로 auth.signOut({ scope: 'local' }) (callback 실패 분기와 같은 호출) → D 200 · C 401", async ({
    playwright
  }) => {
    const u = userU!;
    const { url, key } = supabasePublicConfig();
    const sessionC = await signInWithSupabasePassword(u.email, u.password);
    const sessionD = await signInWithSupabasePassword(u.email, u.password);

    // callback route처럼 @supabase/ssr 서버 클라이언트를 C 쿠키로 만든 뒤 local 로그아웃
    const cookieJar = sessionC.storageState.cookies.map(({ name, value }) => ({ name, value }));
    const serverClientC = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieJar;
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            const index = cookieJar.findIndex((item) => item.name === cookie.name);
            if (index >= 0) cookieJar[index] = { name: cookie.name, value: cookie.value };
            else cookieJar.push({ name: cookie.name, value: cookie.value });
          }
        }
      }
    });
    const { error: signOutError } = await serverClientC.auth.signOut({ scope: 'local' });
    expect(signOutError).toBeNull();

    const requestD = await newProbeRequest(playwright, sessionD.storageState);
    const requestC = await newProbeRequest(playwright, sessionC.storageState);
    try {
      expect((await requestD.get(NOTIFICATIONS_PROBE)).status()).toBe(200);
      expect((await requestC.get(NOTIFICATIONS_PROBE)).status()).toBe(401);
    } finally {
      await requestD.dispose();
      await requestC.dispose();
    }
  });

  test('AC-06: V 컨텍스트 A(/dashboard/overview)·세션 B 보관 → service-role로 V inactive → A는 /auth/sign-in?accountDisabled=1 · 15초 안에 B refreshSession 실패', async ({
    browser,
    playwright
  }) => {
    const v = userV!;
    const { url, key } = supabasePublicConfig();
    const sessionA = await signInWithSupabasePassword(v.email, v.password);
    const sessionB = await signInWithSupabasePassword(v.email, v.password);
    let refreshTokenB = sessionB.session.refresh_token;

    // 변경 전 B는 살아 있다 (B 쿠키로 앱 요청은 변경 전에만 — 변경 후에는 middleware가 global을 대신 불러 판정을 오염시킨다)
    const requestB = await newProbeRequest(playwright, sessionB.storageState);
    try {
      expect((await requestB.get(NOTIFICATIONS_PROBE)).status()).toBe(200);
    } finally {
      await requestB.dispose();
    }

    const contextA = await newUserContext(browser, sessionA.storageState);
    try {
      const pageA = await contextA.newPage();
      const channelTopic = `profile-status-${v.userId}`;
      let realtimeJoined = false;
      const realtimeReady = new Promise<void>((resolve) => {
        pageA.on('websocket', (socket) => {
          socket.on('framereceived', (frame) => {
            const text =
              typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');
            if (text.includes(channelTopic) && /"status"\s*:\s*"ok"/.test(text)) {
              realtimeJoined = true;
              resolve();
            }
          });
        });
      });

      await openDashboard(pageA, v.fullName);
      await Promise.race([realtimeReady, pageA.waitForTimeout(20_000)]);
      test.info().annotations.push({
        type: 'realtime-join',
        description: realtimeJoined ? `joined ${channelTopic}` : 'join frame not observed (20s)'
      });
      // postgres_changes 구독이 서버에 붙을 시간을 조금 더 준다
      await pageA.waitForTimeout(2_000);

      await setProfileStatus(v.userId, 'inactive');

      let redirectPath = 'realtime';
      try {
        await pageA.waitForURL(/\/auth\/sign-in\?accountDisabled=1/, { timeout: 15_000 });
      } catch {
        // 실시간 이벤트가 오지 않은 환경 — 다음 요청의 middleware 경로로 확인
        redirectPath = 'middleware(reload)';
        await pageA.reload();
        await pageA.waitForURL(/\/auth\/sign-in\?.*accountDisabled=1/, { timeout: 15_000 });
      }
      test.info().annotations.push({ type: 'inactive-redirect-path', description: redirectPath });
      await expect(pageA).toHaveURL(/\/auth\/sign-in\?.*accountDisabled=1/);

      // B는 앱을 거치지 않고 Auth 서버에 직접 refresh — 15초 안에 실패해야 한다 (모든 기기 세션 종료)
      let lastRefreshError = '';
      await expect
        .poll(
          async () => {
            const client = createClient(url, key, {
              auth: { autoRefreshToken: false, persistSession: false }
            });
            const { data, error } = await client.auth.refreshSession({ refresh_token: refreshTokenB });
            if (error || !data.session) {
              lastRefreshError = error?.message ?? 'no session';
              return 'failed';
            }
            refreshTokenB = data.session.refresh_token;
            return 'refreshed';
          },
          { timeout: 15_000, intervals: [1_000, 2_000, 3_000] }
        )
        .toBe('failed');
      test.info().annotations.push({ type: 'refresh-B-error', description: lastRefreshError });
    } finally {
      await contextA.close().catch(() => undefined);
    }
  });
});

test.describe('plan 104 정적 검사 (grep)', () => {
  test("AC-07: callback route — auth.signOut({ scope: 'local' }) 4건 · 옵션 없는 auth.signOut() 0건", () => {
    const source = readSource('src/app/api/auth/google/callback/route.ts');
    expect(countMatches(source, /auth\.signOut\(\{\s*scope:\s*'local'\s*\}\)/g)).toBe(4);
    expect(countMatches(source, /auth\.signOut\(\s*\)/g)).toBe(0);
  });

  test("AC-08: src 전체 auth.signOut() 0건 · middleware global 1건+주석 · realtime global 1건 · service 기본 'local'", () => {
    const offenders = listSourceFiles(path.join(ROOT, 'src')).filter((file) =>
      /auth\.signOut\(\s*\)/.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);

    const middleware = readSource('src/lib/supabase/middleware.ts');
    expect(countMatches(middleware, /signOut\(\{\s*scope:\s*'global'\s*\}\)/g)).toBe(1);
    const lines = middleware.split(/\r?\n/);
    const globalLine = lines.findIndex((line) => /signOut\(\{\s*scope:\s*'global'\s*\}\)/.test(line));
    expect(lines[globalLine - 1]?.trim()).toMatch(/^\/\/.*plan 104/);

    // plan 105 AC-20 — realtime 강제 로그아웃은 `{ scope: 'global', reason: 'forced' }` (105가 104 시그니처에 reason 추가)
    const realtime = readSource('src/features/auth/components/profile-status-realtime.tsx');
    expect(
      countMatches(realtime, /signOut\(\{\s*scope:\s*'global'\s*(?:,\s*reason:\s*'forced'\s*)?\}\)/g)
    ).toBe(1);

    // plan 105 — `signOut(options?: { scope?: 'local' | 'global'; reason?: 'user' | 'forced' })` (여러 줄 허용)
    const service = readSource('src/features/auth/api/service.ts');
    expect(service).toMatch(
      /export async function signOut\(options\?: \{\s*scope\?: 'local' \| 'global';?\s*(?:reason\?: 'user' \| 'forced';?\s*)?\}\)/
    );
    expect(service).toMatch(/supabase\.auth\.signOut\(\{\s*scope:\s*options\?\.scope\s*\?\?\s*'local'\s*\}\)/);
  });

  test('AC-09: service.signOut 안에서 푸시 처리 호출이 supabase.auth.signOut( 보다 먼저 (plan 91 AC-17 회귀 · plan 105 기준: 일반 signOutPushOnThisDevice · 강제 unsubscribePushOnThisDevice)', () => {
    const service = readSource('src/features/auth/api/service.ts');
    const start = service.indexOf('export async function signOut(');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = service.indexOf('\n}\n', start);
    const body = service.slice(start, end);
    const unsubscribeAt = body.indexOf('await unsubscribePushOnThisDevice()');
    const userPushAt = body.indexOf('await signOutPushOnThisDevice(');
    const signOutAt = body.indexOf('supabase.auth.signOut(');
    expect(unsubscribeAt).toBeGreaterThanOrEqual(0);
    expect(userPushAt).toBeGreaterThanOrEqual(0);
    expect(signOutAt).toBeGreaterThan(unsubscribeAt);
    expect(signOutAt).toBeGreaterThan(userPushAt);
  });
});

test.describe('plan 104 정리', () => {
  test('AC-10: 일회용 사용자 U·V deleteUser 완료 · U·V push_subscriptions 잔여 0', async () => {
    const admin = getE2eServiceRoleClient();
    // V(활동 로그 없음)를 먼저 deleteUser로 지운다 — U의 RPC 폴백이 V까지 지워 버리지 않도록
    const users = [userV, userU].filter((user): user is DisposableUser => Boolean(user));
    expect(users).toHaveLength(2);

    for (const user of users) {
      const method = await deleteDisposableUser(user);
      test.info().annotations.push({ type: 'delete-method', description: `${user.fullName}: ${method}` });
      expect(method).not.toBe('none');
      const { data, error } = await admin.auth.admin.getUserById(user.userId);
      expect(data?.user ?? null).toBeNull();
      expect(error).not.toBeNull();
      expect(await countSubscriptionsByUser(user.userId)).toBe(0);
      const { count: profileCount } = await admin
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', user.userId);
      expect(profileCount ?? 0).toBe(0);
    }
  });
});
