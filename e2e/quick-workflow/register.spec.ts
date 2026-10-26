import { expect, test } from '@playwright/test';
import { openchatRequestsFor, setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  addressPickerDialog,
  clickDesktopRegister,
  clickMobileRegister,
  fillLocationByPrefix,
  fillQuickRequestOrder,
  gotoQuickRequest,
  openAddressPicker
} from '../quick-request/helpers';
import {
  dbDispatch,
  expectDetailStatus,
  expectLogFor,
  gotoDetail,
  MSG,
  pageAs,
  toast,
  uniqueTag,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE
} from './helpers';
import { confirmPreviewAndRegister, readClipboard, writeClipboardSentinel } from './register-flow';

// plan 89 §B 등록·번호·발송 (UI) — docs/plans/89_quick-workflow-dongbang-openchat-plan.md
test.describe('plan 89 B. 퀵 요청 등록 (UI)', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
  });

  test.beforeEach(async () => {
    await setOpenchatMockMode('ok');
  });

  test('AC-08: 데스크톱 등록 → 「등록」 → 201 · 토스트 · /dashboard/quick/{번호} · 「신규요청」 · 자동 복사 없음', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const sentinel = `sentinel-${Date.now()}`;
    await writeClipboardSentinel(page, sentinel);
    await fillQuickRequestOrder(page);
    await clickDesktopRegister(page);
    const { requestNo } = await confirmPreviewAndRegister(page);

    await expectDetailStatus(page, 'requested');
    await expect(page.getByTestId('quick-detail-request-no')).toHaveText(requestNo);
    expect(await readClipboard(page)).toBe(sentinel);
  });

  test('AC-09: 375 모바일 하단바 등록 → 확인 → AC-08과 같은 결과', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    const sentinel = `sentinel-m-${Date.now()}`;
    await writeClipboardSentinel(page, sentinel);
    await fillQuickRequestOrder(page);
    await clickMobileRegister(page);
    const { requestNo } = await confirmPreviewAndRegister(page);

    await expectDetailStatus(page, 'requested');
    await expect(page.getByTestId('quick-detail-request-no')).toHaveText(requestNo);
    expect(await readClipboard(page)).toBe(sentinel);
  });

  test('AC-12 · AC-14: mock 500 → 등록 201 · 경고 토스트 · failed(2회) → 동방 「다시 보내기」 발송됨 · 같은 Idempotency-Key · resend 로그 · 메시지 복사', async ({
    page,
    browser
  }) => {
    await setOpenchatMockMode('status:500');
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page);
    await clickDesktopRegister(page);
    const { requestNo, id, openchat } = await confirmPreviewAndRegister(page);
    expect(openchat.status).toBe('failed');
    await expect(toast(page, MSG.openchatFailedWarning)).toBeVisible({ timeout: 15_000 });

    const firstAttempts = await openchatRequestsFor(requestNo, 'created');
    expect(firstAttempts).toHaveLength(2);
    const failed = await dbDispatch(requestNo, 'created');
    expect(failed?.status).toBe('failed');
    expect(failed?.attempt_count).toBe(2);

    // AC-14 — 동방특송 상세 「오픈채팅 발송」 패널
    await setOpenchatMockMode('ok');
    const vendor = await pageAs(browser, 'dongbang', { clipboard: true });
    try {
      await gotoDetail(vendor.page, requestNo);
      const panel = vendor.page.getByTestId('quick-openchat-panel');
      await expect(panel).toBeVisible();
      const statusBadge = panel.getByTestId('quick-openchat-created-status');
      await expect(statusBadge).toHaveText('실패');

      const resendPromise = vendor.page.waitForResponse(
        (res) => res.url().includes('/openchat/resend') && res.request().method() === 'POST'
      );
      await panel.getByTestId('quick-openchat-created-resend').click();
      const resendResponse = await resendPromise;
      expect(resendResponse.status()).toBe(200);
      await expect(statusBadge).toHaveText('발송됨', { timeout: 15_000 });
      await expect(panel.getByTestId('quick-openchat-created-resend')).toHaveCount(0);

      const sent = await dbDispatch(requestNo, 'created');
      expect(sent?.status).toBe('sent');
      expect(sent?.attempt_count).toBe(3);
      const allAttempts = await openchatRequestsFor(requestNo, 'created');
      expect(allAttempts).toHaveLength(3);
      const keys = new Set(allAttempts.map((entry) => entry.headers['idempotency-key']));
      expect([...keys]).toEqual([`${id}:created`]);

      await expectLogFor('quick_request.openchat_resend', requestNo, 200);

      await panel.getByTestId('quick-openchat-created-copy').click();
      await expect(toast(vendor.page, '메시지가 복사되었습니다.')).toBeVisible({ timeout: 10_000 });
      const copied = await vendor.page.evaluate(() => navigator.clipboard.readText());
      expect(copied.split('\n')[0]).toBe(`❗ 퀵요청 - ${requestNo}`);
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-15: 등록 성공 → 주소 모달 「최근 이용 내역」 맨 위 · FE recent-addresses POST 0건', async ({
    page
  }) => {
    const recentPosts: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/quick-request/recent-addresses') && req.method() === 'POST') {
        recentPosts.push(req.url());
      }
    });
    const tag = uniqueTag('E2E89R');
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page);
    await fillLocationByPrefix(page, 'quick-request-origin', {
      road: '서울 중구 세종대로 110',
      detail: `${tag} 출발`,
      name: 'E2E 출발',
      phone: '01011112222'
    });
    await fillLocationByPrefix(page, 'quick-request-destination', {
      road: '경기 성남시 분당구 판교역로 166',
      detail: `${tag} 도착`,
      name: 'E2E 도착',
      phone: '01033334444'
    });
    await clickDesktopRegister(page);
    await confirmPreviewAndRegister(page);

    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openAddressPicker(page);
    await dialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    const top = dialog.getByTestId('quick-request-recent-address-0');
    await expect(top).toContainText(tag, { timeout: 15_000 });
    await expect(addressPickerDialog(page)).toBeVisible();
    expect(recentPosts, 'FE POST /api/quick-request/recent-addresses').toEqual([]);
  });
});
