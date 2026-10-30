import fs from 'node:fs';
import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { authenticateStorageState } from '../helpers/supabase-auth-storage';
import {
  BASE_URL,
  callAs,
  createDisposableDongbang,
  dbChatNotifications,
  pageAs,
  readAccountMeta,
  serviceClient,
  VIEWPORT_DESKTOP,
  type AccountKey,
  type AccountMeta,
  type ApiResult
} from '../quick-workflow/helpers';

/**
 * plan 93 — 퀵 요청 건별 실시간 채팅 e2e 공용 (docs/plans/93_quick-request-chat-plan.md)
 * - 계정: user(요청자)·user2·admin·dongbang(동방 A)·logistics + dongbang2(일회용, 92 helper)
 * - 전송·읽음·목록은 API, 알림·읽음 위치·fixture 메시지는 service role로 DB 직접 조회/삽입
 * - 「실시간」 5초 · 「미반영」 8초 (plan §공통)
 */

export const REALTIME_TIMEOUT_MS = 5_000;
export const NO_REALTIME_WAIT_MS = 8_000;
/** 구독(setAuth → subscribe)이 자리 잡을 시간 */
export const SUBSCRIBE_SETTLE_MS = 2_000;

export const CHAT_TEXT = {
  listTitle: '퀵 대화',
  realtimeOn: '실시간',
  searchPlaceholder: '요청번호·요청자·주소 검색',
  tabAll: '전체',
  tabUnread: '안 읽음',
  noSelection: '왼쪽에서 대화를 선택하세요',
  notFound: '대화를 찾을 수 없습니다.',
  emptyWritable: '아직 대화가 없습니다. 취소나 시간 변경 같은 요청을 남겨 보세요.',
  unreadDivider: '여기부터 새 메시지',
  send: '전송',
  backToList: '목록',
  detailLink: '상세 보기',
  detailChatTitle: '요청 대화',
  chatButton: '대화',
  receiptSent: '전송됨',
  receiptRead: '읽음',
  sendFailed: '전송 실패 ·',
  retry: '다시 보내기',
  discard: '삭제',
  logisticsReadOnly: '구매물류팀은 대화를 볼 수만 있습니다.',
  requestNotFound: '퀵 요청을 찾을 수 없습니다.',
  /** plan 98 AC-09 — 93 AC-08 「메시지를 입력해 주세요.」 교체 (본문 없이 첨부만도 허용) */
  bodyRequired: '메시지를 입력하거나 파일을 첨부해 주세요.',
  bodyTooLong: '메시지는 1,000자까지 입력할 수 있습니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  roleRequester: '요청자',
  roleDongbang: '동방특송',
  roleAdmin: '관리자',
  logLabel: '퀵 대화 메시지 전송'
} as const;

export const REQUESTER_REPLIES = ['취소 부탁드립니다', '시간 변경 부탁드립니다', '연락 부탁드립니다'] as const;
export const VENDOR_REPLIES = ['확인했습니다', '처리했습니다', '불가능합니다', '잠시만 기다려 주세요'] as const;

export const ABSOLUTE_DATE_RE = /\d{4}-\d{2}-\d{2} \([월화수목금토일]\)/;

export function chatHref(requestNo: string) {
  return `/dashboard/quick/chat?request=${encodeURIComponent(requestNo)}`;
}

// ---------------------------------------------------------------------------
// API (계정별)
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: number;
  authorUserId: string;
  authorName: string;
  authorRole: 'requester' | 'dongbang' | 'admin';
  body: string;
  createdAt: string;
};

export type ChatMessagesData = {
  request: { id: string; requestNo: string; status: string };
  viewer: { userId: string; name: string; role: string };
  messages: ChatMessage[];
  myLastReadMessageId: number;
  reads: { userId: string; name: string; role: string; lastReadMessageId: number; lastReadAt: string }[];
  canWrite: boolean;
  /** plan 94 D-12 — `'locked'` 삭제(승인·취소 건도 대화 가능) */
  readOnlyReason: 'logistics' | null;
  quickReplies: string[];
};

export function postMessageAs(account: AccountKey, requestNo: string, body: unknown): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.post(`/api/quick-request/${requestNo}/messages`, {
      data: body as Record<string, unknown>
    })
  );
}

/** 201 보장 + 생성된 메시지 반환 */
export async function sendMessageAs(account: AccountKey, requestNo: string, body: string): Promise<ChatMessage> {
  const result = await postMessageAs(account, requestNo, { body });
  expect(result.status, `POST messages ${requestNo} ${JSON.stringify(result.body)}`).toBe(201);
  const data = result.body.data as { message: ChatMessage };
  return data.message;
}

export async function getMessagesAs(account: AccountKey, requestNo: string): Promise<ApiResult> {
  return callAs(account, (api) => api.get(`/api/quick-request/${requestNo}/messages`));
}

export async function getMessagesDataAs(account: AccountKey, requestNo: string): Promise<ChatMessagesData> {
  const result = await getMessagesAs(account, requestNo);
  expect(result.status, `GET messages ${requestNo}`).toBe(200);
  return result.body.data as ChatMessagesData;
}

export async function markReadAs(account: AccountKey, requestNo: string, lastMessageId: number): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.put(`/api/quick-request/${requestNo}/messages/read`, { data: { lastMessageId } })
  );
}

export type ConversationItem = {
  id: string;
  requestNo: string;
  status: string;
  requesterName: string;
  lastMessage: { id: number; authorName: string; body: string; createdAt: string } | null;
  unreadCount: number;
};

export async function getConversationsAs(
  account: AccountKey,
  query = ''
): Promise<{ status: number; conversations: ConversationItem[]; totals: { conversations: number; unreadConversations: number } }> {
  const result = await callAs(account, (api) => api.get(`/api/quick-request/conversations${query}`));
  const data = (result.body.data ?? { conversations: [], totals: { conversations: 0, unreadConversations: 0 } }) as {
    conversations: ConversationItem[];
    totals: { conversations: number; unreadConversations: number };
  };
  return { status: result.status, ...data };
}

/** 계정의 안 읽은 대화를 전부 읽음 처리해 baseline 0으로 만든다 (사이드바·요약 판정 전) */
export async function markAllConversationsReadAs(account: AccountKey) {
  // 안 읽음 탭은 한 번에 20건씩 — 공유 dev DB에 20건을 넘으면 비워질 때까지 반복 (plan 106 verifier)
  for (let round = 0; round < 30; round += 1) {
    const { conversations } = await getConversationsAs(account, '?tab=unread');
    const pending = conversations.filter((conversation) => conversation.lastMessage);
    if (pending.length === 0) break;
    for (const conversation of pending) {
      await markReadAs(account, conversation.requestNo, conversation.lastMessage!.id);
    }
  }
  await expect
    .poll(async () => (await getConversationsAs(account)).totals.unreadConversations, {
      message: `${account} 안 읽은 대화 0`
    })
    .toBe(0);
}

export async function getUnreadTotalAs(account: AccountKey): Promise<number> {
  const result = await callAs(account, (api) => api.get('/api/quick-request/unread-total'));
  expect(result.status).toBe(200);
  return (result.body.data as { total: number }).total;
}

// ---------------------------------------------------------------------------
// DB (service role)
// ---------------------------------------------------------------------------

export type DbMessageRow = {
  id: number;
  quick_request_id: string;
  author_user_id: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
};

export async function dbMessages(requestId: string): Promise<DbMessageRow[]> {
  const { data, error } = await serviceClient()
    .from('quick_request_messages')
    .select('id, quick_request_id, author_user_id, author_name, author_role, body, created_at')
    .eq('quick_request_id', requestId)
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbMessageRow[];
}

export async function dbRead(userId: string, requestId: string) {
  const { data, error } = await serviceClient()
    .from('quick_request_message_reads')
    .select('last_read_message_id, last_read_at')
    .eq('user_id', userId)
    .eq('quick_request_id', requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { last_read_message_id: number; last_read_at: string } | null;
}

/** AC-35 fixture — 과거 시각 메시지 삽입 (service role · 쓰기 grant all) */
export async function insertFixtureMessages(
  requestId: string,
  rows: { authorUserId: string; authorName: string; authorRole: 'requester' | 'dongbang' | 'admin'; body: string; createdAt: string }[]
): Promise<number[]> {
  const { data, error } = await serviceClient()
    .from('quick_request_messages')
    .insert(
      rows.map((row) => ({
        quick_request_id: requestId,
        author_user_id: row.authorUserId,
        author_name: row.authorName,
        author_role: row.authorRole,
        body: row.body,
        created_at: row.createdAt
      }))
    )
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => Number(row.id));
}

export async function setProfileStatus(userId: string, status: 'active' | 'inactive') {
  const { error } = await serviceClient()
    .from('profiles')
    .update({ status, deactivated_at: status === 'inactive' ? new Date().toISOString() : null })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function dbNotificationsStatus(ids: string[]) {
  const { data, error } = await serviceClient().from('notifications').select('id, status').in('id', ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; status: string }[];
}

/** 메시지 1건의 수신자 집합 (알림이 생길 시간을 기다린다 · 0건 기대면 expectZero) */
export async function chatRecipientsOf(requestNo: string, messageId: number, expectAtLeast = 1): Promise<Set<string>> {
  let rows: Awaited<ReturnType<typeof dbChatNotifications>> = [];
  if (expectAtLeast > 0) {
    await expect
      .poll(
        async () => {
          rows = await dbChatNotifications(requestNo, messageId);
          return rows.length;
        },
        { timeout: 15_000, message: `chat notifications ${requestNo}#${messageId}` }
      )
      .toBeGreaterThanOrEqual(expectAtLeast);
  } else {
    rows = await dbChatNotifications(requestNo, messageId);
  }
  return new Set(rows.map((row) => row.recipient_user_id));
}

export function expectSetEqual(actual: Set<string>, expected: Iterable<string>, label: string) {
  expect([...actual].sort(), label).toEqual([...new Set(expected)].sort());
}

// ---------------------------------------------------------------------------
// dongbang2 (일회용 · 브라우저 세션 포함)
// ---------------------------------------------------------------------------

export const DONGBANG2_AUTH = 'e2e/.auth/dongbang2.json';

export async function createDongbang2WithSession(browser: Browser): Promise<AccountMeta> {
  const meta = await createDisposableDongbang('dongbang2');
  fs.rmSync(DONGBANG2_AUTH, { force: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  try {
    await authenticateStorageState(context, meta.email, meta.password, DONGBANG2_AUTH);
  } finally {
    await context.close();
  }
  return meta;
}

export async function pageAsDongbang2(
  browser: Browser,
  viewport: { width: number; height: number } = VIEWPORT_DESKTOP
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: DONGBANG2_AUTH, baseURL: BASE_URL, viewport });
  const page = await context.newPage();
  return { context, page };
}

export async function apiAsDongbang2<T>(fn: (api: import('@playwright/test').APIRequestContext) => Promise<T>) {
  const { request } = await import('@playwright/test');
  const api = await request.newContext({ baseURL: BASE_URL, storageState: DONGBANG2_AUTH });
  try {
    return await fn(api);
  } finally {
    await api.dispose();
  }
}

export async function markReadAsDongbang2(requestNo: string, lastMessageId: number) {
  return apiAsDongbang2(async (api) => {
    const response = await api.put(`/api/quick-request/${requestNo}/messages/read`, { data: { lastMessageId } });
    return { status: response.status(), body: (await response.json()) as { data?: { lastReadMessageId: number } } };
  });
}

export { pageAs, readAccountMeta };

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export async function gotoChat(page: Page, requestNo?: string) {
  await page.goto(requestNo ? chatHref(requestNo) : '/dashboard/quick/chat', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
}

export async function gotoDetailChat(page: Page, requestNo: string) {
  await page.goto(`/dashboard/quick/${requestNo}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('quick-detail-chat')).toBeVisible({ timeout: 30_000 });
}

export function messagesLog(page: Page) {
  return page.getByTestId('quick-chat-messages');
}

export function composerInput(page: Page) {
  return page.getByTestId('quick-chat-input');
}

export function sendButton(page: Page) {
  return page.getByTestId('quick-chat-send');
}

export function messageBubble(page: Page, id: number) {
  return page.getByTestId(`quick-chat-message-${id}`);
}

export function receipt(page: Page, id: number) {
  return page.getByTestId(`quick-chat-receipt-${id}`);
}

/** 입력 → Enter 전송 → 서버 id 말풍선 반환 (POST 201 응답 대기) */
export async function sendViaUi(page: Page, body: string): Promise<{ id: number; bubble: Locator }> {
  const input = composerInput(page);
  await input.fill(body);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/messages') && response.request().method() === 'POST'
  );
  await input.press('Enter');
  const response = await responsePromise;
  expect(response.status(), 'POST messages').toBe(201);
  const json = (await response.json()) as { data: { message: ChatMessage } };
  const id = json.data.message.id;
  const bubble = messageBubble(page, id);
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  return { id, bubble };
}

/** plan 94 U-1 — 배지 `quick-chat-realtime-status` · `data-state='live'` (옛 `quick-chat-realtime-badge`/`data-status` 교체) */
export async function waitForSubscribed(page: Page) {
  await expect(page.getByTestId('quick-chat-realtime-status')).toHaveAttribute('data-state', 'live', {
    timeout: 20_000
  });
}

export async function scrollMessagesToBottom(page: Page) {
  await messagesLog(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}

export async function markNoReload(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __e2eRealtimeMarker: number }).__e2eRealtimeMarker = Date.now();
  });
}

export async function expectNoReload(page: Page) {
  const marker = await page.evaluate(
    () => (window as unknown as { __e2eRealtimeMarker?: number }).__e2eRealtimeMarker ?? null
  );
  expect(marker, '페이지가 새로고침되지 않았다(window 마커 유지)').not.toBeNull();
}

/** 문서 가로 스크롤 0 */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth);
}

export async function expectTouchTarget(locator: Locator, min = 44) {
  const box = await locator.boundingBox();
  expect(box, 'boundingBox').not.toBeNull();
  expect(box!.height, `height ${box!.height} >= ${min}`).toBeGreaterThanOrEqual(min);
}

export function bellCount(page: Page) {
  return page.getByTestId('notification-bell').locator('span').filter({ hasText: /^(\d+|9\+)$/ });
}
