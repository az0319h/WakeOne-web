import { expect, test, type Page } from '@playwright/test';
import {
  acceptAs,
  createAs,
  gotoDashboard,
  gotoDetail,
  pageAs,
  seedQuickRequest,
  STATUS_LABEL,
  uniqueTag
} from './helpers';

/**
 * plan 92 §C 실시간 갱신 — docs/plans/92_quick-web-only-notifications-plan.md (AC-19~21)
 * 화면 A를 열어 둔 채 다른 계정이 API로 바꾸면 새로고침 없이(5초 안에) 반영되는지, 권한 밖 건은 안 오는지(RLS) 판정한다.
 */

const REALTIME_TIMEOUT_MS = 5_000;
/** 구독(setAuth → subscribe)이 자리 잡을 시간 */
const SUBSCRIBE_SETTLE_MS = 2_000;

async function markNoReload(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __e2eRealtimeMarker: number }).__e2eRealtimeMarker = Date.now();
  });
}

async function expectNoReload(page: Page) {
  const marker = await page.evaluate(
    () => (window as unknown as { __e2eRealtimeMarker?: number }).__e2eRealtimeMarker ?? null
  );
  expect(marker, '페이지가 새로고침되지 않았다(window 마커 유지)').not.toBeNull();
}

test.describe('plan 92 C. 퀵 대시보드 · 상세 실시간 갱신', () => {
  test.describe.configure({ timeout: 120_000 });

  test('AC-19: admin이 /dashboard/quick을 열어 둔 채 user가 API 등록 → 5초 안에 새 행 · 「신규요청」 +1 · 새로고침 없음', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await gotoDashboard(page);
      const requestedCount = page.getByTestId('quick-dashboard-card-requested-count');
      await expect(requestedCount).toHaveText(/^\d+$/, { timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-table')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      const before = Number(await requestedCount.innerText());
      await markNoReload(page);

      const { requestNo } = await createAs('user', uniqueTag('E2E92RT'));
      await expect(page.getByTestId(`quick-row-detail-${requestNo}`)).toBeVisible({
        timeout: REALTIME_TIMEOUT_MS
      });
      await expect(requestedCount).toHaveText(String(before + 1), { timeout: REALTIME_TIMEOUT_MS });
      await expectNoReload(page);
    } finally {
      await context.close();
    }
  });

  test('AC-20: user가 본인 requested 상세를 열어 둔 채 동방이 API 접수 → 5초 안에 「접수 및 배차중」 · Stepper 2단계 · 「요청 취소」 사라짐', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('requested');
    const { context, page } = await pageAs(browser, 'user');
    try {
      await gotoDetail(page, requestNo);
      await expect(page.getByTestId('quick-detail-status')).toHaveText(STATUS_LABEL.requested);
      await expect(page.getByTestId('quick-detail-cancel')).toBeVisible();
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await markNoReload(page);

      await acceptAs('dongbang', requestNo);
      await expect(page.getByTestId('quick-detail-status')).toHaveText(STATUS_LABEL.dispatching, {
        timeout: REALTIME_TIMEOUT_MS
      });
      await expect(page.getByTestId('quick-detail-step-dispatching')).toHaveAttribute('data-state', 'current');
      await expect(page.getByTestId('quick-detail-step-requested')).toHaveAttribute('data-state', 'complete');
      await expect(page.getByTestId('quick-detail-cancel')).toHaveCount(0);
      await expectNoReload(page);
    } finally {
      await context.close();
    }
  });

  test('AC-21: user2가 「나의 퀵 내역」을 열어 둔 채 user가 등록 → 8초 기다려도 그 번호 0건(RLS)', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'user2');
    try {
      await gotoDashboard(page);
      await expect(page.getByRole('heading', { name: '나의 퀵 내역', exact: true }).first()).toBeVisible();
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await markNoReload(page);

      const { requestNo } = await createAs('user', uniqueTag('E2E92RLS'));
      await page.waitForTimeout(8_000);
      await expect(page.getByTestId(`quick-row-detail-${requestNo}`)).toHaveCount(0);
      await expect(page.getByTestId(`quick-card-${requestNo}`)).toHaveCount(0);
      await expect(page.getByText(requestNo, { exact: true })).toHaveCount(0);
      await expectNoReload(page);
    } finally {
      await context.close();
    }
  });
});
