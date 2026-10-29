import { createHash } from 'node:crypto';
import { expect, type BrowserContext, type Page, type Response } from '@playwright/test';
import { MOCK_KEYS, PUSH_SUBSCRIPTIONS_PATH } from './push-mock';
import { signInWithSupabasePassword } from './supabase-direct-auth';

/**
 * plan 105 — 브라우저 푸시 stub(「가짜 폰」) · 기기 표시 · 재로그인 흉내 helper.
 *
 * 상태는 `localStorage.__e2e_push_stub`에 둔다(같은 BrowserContext = 같은 기기 → 로그아웃·재로그인에도 유지).
 * - `Notification.permission` getter · `Notification.requestPermission` 대체
 *   - `mode:'webkit'`: 사용자 활성화(`navigator.userActivation.isActive`)가 없으면 `'denied'` (WebKit 소스와 동일)
 * - `PushManager.prototype.getSubscription` · `subscribe` 대체
 *   - `subscribe`: permission `granted`면 새 mock endpoint(`https://e2e.invalid/push/ok/<uuid>`) ·
 *     `default`이고 사용자 활성화가 없으면 `NotAllowedError` · `mode:'fail_subscribe'`면 사용자 활성화가 없을 때 항상 `NotAllowedError`
 * - 가짜 구독 객체: `{endpoint, toJSON(){endpoint, keys: MOCK_KEYS}, unsubscribe(){endpoint=null; calls.unsubscribe++}}`
 * - 호출 횟수 `calls.{requestPermission, subscribe, unsubscribe}`는 **누적**된다 → 단계마다 `resetPushStubCalls`.
 */

export const PUSH_STUB_STORAGE_KEY = '__e2e_push_stub';
export const PUSH_RESUME_MARKER_KEY = 'wakeone.push.resume-owner';
export const PUSH_DETACH_PATH = '/api/notifications/push/subscriptions/detach';
export const PUSH_RESUME_TOAST_TEXT = '휴대폰 알림을 다시 켰어요';
export const PUSH_RESUME_BANNER_TEXT = '로그아웃 전에 켜 두었던 휴대폰 알림이 꺼졌어요';

export type PushStubMode = 'chrome' | 'webkit' | 'fail_subscribe';
export type PushStubPermission = 'granted' | 'default' | 'denied';
export type PushStubCalls = { requestPermission: number; subscribe: number; unsubscribe: number };
export type PushStubState = {
  permission: PushStubPermission;
  endpoint: string | null;
  mode: PushStubMode;
  calls: PushStubCalls;
};

export type DisposableUser = { userId: string; email: string; password: string; fullName: string };

const ZERO_CALLS: PushStubCalls = { requestPermission: 0, subscribe: 0, unsubscribe: 0 };

function stubScript(initial: PushStubState) {
  return `(() => {
  const KEY = ${JSON.stringify(PUSH_STUB_STORAGE_KEY)};
  const INITIAL = ${JSON.stringify(initial)};
  const MOCK_KEYS = ${JSON.stringify(MOCK_KEYS)};
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  try { if (!load()) save(INITIAL); } catch { return; }
  if (typeof Notification === 'undefined' || typeof PushManager === 'undefined') return;
  const isActive = () => (navigator.userActivation ? navigator.userActivation.isActive : false);
  Object.defineProperty(Notification, 'permission', {
    configurable: true,
    get: () => ((load() || {}).permission || 'default')
  });
  Notification.requestPermission = async () => {
    const s = load();
    s.calls.requestPermission++;
    if (s.mode === 'webkit' && !isActive()) { save(s); return 'denied'; }
    if (s.permission === 'default' && isActive()) s.permission = 'granted';
    save(s);
    return s.permission;
  };
  const makeSub = (endpoint) => ({
    endpoint,
    expirationTime: null,
    options: { userVisibleOnly: true, applicationServerKey: null },
    getKey: () => null,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { ...MOCK_KEYS } }),
    unsubscribe: async () => {
      const s = load();
      s.endpoint = null;
      s.calls.unsubscribe++;
      save(s);
      return true;
    }
  });
  PushManager.prototype.getSubscription = async function getSubscription() {
    const s = load();
    return s && s.endpoint ? makeSub(s.endpoint) : null;
  };
  PushManager.prototype.subscribe = async function subscribe() {
    const s = load();
    const active = isActive();
    if (s.mode === 'fail_subscribe' && !active) throw new DOMException('stub fail_subscribe', 'NotAllowedError');
    if (s.permission !== 'granted' && !active) throw new DOMException('stub no permission', 'NotAllowedError');
    s.calls.subscribe++;
    s.endpoint = 'https://e2e.invalid/push/ok/' + crypto.randomUUID();
    save(s);
    return makeSub(s.endpoint);
  };
})();`;
}

/** Next dev 「N Issue」 배지(좌하단)가 사이드바 사용자 메뉴를 가린다 → dev 전용 오버레이만 숨긴다 (104 spec 동일) */
const HIDE_NEXT_DEV_OVERLAY = `(() => {
  const apply = () => {
    try {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    } catch {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();`;

/** 새 「기기」 — stub 설치 + dev 오버레이 숨김. 상태는 첫 페이지 로드 때 `initial`로 시드된다(이미 있으면 유지). */
export async function installPushBrowserStub(
  context: BrowserContext,
  initial: Partial<Omit<PushStubState, 'calls'>> = {}
) {
  const state: PushStubState = {
    permission: initial.permission ?? 'granted',
    endpoint: initial.endpoint ?? null,
    mode: initial.mode ?? 'chrome',
    calls: { ...ZERO_CALLS }
  };
  await context.addInitScript(stubScript(state));
  await context.addInitScript(HIDE_NEXT_DEV_OVERLAY);
}

export async function readPushStub(page: Page): Promise<PushStubState> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), PUSH_STUB_STORAGE_KEY);
  expect(raw, 'push stub state').toBeTruthy();
  return JSON.parse(raw!) as PushStubState;
}

export async function patchPushStub(page: Page, patch: Partial<PushStubState>) {
  await page.evaluate(
    ([key, value]) => {
      const current = JSON.parse(localStorage.getItem(key) || 'null') ?? {};
      localStorage.setItem(key, JSON.stringify({ ...current, ...value }));
    },
    [PUSH_STUB_STORAGE_KEY, patch] as const
  );
}

export async function resetPushStubCalls(page: Page) {
  await patchPushStub(page, { calls: { ...ZERO_CALLS } });
}

/** 테스트 쪽 기대 hash — `sha256('wakeone-push-owner:' + userId)` hex 앞 16자 */
export function expectedOwnerHash(userId: string): string {
  return createHash('sha256').update(`wakeone-push-owner:${userId}`).digest('hex').slice(0, 16);
}

export async function readResumeMarkerRaw(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), PUSH_RESUME_MARKER_KEY);
}

export async function readResumeMarkerOwner(page: Page): Promise<string | null> {
  const raw = await readResumeMarkerRaw(page);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { owner?: string }).owner ?? null;
  } catch {
    return null;
  }
}

export async function writeResumeMarker(page: Page, owner: string, at = Date.now()) {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [PUSH_RESUME_MARKER_KEY, JSON.stringify({ owner, at })] as const
  );
}

// ---------------------------------------------------------------------------
// 요청 기록 (subscriptions · detach)
// ---------------------------------------------------------------------------

export type PushRequestRecord = {
  method: string;
  path: string;
  status: number;
  body: Record<string, unknown> | null;
  json: { success?: boolean; data?: Record<string, unknown>; message?: string } | null;
  requestId: string | undefined;
};

export function trackPushRequests(page: Page) {
  const records: PushRequestRecord[] = [];
  page.on('response', async (response: Response) => {
    let pathname: string;
    try {
      pathname = new URL(response.url()).pathname;
    } catch {
      return;
    }
    if (pathname !== PUSH_SUBSCRIPTIONS_PATH && pathname !== PUSH_DETACH_PATH) return;
    const request = response.request();
    let body: Record<string, unknown> | null = null;
    try {
      body = request.postDataJSON() as Record<string, unknown> | null;
    } catch {
      body = null;
    }
    let json: PushRequestRecord['json'] = null;
    try {
      json = (await response.json()) as PushRequestRecord['json'];
    } catch {
      json = null;
    }
    records.push({
      method: request.method(),
      path: pathname,
      status: response.status(),
      body,
      json,
      requestId: response.headers()['x-request-id']
    });
  });
  return {
    records,
    clear() {
      records.length = 0;
    },
    posts() {
      return records.filter((r) => r.method === 'POST' && r.path === PUSH_SUBSCRIPTIONS_PATH);
    },
    deletes() {
      return records.filter((r) => r.method === 'DELETE' && r.path === PUSH_SUBSCRIPTIONS_PATH);
    },
    detaches() {
      return records.filter((r) => r.path === PUSH_DETACH_PATH);
    }
  };
}

// ---------------------------------------------------------------------------
// 로그인 흉내 · 로그아웃
// ---------------------------------------------------------------------------

/** 「재로그인」 흉내 — 같은 context(=같은 기기 · localStorage 유지)에서 쿠키만 새 세션으로 바꾼다 */
export async function loginOnDevice(context: BrowserContext, user: DisposableUser) {
  const { storageState } = await signInWithSupabasePassword(user.email, user.password);
  await context.clearCookies();
  await context.addCookies([
    ...storageState.cookies,
    // 사이드바 펼침 고정(사용자 메뉴 트리거 위치 안정)
    { name: 'sidebar_state', value: 'true', domain: 'localhost', path: '/' }
  ]);
}

/** 쿠키 없이 같은 origin 문서를 열어 기기 상태(stub·표시)를 미리 심을 때 쓴다 */
export async function openDeviceBlankPage(page: Page) {
  await page.context().clearCookies();
  await page.goto('/auth/sign-in');
  await expect(page).toHaveURL(/\/auth\/sign-in/);
}

export async function openDashboardAs(page: Page, fullName: string) {
  await page.goto('/dashboard/overview');
  await expect(page).toHaveURL(/\/dashboard\/overview/);
  await expect(page.getByTestId('nav-user-display-name')).toHaveText(fullName, { timeout: 30_000 });
}

export async function logoutViaSidebarMenu(page: Page) {
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((node) => node.remove()));
  await page.getByRole('button').filter({ has: page.getByTestId('nav-user-display-name') }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 30_000 });
}

/** 프로필 Switch ON (클릭 = 사용자 활성화) → 토스트 「휴대폰 알림을 켰어요.」 */
export async function enablePushFromProfile(page: Page) {
  await page.goto('/dashboard/profile');
  const status = page.getByTestId('push-status');
  await expect(status).toHaveAttribute('data-status', 'off', { timeout: 30_000 });
  await page.getByTestId('push-toggle').click();
  await expect(page.getByText('휴대폰 알림을 켰어요.', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(status).toHaveAttribute('data-status', 'on', { timeout: 20_000 });
}
