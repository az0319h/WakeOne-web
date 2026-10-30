import { expect, test } from '@playwright/test';
import {
  applyThemeBeforeNavigation,
  clickMobileRegister,
  confirmPreviewAndRegister,
  expectNoHorizontalScroll,
  expectNoInnerHorizontalOverflow,
  expectThemeApplied,
  fillQuickRequestOrder,
  gotoQuickRequest,
  noteChip,
  previewCard,
  resetNotesToSeed,
  SEED_NOTE_LABEL,
  quickRequestMain,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE,
  VIEWPORT_TABLET,
  vehicleCard
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

// plan 86 — docs/plans/86_quick-request-kakao-redesign-plan.md (반응형 375 / 768 / 1280)
const MIN_TOUCH_TARGET = 44;

test.describe('퀵 배송 요청 반응형 · 가로 스크롤 0 (plan 86 AC-14)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  const viewports = [
    { label: '375', size: VIEWPORT_MOBILE },
    { label: '768', size: VIEWPORT_TABLET },
    { label: '1280', size: VIEWPORT_DESKTOP }
  ];

  for (const { label, size } of viewports) {
    test(`AC-14: vercel · ${label}px scrollWidth <= clientWidth`, async ({ page, baseURL }) => {
      await applyThemeBeforeNavigation(page, baseURL!, 'vercel', 'light');
      await gotoQuickRequest(page, size);
      await expectThemeApplied(page, 'vercel', 'light');
      await expectNoHorizontalScroll(page);
      await expectNoInnerHorizontalOverflow(page);
      if (size.width < 1024) {
        // plan 106 D-10 ① — lg 미만은 안쪽 상자가 아니라 페이지 전체가 스크롤된다
        const metrics = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight
        }));
        expect(metrics.scrollHeight, '페이지 스크롤').toBeGreaterThan(metrics.innerHeight);
      }
    });
  }

  test('AC-14: vercel · 375px Drawer 열림 상태 scrollWidth <= clientWidth', async ({
    page,
    baseURL
  }) => {
    await applyThemeBeforeNavigation(page, baseURL!, 'vercel', 'light');
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    await quickRequestMain(page).getByTestId('quick-request-mobile-summary-trigger').click();
    await expect(page.getByTestId('quick-request-summary-drawer')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  // 테마별 폰트·offset shadow·radius 차이 — 375에서 추가 확인
  for (const theme of ['neobrutualism', 'notebook', 'mono']) {
    test(`AC-14: ${theme} · 375px scrollWidth <= clientWidth`, async ({ page, baseURL }) => {
      await applyThemeBeforeNavigation(page, baseURL!, theme, 'light');
      await gotoQuickRequest(page, VIEWPORT_MOBILE);
      await expectThemeApplied(page, theme, 'light');
      await expectNoHorizontalScroll(page);
      await expectNoInnerHorizontalOverflow(page);
    });
  }
});

test.describe('퀵 배송 요청 모바일 375 (plan 86 AC-15~18 · plan 106 판정: 페이지 스크롤·주소 readonly·요약바 한 줄)', () => {
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  test.describe.configure({ timeout: 90_000 });

  test('AC-15: 모바일 바 노출 · 데스크톱 요약 미노출 · Drawer 열림 · 입력값 반영', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    const main = quickRequestMain(page);
    await expect(main.getByTestId('quick-request-mobile-bar')).toBeVisible();
    await expect(main.getByTestId('quick-request-summary')).toBeHidden();
    await expect(main.getByTestId('quick-request-register-button')).toBeHidden();

    await fillQuickRequestOrder(page, {
      // plan 87 r1 — 물품 내용은 「기타」일 때만 입력·요약 노출
      goodsSize: 'other',
      item: 'E2E 모바일 물품',
      vehicles: ['다마스'],
      count: { preset: 2 }
    });

    // plan 106 D-10 ⑦ — 하단 요약바 글자는 한 줄(말줄임) · 바 높이 ≤ 76
    const barBox = await main.getByTestId('quick-request-mobile-bar').boundingBox();
    expect(barBox!.height, '요약바 높이').toBeLessThanOrEqual(76);
    const summaryParts = await main
      .getByTestId('quick-request-mobile-summary-text')
      .evaluate((el) => Array.from(el.children).map((child) => child.getClientRects().length));
    expect(summaryParts.every((count) => count === 1), `요약 조각 한 줄 ${summaryParts.join(',')}`).toBe(true);

    await main.getByTestId('quick-request-mobile-summary-trigger').click();
    const drawer = page.getByTestId('quick-request-summary-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('서울 중구 세종대로 110');
    await expect(drawer).toContainText('경기 성남시 분당구 판교역로 166');
    await expect(drawer).toContainText('다마스');
    await expect(drawer).toContainText('2대');
    await expect(drawer).toContainText('E2E 모바일 물품');
    await expect(drawer.getByRole('button', { name: '퀵 요청 등록하기' })).toBeVisible();

    await drawer.getByRole('button', { name: '닫기' }).click();
    await expect(drawer).toBeHidden();
  });

  // plan 89 AC-09가 86 AC-16(501·복사·reset)을 대체
  test('AC-16: (89 AC-09 대체) 모바일 등록 → 「등록」 → 201 · 상세 이동', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    await fillQuickRequestOrder(page);
    await clickMobileRegister(page);
    await confirmPreviewAndRegister(page);
    await expect(page.getByTestId('quick-detail-status')).toHaveText('신규요청');
    await expectNoHorizontalScroll(page);
  });

  // plan 87 r1 — 물품 내용 필수는 「기타」 선택 시에만
  test('AC-17: 모바일 기타 + 물품 비움 → 에러 · Dialog 미오픈 · 에러 필드 toBeInViewport', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: '' });
    const main = quickRequestMain(page);
    const itemField = main.getByTestId('quick-request-item-description');
    // 물품 필드는 화면 밖에서 시작 — plan 106 D-10 ① 페이지 스크롤이라 결제 칸과 물품 칸이 한 화면에 함께 보일 수 있다 → 맨 위로
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(itemField).not.toBeInViewport();

    await clickMobileRegister(page);
    await expect(main.getByText('물품 내용을 입력해 주세요.')).toBeVisible();
    await expect(previewCard(page)).toHaveCount(0);
    await expect(itemField).toBeInViewport();
  });

  test('AC-18: 375 주요 컨트롤 높이 >= 44px', async ({ page }) => {
    // plan 87 supersede — 측정 대상 칩: seed 「동승 필요」 (group + role)
    await resetNotesToSeed(page.request);
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    const main = quickRequestMain(page);
    const targets = [
      { name: 'vehicle-card(오토바이)', locator: vehicleCard(page, '오토바이') },
      { name: 'vehicle-count-1', locator: main.getByTestId('quick-request-vehicle-count-1') },
      {
        name: 'origin-note chip(동승 필요)',
        locator: noteChip(page, 'origin', SEED_NOTE_LABEL)
      },
      { name: 'note-add', locator: main.getByTestId('quick-request-note-add') },
      { name: 'goods-size-s', locator: main.getByTestId('quick-request-goods-size-s') },
      { name: 'add-stopover', locator: main.getByTestId('quick-request-add-stopover') },
      {
        name: 'origin-address-search',
        locator: main.getByTestId('quick-request-origin-address-search')
      },
      { name: 'freight-collect', locator: main.getByTestId('quick-request-freight-collect') },
      {
        name: 'mobile-register-button',
        locator: main.getByTestId('quick-request-mobile-register-button')
      }
    ];
    for (const { name, locator } of targets) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      expect(box, `${name} boundingBox`).not.toBeNull();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
    // plan 106 D-10 ② — 375 주소 칸은 readonly(탭 = 주소 검색) · 칸 안 돋보기 아이콘 버튼 44×44 · 접근 이름 「주소 검색」
    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveAttribute('readonly', '');
    const search = main.getByTestId('quick-request-origin-address-search');
    await expect(search).toHaveAccessibleName('주소 검색');
    const searchBox = await search.boundingBox();
    expect(searchBox!.width, 'address-search width').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});
