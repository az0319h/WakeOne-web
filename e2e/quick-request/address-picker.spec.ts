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

  // plan 99 — 장소 검색 키(또는 E2E_KAKAO_PLACES_MOCK)가 설정된 서버면 「장소 검색」 탭이 더해져 3개다.
  // 탭 개수·순서는 e2e/quick-round2/99-place-search*.spec.ts(AC-01 · AC-10)가 판정하고, 여기서는 87 탭 2개의 존재만 본다.
  test('AC-15: 1280 — 주소 검색 dialog · 「주소 검색」「최근 이용 내역」 tab · postcode 컨테이너 · popup 0건', async ({
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

  test('AC-17: 등록 후 출발 칸 최근 이용 내역(origin) 행 클릭 → 출발 4칸 자동 채움 · dialog 닫힘 (97 D-8)', async ({
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
      // plan 97 — `?direction=origin|destination` · `{addresses, nextCursor}`
      await page.route('**/api/quick-request/recent-addresses?*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { addresses: [], nextCursor: null } })
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
      // plan 97 U-5 · designer K5 — 출발 칸 빈 상태 보조문장
      await expect(dialog.getByText('출발지로 등록한 주소가 여기에 저장됩니다.', { exact: true })).toBeVisible();
      await expect(dialog.getByTestId('quick-request-recent-address-hint')).toHaveText('출발지에서 쓴 주소');
      await expect(dialog.getByTestId('quick-request-recent-address-0')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
