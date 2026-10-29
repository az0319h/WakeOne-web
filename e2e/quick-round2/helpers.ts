import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import {
  anonKey,
  buildCreateBody,
  callAs,
  createQuickRequestApi,
  serviceClient,
  withApi,
  type AccountKey,
  type QuickNotificationRow
} from '../quick-workflow/helpers';

/**
 * plan 94 — 퀵 2차(실시간 Broadcast · 푸시 클릭 · 작은 수정 · 수정 알림 · 잠금 해제) e2e 공용
 * docs/plans/94_quick-realtime-and-small-fixes-plan.md
 * - 계정·API·DB 헬퍼는 `../quick-workflow/helpers` · `../quick-chat/helpers` 재사용
 * - grep 유형 AC는 Node fs로 소스를 훑어 판정한다 (verifier CLI grep과 같은 기준)
 */

export const REALTIME_TIMEOUT_MS = 5_000;
export const NO_REALTIME_WAIT_MS = 8_000;
/** AC-09 — 폴링(5초) 반영 한도 */
export const POLLING_TIMEOUT_MS = 10_000;
/** 구독(setAuth → subscribe)이 자리 잡을 시간 */
export const SUBSCRIBE_SETTLE_MS = 2_000;

export const TEXT = {
  vatIncludedInput: '부가세 포함 금액으로 입력',
  vatIncludedDetail: '예상금액·최종금액은 부가세 포함 금액입니다.',
  vatExcludedLegacy: '부가세 별도',
  plateLabel: '자동차등록번호',
  platePlaceholder: '예: 21마 6543',
  plateInvalid: '자동차등록번호 형식을 확인해 주세요. 예: 21마 6543',
  plateRequired: '자동차등록번호를 입력해 주세요.',
  chatLockedLegacy: '승인되었거나 취소된 요청은 대화를 보낼 수 없습니다.',
  realtimePolling: '폴링',
  realtimeLive: '실시간',
  updatedTitle: (no: string) => `퀵 ${no} 수정됨`,
  updatedBody: (actor: string, labels: string) => `${actor}님이 요청 내용을 수정했습니다. (${labels})`,
  acceptedToast: '퀵 요청을 접수했습니다.',
  viewQuickRequest: '퀵 요청 보기'
} as const;

export const PLATE_VALID = ['21마 6543', '서울 12가 3456', '서울 강남 가 1234'] as const;
export const PLATE_INVALID = ['오토바이 8514', 'abc'] as const;

export const SRC_ROOT = path.resolve(process.cwd());

/** 디렉터리를 재귀로 훑어 `needle`이 들어 있는 `file:line`을 돌려준다 (`.ts`·`.tsx`·`.js`·`.json`·`.sql`) */
export function grepDir(relativeDir: string, needle: string | RegExp): string[] {
  const root = path.join(SRC_ROOT, relativeDir);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|json|sql)$/.test(entry.name)) continue;
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        const matched = typeof needle === 'string' ? line.includes(needle) : needle.test(line);
        if (matched) hits.push(`${path.relative(SRC_ROOT, full)}:${index + 1}: ${line.trim()}`);
      });
    }
  };
  walk(root);
  return hits;
}

export function readSource(relativeFile: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativeFile), 'utf8');
}

/** D-13 — `buildChatNotificationTitle`과 같은 규칙 (이름 20자 · 전체 30자) */
export function expectedChatTitle(requestNo: string, senderName: string): string {
  const no = requestNo.trim();
  const budget = Math.max(1, Math.min(20, 30 - 3 - no.length));
  const name = senderName.replace(/\s+/g, ' ').trim().slice(0, budget);
  return `${name} · ${no}`;
}

// ---------------------------------------------------------------------------
// DB (service role)
// ---------------------------------------------------------------------------

/** 요청번호 + 사건(`updated` 포함)으로 모든 수신자의 퀵 알림 행 */
export async function dbQuickNotificationsByEvent(
  requestNo: string,
  event: string
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

export async function waitQuickNotifications(
  requestNo: string,
  event: string,
  atLeast: number,
  timeout = 15_000
): Promise<QuickNotificationRow[]> {
  let rows: QuickNotificationRow[] = [];
  await expect
    .poll(
      async () => {
        rows = await dbQuickNotificationsByEvent(requestNo, event);
        return rows.length;
      },
      { timeout, message: `${event} notifications ${requestNo} >= ${atLeast}` }
    )
    .toBeGreaterThanOrEqual(atLeast);
  return rows;
}

export async function profilePhone(userId: string): Promise<string | null> {
  const { data, error } = await serviceClient().from('profiles').select('phone').eq('user_id', userId).single();
  if (error) throw new Error(error.message);
  return (data?.phone as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Realtime (Node · supabase-js) — AC-07 topic 권한 판정
// ---------------------------------------------------------------------------

export type RealtimeSubscribeResult = { statuses: string[]; error: string | null };

/**
 * 계정으로 로그인해 private 채널을 구독하고 subscribe 콜백 status 목록을 돌려준다.
 * 권한 없는 topic은 `CHANNEL_ERROR`(realtime.messages SELECT 정책) · 허용 topic은 `SUBSCRIBED`.
 */
export async function subscribePrivateTopicAs(
  account: 'user' | 'user2',
  topic: string,
  until: 'SUBSCRIBED' | 'CHANNEL_ERROR',
  timeout = 15_000
): Promise<RealtimeSubscribeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const email = account === 'user' ? process.env.E2E_USER_EMAIL : process.env.E2E_USER2_EMAIL;
  const rawPassword = account === 'user' ? process.env.E2E_USER_PASSWORD : process.env.E2E_USER2_PASSWORD;
  if (!url || !email || !rawPassword) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL · E2E_USER(2)_EMAIL/PASSWORD are required.');
  }
  const client = createClient(url, anonKey(), { auth: { autoRefreshToken: false, persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password: resolveE2EPassword(rawPassword) });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`sign in failed for ${account}: ${signIn.error?.message}`);
  }
  await client.realtime.setAuth(signIn.data.session.access_token);

  const statuses: string[] = [];
  let lastError: string | null = null;
  const channel = client.channel(topic, { config: { private: true } });
  channel.subscribe((status, error) => {
    statuses.push(status);
    if (error) lastError = error.message;
  });
  try {
    await expect
      .poll(() => statuses.includes(until), { timeout, message: `${account} ${topic} → ${until} (got ${statuses.join(',')})` })
      .toBe(true);
  } finally {
    await client.removeChannel(channel);
    client.realtime.disconnect();
    // signOut()은 기본 scope가 global이라 같은 계정의 브라우저 storageState 세션까지 끊는다 → 호출하지 않는다
  }
  return { statuses, error: lastError };
}

// ---------------------------------------------------------------------------
// plan 97 — 기간 필터·페이지네이션 · 대화 무한스크롤 · 최근 주소 · 전화 9~11자리 fixture
// docs/plans/97_quick-period-filter-recent-address-split-phone-plan.md
// - 퀵 요청 fixture는 `buildCreateBody`(출발 담당 `E2E 출발담당`) → scripts/cleanup-e2e-mock-data.mjs가 지운다
// - `requested_at`은 service role로 과거로 옮긴다 (plan §공통 「DB fixture는 service role로 requested_at 조정」)
// ---------------------------------------------------------------------------

export const PHONE_TEXT = {
  error: '연락처는 숫자 9~11자리로 입력해 주세요.',
  hint: '숫자만 9~11자리',
  placeholder: '010-1234-5678 / 02-123-4567'
} as const;

export const RANGE_TEXT = {
  invalid: '기간을 확인해 주세요.',
  label7d: '기간: 최근 7일',
  label30d: '기간: 최근 30일',
  label90d: '기간: 최근 90일',
  labelAll: '기간: 전체',
  chatEnd: '더 이상 대화가 없습니다',
  recentEnd: '더 이상 주소가 없습니다',
  recentHintOrigin: '출발지에서 쓴 주소',
  recentHintDestination: '도착지·경유지에서 쓴 주소',
  recentEmptyOrigin: '출발지로 등록한 주소가 여기에 저장됩니다.',
  recentEmptyDestination: '도착지·경유지로 등록한 주소가 여기에 저장됩니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.'
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** n일 전 같은 시각 (UTC ISO) */
export function daysAgoIso(days: number, now = Date.now()): string {
  return new Date(now - days * DAY_MS).toISOString();
}

/** 로컬(KST) 기준 n일 전 `yyyy-MM-dd` — 달력·URL 비교용 */
export function daysAgoDateString(days: number, now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** service role — `requested_at`을 과거로 옮긴다 (기간 필터 fixture) */
export async function setRequestedAt(requestNo: string, iso: string): Promise<void> {
  const { error } = await serviceClient()
    .from('quick_requests')
    .update({ requested_at: iso })
    .eq('request_no', requestNo);
  if (error) throw new Error(`requested_at update failed for ${requestNo}: ${error.message}`);
}

/** 같은 태그로 count건 등록 (API · 5건씩 병렬) → requestNo 목록(등록 순) */
export async function createManyAs(
  account: 'user' | 'user2' | 'admin',
  tag: string,
  count: number,
  overrides: Record<string, unknown> = {}
): Promise<string[]> {
  const requestNos: string[] = [];
  for (let offset = 0; offset < count; offset += 5) {
    const batch = Math.min(5, count - offset);
    const created = await withApi(account, (api) =>
      Promise.all(
        Array.from({ length: batch }, () => createQuickRequestApi(api, buildCreateBody(tag, overrides)))
      )
    );
    requestNos.push(...created.map((row) => row.requestNo));
  }
  return requestNos;
}

/** 요청번호 목록의 `requested_at`을 일괄 변경 */
export async function setRequestedAtMany(requestNos: string[], iso: string): Promise<void> {
  const { error } = await serviceClient()
    .from('quick_requests')
    .update({ requested_at: iso })
    .in('request_no', requestNos);
  if (error) throw new Error(`requested_at bulk update failed: ${error.message}`);
}

/** 대시보드 상태 카드 5개 숫자 합계 (요청 접수·배차 중·운송 중·승인 대기 + 「취소 N」) */
export async function dashboardCardSum(page: import('@playwright/test').Page): Promise<number> {
  let sum = 0;
  for (const status of ['requested', 'dispatching', 'dispatched', 'approved'] as const) {
    const text = (await page.getByTestId(`quick-dashboard-card-${status}-count`).innerText()).trim();
    sum += Number(text);
  }
  const cancelled = (await page.getByTestId('quick-dashboard-card-cancelled').innerText()).trim();
  const match = /취소\s*(\d+)/.exec(cancelled);
  sum += match ? Number(match[1]) : 0;
  return sum;
}

/** `GET /api/quick-request/summary` 상태 합계 (계정 기준) */
export async function summaryTotalAs(account: AccountKey, query = ''): Promise<number> {
  const result = await callAs(account, (api) => api.get(`/api/quick-request/summary${query}`));
  expect(result.status, `summary ${query}`).toBe(200);
  const counts = (result.body.data as { counts: Record<string, number> }).counts;
  return Object.values(counts).reduce((acc, value) => acc + Number(value), 0);
}

/** 대시보드 표 데이터 행 (상세 보기 link가 있는 행) */
export function dashboardDataRows(page: import('@playwright/test').Page) {
  const table = page.getByTestId('quick-dashboard-table');
  return table.getByRole('row').filter({ has: page.getByRole('link') });
}

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * react-day-picker v9 day button — `locale={ko}`(date-fns) aria-label `PPPP` = `yyyy년 M월 d일 EEEE`
 * (mobile-ux 2차 A#3 · 오늘이면 앞에 `Today, `가 붙지만 과거 날짜만 고른다)
 */
export function calendarDayName(dateString: string): RegExp {
  const [year, month, day] = dateString.split('-').map(Number);
  const weekday = KO_WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return new RegExp(`^${year}년 ${month}월 ${day}일 ${weekday}요일`);
}

/** 달력 Popover에서 날짜 클릭 — 보이지 않으면 이전 달로 이동 (최대 3회) */
export async function pickCalendarDate(
  popover: import('@playwright/test').Locator,
  dateString: string
): Promise<void> {
  const name = calendarDayName(dateString);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const day = popover.getByRole('button', { name }).first();
    if ((await day.count()) > 0 && (await day.isVisible())) {
      await day.click();
      return;
    }
    await popover.getByRole('button', { name: /previous month/i }).click();
  }
  throw new Error(`calendar day not found: ${dateString}`);
}
