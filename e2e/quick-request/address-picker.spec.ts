import { expect, test } from '@playwright/test';
import {
  clickDesktopRegister,
  confirmPreviewAndExpect501,
  expectNoHorizontalScroll,
  fillLocationByPrefix,
  fillQuickRequestOrder,
  gotoQuickRequest,
  openAddressPicker,
  quickRequestMain,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE
} from './helpers';

// plan 87 — docs/plans/87_quick-request-goods-notes-address-picker-plan.md (주소 검색 Dialog · 최근 이용 내역 · AC-15~17·21)
const MIN_TOUCH_TARGET = 44;

const RECENT_ORIGIN = {
  road: '서울 중구 세종대로 110',
  detail: '1층',
  name: 'E2E 출발',
  phone: '01011112222'
};

test.describe('퀵 요청 주소 검색 Dialog (plan 87)', () => {
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  test.describe.configure({ timeout: 90_000 });

  test('AC-15: 1280 — 주소 검색 dialog · tab 2개 · postcode 컨테이너 · popup 0건', async ({
    page
  }) => {
    let popupCount = 0;
    page.on('popup', () => {
      popupCount += 1;
    });
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openAddressPicker(page);

    await expect(dialog.getByRole('tab', { name: '주소 검색' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: '최근 이용 내역' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: '주소 검색' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(dialog.getByTestId('quick-request-address-picker-postcode')).toBeVisible();
    // Daum embed 스크립트 로드·렌더 여유
    await page.waitForTimeout(1_500);
    expect(popupCount).toBe(0);
  });

  test('AC-16: 375 — dialog 전체폭 · 높이 >= 90% · 가로 스크롤 0 · 닫기 >= 44px', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    const dialog = await openAddressPicker(page);
    await expect(dialog.getByTestId('quick-request-address-picker-postcode')).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box, 'dialog boundingBox').not.toBeNull();
    expect(Math.round(box!.width)).toBe(VIEWPORT_MOBILE.width);
    expect(box!.height).toBeGreaterThanOrEqual(VIEWPORT_MOBILE.height * 0.9);
    await expectNoHorizontalScroll(page);

    const close = dialog.getByRole('button', { name: '닫기' });
    const closeBox = await close.boundingBox();
    expect(closeBox, 'close boundingBox').not.toBeNull();
    expect(closeBox!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    await close.click();
    await expect(dialog).toBeHidden();
  });

  test('AC-17: 확인(501) 후 최근 이용 내역 행 클릭 → 출발 4칸 자동 채움 · dialog 닫힘', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page);
    await fillLocationByPrefix(page, 'quick-request-origin', RECENT_ORIGIN);
    await clickDesktopRegister(page);
    const recentPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/quick-request/recent-addresses') &&
        res.request().method() === 'POST'
    );
    await confirmPreviewAndExpect501(page);
    expect((await recentPromise).status()).toBe(200);

    const main = quickRequestMain(page);
    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveValue('');

    const dialog = await openAddressPicker(page);
    await dialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    const row = dialog.getByTestId('quick-request-recent-address-0');
    await expect(row).toContainText(RECENT_ORIGIN.road);
    await expect(row).toContainText(RECENT_ORIGIN.detail);
    await expect(row).toContainText(RECENT_ORIGIN.name);
    await row.click();
    await expect(dialog).toBeHidden();

    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveValue(
      RECENT_ORIGIN.road
    );
    await expect(main.getByTestId('quick-request-origin-detail-address')).toHaveValue(
      RECENT_ORIGIN.detail
    );
    await expect(main.getByTestId('quick-request-origin-contact-name')).toHaveValue(
      RECENT_ORIGIN.name
    );
    const phone = await main.getByTestId('quick-request-origin-contact-phone').inputValue();
    expect(phone.replace(/\D/g, '')).toBe(RECENT_ORIGIN.phone);
  });

  test('AC-21: GET recent-addresses 빈 배열(page.route) → 「최근 이용 내역이 없습니다.」', async ({
    page
  }) => {
    // 최근 주소는 서버 prefetch(HydrationBoundary)로 시작하므로, 클라이언트 재조회가 일어나도록
    // 확인 흐름(recent POST onSettled invalidate)을 거친다. GET·POST 모두 mock → DB 기록 없음.
    await page.route('**/api/quick-request/recent-addresses', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { addresses: [] } })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { count: 2 } })
      });
    });

    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page);
    await clickDesktopRegister(page);
    await confirmPreviewAndExpect501(page);

    const dialog = await openAddressPicker(page);
    await dialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    await expect(dialog.getByText('최근 이용 내역이 없습니다.', { exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(dialog.getByTestId('quick-request-recent-address-0')).toHaveCount(0);
  });
});
