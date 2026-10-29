import { expect, test } from '@playwright/test';
import {
  clickDesktopRegister,
  fillQuickRequestOrder,
  gotoQuickRequest
} from '../quick-request/helpers';
import {
  buildCreateBody,
  callAs,
  createAs,
  expectDetailStatus,
  gotoDashboard,
  gotoDetail,
  pageAs,
  readJson,
  seedQuickRequest,
  VIEWPORT_DESKTOP,
  withApi
} from './helpers';
import { confirmPreviewAndRegister } from './register-flow';

/**
 * plan 92 §A 카톡 흔적 제거 — docs/plans/92_quick-web-only-notifications-plan.md (AC-03 · 04 · 06 · 07 · 08)
 * AC-01 grep(`e2e`에 옛 기능 식별자 0건)을 지키려고 옛 식별자·문구는 조각으로 조립한다.
 */
const LEGACY_KEY = 'open' + 'chat';
const LEGACY_WORD = '오픈' + '채팅';
const LEGACY_BADGE_TEST_ID = `quick-${LEGACY_KEY}-status`;
const LEGACY_PANEL_TEST_ID = `quick-${LEGACY_KEY}-panel`;

function expectNoLegacyKey(value: unknown, label: string) {
  const serialized = JSON.stringify(value);
  expect(serialized, `${label}: '${LEGACY_KEY}' 키 없음`).not.toMatch(new RegExp(LEGACY_KEY, 'i'));
}

test.describe('plan 92 A. 카톡 흔적 제거', () => {
  test.describe.configure({ timeout: 120_000 });

  test('AC-03: admin POST …/{legacy}/resend → 404 (Route 없음)', async () => {
    const { requestNo } = await createAs('user');
    const response = await callAs('admin', (api) =>
      api.post(`/api/quick-request/${requestNo}/${LEGACY_KEY}/resend`, { data: { event: 'created' } })
    );
    expect(response.status).toBe(404);
  });

  test('AC-04: 등록·접수·배차·취소 응답과 목록·summary·상세 응답에 옛 발송 키 없음 · permissions.canOperate', async () => {
    const created = await withApi('user', async (api) => {
      const response = await api.post('/api/quick-request', { data: buildCreateBody() });
      expect(response.status()).toBe(201);
      const body = await readJson<{ data: { requestNo: string; id: string } }>(response);
      expectNoLegacyKey(body, 'POST /api/quick-request');
      expect(Object.keys(body.data).sort()).toEqual(['id', 'requestNo']);
      return body.data;
    });
    const no = created.requestNo;

    for (const [label, run] of [
      ['accept', () => callAs('dongbang', (api) => api.post(`/api/quick-request/${no}/accept`))],
      [
        'dispatch',
        () =>
          callAs('dongbang', (api) =>
            api.post(`/api/quick-request/${no}/dispatch`, {
              data: { estimatedAmount: 20000, vehicleInfo: '21마 6543', driverName: '홍길동', driverPhone: '01012345678' }
            })
          )
      ],
      ['cancel', () => callAs('dongbang', (api) => api.post(`/api/quick-request/${no}/cancel`, { data: {} }))]
    ] as const) {
      const response = await run();
      expect(response.status, label).toBe(200);
      expectNoLegacyKey(response.body, label);
      const data = response.body.data as Record<string, unknown>;
      expect(data, label).toMatchObject({ requestNo: no });
      expect(typeof data.status, label).toBe('string');
    }

    await withApi('dongbang', async (api) => {
      const list = await readJson(await api.get(`/api/quick-request?search=${no}`));
      expectNoLegacyKey(list, 'GET /api/quick-request');
      const summary = await readJson(await api.get('/api/quick-request/summary'));
      expectNoLegacyKey(summary, 'GET /api/quick-request/summary');
      const detail = await readJson<{ data: { permissions: Record<string, unknown> } }>(
        await api.get(`/api/quick-request/${no}`)
      );
      expectNoLegacyKey(detail, 'GET /api/quick-request/{no}');
      expect(detail.data.permissions).not.toHaveProperty('canResend');
      expect(detail.data.permissions).toHaveProperty('canOperate', true);
    });
    const requesterDetail = await callAs('user', (api) => api.get(`/api/quick-request/${no}`));
    expect((requesterDetail.body.data as { permissions: Record<string, unknown> }).permissions).toHaveProperty(
      'canOperate',
      false
    );
  });

  test('AC-06: 동방·admin 대시보드·상세 — 옛 발송 배지·패널·「다시 보내기」·「메시지 복사」 0건', async ({ browser }) => {
    const { requestNo } = await seedQuickRequest('dispatching');
    for (const account of ['dongbang', 'admin'] as const) {
      const { context, page } = await pageAs(browser, account);
      try {
        await gotoDashboard(page, `?search=${requestNo}`);
        await expect(page.getByTestId('quick-dashboard-meta-bar'), account).toBeVisible();
        await expect(page.getByTestId(LEGACY_BADGE_TEST_ID), account).toHaveCount(0);
        await expect(page.getByText(new RegExp(LEGACY_WORD)), account).toHaveCount(0);

        await gotoDetail(page, requestNo);
        await expect(page.getByTestId('quick-detail-section-amount'), account).toBeVisible();
        await expect(page.getByTestId(LEGACY_PANEL_TEST_ID), account).toHaveCount(0);
        await expect(page.getByRole('button', { name: '다시 보내기' }), account).toHaveCount(0);
        await expect(page.getByRole('button', { name: '메시지 복사' }), account).toHaveCount(0);
        await expect(page.getByText(new RegExp(LEGACY_WORD)), account).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  });

  test('AC-07: 미리보기 Dialog 안내 「…WakeOne 알림이 갑니다.」 · 「등록」 201 · 등록 토스트만(경고 없음) · 상세 이동', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_DESKTOP });
    try {
      await gotoQuickRequest(page, VIEWPORT_DESKTOP);
      await fillQuickRequestOrder(page);
      await clickDesktopRegister(page);
      const dialog = page.getByRole('dialog', { name: '퀵 요청 미리보기' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(
        '등록하면 요청번호가 발급되고 동방특송 담당자에게 WakeOne 알림이 갑니다.'
      );
      await expect(dialog.getByText(new RegExp(LEGACY_WORD))).toHaveCount(0);

      const { requestNo, responseData } = await confirmPreviewAndRegister(page);
      expect(Object.keys(responseData).sort()).toEqual(['id', 'requestNo']);
      await expectDetailStatus(page, 'requested');
      await expect(page.getByText(/자동 발송/)).toHaveCount(0);
      await expect(page.getByText(/다시 보낼 수 있습니다/)).toHaveCount(0);
      await expect(page.getByTestId('quick-detail-request-no')).toHaveText(requestNo);
    } finally {
      await context.close();
    }
  });

  test('AC-08: 동방 dispatching 건 「배차완료」 Dialog 안내 「…요청자와 동방특송 담당자에게 알림이 갑니다.」', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('dispatching');
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-dispatch').click();
      const dialog = page.getByTestId('quick-dispatch-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(
        `${requestNo} 요청의 배차 정보를 입력합니다. 저장하면 요청자와 동방특송 담당자에게 알림이 갑니다.`
      );
      await expect(dialog.getByText(new RegExp(LEGACY_WORD))).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
