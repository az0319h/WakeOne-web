import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { callAs, serviceClient, type AccountKey, type ApiResult } from '../quick-workflow/helpers';
import { getMessagesDataAs, type ChatMessage } from '../quick-chat/helpers';

/**
 * plan 100 — 퀵 대화 AI 답장 추천 e2e 공용 (docs/plans/100_quick-chat-ai-reply-suggestions-plan.md)
 *
 * 서버 모드는 요청마다 바꿀 수 없으므로(env) 실행 단위로 나눈다. Playwright 프로세스에 **서버와 같은 env**를 준다.
 * | 모드 | 서버 · Playwright env | spec |
 * |---|---|---|
 * | off  | (기본 · `QUICK_CHAT_AI_SUGGEST` 없음) | `100-ai-suggest-off.spec.ts` (AC-09) |
 * | mock | `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=1` | `100-ai-suggest.spec.ts`(UI) · `100-ai-suggest-api.spec.ts` |
 * | echo | `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=echo` | `100-ai-suggest-echo.spec.ts` (AC-05) |
 * | fail | `QUICK_CHAT_AI_SUGGEST=1 E2E_ANTHROPIC_MOCK=fail` | `100-ai-suggest-fail.spec.ts` (AC-08) |
 * 모드 무관: `100-ai-suggest-static.spec.ts` (AC-11 · AC-12)
 * 실제 Anthropic 호출은 하지 않는다 — ON 모드는 반드시 mock 값과 함께 띄운다.
 */

export type AiMode = 'off' | 'mock' | 'echo' | 'fail';

export function aiMode(): AiMode | 'real' {
  if (process.env.QUICK_CHAT_AI_SUGGEST?.trim() !== '1') return 'off';
  const mock = process.env.E2E_ANTHROPIC_MOCK?.trim();
  if (mock === '1') return 'mock';
  if (mock === 'echo') return 'echo';
  if (mock === 'fail') return 'fail';
  return 'real';
}

/** describe 안에서 호출 — 모드가 다르면 묶음 전체 skip (beforeAll도 돌지 않음) */
export function onlyInMode(mode: AiMode) {
  const current = aiMode();
  test.skip(
    current !== mode,
    `plan 100 ${mode} 모드 전용 (현재 ${current}) — 서버·Playwright에 같은 env를 주고 따로 실행`
  );
}

export const SUGGEST_ACTION = 'quick_request.chat_ai_suggest' as const;

export const AI_TEXT = {
  badge: 'AI 추천',
  badgeTooltip: '대화 내용을 바탕으로 AI가 제안한 문장입니다. 보내기 전에 확인하세요.',
  disabled: '답장 추천이 꺼져 있습니다.',
  noNewMessage: '추천할 새 메시지가 없습니다.',
  limit: '오늘 답장 추천 횟수를 모두 사용했습니다.',
  failed: '답장 추천을 불러오지 못했습니다.',
  logisticsReadOnly: '구매물류팀은 대화를 볼 수만 있습니다.',
  notFound: '퀵 요청을 찾을 수 없습니다.',
  infoLine:
    '답장 추천: 대화 내용 일부(연락처·주소 가림)가 답장 문장 추천을 위해 외부 AI(Anthropic)에 전송됩니다. 추천은 참고용이며 보내기 전에 확인하세요.'
} as const;

export const DAILY_LIMIT = 100;
export const MAX_SUGGESTION_LENGTH = 40;
/** D-2 debounce 1초 + 여유 — 「호출 0」 판정 대기 */
export const NO_CALL_WAIT_MS = 3_000;
/** AC-01 「5초 안」 */
export const AI_READY_TIMEOUT_MS = 5_000;

const FIXTURE_FILE = path.resolve(process.cwd(), 'e2e', 'fixtures', 'ai-suggestions.json');

/** mock 서버가 돌려주는 4문장 (서버도 같은 파일을 런타임에 읽는다) */
export function readAiFixture(): string[] {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8')) as { suggestions: string[] };
  return parsed.suggestions;
}

/** KST 오늘 (`getKstTodayDateString`과 같은 규칙) */
export function kstDay(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function suggestPath(requestNo: string) {
  return `/api/quick-request/${requestNo}/messages/suggest`;
}

export function suggestAs(account: AccountKey, requestNo: string, body: unknown): Promise<ApiResult> {
  return callAs(account, (api) => api.post(suggestPath(requestNo), { data: body as Record<string, unknown> }));
}

export type SuggestData = {
  suggestions: string[];
  source: 'ai' | 'rules';
  lastMessageId: number;
  usage: { count: number; limit: number };
  debugPrompt?: string;
};

/** 서버 모드 확인 — GET …/messages `aiSuggest.enabled` */
export async function expectAiEnabled(requestNo: string, enabled: boolean) {
  const data = (await getMessagesDataAs('user', requestNo)) as Awaited<ReturnType<typeof getMessagesDataAs>> & {
    aiSuggest?: { enabled: boolean };
  };
  expect(
    data.aiSuggest?.enabled,
    `서버 aiSuggest.enabled=${String(data.aiSuggest?.enabled)} — 기대 ${enabled} (dev 서버 env 확인)`
  ).toBe(enabled);
}

// ---------------------------------------------------------------------------
// DB (service role) — 사용량 fixture
// ---------------------------------------------------------------------------

export async function setUsage(userId: string, day: string, count: number) {
  const { error } = await serviceClient()
    .from('quick_chat_ai_usage')
    .upsert({ user_id: userId, day, count, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
  if (error) throw new Error(`quick_chat_ai_usage upsert: ${error.message}`);
}

export async function getUsage(userId: string, day: string): Promise<number | null> {
  const { data, error } = await serviceClient()
    .from('quick_chat_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  if (error) throw new Error(`quick_chat_ai_usage select: ${error.message}`);
  return data ? Number(data.count) : null;
}

/** 테스트가 만든 사용량 행 삭제 (어제·오늘·내일 — KST 경계 여유) */
export async function clearUsage(userIds: string[]) {
  if (userIds.length === 0) return;
  const { error } = await serviceClient()
    .from('quick_chat_ai_usage')
    .delete()
    .in('user_id', userIds)
    .in('day', [kstDay(-1), kstDay(0), kstDay(1)]);
  if (error) throw new Error(`quick_chat_ai_usage delete: ${error.message}`);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** 이 page에서 나간 `POST …/messages/suggest` 수 (reload 뒤에도 같은 page면 누적) */
export function countSuggestPosts(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && pathnameOf(request.url()).endsWith('/messages/suggest')) count += 1;
  });
  return () => count;
}

/** 이 page에서 나간 메시지 전송(`POST …/messages`) 수 — suggest·read 제외 */
export function countMessageSends(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && pathnameOf(request.url()).endsWith('/messages')) count += 1;
  });
  return () => count;
}

export function repliesRow(page: Page): Locator {
  return page.getByTestId('quick-chat-quick-replies-row');
}

export function repliesGroup(page: Page): Locator {
  return page.getByTestId('quick-chat-quick-replies');
}

export function replyChips(page: Page): Locator {
  return repliesGroup(page).getByRole('button');
}

export function aiBadge(page: Page): Locator {
  return page.getByTestId('quick-chat-ai-badge');
}

/** 「AI 추천」 상태 — 칩 4개가 fixture 문장 · `data-source='ai'` · 배지 */
export async function expectAiChips(page: Page, suggestions: readonly string[], timeout = AI_READY_TIMEOUT_MS) {
  await expect(replyChips(page)).toHaveText([...suggestions], { timeout });
  await expect(repliesGroup(page)).toHaveAttribute('data-source', 'ai');
  await expect(aiBadge(page)).toBeVisible();
  await expect(aiBadge(page)).toHaveText(AI_TEXT.badge);
}

/** 규칙 칩 상태 — 배지 0 · `data-source='rules'` */
export async function expectRuleChips(page: Page, replies: readonly string[], timeout = 10_000) {
  await expect(replyChips(page)).toHaveText([...replies], { timeout });
  await expect(repliesGroup(page)).toHaveAttribute('data-source', 'rules');
  await expect(aiBadge(page)).toHaveCount(0);
}

/** 토스트 0 + 서버 오류 문구 화면 노출 0 (D-8 「조용히」) */
export async function expectNoToast(page: Page) {
  await expect(page.getByRole('region', { name: /Notifications/ }).getByRole('listitem')).toHaveCount(0);
  for (const text of [AI_TEXT.limit, AI_TEXT.failed, AI_TEXT.disabled, AI_TEXT.noNewMessage]) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
}

/** UI로 전송 (Enter) — `POST …/messages` 201만 기다린다 (suggest와 구분) */
export async function sendFromUi(page: Page, body: string): Promise<ChatMessage> {
  const input = page.getByTestId('quick-chat-input');
  await input.fill(body);
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && pathnameOf(response.url()).endsWith('/messages')
  );
  await input.press('Enter');
  const response = await responsePromise;
  expect(response.status(), 'POST messages').toBe(201);
  const json = (await response.json()) as { data: { message: ChatMessage } };
  await expect(page.getByTestId(`quick-chat-message-${json.data.message.id}`)).toBeVisible({ timeout: 10_000 });
  return json.data.message;
}

/** boundingBox 높이 (소수점 반올림) */
export async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, 'boundingBox').not.toBeNull();
  return Math.round(box!.height * 10) / 10;
}
