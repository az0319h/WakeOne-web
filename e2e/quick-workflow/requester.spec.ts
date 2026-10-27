import { expect, test } from '@playwright/test';
import { listOpenchatMockRequests, openchatRequestsFor, setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  DISPATCH_BODY,
  dbNotifications,
  expectDetailStatus,
  expectLogFor,
  fixtureUser,
  gotoDetail,
  MSG,
  readAccountMeta,
  readJson,
  seedQuickRequest,
  callAs,
  withApi
} from './helpers';

// plan 89 §D 요청자·승인·취소·잠금 — docs/plans/89_quick-workflow-dongbang-openchat-plan.md
test.describe('plan 89 D. 요청자 · 승인 · 취소 · 잠금', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ storageState: 'e2e/.auth/user.json' });

  test.beforeEach(async () => {
    await setOpenchatMockMode('ok');
  });

  test('AC-22: 요청자 본인 requested 건 — 「수정」 없음 · PATCH 403 「요청자는 등록 후 내용을 수정할 수 없습니다.」', async ({
    page
  }) => {
    const { requestNo } = await seedQuickRequest('requested');
    await gotoDetail(page, requestNo);
    await expectDetailStatus(page, 'requested');
    await expect(page.getByTestId('quick-detail-cancel')).toBeVisible();
    await expect(page.getByTestId('quick-detail-edit')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);

    const response = await callAs('user', (api) =>
      api.patch(`/api/quick-request/${requestNo}`, { data: { itemDescription: '바꿈' } })
    );
    expect(response.status).toBe(403);
    expect(response.body.message).toBe(MSG.requesterCannotEdit);
    expect(response.headers['x-request-id']).toBeTruthy();
    await expectLogFor('quick_request.update', requestNo, 403);
  });

  test('AC-23: 요청자 requested 건 「요청 취소」 → AlertModal 「퀵 요청을 취소할까요?」 → 「취소」 · webhook · 동방 알림 · cancel 로그', async ({
    page
  }) => {
    const { requestNo } = await seedQuickRequest('requested');
    await gotoDetail(page, requestNo);
    await page.getByTestId('quick-detail-cancel').click();
    const modal = page.getByRole('dialog', { name: '퀵 요청을 취소할까요?' });
    await expect(modal).toBeVisible();
    await modal.getByTestId('quick-cancel-reason').fill('E2E 일정 변경');
    await expect(modal).toContainText('/200');
    await modal.getByRole('button', { name: '요청 취소' }).click();
    await expect(modal).toBeHidden({ timeout: 15_000 });
    await expectDetailStatus(page, 'cancelled');
    await expect(page.getByTestId('quick-detail-cancelled-banner')).toContainText('사유: E2E 일정 변경');
    await expect(page.getByTestId('quick-detail-actions')).toHaveCount(0);

    const cancelled = await openchatRequestsFor(requestNo, 'cancelled');
    expect(cancelled).toHaveLength(1);
    const lines = String(cancelled[0].body.text).split('\n');
    expect(lines[0]).toBe(`🚫퀵요청 취소 - ${requestNo}`);
    const user = await fixtureUser('user');
    expect(lines[1]).toBe(`"${user.fullName}"님이 퀵 요청을 취소하였습니다.`);
    expect(lines).toContain('사유: E2E 일정 변경');

    const dongbang = readAccountMeta('dongbang');
    const vendorNotifications = await dbNotifications(dongbang.userId, requestNo);
    expect(vendorNotifications.map((item) => item.type)).toEqual(
      expect.arrayContaining(['quick_request.vendor_event'])
    );
    expect(vendorNotifications.map((item) => item.title)).toContain('퀵 요청이 취소되었습니다');
    await expectLogFor('quick_request.cancel', requestNo, 200);
  });

  test('AC-24: 요청자 dispatching 건 — 「요청 취소」 없음 · cancel API 403 안내 문구', async ({ page }) => {
    const { requestNo } = await seedQuickRequest('dispatching');
    await gotoDetail(page, requestNo);
    await expectDetailStatus(page, 'dispatching');
    await expect(page.getByTestId('quick-detail-cancel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '요청 취소' })).toHaveCount(0);

    const response = await callAs('user', (api) =>
      api.post(`/api/quick-request/${requestNo}/cancel`, { data: {} })
    );
    expect(response.status).toBe(403);
    expect(response.body.message).toBe(MSG.requesterCannotCancel);
  });

  test('AC-25: 요청자 dispatched · 최종금액 없음 — 「승인」 비활성 + 안내 · approve API 409', async ({
    page
  }) => {
    const { requestNo } = await seedQuickRequest('dispatched');
    await gotoDetail(page, requestNo);
    await expectDetailStatus(page, 'dispatched');
    const approve = page.getByTestId('quick-detail-approve');
    await expect(approve).toBeVisible();
    await expect(approve).toBeDisabled();
    await expect(page.getByTestId('quick-detail-approve-hint')).toHaveText(MSG.finalAmountRequired);

    const response = await callAs('user', (api) => api.post(`/api/quick-request/${requestNo}/approve`));
    expect(response.status).toBe(409);
    expect(response.body.message).toBe(MSG.finalAmountRequired);
  });

  test('AC-26: 요청자 dispatched · 최종금액 있음 — 「승인」 → AlertModal → 「승인」 · webhook 없음 · approve 로그', async ({
    page
  }) => {
    const { requestNo } = await seedQuickRequest('dispatchedWithFinal');
    const before = (await listOpenchatMockRequests()).filter((e) => e.body.requestNo === requestNo).length;
    await gotoDetail(page, requestNo);
    const approve = page.getByTestId('quick-detail-approve');
    await expect(approve).toBeEnabled();
    await approve.click();
    const modal = page.getByRole('dialog', { name: '퀵 요청 승인' });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('23,000원');
    await modal.getByRole('button', { name: '승인', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 15_000 });
    await expectDetailStatus(page, 'approved');
    await expect(page.getByTestId('quick-detail-actions')).toHaveCount(0);

    const after = (await listOpenchatMockRequests()).filter((e) => e.body.requestNo === requestNo).length;
    expect(after).toBe(before);
    await expectLogFor('quick_request.approve', requestNo, 200);
  });

  test('AC-27: approved·cancelled 건 PATCH·accept·dispatch·cancel → 409 「완료되었거나 취소된 요청은 변경할 수 없습니다.」 (동방·admin)', async () => {
    const approved = await seedQuickRequest('approved');
    const cancelled = await seedQuickRequest('cancelled');
    for (const account of ['dongbang', 'admin'] as const) {
      await withApi(account, async (api) => {
        for (const no of [approved.requestNo, cancelled.requestNo]) {
          const calls = [
            ['PATCH', () => api.patch(`/api/quick-request/${no}`, { data: { itemDescription: '변경' } })],
            ['accept', () => api.post(`/api/quick-request/${no}/accept`)],
            ['dispatch', () => api.post(`/api/quick-request/${no}/dispatch`, { data: DISPATCH_BODY })],
            ['cancel', () => api.post(`/api/quick-request/${no}/cancel`, { data: {} })]
          ] as const;
          for (const [label, run] of calls) {
            const response = await run();
            expect(response.status(), `${account} ${label} ${no}`).toBe(409);
            expect((await readJson<{ message: string }>(response)).message, `${account} ${label}`).toBe(
              MSG.locked
            );
          }
        }
      });
    }
  });

  test('AC-28: 동방특송 approve → 403', async () => {
    const { requestNo } = await seedQuickRequest('dispatchedWithFinal');
    const response = await callAs('dongbang', (api) =>
      api.post(`/api/quick-request/${requestNo}/approve`)
    );
    expect(response.status).toBe(403);
    expect(response.body.message).toBe(MSG.forbidden);
  });
});
