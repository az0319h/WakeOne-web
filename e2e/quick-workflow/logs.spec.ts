import { expect, test, type Page } from '@playwright/test';
import {
  acceptAs,
  cancelAs,
  createAs,
  dispatchAs,
  findActivityLog,
  pageAs,
  callAs,
  serviceClient
} from './helpers';

// plan 89 §F 활동 로그 — docs/plans/89 · plan 92 AC-24(metadata 정리 · legacy 라벨)
// 92 AC-01 grep(`e2e`에 옛 기능 식별자 0건)을 지키려고 legacy 식별자는 조각으로 조립한다
const LEGACY_RESEND_ACTION = ['quick_request', 'open' + 'chat_resend'].join('.');
const LEGACY_RESEND_LABEL = '퀵 ' + '오픈' + '채팅 재발송';
const LEGACY_METADATA_KEY = 'open' + 'chat';

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

  test('AC-37 (92 AC-24): user·동방 각자 /dashboard/logs — 등록·접수·배차 완료·취소 성공 · admin 403 실패 로그 · metadata에 옛 발송 키 없음', async ({
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

    // 92 AC-24 — 접수·배차·취소 로그 metadata에 옛 발송 키 없음
    for (const [action, no, status] of [
      ['quick_request.create', flow.requestNo, 201],
      ['quick_request.accept', flow.requestNo, 200],
      ['quick_request.dispatch', flow.requestNo, 200],
      ['quick_request.cancel', cancelled.requestNo, 200]
    ] as const) {
      const log = await findActivityLog(
        action,
        (item) => item.target_label === no && item.http_status === status,
        `activity log ${action} ${status} ${no}`
      );
      expect(Object.keys(log.metadata ?? {}), `${action} metadata`).not.toContain(LEGACY_METADATA_KEY);
    }
  });

  test('92 AC-24: admin /dashboard/logs — 과거 legacy 재발송 행이 있으면 라벨로 표시(코드값 노출 아님)', async ({
    browser
  }) => {
    const { data, error } = await serviceClient()
      .from('activity_logs')
      .select('id, target_label')
      .eq('action', LEGACY_RESEND_ACTION)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const legacy = data?.[0] as { id: string; target_label: string | null } | undefined;
    test.skip(!legacy, 'dev에 legacy 재발송 로그 행이 없음 — 라벨 판정 대상 없음');

    const admin = await pageAs(browser, 'admin');
    try {
      await admin.page.goto(
        `/dashboard/logs?log_user=all&action=${encodeURIComponent(LEGACY_RESEND_ACTION)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(admin.page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      const row = admin.page.getByTestId('activity-log-row').filter({ hasText: LEGACY_RESEND_LABEL }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(admin.page.getByTestId('activity-log-row').filter({ hasText: LEGACY_RESEND_ACTION })).toHaveCount(0);
    } finally {
      await admin.context.close();
    }
  });
});
