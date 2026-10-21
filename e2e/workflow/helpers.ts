import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page
} from '@playwright/test';
import { e2eBaseURL, readNormalizedStorageState } from '../helpers/auth-request';

/**
 * plan 88 — 워크플로우(전자결재) 지출결의서 e2e 공통 helpers.
 * 역할: user = 작성자, user2 = 승인자 A, hr = 승인자 B / 외부인 / 참조자, admin = 시스템 관리자(워크플로우 관리자).
 * e2e로 만든 문서는 비고(note)에 `E2E-WF-{ts}` 표식을 넣는다 → cleanup 대상.
 */

export type Role = 'admin' | 'user' | 'user2' | 'hr';

export const STORAGE: Record<Role, string> = {
  admin: 'e2e/.auth/admin.json',
  user: 'e2e/.auth/user.json',
  user2: 'e2e/.auth/user2.json',
  hr: 'e2e/.auth/hr-benefits.json'
};

export const WORKFLOW_PATH = '/dashboard/workflow';
export const SETTINGS_PATH = '/dashboard/workflow/settings';
export const VIEWPORT_DESKTOP = { width: 1280, height: 900 } as const;
export const VIEWPORT_MOBILE = { width: 375, height: 812 } as const;

export const REQ_PURCHASE = '구매 요청';
export const REQ_PAYMENT = '입, 출금 요청';

export const FIELD_KEYS = [
  'request_type',
  'writer_name',
  'written_date',
  'brand',
  'amount',
  'due_date',
  'vendor_account_holder',
  'bank_account',
  'item_quantity',
  'delivery_address',
  'recipient',
  'link_url',
  'purchase_reason',
  'note',
  'reference_documents'
] as const;

export const COMMON_REQUIRED = [
  'request_type',
  'writer_name',
  'written_date',
  'brand',
  'amount',
  'purchase_reason'
] as const;

export function marker(): string {
  return `E2E-WF-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
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

export function uid(role: Role): string {
  return readUserIdFromStorage(STORAGE[role]);
}

type PlaywrightLike = { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } };

export async function apiAs(playwright: PlaywrightLike, role: Role): Promise<APIRequestContext> {
  return playwright.request.newContext({
    storageState: readNormalizedStorageState(STORAGE[role]),
    baseURL: e2eBaseURL
  });
}

export async function contextAs(
  browser: Browser,
  role: Role,
  viewport: { width: number; height: number } = VIEWPORT_DESKTOP
): Promise<BrowserContext> {
  return browser.newContext({ storageState: STORAGE[role], baseURL: e2eBaseURL, viewport });
}

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** 비활성 사용자 1명 (읽기 전용 조회) */
export async function inactiveUserId(): Promise<string> {
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('user_id')
    .eq('status', 'inactive')
    .limit(1);
  if (error) throw new Error(error.message);
  const id = data?.[0]?.user_id as string | undefined;
  if (!id) throw new Error('inactive profile not found in dev DB');
  return id;
}

export type Member = { user_id: string; full_name: string; email: string };

export async function members(req: APIRequestContext): Promise<Member[]> {
  const response = await req.get('/api/workflow/members');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { members: Member[] }).members;
}

export async function nameOf(req: APIRequestContext, userId: string): Promise<string> {
  const found = (await members(req)).find((member) => member.user_id === userId);
  if (!found) throw new Error(`member ${userId} not found`);
  return found.full_name;
}

export async function json<T = Record<string, unknown>>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

export async function expectError(response: APIResponse, status: number, message?: string) {
  const body = await response.text();
  expect(response.status(), body).toBe(status);
  if (message !== undefined) {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    expect(parsed.message ?? parsed.error).toBe(message);
  }
}

// ---------------------------------------------------------------------------
// 첨부 업로드 (prepare → signed PUT → complete)
// ---------------------------------------------------------------------------

/** 1x1 png */
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export async function uploadAttachment(
  req: APIRequestContext,
  fileName = 'e2e-wf.png',
  bytes: Buffer = PNG_BYTES,
  contentType = 'image/png'
): Promise<{ id: string; prepare: APIResponse; complete: APIResponse }> {
  const prepare = await req.post('/api/workflow/attachments/prepare', {
    data: { file_name: fileName, file_size: bytes.length, content_type: contentType, existing_count: 0 }
  });
  expect(prepare.status(), await prepare.text()).toBe(200);
  const prepared = await json<{ signed_url: string; storage_path: string }>(prepare);
  const put = await req.fetch(prepared.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    data: bytes
  });
  expect(put.ok(), await put.text()).toBe(true);
  const complete = await req.post('/api/workflow/attachments/complete', {
    data: {
      storage_path: prepared.storage_path,
      file_name: fileName,
      file_size: bytes.length,
      content_type: contentType
    }
  });
  expect(complete.status(), await complete.text()).toBe(201);
  const body = await json<{ attachment: { id: string } }>(complete);
  return { id: body.attachment.id, prepare, complete };
}

// ---------------------------------------------------------------------------
// 문서 픽스처
// ---------------------------------------------------------------------------

export type Values = Record<string, string | string[]>;

export function kstToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function purchaseValues(mark: string, overrides: Values = {}): Values {
  return {
    request_type: REQ_PURCHASE,
    writer_name: 'E2E 작성자',
    written_date: kstToday(),
    brand: '웨이크',
    amount: '194840',
    item_quantity: `E2E 품목 ${mark}`,
    delivery_address: '서울 E2E 수령지',
    recipient: 'E2E 수령인 010-0000-0000',
    link_url: 'https://example.com/e2e',
    purchase_reason: 'E2E 구매 사유',
    note: mark,
    ...overrides
  };
}

export function paymentValues(mark: string, overrides: Values = {}): Values {
  return {
    request_type: REQ_PAYMENT,
    writer_name: 'E2E 작성자',
    written_date: kstToday(),
    brand: '웨이크',
    amount: '50000',
    vendor_account_holder: 'E2E 업체',
    bank_account: 'E2E 은행 000-000',
    purchase_reason: 'E2E 출금 사유',
    note: mark,
    ...overrides
  };
}

export type Referrer = { user_id: string; notification_setting: 'START_AND_END' | 'END' | 'NONE' };

export type CreatedDoc = { id: string; code: string; status: string; current_step: number; total_steps: number };

export async function postDocument(
  req: APIRequestContext,
  input: {
    values: Values;
    steps: string[][];
    referrers?: Referrer[];
    attachmentIds?: string[];
    contentHtml?: string;
    extra?: Record<string, unknown>;
  }
): Promise<APIResponse> {
  return req.post('/api/workflow/documents', {
    data: {
      template_key: 'expense',
      values: input.values,
      content_html: input.contentHtml ?? '<p>E2E 본문</p>',
      steps: input.steps,
      referrers: input.referrers ?? [],
      attachment_ids: input.attachmentIds ?? [],
      ...input.extra
    }
  });
}

/** 구매 요청 + 첨부 1개로 문서를 만든다 (기본 결재선: 1단계 user2, 2단계 hr) */
export async function createDoc(
  req: APIRequestContext,
  options: {
    mark?: string;
    steps?: string[][];
    referrers?: Referrer[];
    values?: Values;
    contentHtml?: string;
  } = {}
): Promise<CreatedDoc & { mark: string }> {
  const mark = options.mark ?? marker();
  const attachment = await uploadAttachment(req);
  const response = await postDocument(req, {
    values: options.values ?? purchaseValues(mark),
    steps: options.steps ?? [[uid('user2')], [uid('hr')]],
    referrers: options.referrers ?? [],
    attachmentIds: [attachment.id],
    contentHtml: options.contentHtml
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await json<{ document: CreatedDoc }>(response);
  return { ...body.document, mark };
}

export async function getDetail(req: APIRequestContext, id: string) {
  const response = await req.get(`/api/workflow/documents/${id}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await json<{ document: Record<string, unknown> & { status: string; events: Array<{ type: string; content: string | null; payload: Record<string, unknown> }>; steps: Array<{ step: number; status: string; actors: Array<{ user_id: string; status: string }> }>; content_html: string; current_step: number; total_steps: number; code: string } }>(response)).document;
}

export async function approve(req: APIRequestContext, id: string, opinion?: string) {
  return req.post(`/api/workflow/documents/${id}/approve`, { data: { opinion: opinion ?? null } });
}

export async function decline(req: APIRequestContext, id: string, reason?: string) {
  return req.post(`/api/workflow/documents/${id}/decline`, { data: { reason: reason ?? null } });
}

export async function cancel(req: APIRequestContext, id: string) {
  return req.post(`/api/workflow/documents/${id}/cancel`, { data: {} });
}

// ---------------------------------------------------------------------------
// 기본 결재선 (policy) — 테스트가 세팅하고 원래 값으로 되돌린다
// ---------------------------------------------------------------------------

export type Policy = { steps: string[][]; referrers: Referrer[]; approval_step_edit_enabled: boolean };

export async function readPolicy(req: APIRequestContext): Promise<Policy> {
  const response = await req.get('/api/workflow/templates/expense');
  expect(response.status()).toBe(200);
  const { template } = await json<{
    template: {
      approval_step_edit_enabled: boolean;
      default_line: {
        steps: { step: number; actors: { user_id: string }[] }[];
        referrers: { member: { user_id: string }; notification_setting: Referrer['notification_setting'] }[];
      };
    };
  }>(response);
  return {
    steps: template.default_line.steps
      .sort((a, b) => a.step - b.step)
      .map((step) => step.actors.map((actor) => actor.user_id)),
    referrers: template.default_line.referrers.map((referrer) => ({
      user_id: referrer.member.user_id,
      notification_setting: referrer.notification_setting
    })),
    approval_step_edit_enabled: template.approval_step_edit_enabled
  };
}

export async function putPolicy(req: APIRequestContext, policy: Policy) {
  const response = await req.put('/api/workflow/templates/expense/policy', { data: policy });
  expect(response.status(), await response.text()).toBe(200);
}

// ---------------------------------------------------------------------------
// activity log / notifications
// ---------------------------------------------------------------------------

export type LogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: Record<string, unknown>;
};

export function requestIdOf(response: APIResponse): string {
  const requestId = response.headers()['x-request-id'];
  expect(requestId, 'x-request-id header').toBeTruthy();
  return requestId;
}

export async function expectLogRow(
  admin: APIRequestContext,
  action: string,
  requestId: string,
  status: number
): Promise<LogItem> {
  let matched: LogItem | undefined;
  await expect
    .poll(
      async () => {
        const response = await admin.get(
          `/api/activity-logs?action=${encodeURIComponent(action)}&limit=100&log_user=all`
        );
        if (response.status() !== 200) return false;
        const body = await json<{ data?: { logs?: LogItem[] } }>(response);
        matched = (body.data?.logs ?? []).find(
          (item) => item.request_id === requestId && item.action === action && item.http_status === status
        );
        return Boolean(matched);
      },
      { timeout: 20_000, message: `activity log ${action} ${status} ${requestId}` }
    )
    .toBe(true);
  return matched!;
}

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  metadata?: Record<string, unknown>;
};

/** admin 컨텍스트로 특정 사용자 알림 조회 */
export async function notificationsFor(admin: APIRequestContext, userId: string): Promise<NotificationItem[]> {
  const response = await admin.get(`/api/notifications?limit=100&notif_user=${encodeURIComponent(userId)}`);
  expect(response.status()).toBe(200);
  const body = await json<{ data?: { notifications?: NotificationItem[] } }>(response);
  return body.data?.notifications ?? [];
}

export async function docNotifications(
  admin: APIRequestContext,
  userId: string,
  docId: string,
  type?: string
): Promise<NotificationItem[]> {
  const items = await notificationsFor(admin, userId);
  return items.filter(
    (item) =>
      item.metadata?.workflow_document_id === docId && (type === undefined || item.type === type)
  );
}

export async function expectDocNotification(
  admin: APIRequestContext,
  userId: string,
  docId: string,
  type: string
) {
  await expect
    .poll(async () => (await docNotifications(admin, userId, docId, type)).length, {
      timeout: 15_000,
      message: `${type} notification for ${userId}`
    })
    .toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export async function gotoWorkflow(page: Page, query = '') {
  await page.goto(`${WORKFLOW_PATH}${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 30_000 });
}

export async function openDoc(page: Page, docId: string) {
  await gotoWorkflow(page, `?doc=${docId}`);
  const detail = page.getByTestId('workflow-detail');
  await expect(detail).toBeVisible({ timeout: 30_000 });
  await expect(detail.getByTestId('workflow-detail-code')).toBeVisible({ timeout: 30_000 });
  return detail;
}

export function composeForm(page: Page): Locator {
  return page.getByTestId('workflow-compose-form');
}

export function field(page: Page, key: string): Locator {
  return composeForm(page).getByTestId(`workflow-field-${key}`);
}

/** 문서 작성하기 → 양식 선택 Dialog (하이드레이션 전 클릭 대비 재시도) */
export async function openPicker(page: Page): Promise<Locator> {
  const button = page.getByTestId('workflow-compose-button');
  const picker = page.getByTestId('workflow-template-picker');
  await expect(async () => {
    if ((await picker.count()) === 0) await button.click();
    await expect(picker).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return picker;
}

/** 문서 작성하기 → 지출결의서 */
export async function openCompose(page: Page) {
  await openPicker(page);
  await page.getByTestId('workflow-template-option-expense').click();
  await expect(composeForm(page)).toBeVisible({ timeout: 30_000 });
  await expect(field(page, 'request_type')).toBeVisible({ timeout: 30_000 });
}

export async function selectOption(page: Page, key: string, option: string) {
  await field(page, key).getByRole('combobox').click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

export async function fillText(page: Page, key: string, value: string) {
  const input = field(page, key).getByRole('textbox');
  await input.fill(value);
}

export async function requiredKeys(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const key of FIELD_KEYS) {
    if ((await composeForm(page).getByTestId(`workflow-field-required-${key}`).count()) > 0) {
      found.push(key);
    }
  }
  return found;
}

/** 열린 구성원 Combobox에서 user_id로 검색해 선택 (CommandItem value에 user_id 포함) */
export async function pickMember(page: Page, userId: string) {
  const input = page.getByPlaceholder('이름 검색…');
  await expect(input).toHaveCount(1);
  await input.fill(userId);
  await page.getByRole('option').first().click();
  await expect(page.getByPlaceholder('이름 검색…')).toHaveCount(0);
}

export async function addApprover(page: Page, scope: Locator, step: number, userId: string) {
  await expect(page.getByPlaceholder('이름 검색…')).toHaveCount(0);
  await scope.getByTestId(`workflow-step-${step}-add`).click();
  await pickMember(page, userId);
  await expect(scope.getByTestId(`workflow-actor-${step}-${userId}`)).toBeVisible();
}

export async function addReferrer(page: Page, scope: Locator, userId: string) {
  await expect(page.getByPlaceholder('이름 검색…')).toHaveCount(0);
  await scope.getByTestId('workflow-referrer-add').click();
  await pickMember(page, userId);
  await expect(scope.getByTestId(`workflow-referrer-notify-${userId}`)).toBeVisible();
}

export async function attachFile(page: Page, fileName = 'e2e-wf.png', bytes: Buffer = PNG_BYTES) {
  await composeForm(page)
    .getByTestId('workflow-attachments-dropzone')
    .locator('input[type=file]')
    .setInputFiles({ name: fileName, mimeType: 'image/png', buffer: bytes });
}

export async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

export function codePattern(): RegExp {
  return new RegExp(`^${new Date().getFullYear()}-\\d{4,}$`);
}
