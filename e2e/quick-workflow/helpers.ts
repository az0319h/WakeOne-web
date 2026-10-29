import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page
} from '@playwright/test';
import { createOrgChartTestUser, uniqueOrgChartEmail } from '../helpers/org-chart';

/**
 * plan 89 · 92 — 퀵 업무 흐름 e2e 공용 (docs/plans/89 · docs/plans/92_quick-web-only-notifications-plan.md)
 * - 계정: user.json(일반) · user2.json(타 일반) · admin.json · dongbang.json · logistics.json
 * - 데이터 표식: 출발·도착 담당자 이름 `E2E…` → scripts/cleanup-e2e-mock-data.mjs가 퀵 요청을 지운다
 * - plan 92: 알림은 WakeOne 인앱 알림(`notifications`)만. 수신자 판정은 service role로 DB를 직접 읽는다
 */

export const AUTH = {
  user: 'e2e/.auth/user.json',
  user2: 'e2e/.auth/user2.json',
  admin: 'e2e/.auth/admin.json',
  dongbang: 'e2e/.auth/dongbang.json',
  logistics: 'e2e/.auth/logistics.json'
} as const;

export type AccountKey = keyof typeof AUTH;

export const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);
export const MSG = {
  forbidden: '접근 권한이 없습니다.',
  requesterCannotEdit: '요청자는 등록 후 내용을 수정할 수 없습니다.',
  requesterCannotCancel: '접수된 요청은 취소할 수 없습니다. 동방특송 담당자에게 연락해 주세요.',
  notFound: '퀵 요청을 찾을 수 없습니다.',
  stale: '이미 다른 사용자가 처리한 요청입니다. 새로고침해 주세요.',
  locked: '완료되었거나 취소된 요청은 변경할 수 없습니다.',
  finalAmountRequired: '최종금액이 입력되면 승인할 수 있습니다.'
} as const;

/** plan 92 §문구표 — 제목 */
export const NOTIFY_TITLE = {
  created: (no: string) => `새 퀵 요청 ${no}`,
  accepted: (no: string) => `퀵 ${no} 접수됨`,
  dispatched: (no: string) => `퀵 ${no} 배차완료`,
  final_amount_set: (no: string) => `퀵 ${no} 최종금액 입력`,
  approved: (no: string) => `퀵 ${no} 승인됨`,
  cancelled: (no: string) => `퀵 ${no} 취소됨`
} as const;

export type QuickNotifyEvent = keyof typeof NOTIFY_TITLE;
export const NOTIFY_TYPE = {
  vendor: 'quick_request.vendor_event',
  requester: 'quick_request.requester_event'
} as const;

export const STATUS_LABEL = {
  requested: '신규요청',
  dispatching: '접수 및 배차중',
  dispatched: '배차완료 및 결과',
  approved: '승인',
  cancelled: '취소'
} as const;

export const ABSOLUTE_DATETIME_RE = /\d{4}-\d{2}-\d{2} \([월화수목금토일]\) \d{2}:\d{2}:\d{2}/;
export const REQUEST_NO_RE = /^\d{4}-\d{2,}$/;

export const VIEWPORT_DESKTOP = { width: 1280, height: 900 } as const;
export const VIEWPORT_MOBILE = { width: 375, height: 812 } as const;

// ---------------------------------------------------------------------------
// 계정 메타 · service role
// ---------------------------------------------------------------------------

export type AccountMeta = { userId: string; email: string; password: string; fullName: string };

export function readAccountMeta(key: 'dongbang' | 'logistics'): AccountMeta {
  return JSON.parse(fs.readFileSync(`e2e/.auth/${key}.meta.json`, 'utf8')) as AccountMeta;
}

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function anonKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required.');
  return key;
}

export async function profileByEmail(email: string) {
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('user_id, full_name, affiliation, rank, position_level, leader_role, system_role, status')
    .eq('email', email)
    .single();
  if (error || !data) throw new Error(`profile lookup failed for ${email}: ${error?.message}`);
  return data as {
    user_id: string;
    full_name: string;
    affiliation: string | null;
    rank: string | null;
    position_level: string | null;
    leader_role: string | null;
    system_role: string;
    status: string;
  };
}

export async function fixtureUser(key: 'user' | 'user2' | 'admin') {
  const email =
    key === 'user'
      ? process.env.E2E_USER_EMAIL
      : key === 'user2'
        ? process.env.E2E_USER2_EMAIL
        : process.env.E2E_ADMIN_EMAIL;
  if (!email) throw new Error(`E2E_${key.toUpperCase()}_EMAIL is required`);
  const profile = await profileByEmail(email);
  return { userId: profile.user_id, fullName: profile.full_name, email };
}

export type QuickRequestDbRow = {
  id: string;
  request_no: string;
  status: string;
  requester_user_id: string;
  estimated_amount: number | null;
  final_amount: number | null;
  destination: Record<string, unknown>;
  vehicle_types: string[];
  requested_at: string;
};

export async function dbQuickRequest(requestNo: string): Promise<QuickRequestDbRow> {
  const { data, error } = await serviceClient()
    .from('quick_requests')
    .select('id, request_no, status, requester_user_id, estimated_amount, final_amount, destination, vehicle_types, requested_at')
    .eq('request_no', requestNo)
    .single();
  if (error || !data) throw new Error(`quick_requests ${requestNo}: ${error?.message}`);
  return data as QuickRequestDbRow;
}

export type QuickNotificationRow = {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
};

/** plan 92 — 요청번호 + 사건(metadata.quick_request_event)으로 모든 수신자의 알림 행을 읽는다 */
export async function dbNotificationsByEvent(
  requestNo: string,
  event: QuickNotifyEvent
): Promise<QuickNotificationRow[]> {
  const { data, error } = await serviceClient()
    .from('notifications')
    .select('id, recipient_user_id, type, title, body, metadata')
    .like('type', 'quick_request.%')
    .eq('metadata->>quick_request_no', requestNo)
    .eq('metadata->>quick_request_event', event)
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuickNotificationRow[];
}

export function notificationsOf(rows: QuickNotificationRow[], recipientUserId: string) {
  return rows.filter((row) => row.recipient_user_id === recipientUserId);
}

async function listActiveProfileIds(match: Record<string, string>): Promise<string[]> {
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('user_id')
    .eq('status', 'active')
    .match(match);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.user_id as string);
}

/** plan 92 D-4 수신 후보 (구현과 같은 판별식) */
export const listActiveDongbangIds = () => listActiveProfileIds({ affiliation: 'dongbang' });
export const listActiveAdminIds = () => listActiveProfileIds({ system_role: 'admin' });
export const listActiveLogisticsIds = () =>
  listActiveProfileIds({ affiliation: 'wake', rank: '구매물류팀', system_role: 'user' });

/** plan 92 — 수신자 검증용 동방특송 2번째 일회용 계정 (example.com · `E2E ` 이름 → teardown이 삭제) */
export async function createDisposableDongbang(label = 'dongbang2'): Promise<AccountMeta> {
  const email = uniqueOrgChartEmail(label);
  const fullName = `E2E 동방특송2 ${Date.now()}`;
  const password = 'E2eDongbang9!';
  const created = await createOrgChartTestUser(label, {
    email,
    password,
    affiliation: 'dongbang',
    rank: null,
    position_level: null,
    leader_role: null,
    birthday: null,
    phone: '01055550002',
    fullName
  });
  return { userId: created.userId, email, password, fullName };
}

/** plan 93 — 채팅 알림 type */
export const CHAT_NOTIFY_TYPE = 'quick_request.chat_message' as const;

/**
 * plan 93 — 요청번호(+ 메시지 id)로 `quick_request.chat_message` 알림 전 수신자 행을 읽는다.
 * `metadata.quick_request_message_id`로 메시지 1건의 수신자를 판정한다 (AC-22~26).
 */
export async function dbChatNotifications(
  requestNo: string,
  messageId?: number
): Promise<(QuickNotificationRow & { status: string })[]> {
  let query = serviceClient()
    .from('notifications')
    .select('id, recipient_user_id, type, title, body, metadata, status')
    .eq('type', CHAT_NOTIFY_TYPE)
    .eq('metadata->>quick_request_no', requestNo);
  if (messageId !== undefined) {
    query = query.eq('metadata->>quick_request_message_id', String(messageId));
  }
  const { data, error } = await query.order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as (QuickNotificationRow & { status: string })[];
}

export async function dbNotifications(recipientUserId: string, requestNo: string) {
  const { data, error } = await serviceClient()
    .from('notifications')
    .select('id, type, title, body, metadata')
    .eq('recipient_user_id', recipientUserId)
    .like('type', 'quick_request.%')
    .eq('metadata->>quick_request_no', requestNo);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; type: string; title: string; body: string; metadata: Record<string, unknown> }[];
}

// ---------------------------------------------------------------------------
// API context (계정별)
// ---------------------------------------------------------------------------

export async function apiAs(account: AccountKey, baseURL = BASE_URL): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, storageState: AUTH[account] });
}

export async function withApi<T>(
  account: AccountKey,
  fn: (api: APIRequestContext) => Promise<T>,
  baseURL = BASE_URL
): Promise<T> {
  const api = await apiAs(account, baseURL);
  try {
    return await fn(api);
  } finally {
    await api.dispose();
  }
}

export type ApiResult = {
  status: number;
  body: { success?: boolean; message?: string; data?: unknown } & Record<string, unknown>;
  headers: Record<string, string>;
};

async function toApiResult(response: APIResponse): Promise<ApiResult> {
  const text = await response.text();
  let body: ApiResult['body'] = {};
  try {
    body = JSON.parse(text) as ApiResult['body'];
  } catch {
    body = { raw: text };
  }
  return { status: response.status(), body, headers: response.headers() };
}

/** 계정 context로 호출하고 dispose 전에 status·body·headers를 읽어 돌려준다 */
export async function callAs(
  account: AccountKey,
  run: (api: APIRequestContext) => Promise<APIResponse>
): Promise<ApiResult> {
  return withApi(account, async (api) => toApiResult(await run(api)));
}

export async function callManyAs(
  account: AccountKey,
  run: (api: APIRequestContext) => Promise<APIResponse[]>
): Promise<ApiResult[]> {
  return withApi(account, async (api) => Promise.all((await run(api)).map(toApiResult)));
}

export async function pageAs(
  browser: Browser,
  account: AccountKey,
  options: { viewport?: { width: number; height: number }; baseURL?: string; clipboard?: boolean } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: AUTH[account],
    baseURL: options.baseURL ?? BASE_URL,
    viewport: options.viewport ?? VIEWPORT_DESKTOP,
    permissions: options.clipboard ? ['clipboard-read', 'clipboard-write'] : []
  });
  const page = await context.newPage();
  return { context, page };
}

// ---------------------------------------------------------------------------
// 퀵 요청 payload · 상태 전이 (API)
// ---------------------------------------------------------------------------

export function uniqueTag(prefix = 'E2E89') {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const CONTACT_PHONE_ORIGIN = '01055501234';
export const CONTACT_PHONE_DEST = '01055505678';

export function buildCreateBody(tag = uniqueTag(), overrides: Record<string, unknown> = {}) {
  return {
    itemDescription: '',
    goodsSize: 's',
    vehicleTypes: ['오토바이'],
    vehicleCount: 1,
    freightPayment: 'monthly',
    origin: {
      roadAddress: '서울 강남구 테헤란로 152',
      detailAddress: `${tag} 출발 3층`,
      contactName: 'E2E 출발담당',
      contactPhone: CONTACT_PHONE_ORIGIN,
      schedule: { mode: 'immediate' },
      notes: []
    },
    stopovers: [],
    destination: {
      roadAddress: '서울 용산구 한강대로 405',
      detailAddress: `${tag} 도착 2층`,
      contactName: 'E2E 도착담당',
      contactPhone: CONTACT_PHONE_DEST,
      schedule: { mode: 'asap' },
      notes: []
    },
    requesterName: '무시되는 이름',
    requestedAtIso: '2000-01-01T00:00:00.000Z',
    ...overrides
  };
}

/** plan 92 — 등록 201 `{data:{requestNo,id}}` */
export type CreatedQuickRequest = { requestNo: string; id: string } & Record<string, unknown>;

export async function readJson<T = Record<string, unknown>>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

export async function createQuickRequestApi(
  api: APIRequestContext,
  body: Record<string, unknown> = buildCreateBody()
): Promise<CreatedQuickRequest> {
  const response = await api.post('/api/quick-request', { data: body });
  expect(response.status(), `POST /api/quick-request ${await response.text()}`).toBe(201);
  const json = await readJson<{ success: boolean; data: CreatedQuickRequest }>(response);
  expect(json.success).toBe(true);
  expect(json.data.requestNo).toMatch(REQUEST_NO_RE);
  return json.data;
}

export async function createAs(account: 'user' | 'user2' | 'admin' | 'logistics', tag?: string) {
  return withApi(account, (api) => createQuickRequestApi(api, buildCreateBody(tag)));
}

export const DISPATCH_BODY = {
  estimatedAmount: 20000,
  vehicleInfo: '21마 6543',
  driverName: '홍길동',
  driverPhone: '01012345678'
} as const;

export async function expectOk(response: APIResponse, label: string) {
  expect(response.status(), `${label} ${await response.text()}`).toBe(200);
}

export async function acceptAs(account: AccountKey, requestNo: string) {
  return withApi(account, async (api) => {
    const response = await api.post(`/api/quick-request/${requestNo}/accept`);
    await expectOk(response, `accept ${requestNo}`);
  });
}

export type DispatchBody = { estimatedAmount: number; vehicleInfo: string; driverName: string; driverPhone: string };

export async function dispatchAs(account: AccountKey, requestNo: string, body: DispatchBody = DISPATCH_BODY) {
  return withApi(account, async (api) => {
    const response = await api.post(`/api/quick-request/${requestNo}/dispatch`, { data: body });
    await expectOk(response, `dispatch ${requestNo}`);
  });
}

export async function setFinalAs(account: AccountKey, requestNo: string, finalAmount: number) {
  return withApi(account, async (api) => {
    const response = await api.patch(`/api/quick-request/${requestNo}`, { data: { finalAmount } });
    await expectOk(response, `final ${requestNo}`);
  });
}

export async function approveAs(account: AccountKey, requestNo: string) {
  return withApi(account, async (api) => {
    const response = await api.post(`/api/quick-request/${requestNo}/approve`);
    await expectOk(response, `approve ${requestNo}`);
  });
}

export async function cancelAs(account: AccountKey, requestNo: string, reason?: string) {
  return withApi(account, async (api) => {
    const response = await api.post(`/api/quick-request/${requestNo}/cancel`, {
      data: reason ? { reason } : {}
    });
    await expectOk(response, `cancel ${requestNo}`);
  });
}

/** 요청자(user) 등록 → 원하는 상태까지 진행 */
export async function seedQuickRequest(
  target: 'requested' | 'dispatching' | 'dispatched' | 'dispatchedWithFinal' | 'approved' | 'cancelled',
  requester: 'user' | 'user2' | 'admin' = 'user',
  tag?: string
) {
  const created = await createAs(requester, tag);
  const no = created.requestNo;
  if (target === 'requested') return created;
  if (target === 'cancelled') {
    await cancelAs('dongbang', no);
    return created;
  }
  await acceptAs('dongbang', no);
  if (target === 'dispatching') return created;
  await dispatchAs('dongbang', no);
  if (target === 'dispatched') return created;
  await setFinalAs('dongbang', no, 23000);
  if (target === 'dispatchedWithFinal') return created;
  await approveAs(requester, no);
  return created;
}

// ---------------------------------------------------------------------------
// activity log (admin API)
// ---------------------------------------------------------------------------

export type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  target_label?: string;
  metadata?: Record<string, unknown>;
};

export async function findActivityLog(
  action: string,
  predicate: (item: ActivityLogItem) => boolean,
  message: string
): Promise<ActivityLogItem> {
  let matched: ActivityLogItem | undefined;
  await withApi('admin', async (admin) => {
    await expect
      .poll(
        async () => {
          const response = await admin.get(
            `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50&log_user=all`
          );
          expect(response.status()).toBe(200);
          const body = await readJson<{ data?: { logs?: ActivityLogItem[] } }>(response);
          matched = (body.data?.logs ?? []).find((item) => item.action === action && predicate(item));
          return Boolean(matched);
        },
        { timeout: 20_000, message }
      )
      .toBe(true);
  });
  return matched!;
}

export function expectLogFor(action: string, requestNo: string, status = 200) {
  return findActivityLog(
    action,
    (item) => item.target_label === requestNo && item.http_status === status,
    `activity log ${action} ${status} ${requestNo}`
  );
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export async function gotoDashboard(page: Page, query = '') {
  await page.goto(`/dashboard/quick${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
}

export async function gotoDetail(page: Page, requestNo: string) {
  await page.goto(`/dashboard/quick/${requestNo}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
}

export function detailStatus(page: Page) {
  return page.getByTestId('quick-detail-status');
}

export async function expectDetailStatus(page: Page, status: keyof typeof STATUS_LABEL) {
  await expect(detailStatus(page)).toHaveText(STATUS_LABEL[status], { timeout: 20_000 });
}

export function toast(page: Page, text: string) {
  return page.getByText(text, { exact: true });
}

/** 문서 가로 스크롤 0 */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth
  );
}
