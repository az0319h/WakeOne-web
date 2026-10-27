import { expect, test } from '@playwright/test';
import {
  addressPickerDialog,
  clickDesktopRegister,
  clickMobileRegister,
  fillLocationByPrefix,
  fillQuickRequestOrder,
  gotoQuickRequest,
  openAddressPicker
} from '../quick-request/helpers';
import { expectDetailStatus, uniqueTag, VIEWPORT_DESKTOP, VIEWPORT_MOBILE } from './helpers';
import { confirmPreviewAndRegister, readClipboard, writeClipboardSentinel } from './register-flow';

// plan 89 §B 등록·번호 (UI) — docs/plans/89 · plan 92가 발송 판정(옛 AC-12·14)을 제거했다
test.describe('plan 89 B. 퀵 요청 등록 (UI)', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
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
