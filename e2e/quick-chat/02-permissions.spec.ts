import { expect, test } from '@playwright/test';
import { callAs, createAs, pageAs, seedQuickRequest, uniqueTag } from '../quick-workflow/helpers';
import { CHAT_TEXT, getMessagesAs, gotoChat, postMessageAs, sendMessageAs } from './helpers';

/**
 * plan 93 §A 권한 — docs/plans/93_quick-request-chat-plan.md (AC-05 · AC-06 · AC-07 · AC-08)
 */
test.describe('plan 93 A. 권한 · 잠금 · 검증', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('AC-05: 구매물류팀 — 타인 건 대화는 보이고 입력창 대신 안내 · POST 403 같은 문구', async ({ browser }) => {
    const { requestNo } = await createAs('user', uniqueTag('E2E93P5'));
    const body = `구매물류 읽기 전용 확인 ${Date.now()}`;
    await sendMessageAs('user', requestNo, body);

    const { context, page } = await pageAs(browser, 'logistics');
    try {
      await gotoChat(page, requestNo);
      await expect(page.getByTestId('quick-chat-messages')).toContainText(body, { timeout: 20_000 });
      const notice = page.getByTestId('quick-chat-read-only');
      await expect(notice).toHaveText(CHAT_TEXT.logisticsReadOnly);
      await expect(notice).toHaveAttribute('data-reason', 'logistics');
      await expect(page.getByTestId('quick-chat-input')).toHaveCount(0);
      await expect(page.getByTestId('quick-chat-quick-replies')).toHaveCount(0);
    } finally {
      await context.close();
    }

    const forbidden = await postMessageAs('logistics', requestNo, { body: '쓰기 시도' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe(CHAT_TEXT.logisticsReadOnly);
    expect(forbidden.headers['x-request-id']).toBeTruthy();
  });

  test('AC-06: user2 — user 건 GET·POST 404 「퀵 요청을 찾을 수 없습니다.」 · 화면 목록 0건 + 「대화를 찾을 수 없습니다.」', async ({
    browser
  }) => {
    const { requestNo } = await createAs('user', uniqueTag('E2E93P6'));
    await sendMessageAs('user', requestNo, '타인 건');

    const get = await getMessagesAs('user2', requestNo);
    expect(get.status).toBe(404);
    expect(get.body.message).toBe(CHAT_TEXT.requestNotFound);
    const post = await postMessageAs('user2', requestNo, { body: '침입' });
    expect(post.status).toBe(404);
    expect(post.body.message).toBe(CHAT_TEXT.requestNotFound);
    const read = await callAs('user2', (api) =>
      api.put(`/api/quick-request/${requestNo}/messages/read`, { data: { lastMessageId: 0 } })
    );
    expect(read.status).toBe(404);

    const { context, page } = await pageAs(browser, 'user2');
    try {
      await gotoChat(page, requestNo);
      await expect(page.getByTestId('quick-chat-not-found')).toContainText(CHAT_TEXT.notFound, { timeout: 20_000 });
      await expect(page.getByTestId(`quick-chat-list-item-${requestNo}`)).toHaveCount(0);
      await expect(page.getByTestId('quick-chat-list').getByText(requestNo)).toHaveCount(0);
      await expect(page.getByTestId('quick-chat-input')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-07: approved·cancelled 건 — 기존 메시지 보임 · 입력창 대신 잠금 안내 · POST 409 · admin 동일', async ({ browser }) => {
    const approved = await seedQuickRequest('dispatchedWithFinal', 'user', uniqueTag('E2E93P7A'));
    const approvedBody = `승인 전 메시지 ${Date.now()}`;
    await sendMessageAs('dongbang', approved.requestNo, approvedBody);
    await callAs('user', async (api) => {
      const response = await api.post(`/api/quick-request/${approved.requestNo}/approve`);
      expect(response.status()).toBe(200);
      return response;
    });

    const cancelled = await createAs('user', uniqueTag('E2E93P7C'));
    const cancelledBody = `취소 전 메시지 ${Date.now()}`;
    await sendMessageAs('user', cancelled.requestNo, cancelledBody);
    await callAs('user', async (api) => {
      const response = await api.post(`/api/quick-request/${cancelled.requestNo}/cancel`, { data: {} });
      expect(response.status()).toBe(200);
      return response;
    });

    for (const [no, body] of [
      [approved.requestNo, approvedBody],
      [cancelled.requestNo, cancelledBody]
    ] as const) {
      for (const account of ['dongbang', 'admin'] as const) {
        const result = await postMessageAs(account, no, { body: '잠금 후 전송' });
        expect(result.status, `${account} ${no}`).toBe(409);
        expect(result.body.message).toBe(CHAT_TEXT.locked);
      }
      const requester = await postMessageAs('user', no, { body: '잠금 후 전송' });
      expect(requester.status, `user ${no}`).toBe(409);

      for (const account of ['dongbang', 'admin'] as const) {
        const { context, page } = await pageAs(browser, account);
        try {
          await gotoChat(page, no);
          await expect(page.getByTestId('quick-chat-messages')).toContainText(body, { timeout: 20_000 });
          const notice = page.getByTestId('quick-chat-read-only');
          await expect(notice).toHaveText(CHAT_TEXT.locked);
          await expect(notice).toHaveAttribute('data-reason', 'locked');
          await expect(page.getByTestId('quick-chat-input')).toHaveCount(0);
          await expect(page.getByTestId('quick-chat-quick-replies')).toHaveCount(0);
        } finally {
          await context.close();
        }
      }
    }
  });

  test('AC-08: user 본인 건 — 공백만 400 · 1,001자 400 · JSON 아님 400 (문구 3종)', async () => {
    const { requestNo } = await createAs('user', uniqueTag('E2E93P8'));

    const blank = await postMessageAs('user', requestNo, { body: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.message).toBe(CHAT_TEXT.bodyRequired);

    const tooLong = await postMessageAs('user', requestNo, { body: '가'.repeat(1001) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.message).toBe(CHAT_TEXT.bodyTooLong);

    const notJson = await callAs('user', (api) =>
      api.post(`/api/quick-request/${requestNo}/messages`, {
        headers: { 'content-type': 'application/json' },
        data: '{not json'
      })
    );
    expect(notJson.status).toBe(400);
    expect(notJson.body.message).toBe(CHAT_TEXT.invalidBody);

    const wrongType = await postMessageAs('user', requestNo, { body: 123 });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.message).toBe(CHAT_TEXT.invalidBody);

    const ok = await postMessageAs('user', requestNo, { body: '가'.repeat(1000) });
    expect(ok.status, '1,000자는 201').toBe(201);
  });
});
