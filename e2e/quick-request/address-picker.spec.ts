import { expect, test } from '@playwright/test';
import { createActiveTestUser, signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import {
  clickDesktopRegister,
  confirmPreviewAndRegister,
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
    // plan 89 D-12 — 최근 주소는 등록 Route가 서버에서 기록한다 (FE POST 없음) → 등록 후 요청 화면 재진입
    await confirmPreviewAndRegister(page);
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);

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

  test('AC-21: 최근 주소 0건 사용자(일회용) · GET 빈 배열(page.route) → 「최근 이용 내역이 없습니다.」', async ({
    browser
  }) => {
    // plan 89 — 등록 후 화면 reset 흐름이 없어졌으므로, 최근 주소가 없는 일회용 계정으로 빈 상태를 확인한다
    const fresh = await createActiveTestUser('quick-p87-ac21', { fullName: `E2E 최근주소없음 ${Date.now()}` });
    const { storageState } = await signInWithSupabasePassword(fresh.email, fresh.password);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    try {
      await page.route('**/api/quick-request/recent-addresses', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { addresses: [] } })
          });
          return;
        }
        await route.continue();
      });

      await gotoQuickRequest(page, VIEWPORT_DESKTOP);
      const dialog = await openAddressPicker(page);
      await dialog.getByRole('tab', { name: '최근 이용 내역' }).click();
      await expect(dialog.getByText('최근 이용 내역이 없습니다.', { exact: true })).toBeVisible({
        timeout: 15_000
      });
      await expect(dialog.getByTestId('quick-request-recent-address-0')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
