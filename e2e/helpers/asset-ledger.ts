import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page
} from '@playwright/test';
import { e2eBaseURL, readNormalizedStorageState } from './auth-request';

/**
 * plan 103 — 구독 관리 · 비품 관리 e2e 공통 helper.
 *
 * - 계정: admin(공용) · hr(웨이크 인사팀 · setup-hr-benefits) · 동방(setup-dongbang)
 *   + 전용 4명(setup-asset-ledger): accounting(회계팀) · staff(디자인팀 A) · teammate(디자인팀 B) · other(마케팅팀 C)
 * - 대장 fixture는 service role로 직접 만들고 **`source='e2e'` + 이름/모델·시리얼 `E2E` 접두**를 붙인다.
 *   이관 데이터(`source='excel_import'`)에는 요청·수정·삭제를 하지 않는다.
 * - 자산번호 fixture는 접두사 `N`을 쓰지 않는다(AC-17 「다음 번호」 기대값 보호) · 4자리 5000~9999 사용.
 * - 메일 Route는 호출하지 않는다(이 기능은 메일 없음).
 */

export type AssetRole = 'admin' | 'hr' | 'accounting' | 'staff' | 'teammate' | 'other' | 'dongbang';
type DisposableRole = 'accounting' | 'staff' | 'teammate' | 'other';

export const ASSET_STORAGE: Record<AssetRole, string> = {
  admin: 'e2e/.auth/admin.json',
  hr: 'e2e/.auth/hr-benefits.json',
  accounting: 'e2e/.auth/asset-accounting.json',
  staff: 'e2e/.auth/asset-staff.json',
  teammate: 'e2e/.auth/asset-teammate.json',
  other: 'e2e/.auth/asset-other.json',
  dongbang: 'e2e/.auth/dongbang.json'
};

export const ASSET_META_FILE = 'e2e/.auth/asset-ledger.meta.json';
export const SUBSCRIPTIONS_PATH = '/dashboard/subscriptions';
export const EQUIPMENT_PATH = '/dashboard/equipment';
export const VIEWPORT_DESKTOP = { width: 1440, height: 900 } as const;
export const VIEWPORT_PHONE = { width: 390, height: 844 } as const;
export const ABSOLUTE_DATETIME_RE = /\d{4}-\d{2}-\d{2} \([월화수목금토일]\) \d{2}:\d{2}:\d{2}/;
export const UI_TIMEOUT = 30_000;

export const MSG = {
  forbidden: '권한이 없습니다.',
  dongbangForbidden: '접근 권한이 없습니다.',
  dongbangToast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.',
  secret: '비밀번호·로그인 정보는 저장할 수 없어요.',
  invalidAssignee: '선택할 수 없는 대상자예요.',
  duplicateAssignee: '같은 대상자가 두 번 들어 있어요.',
  duplicateAssetNo: '이미 있는 자산번호예요.',
  prefixMismatch: '품목과 자산번호 앞글자가 맞지 않아요.',
  hasRequests: '요청 기록이 있어 삭제할 수 없어요.',
  equipmentDeleteBlocked:
    '요청 기록이 있는 장비는 지울 수 없어요. 더 안 쓰면 상태를 「폐기」로 바꿔 주세요.',
  bodyTooShort: '내용을 5자 이상 적어 주세요.',
  duplicateOpen: '이미 진행 중인 요청이 있어요.',
  pendingOnly: '접수대기일 때만 수정·취소할 수 있어요.',
  startFirst: '먼저 처리를 시작해 주세요.',
  alreadyDone: '이미 끝난 요청이에요.',
  rejectReasonRequired: '반려 사유를 입력해 주세요.',
  managerHint: '완료해도 장비 정보는 자동으로 바뀌지 않아요.',
  commentDeleted: '삭제된 댓글입니다.',
  invalidPushGroup: '알림 종류가 올바르지 않습니다.'
} as const;

// ---------------------------------------------------------------------------
// 계정 · 세션
// ---------------------------------------------------------------------------

type MetaEntry = { userId: string; email: string; fullName: string; rank: string };

export function assetMeta(): Record<DisposableRole, MetaEntry> {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), ASSET_META_FILE), 'utf8')) as Record<
    DisposableRole,
    MetaEntry
  >;
}

export function readUserIdFromStorage(storagePath: string): string {
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), storagePath), 'utf8')) as {
    cookies: Array<{ name: string; value: string }>;
  };
  const chunks = state.cookies
    .filter((cookie) => cookie.name.startsWith('sb-') && /-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (chunks.length === 0) throw new Error(`Missing auth cookie in ${storagePath}`);
  const raw = decodeURIComponent(chunks.map((cookie) => cookie.value).join(''));
  const session = JSON.parse(
    raw.startsWith('base64-') ? Buffer.from(raw.slice(7), 'base64').toString('utf8') : raw
  ) as { user?: { id?: string } };
  const userId = session.user?.id;
  if (!userId) throw new Error(`Could not parse user id from ${storagePath}`);
  return userId;
}

export function userIdOf(role: AssetRole): string {
  if (role === 'accounting' || role === 'staff' || role === 'teammate' || role === 'other') {
    return assetMeta()[role].userId;
  }
  return readUserIdFromStorage(ASSET_STORAGE[role]);
}

const nameCache = new Map<string, string>();

export async function fullNameOf(role: AssetRole): Promise<string> {
  const userId = userIdOf(role);
  const cached = nameCache.get(userId);
  if (cached) return cached;
  const { data, error } = await service()
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new Error(`profile lookup failed for ${role}: ${error?.message}`);
  const name = (data as { full_name: string }).full_name;
  nameCache.set(userId, name);
  return name;
}

let serviceClient: SupabaseClient | null = null;

export function service(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  serviceClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return serviceClient;
}

type PlaywrightLike = {
  request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> };
};

export async function apiAs(playwright: PlaywrightLike, role: AssetRole): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: readNormalizedStorageState(ASSET_STORAGE[role]),
    baseURL: e2eBaseURL
  });
}

export async function withApi<T>(
  playwright: PlaywrightLike,
  role: AssetRole,
  fn: (api: APIRequestContext) => Promise<T>
): Promise<T> {
  const api = await apiAs(playwright, role);
  try {
    return await fn(api);
  } finally {
    await api.dispose();
  }
}

export async function contextAs(
  browser: Browser,
  role: AssetRole,
  viewport: { width: number; height: number } = VIEWPORT_DESKTOP
): Promise<BrowserContext> {
  const context = await browser.newContext({
    storageState: readNormalizedStorageState(ASSET_STORAGE[role]),
    baseURL: e2eBaseURL,
    viewport
  });
  // 사이드바 펼친 상태(배지·그룹 라벨이 CSS로 숨지 않게 · FE handoff §6-1)
  await context.addCookies([{ name: 'sidebar_state', value: 'true', domain: 'localhost', path: '/' }]);
  return context;
}

export async function pageAs(
  browser: Browser,
  role: AssetRole,
  viewport: { width: number; height: number } = VIEWPORT_DESKTOP
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await contextAs(browser, role, viewport);
  const page = await context.newPage();
  return { context, page };
}

export async function json<T = Record<string, unknown>>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

export async function expectApiError(response: APIResponse, status: number, message: string) {
  const body = await json<{ success?: boolean; message?: string }>(response);
  expect(response.status(), `${response.url()} status`).toBe(status);
  expect(body.success, `${response.url()} success`).toBe(false);
  expect(body.message, `${response.url()} message`).toBe(message);
}

// ---------------------------------------------------------------------------
// 표식
// ---------------------------------------------------------------------------

/** 고유 태그 — 이름·모델 검색(q)으로 내 fixture만 모아 보기 */
export function uniqueTag(prefix = 'E2E103'): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 대장 fixture (service role · source='e2e')
// ---------------------------------------------------------------------------

export type AssigneeFixture =
  | { type: 'user'; role: AssetRole }
  | { type: 'userId'; userId: string }
  | { type: 'team'; affiliation: 'wake' | 'sans' | 'sans_foundry'; rank: string }
  | { type: 'affiliation'; affiliation: 'wake' | 'sans' | 'sans_foundry' };

export type SubscriptionFixtureInput = {
  name: string;
  category?: 'creative' | 'software' | 'collaboration' | 'etc';
  status?: 'active' | 'cancel_scheduled' | 'canceled';
  plan_name?: string | null;
  purpose?: string | null;
  expires_on?: string | null;
  payer_entity?: string | null;
  card_last4?: string | null;
  billing_cycle?: 'monthly' | 'yearly' | null;
  billing_day?: number | null;
  billing_date?: string | null;
  amount?: number | null;
  currency?: 'KRW' | 'USD' | null;
  amount_varies?: boolean;
  started_on?: string | null;
  owner_account?: string | null;
  manager_memo?: string | null;
  assignees?: AssigneeFixture[];
};

function assigneeRow(assignee: AssigneeFixture) {
  if (assignee.type === 'user') {
    return { assignee_type: 'user', user_id: userIdOf(assignee.role), affiliation: null, rank: null };
  }
  if (assignee.type === 'userId') {
    return { assignee_type: 'user', user_id: assignee.userId, affiliation: null, rank: null };
  }
  if (assignee.type === 'team') {
    return { assignee_type: 'team', user_id: null, affiliation: assignee.affiliation, rank: assignee.rank };
  }
  return { assignee_type: 'affiliation', user_id: null, affiliation: assignee.affiliation, rank: null };
}

export async function createSubscriptionFixture(input: SubscriptionFixtureInput): Promise<number> {
  if (!input.name.startsWith('E2E')) throw new Error('fixture 구독명은 E2E로 시작해야 합니다.');
  const { assignees = [], ...fields } = input;
  const { data, error } = await service()
    .from('subscriptions')
    .insert({
      category: 'software',
      status: 'active',
      amount_varies: false,
      ...fields,
      source: 'e2e'
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`subscription fixture failed: ${error?.message}`);
  const id = (data as { id: number }).id;
  if (assignees.length > 0) {
    const { error: assigneeError } = await service()
      .from('subscription_assignees')
      .insert(assignees.map((assignee) => ({ subscription_id: id, ...assigneeRow(assignee) })));
    if (assigneeError) throw new Error(`subscription assignee fixture failed: ${assigneeError.message}`);
  }
  return id;
}

const PREFIX_BY_KIND = {
  monitor: 'M',
  desktop: 'W',
  mouse: 'S',
  keyboard: 'K',
  tablet: 'T',
  store_device: 'R',
  etc: 'A'
} as const;

export type EquipmentKindFixture = keyof typeof PREFIX_BY_KIND;

export type EquipmentFixtureInput = {
  kind?: EquipmentKindFixture;
  model_serial: string;
  status?: 'in_use' | 'stored' | 'repair' | 'lost' | 'disposed';
  assignee?: Exclude<AssigneeFixture, { type: 'affiliation' }> | null;
  ledger_entity?: string | null;
  ledger_code?: string | null;
  purchase_amount?: number | null;
  purchased_on?: string | null;
  vendor?: string | null;
  manager_memo?: string | null;
};

export type EquipmentFixture = { id: number; asset_no: string };

export async function createEquipmentFixture(input: EquipmentFixtureInput): Promise<EquipmentFixture> {
  if (!input.model_serial.startsWith('E2E')) throw new Error('fixture 모델·시리얼은 E2E로 시작해야 합니다.');
  const { assignee = null, kind = 'monitor', ...fields } = input;
  const prefix = PREFIX_BY_KIND[kind];
  const assigneeFields = !assignee
    ? { assignee_type: null, assignee_user_id: null, assignee_affiliation: null, assignee_rank: null }
    : assignee.type === 'team'
      ? {
          assignee_type: 'team',
          assignee_user_id: null,
          assignee_affiliation: assignee.affiliation,
          assignee_rank: assignee.rank
        }
      : {
          assignee_type: 'user',
          assignee_user_id: assignee.type === 'user' ? userIdOf(assignee.role) : assignee.userId,
          assignee_affiliation: null,
          assignee_rank: null
        };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const assetNo = `${prefix}-${5000 + Math.floor(Math.random() * 5000)}`;
    const { data, error } = await service()
      .from('equipment_items')
      .insert({
        status: 'in_use',
        ...fields,
        kind,
        asset_no: assetNo,
        ...assigneeFields,
        source: 'e2e'
      })
      .select('id, asset_no')
      .single();
    if (!error && data) return data as EquipmentFixture;
    if (error && error.code !== '23505') throw new Error(`equipment fixture failed: ${error.message}`);
  }
  throw new Error('equipment fixture: 자산번호를 고르지 못했습니다.');
}

export type RequestFixtureInput = {
  target: { type: 'equipment' | 'subscription'; id: number };
  requester: AssetRole;
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'canceled';
  assignee?: AssetRole | null;
  request_type?: string;
  body?: string;
  reject_reason?: string | null;
};

/** 요청 상태만 필요한 화면 AC용 — service role 직접 INSERT(알림 없음) */
export async function createRequestFixture(input: RequestFixtureInput): Promise<number> {
  const label = await targetLabelOf(input.target.type, input.target.id);
  const status = input.status ?? 'pending';
  const { data, error } = await service()
    .from('asset_requests')
    .insert({
      target_type: input.target.type,
      subscription_id: input.target.type === 'subscription' ? input.target.id : null,
      equipment_id: input.target.type === 'equipment' ? input.target.id : null,
      target_label: label,
      request_type: input.request_type ?? (input.target.type === 'equipment' ? 'repair' : 'change'),
      body: input.body ?? 'E2E 요청 본문입니다.',
      status,
      requester_user_id: userIdOf(input.requester),
      requester_name: await fullNameOf(input.requester),
      assignee_user_id: input.assignee ? userIdOf(input.assignee) : null,
      reject_reason: status === 'rejected' ? (input.reject_reason ?? 'E2E 반려') : null,
      status_updated_at: status === 'pending' ? null : new Date().toISOString(),
      status_updated_by: input.assignee ? userIdOf(input.assignee) : null
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`request fixture failed: ${error?.message}`);
  return (data as { id: number }).id;
}

export async function targetLabelOf(type: 'equipment' | 'subscription', id: number): Promise<string> {
  if (type === 'subscription') {
    const { data } = await service().from('subscriptions').select('name, plan_name').eq('id', id).single();
    const row = data as { name: string; plan_name: string | null };
    return row.plan_name ? `${row.name} · ${row.plan_name}` : row.name;
  }
  const { data } = await service().from('equipment_items').select('asset_no, model_serial').eq('id', id).single();
  const row = data as { asset_no: string; model_serial: string | null };
  return row.model_serial ? `${row.asset_no} · ${row.model_serial}` : row.asset_no;
}

/**
 * 이전 테스트가 남긴 E2E 요청(진행 중 배지·요청 표 건수에 섞임)을 지운다.
 * 대상 = `source='e2e'` 대장 행 · `source='manual'` + `E2E` 이름 행의 요청만 (이관 행 요청은 절대 건드리지 않음).
 * 알림(metadata.asset_request_id)을 먼저 지워 고아 알림을 남기지 않는다.
 */
export async function purgeE2eRequests(): Promise<void> {
  const client = service();
  const [{ data: subs }, { data: subsManual }, { data: eqs }, { data: eqsManual }] = await Promise.all([
    client.from('subscriptions').select('id').eq('source', 'e2e'),
    client.from('subscriptions').select('id').eq('source', 'manual').ilike('name', 'E2E%'),
    client.from('equipment_items').select('id').eq('source', 'e2e'),
    client.from('equipment_items').select('id').eq('source', 'manual').ilike('model_serial', 'E2E%')
  ]);
  const subscriptionIds = [...(subs ?? []), ...(subsManual ?? [])].map((row) => (row as { id: number }).id);
  const equipmentIds = [...(eqs ?? []), ...(eqsManual ?? [])].map((row) => (row as { id: number }).id);
  const requestIds = new Set<number>();
  for (const [column, ids] of [
    ['subscription_id', subscriptionIds],
    ['equipment_id', equipmentIds]
  ] as const) {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data } = await client.from('asset_requests').select('id').in(column, ids.slice(offset, offset + 100));
      for (const row of data ?? []) requestIds.add((row as { id: number }).id);
    }
  }
  const all = [...requestIds];
  for (let offset = 0; offset < all.length; offset += 100) {
    const slice = all.slice(offset, offset + 100);
    const { error: notifError } = await client
      .from('notifications')
      .delete()
      .like('type', 'asset_request.%')
      .in('metadata->>asset_request_id', slice.map(String));
    if (notifError) throw new Error(`purge notifications failed: ${notifError.message}`);
    const { error } = await client.from('asset_requests').delete().in('id', slice);
    if (error) throw new Error(`purge requests failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 요청 API (실제 Route — 알림·로그가 생긴다)
// ---------------------------------------------------------------------------

export async function createRequestViaApi(
  api: APIRequestContext,
  input: { target_type: 'equipment' | 'subscription'; target_id: number; request_type?: string; body?: string }
): Promise<{ id: number; response: APIResponse }> {
  const response = await api.post('/api/asset-requests', {
    data: {
      target_type: input.target_type,
      target_id: input.target_id,
      request_type: input.request_type ?? (input.target_type === 'equipment' ? 'repair' : 'change'),
      body: input.body ?? 'E2E 요청 — 화면에 줄이 생겨요.'
    }
  });
  expect(response.status(), `POST /api/asset-requests ${await response.text()}`).toBe(201);
  const body = (await response.json()) as { request: { id: number } };
  return { id: body.request.id, response };
}

export async function changeStatusViaApi(
  api: APIRequestContext,
  requestId: number,
  status: 'in_progress' | 'completed' | 'rejected',
  rejectReason?: string
): Promise<APIResponse> {
  const response = await api.post(`/api/asset-requests/${requestId}/status`, {
    data: rejectReason ? { status, reject_reason: rejectReason } : { status }
  });
  expect(response.status(), `status → ${status}: ${await response.text()}`).toBe(200);
  return response;
}

export async function postCommentViaApi(
  api: APIRequestContext,
  requestId: number,
  body: string,
  parentId?: number
): Promise<{ id: number; response: APIResponse }> {
  const response = parentId
    ? await api.post(`/api/asset-requests/${requestId}/comments/${parentId}/replies`, { data: { body } })
    : await api.post(`/api/asset-requests/${requestId}/comments`, { data: { body } });
  expect(response.status(), `comment POST ${await response.text()}`).toBe(201);
  const json = (await response.json()) as { comment: { id: number } };
  return { id: json.comment.id, response };
}

// ---------------------------------------------------------------------------
// 활동 로그 · 알림 (service role 읽기)
// ---------------------------------------------------------------------------

export type ActivityLogRow = {
  request_id: string;
  action: string;
  target_type: string | null;
  http_method: string | null;
  http_status: number | null;
  metadata: Record<string, unknown> | null;
  actor_user_id: string | null;
};

export async function logsByRequestId(requestId: string | undefined): Promise<ActivityLogRow[]> {
  if (!requestId) return [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await service()
      .from('activity_logs')
      .select('request_id, action, target_type, http_method, http_status, metadata, actor_user_id')
      .eq('request_id', requestId);
    if (error) throw new Error(`activity_logs lookup failed: ${error.message}`);
    if ((data ?? []).length > 0) return data as ActivityLogRow[];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return [];
}

/** 응답의 x-request-id로 activity_logs 행 1개 확인 */
export async function expectLog(
  response: APIResponse | { headers: () => Record<string, string> },
  expected: { action: string; status: number; target_type?: string }
): Promise<ActivityLogRow> {
  const requestId = response.headers()['x-request-id'];
  expect(requestId, `x-request-id for ${expected.action}`).toBeTruthy();
  const rows = await logsByRequestId(requestId);
  const row = rows.find((item) => item.action === expected.action);
  expect(row, `activity log ${expected.action} (${requestId})`).toBeTruthy();
  expect(row?.http_status, `${expected.action} http_status`).toBe(expected.status);
  if (expected.target_type) expect(row?.target_type).toBe(expected.target_type);
  return row as ActivityLogRow;
}

export type NotificationRow = {
  id: number;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function notificationsForRequest(requestId: number, type?: string): Promise<NotificationRow[]> {
  let query = service()
    .from('notifications')
    .select('id, recipient_user_id, type, title, body, metadata, created_at')
    .eq('metadata->>asset_request_id', String(requestId));
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('id', { ascending: true });
  if (error) throw new Error(`notifications lookup failed: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

/** 알림 INSERT가 응답 뒤에 끝날 수 있어 원하는 건수까지 잠깐 기다린다 */
export async function waitNotifications(
  requestId: number,
  type: string,
  predicate: (rows: NotificationRow[]) => boolean,
  timeoutMs = 10_000
): Promise<NotificationRow[]> {
  const started = Date.now();
  let rows: NotificationRow[] = [];
  while (Date.now() - started < timeoutMs) {
    rows = await notificationsForRequest(requestId, type);
    if (predicate(rows)) return rows;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return rows;
}

/** active 권한자(admin · wake 인사팀 · wake 회계팀) user_id — plan D-1 판정과 같은 규칙 */
export async function activeManagerIds(): Promise<string[]> {
  const { data, error } = await service()
    .from('profiles')
    .select('user_id, system_role, affiliation, rank')
    .eq('status', 'active');
  if (error) throw new Error(`profiles lookup failed: ${error.message}`);
  return (data ?? [])
    .filter((row) => {
      const profile = row as { system_role: string; affiliation: string | null; rank: string | null };
      return (
        profile.system_role === 'admin' ||
        (profile.system_role === 'user' &&
          profile.affiliation === 'wake' &&
          (profile.rank === '인사팀' || profile.rank === '회계팀'))
      );
    })
    .map((row) => (row as { user_id: string }).user_id)
    .sort();
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

/** sonner 토스트 영역 (role=region 「Notifications alt+T」) */
export function toastRegion(page: Page): Locator {
  return page.getByRole('region', { name: /Notifications/ });
}

export async function expectToast(page: Page, text: string) {
  await expect(toastRegion(page)).toContainText(text, { timeout: 15_000 });
}

export async function gotoLedger(page: Page, kind: 'subscriptions' | 'equipment', query = '') {
  const base = kind === 'subscriptions' ? SUBSCRIPTIONS_PATH : EQUIPMENT_PATH;
  await page.goto(`${base}${query ? `?${query}` : ''}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(kind === 'subscriptions' ? 'subscriptions-page' : 'equipment-page')).toBeVisible({
    timeout: UI_TIMEOUT
  });
}

/** 목록 본문(표 또는 빈 상태)이 그려질 때까지 */
export async function waitListBody(page: Page, kind: 'subscriptions' | 'equipment') {
  const table = page.getByTestId(kind === 'subscriptions' ? 'subscription-table' : 'equipment-table');
  const empty = page.getByTestId('asset-list-empty');
  const cards = page.getByTestId('asset-list-cards');
  await expect(table.or(empty).or(cards).first()).toBeAttached({ timeout: UI_TIMEOUT });
}

export function rowsOf(page: Page, kind: 'subscriptions' | 'equipment'): Locator {
  return page.getByTestId(kind === 'subscriptions' ? /^subscription-row-\d+$/ : /^equipment-row-\d+$/);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(scrollWidth, '가로 스크롤 없음').toBeLessThanOrEqual(clientWidth + 1);
}

/** 사이드바 링크가 속한 그룹 라벨 (구조 확인용 evaluate — 셀렉터 아님) */
export async function sidebarGroupLabelOf(link: Locator): Promise<string | null> {
  return link.evaluate((element) => {
    let node: Element | null = element;
    while (node && node.getAttribute('data-slot') !== 'sidebar-group') node = node.parentElement;
    const label = node?.querySelector('[data-slot="sidebar-group-label"], [data-sidebar="group-label"]');
    return label?.textContent?.trim() ?? null;
  });
}
