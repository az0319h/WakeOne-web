import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  callAs,
  createAs,
  fixtureUser,
  pageAs,
  uniqueTag,
  type AccountKey
} from '../quick-workflow/helpers';
import { CHAT_TEXT, getMessagesDataAs, gotoChat, sendMessageAs, waitForSubscribed } from './helpers';

/**
 * plan 93 §A 화면 구조 — docs/plans/93_quick-request-chat-plan.md (AC-01 · AC-02 · AC-09)
 */
test.describe('plan 93 A. 「퀵 대화」 nav · Messenger 구조 · 동방 allowlist', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let user: { userId: string; fullName: string };
  let requestNos: string[] = [];
  let msgNo = '';
  let lastBody = '';

  test.beforeAll(async () => {
    user = await fixtureUser('user');
    const created = await Promise.all([
      createAs('user', uniqueTag('E2E93A1')),
      createAs('user', uniqueTag('E2E93A2')),
      createAs('user', uniqueTag('E2E93A3'))
    ]);
    requestNos = created.map((item) => item.requestNo);
    msgNo = requestNos[0];
    lastBody = `동방특송 담당자님 이건 취소해주세요 ${Date.now()}`;
    await sendMessageAs('user', msgNo, lastBody);
  });

  test('AC-01: 사이드바 「퀵」 그룹 — 「퀵 대화」가 「퀵 대시보드」 아래 · 클릭 200 · 동방 「퀵 요청하기」 0건 · user·admin·logistics에도 노출', async ({
    browser
  }) => {
    const vendor = await pageAs(browser, 'dongbang');
    try {
      await vendor.page.goto('/dashboard/quick', { waitUntil: 'domcontentloaded' });
      await expect(vendor.page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
      const dashboardLink = vendor.page.getByRole('link', { name: '퀵 대시보드', exact: true }).first();
      const chatLink = vendor.page.getByRole('link', { name: '퀵 대화', exact: true }).first();
      await expect(dashboardLink).toBeVisible();
      await expect(chatLink).toBeVisible();
      await expect(chatLink).toHaveAttribute('href', '/dashboard/quick/chat');
      const dashboardBox = await dashboardLink.boundingBox();
      const chatBox = await chatLink.boundingBox();
      expect(chatBox!.y, '「퀵 대화」가 「퀵 대시보드」 아래').toBeGreaterThan(dashboardBox!.y);
      await expect(vendor.page.getByRole('link', { name: '퀵 요청하기', exact: true })).toHaveCount(0);

      // Link는 클라이언트 전환이라 document 응답이 없다 → 전환 + 서버 200은 같은 세션의 request로 판정
      const pageResponse = await vendor.page.request.get('/dashboard/quick/chat');
      expect(pageResponse.status(), '동방 /dashboard/quick/chat 200').toBe(200);
      await chatLink.click();
      await expect(vendor.page).toHaveURL(/\/dashboard\/quick\/chat/);
      await expect(vendor.page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
    } finally {
      await vendor.context.close();
    }

    for (const account of ['user', 'admin', 'logistics'] as AccountKey[]) {
      const { context, page } = await pageAs(browser, account);
      try {
        await page.goto('/dashboard/quick', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
        await expect(
          page.getByRole('link', { name: '퀵 대화', exact: true }).first(),
          `${account} nav 「퀵 대화」`
        ).toBeVisible();
      } finally {
        await context.close();
      }
    }
  });

  test('AC-02: 1280 · 동방 — 왼쪽 패널(제목·「실시간」·「대화 N건」·검색·탭·항목 구성·선택 강조) · 오른쪽 헤더(요청번호·상태·경로·「상세 보기」)', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(page);
      const panel = page.getByRole('complementary', { name: '퀵 대화 목록' });
      await expect(panel.getByRole('heading', { name: CHAT_TEXT.listTitle, exact: true })).toBeVisible();
      await waitForSubscribed(page);
      await expect(page.getByTestId('quick-chat-realtime-badge')).toHaveText(CHAT_TEXT.realtimeOn);
      await expect(page.getByTestId('quick-chat-list-summary')).toHaveText(/^대화 \d+건 · 안 읽은 대화 \d+건$/);
      const summary = await page.getByTestId('quick-chat-list-summary').innerText();
      expect(Number(/대화 (\d+)건/.exec(summary)![1]), '대화 3건 이상').toBeGreaterThanOrEqual(3);
      await expect(page.getByPlaceholder(CHAT_TEXT.searchPlaceholder)).toBeVisible();
      await expect(page.getByRole('tab', { name: CHAT_TEXT.tabAll })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^안 읽음/ })).toBeVisible();

      for (const no of requestNos) {
        await expect(page.getByTestId(`quick-chat-list-item-${no}`)).toBeVisible({ timeout: 15_000 });
      }
      const item = page.getByTestId(`quick-chat-list-item-${msgNo}`);
      await expect(item).toContainText(user.fullName.trim().charAt(0));
      await expect(item).toContainText(`${msgNo} · ${user.fullName}`);
      await expect(item).toContainText('신규요청');
      await expect(item).toContainText('→');
      await expect(item).toContainText(`${user.fullName}: ${lastBody}`);
      await expect(item).toContainText(ABSOLUTE_DATETIME_RE);
      await expect(page.getByTestId(`quick-chat-list-unread-${msgNo}`)).toHaveText('1');
      await expect(item).not.toHaveAttribute('aria-current', 'true');
      await expect(page.getByTestId('quick-chat-no-selection')).toContainText(CHAT_TEXT.noSelection);

      await item.click();
      await expect(page).toHaveURL(new RegExp(`request=${msgNo.replace('-', '(-|%2D)')}`));
      await expect(item).toHaveAttribute('aria-current', 'true');
      const header = page.getByTestId('quick-chat-header');
      await expect(header.getByRole('heading', { name: msgNo, exact: true })).toBeVisible();
      await expect(header).toContainText('신규요청');
      await expect(header).toContainText('→');
      await expect(header).toContainText(user.fullName);
      const detailLink = page.getByTestId('quick-chat-detail-link');
      await expect(detailLink).toHaveText(CHAT_TEXT.detailLink);
      await expect(detailLink).toHaveAttribute('href', `/dashboard/quick/${msgNo}`);
      await expect(page.getByTestId('quick-chat-messages')).toContainText(lastBody);
    } finally {
      await context.close();
    }
  });

  test('AC-09: 동방 — conversations·messages·read API 200 · 페이지 200 · dongbang-routes.ts에 /dashboard/quick/chat 명시', async () => {
    const conversations = await callAs('dongbang', (api) => api.get('/api/quick-request/conversations'));
    expect(conversations.status, JSON.stringify(conversations.body)).toBe(200);
    const messages = await getMessagesDataAs('dongbang', msgNo);
    expect(messages.messages.length).toBeGreaterThan(0);
    const read = await callAs('dongbang', (api) =>
      api.put(`/api/quick-request/${msgNo}/messages/read`, {
        data: { lastMessageId: messages.messages[messages.messages.length - 1].id }
      })
    );
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    const pageResponse = await callAs('dongbang', (api) => api.get('/dashboard/quick/chat'));
    expect(pageResponse.status).toBe(200);

    const source = fs.readFileSync('src/config/dongbang-routes.ts', 'utf8');
    expect(source).toContain("'/dashboard/quick/chat'");
  });
});
