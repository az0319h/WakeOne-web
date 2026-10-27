import { expect, test, type Page } from '@playwright/test';
import { setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  acceptAs,
  cancelAs,
  createAs,
  dispatchAs,
  pageAs,
  callAs
} from './helpers';

// plan 89 §F 활동 로그 — docs/plans/89_quick-workflow-dongbang-openchat-plan.md

async function expectLogRow(page: Page, action: string, requestNo: string, label: string, result: string) {
  await page.goto(
    `/dashboard/logs?log_user=all&action=${encodeURIComponent(action)}&search=${encodeURIComponent(requestNo)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
  // 일반 사용자 화면은 action·search URL 필터를 쓰지 않는다(본인 관련 최신순) → 번호 + 라벨로 행을 찾는다
  const row = page
    .getByTestId('activity-log-row')
    .filter({ hasText: requestNo })
    .filter({ hasText: label })
    .first();
  await expect(row, `${action} ${requestNo}`).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(result);
}

test.describe('plan 89 F. 활동 로그', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async () => {
    await setOpenchatMockMode('ok');
  });

  test('AC-37: user·동방 각자 /dashboard/logs — 등록·접수·배차 완료·취소 성공 · admin 403 실패 로그', async ({
    browser
  }) => {
    const flow = await createAs('user');
    await acceptAs('dongbang', flow.requestNo);
    await dispatchAs('dongbang', flow.requestNo);
    const cancelled = await createAs('user');
    await cancelAs('user', cancelled.requestNo);
    const forbiddenRequested = await createAs('user');
    const forbiddenPatch = await callAs('user', (api) =>
      api.patch(`/api/quick-request/${forbiddenRequested.requestNo}`, { data: { itemDescription: 'x' } })
    );
    expect(forbiddenPatch.status).toBe(403);
    expect(forbiddenPatch.body.message).toBe(
      '요청자는 등록 후 내용을 수정할 수 없습니다.'
    );

    const user = await pageAs(browser, 'user');
    try {
      await expectLogRow(user.page, 'quick_request.create', flow.requestNo, '퀵 요청 등록', '성공');
      await expectLogRow(user.page, 'quick_request.cancel', cancelled.requestNo, '퀵 요청 취소', '성공');
    } finally {
      await user.context.close();
    }

    const vendor = await pageAs(browser, 'dongbang');
    try {
      await expectLogRow(vendor.page, 'quick_request.accept', flow.requestNo, '퀵 요청 접수', '성공');
      await expectLogRow(vendor.page, 'quick_request.dispatch', flow.requestNo, '퀵 배차 완료', '성공');
    } finally {
      await vendor.context.close();
    }

    const admin = await pageAs(browser, 'admin');
    try {
      await expectLogRow(
        admin.page,
        'quick_request.update',
        forbiddenRequested.requestNo,
        '퀵 요청 수정',
        '권한 없음'
      );
    } finally {
      await admin.context.close();
    }
  });
});
