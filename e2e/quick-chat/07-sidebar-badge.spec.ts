import { expect, test } from '@playwright/test';
import { formatUnreadBadge } from '../../src/features/quick-request/components/chat/format-unread-badge';
import { createAs, gotoDashboard, pageAs, uniqueTag } from '../quick-workflow/helpers';
import {
  REALTIME_TIMEOUT_MS,
  SUBSCRIBE_SETTLE_MS,
  apiAsDongbang2,
  createDongbang2WithSession,
  markReadAsDongbang2,
  pageAsDongbang2,
  sendMessageAs
} from './helpers';

/**
 * plan 93 §F 사이드바 「퀵 대화」 배지 — docs/plans/93_quick-request-chat-plan.md (AC-37)
 */
test.describe('plan 93 F. 사이드바 전체 안 읽은 수', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  test.beforeAll(async ({ browser }) => {
    await createDongbang2WithSession(browser);
    await apiAsDongbang2(async (api) => {
      const response = await api.get('/api/quick-request/conversations?tab=unread');
      const { data } = (await response.json()) as {
        data: { conversations: { requestNo: string; lastMessage: { id: number } | null }[] };
      };
      for (const conversation of data.conversations) {
        if (conversation.lastMessage) {
          await api.put(`/api/quick-request/${conversation.requestNo}/messages/read`, {
            data: { lastMessageId: conversation.lastMessage.id }
          });
        }
      }
      const total = await api.get('/api/quick-request/unread-total');
      expect(((await total.json()) as { data: { total: number } }).data.total, 'baseline 0').toBe(0);
    });
  });

  test('AC-37: dongbang2 /dashboard/quick — 건 A 2개·건 B 1개 → 5초 안 배지 3 · 접힌 모드 숨김+tooltip · A 읽으면 1 · user2 배지 없음 · 99+ 단위', async ({
    browser
  }) => {
    const [a, b] = await Promise.all([createAs('user', uniqueTag('E2E93SBA')), createAs('user', uniqueTag('E2E93SBB'))]);
    const vendor = await pageAsDongbang2(browser);
    try {
      await gotoDashboard(vendor.page);
      // 새 계정은 사이드바가 접힌(icon) 상태로 시작할 수 있다 → 펼친 상태에서 판정
      const sidebar = vendor.page.locator('[data-slot="sidebar"][data-collapsible]').first();
      const toggle = vendor.page.getByRole('button', { name: 'Toggle Sidebar' }).first();
      if ((await sidebar.getAttribute('data-state')) === 'collapsed') {
        await toggle.click();
      }
      await expect(sidebar).toHaveAttribute('data-state', 'expanded');
      const badge = vendor.page.getByTestId('quick-chat-sidebar-badge');
      await expect(badge).toHaveCount(0);
      await vendor.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      await sendMessageAs('user', a.requestNo, '건 A 첫 메시지');
      await sendMessageAs('user', a.requestNo, '건 A 둘째 메시지');
      const lastB = await sendMessageAs('user', b.requestNo, '건 B 메시지');
      await expect(badge).toHaveText('3', { timeout: REALTIME_TIMEOUT_MS });
      await expect(badge).toBeVisible();

      // 접힌(icon) 모드 — 배지 숨김 · tooltip 유지
      await toggle.click();
      await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
      await expect(sidebar).toHaveAttribute('data-collapsible', 'icon');
      await expect(badge).toBeHidden();
      const chatLink = vendor.page.getByRole('link', { name: '퀵 대화', exact: true }).first();
      await chatLink.hover();
      await expect(vendor.page.getByRole('tooltip').filter({ hasText: '퀵 대화' })).toBeVisible({ timeout: 5_000 });
      await vendor.page.mouse.move(0, 0);
      await toggle.click();
      await expect(sidebar).toHaveAttribute('data-state', 'expanded');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('3');

      // 건 A를 읽으면 5초 안에 1
      const aMessages = await apiAsDongbang2(async (api) => {
        const response = await api.get(`/api/quick-request/${a.requestNo}/messages`);
        return ((await response.json()) as { data: { messages: { id: number }[] } }).data.messages;
      });
      const read = await markReadAsDongbang2(a.requestNo, aMessages[aMessages.length - 1].id);
      expect(read.status).toBe(200);
      await expect(badge).toHaveText('1', { timeout: REALTIME_TIMEOUT_MS });

      await markReadAsDongbang2(b.requestNo, lastB.id);
      await expect(badge).toHaveCount(0, { timeout: REALTIME_TIMEOUT_MS });
    } finally {
      await vendor.context.close();
    }

    const other = await pageAs(browser, 'user2');
    try {
      await gotoDashboard(other.page);
      await other.page.waitForTimeout(1_500);
      await expect(other.page.getByTestId('quick-chat-sidebar-badge')).toHaveCount(0);
    } finally {
      await other.context.close();
    }

    expect(formatUnreadBadge(99)).toBe('99');
    expect(formatUnreadBadge(100)).toBe('99+');
    expect(formatUnreadBadge(250)).toBe('99+');
  });
});
