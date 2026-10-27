import { expect, test, type Page } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  createAs,
  dbQuickRequest,
  fixtureUser,
  pageAs,
  readAccountMeta,
  uniqueTag
} from '../quick-workflow/helpers';
import {
  CHAT_TEXT,
  REQUESTER_REPLIES,
  VENDOR_REPLIES,
  composerInput,
  gotoChat,
  gotoDetailChat,
  insertFixtureMessages,
  messageBubble,
  messagesLog,
  receipt,
  sendButton,
  sendMessageAs,
  sendViaUi
} from './helpers';

/**
 * plan 93 §A·B·F 상세 「요청 대화」 · 전송 · 칩 · DM 동작 — docs/plans/93_quick-request-chat-plan.md
 * (AC-04 PC · AC-10 · AC-11 · AC-15 · AC-33 · AC-34 · AC-35) — user.json(요청자) 기본 context
 */

const MESSAGES_POST = (url: string, method: string) => url.includes('/messages') && method === 'POST';

function countPosts(page: Page) {
  let count = 0;
  page.on('request', (request) => {
    if (MESSAGES_POST(request.url(), request.method())) count += 1;
  });
  return () => count;
}

test.describe('plan 93 B·F. 상세 「요청 대화」 전송 · DM 동작', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let user: { userId: string; fullName: string };
  let requestNo = '';

  test.beforeAll(async () => {
    user = await fixtureUser('user');
    requestNo = (await createAs('user', uniqueTag('E2E93SEND'))).requestNo;
  });

  test('AC-04: 1280 상세 — 「요청 대화」 영역 · 빈 상태 문구 · placeholder · 「전송」 버튼', async ({ page }) => {
    await gotoDetailChat(page, requestNo);
    const section = page.getByTestId('quick-detail-chat');
    await expect(section.getByRole('heading', { name: CHAT_TEXT.detailChatTitle })).toBeVisible();
    await expect(page.getByTestId('quick-chat-empty')).toHaveText(CHAT_TEXT.emptyWritable, { timeout: 20_000 });
    await expect(page.getByPlaceholder(CHAT_TEXT.composerPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: CHAT_TEXT.send, exact: true })).toBeVisible();
  });

  test('AC-15: 요청자 칩 3개 · 클릭 시 입력창에 채워지고 전송 0건 · 동방 칩 4개', async ({ page, browser }) => {
    await gotoDetailChat(page, requestNo);
    const posts = countPosts(page);
    const chips = page.getByTestId('quick-chat-quick-replies').getByRole('button');
    await expect(chips).toHaveCount(3);
    await expect(chips).toHaveText([...REQUESTER_REPLIES]);
    await chips.nth(0).click();
    await expect(composerInput(page)).toHaveValue(REQUESTER_REPLIES[0]);
    await page.waitForTimeout(800);
    expect(posts(), '칩 클릭은 전송하지 않음').toBe(0);
    await composerInput(page).fill('');

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendor.page, requestNo);
      const vendorChips = vendor.page.getByTestId('quick-chat-quick-replies').getByRole('button');
      await expect(vendorChips).toHaveCount(4, { timeout: 20_000 });
      await expect(vendorChips).toHaveText([...VENDOR_REPLIES]);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-10: 「동방특송 담당자님 이건 취소해주세요」 Enter → 201 · 오른쪽 말풍선 1개 · 이름·「요청자」·절대 시각·「전송됨」 · 입력창 비움 · 중복 0', async ({
    page
  }) => {
    await gotoDetailChat(page, requestNo);
    const body = '동방특송 담당자님 이건 취소해주세요';
    const { id, bubble } = await sendViaUi(page, body);
    await expect(bubble).toHaveAttribute('data-mine', 'true');
    await expect(bubble).toHaveAttribute('data-author-role', 'requester');
    await expect(bubble).toContainText(user.fullName);
    await expect(bubble).toContainText(CHAT_TEXT.roleRequester);
    await expect(bubble).toContainText(body);
    await expect(bubble).toContainText(ABSOLUTE_DATETIME_RE);
    await expect(receipt(page, id)).toHaveAttribute('data-state', 'sent');
    await expect(receipt(page, id)).toContainText(CHAT_TEXT.receiptSent);
    await expect(composerInput(page)).toHaveValue('');
    await expect(page.getByTestId(`quick-chat-message-${id}`)).toHaveCount(1);
    // 오른쪽 정렬: 말풍선 오른쪽 끝이 로그 가운데보다 오른쪽
    const logBox = await messagesLog(page).boundingBox();
    const bubbleBox = await bubble.locator('div').filter({ hasText: body }).last().boundingBox();
    expect(bubbleBox!.x + bubbleBox!.width).toBeGreaterThan(logBox!.x + logBox!.width / 2);
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId(`quick-chat-message-${id}`), 'Realtime 수신분 중복 0').toHaveCount(1);
  });

  test('AC-11: Shift+Enter 줄바꿈만 · 조합 중 Enter 전송 안 함 · 전송 중 재클릭 중복 0', async ({ page }) => {
    await gotoDetailChat(page, requestNo);
    const posts = countPosts(page);
    const input = composerInput(page);
    await input.fill('첫 줄');
    await input.press('Shift+Enter');
    await input.type('둘째 줄');
    await expect(input).toHaveValue('첫 줄\n둘째 줄');
    expect(posts()).toBe(0);

    // 한글 조합 중 Enter (isComposing=true) — 브라우저 IME 이벤트를 그대로 흉내낸다
    await input.evaluate((node) => {
      node.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, isComposing: true })
      );
    });
    await page.waitForTimeout(500);
    expect(posts(), '조합 중 Enter는 전송하지 않음').toBe(0);
    await expect(input).toHaveValue('첫 줄\n둘째 줄');
    await input.fill('');

    // 전송 중 재클릭 — POST를 1.2초 지연시키고 버튼을 연타
    await page.route('**/api/quick-request/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    });
    await input.fill(`중복 방지 ${Date.now()}`);
    const button = sendButton(page);
    await button.click();
    await expect(button).toBeDisabled();
    await button.click({ force: true });
    await button.click({ force: true });
    await input.press('Enter');
    await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 10_000 });
    await expect(input, '전송 후 입력 비움').toHaveValue('');
    await page.waitForTimeout(500);
    expect(posts(), '전송 중 재클릭 중복 0').toBe(1);
    await page.unroute('**/api/quick-request/*/messages');
  });

  test('AC-33: POST 1.5초 지연 — 클릭 직후 임시 말풍선(pending) · 응답 후 「전송됨」 · 최종 1개', async ({ page }) => {
    await gotoDetailChat(page, requestNo);
    await page.route('**/api/quick-request/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    const body = `테스트 ${Date.now()}`;
    await composerInput(page).fill(body);
    const responsePromise = page.waitForResponse((r) => MESSAGES_POST(r.url(), r.request().method()));
    const startedAt = Date.now();
    await sendButton(page).click();
    const pending = page.locator('[data-testid^="quick-chat-message-temp-"]');
    await expect(pending).toHaveCount(1, { timeout: 200 });
    expect(Date.now() - startedAt, 'optimistic 200ms 안').toBeLessThanOrEqual(400);
    await expect(pending).toHaveAttribute('data-state', 'pending');
    await expect(pending.locator('[data-testid^="quick-chat-receipt-temp-"]')).toHaveAttribute('data-state', 'pending');
    await expect(pending).toContainText(body);
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const { data } = (await response.json()) as { data: { message: { id: number } } };
    await expect(messageBubble(page, data.message.id)).toBeVisible({ timeout: 10_000 });
    await expect(receipt(page, data.message.id)).toHaveAttribute('data-state', 'sent');
    await expect(pending).toHaveCount(0);
    await page.waitForTimeout(1_500);
    await expect(messagesLog(page).locator('[data-testid^="quick-chat-message-"]').filter({ hasText: body })).toHaveCount(1);
    await page.unroute('**/api/quick-request/*/messages');
  });

  test('AC-34: POST 500 — 「전송 실패 · 다시 보내기」 · 입력 보존 · 다시 보내기 201 「전송됨」 · 미전송 「삭제」는 AlertModal 없이 즉시', async ({
    page
  }) => {
    await gotoDetailChat(page, requestNo);
    const fail = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: '메시지를 보내지 못했습니다. 다시 시도해 주세요.' })
      });
    };
    await page.route('**/api/quick-request/*/messages', fail);
    const body = `실패 재시도 ${Date.now()}`;
    await composerInput(page).fill(body);
    await composerInput(page).press('Enter');
    const failed = page.locator('[data-testid^="quick-chat-message-temp-"][data-state="failed"]');
    await expect(failed).toHaveCount(1, { timeout: 10_000 });
    await expect(failed).toContainText(CHAT_TEXT.sendFailed);
    const retry = failed.getByRole('button', { name: CHAT_TEXT.retry });
    await expect(retry).toBeVisible();
    await expect(composerInput(page), '입력 내용 유지').toHaveValue(body);
    await composerInput(page).fill('');

    await page.unroute('**/api/quick-request/*/messages');
    const responsePromise = page.waitForResponse((r) => MESSAGES_POST(r.url(), r.request().method()));
    await retry.click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const { data } = (await response.json()) as { data: { message: { id: number } } };
    await expect(messageBubble(page, data.message.id)).toContainText(body);
    await expect(receipt(page, data.message.id)).toHaveAttribute('data-state', 'sent');
    await expect(failed).toHaveCount(0);

    // 미전송 임시 항목 「삭제」 — 서버 데이터 아님 → AlertModal 없이 즉시
    await page.route('**/api/quick-request/*/messages', fail);
    await composerInput(page).fill(`삭제 대상 ${Date.now()}`);
    await composerInput(page).press('Enter');
    await expect(failed).toHaveCount(1, { timeout: 10_000 });
    await failed.getByRole('button', { name: CHAT_TEXT.discard }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(failed).toHaveCount(0);
    await page.unroute('**/api/quick-request/*/messages');
  });

  test('AC-35: 어제 2개(같은 사람 2분 간격) + 오늘 1개 — 날짜 구분선 2개 · 어제 묶음 이름 1회·시각 마지막에만 · 오늘 이름 표시', async ({
    page
  }) => {
    const fixtureNo = (await createAs('user', uniqueTag('E2E93GRP'))).requestNo;
    const row = await dbQuickRequest(fixtureNo);
    const dongbang = readAccountMeta('dongbang');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    yesterday.setHours(10, 0, 0, 0);
    const [firstId, secondId] = await insertFixtureMessages(row.id, [
      {
        authorUserId: dongbang.userId,
        authorName: dongbang.fullName,
        authorRole: 'dongbang',
        body: '어제 첫 메시지',
        createdAt: yesterday.toISOString()
      },
      {
        authorUserId: dongbang.userId,
        authorName: dongbang.fullName,
        authorRole: 'dongbang',
        body: '어제 둘째 메시지',
        createdAt: new Date(yesterday.getTime() + 2 * 60 * 1000).toISOString()
      }
    ]);
    const today = await sendMessageAs('dongbang', fixtureNo, '오늘 메시지');

    await gotoDetailChat(page, fixtureNo);
    const dividers = page.getByTestId('quick-chat-date-divider');
    await expect(dividers).toHaveCount(2, { timeout: 20_000 });
    // core-conventions §날짜만(상한 규칙): 날짜 전용 표시는 `formatAbsoluteDateKo` = `yyyy-MM-dd` (plan AC-35의 `(EEE)` 표기는 수정 이력에 정정)
    const dividerTexts = (await dividers.allInnerTexts()).map((text) => text.trim());
    for (const text of dividerTexts) {
      expect(text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(new Set(dividerTexts).size, '어제·오늘 서로 다른 날짜').toBe(2);
    const first = messageBubble(page, firstId);
    const second = messageBubble(page, secondId);
    const todayBubble = messageBubble(page, today.id);
    await expect(first).toContainText(dongbang.fullName);
    await expect(first).toContainText(CHAT_TEXT.roleDongbang);
    await expect(first.locator('time')).toHaveCount(0);
    await expect(second).not.toContainText(dongbang.fullName);
    await expect(second).not.toContainText(CHAT_TEXT.roleDongbang);
    await expect(second.locator('time')).toHaveCount(1);
    await expect(second.locator('time')).toHaveText(ABSOLUTE_DATETIME_RE);
    await expect(todayBubble).toContainText(dongbang.fullName);
    await expect(todayBubble.locator('time')).toHaveCount(1);
  });
});
