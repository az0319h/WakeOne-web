import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  gotoQuickRequest,
  openAddressPicker,
  quickRequestMain,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE
} from '../quick-request/helpers';
import {
  expectPlacesMockServer,
  ikseonDocs,
  isUnconfiguredRun,
  lastCategory,
  PLACE_TEXT,
  placeInput,
  placeRow,
  openPlaceTab,
  searchPlace,
  trackPlaceRequests
} from './99-helpers';

/**
 * plan 99 — 퀵 주소 「장소 검색」 탭 UI (AC-01 ~ AC-07 · AC-12 + D-3 보조)
 * docs/plans/99_quick-place-keyword-search-plan.md
 * - 서버: `E2E_KAKAO_PLACES_MOCK=1` (fixture `e2e/fixtures/kakao-places.json`)
 * - 계정: user.json (출발 담당자·연락처 = 프로필 기본값)
 * - 퀵 요청을 등록하지 않는다(폼 채움만) → DB 목 데이터 없음
 */
const MIN_TOUCH_TARGET = 44;

test.describe('plan 99 A. 「장소 검색」 탭 (mock)', () => {
  test.skip(isUnconfiguredRun(), '미설정 서버 run에서는 99-place-search-unconfigured.spec.ts만 판정');
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async () => {
    await expectPlacesMockServer();
  });

  test('AC-01: 1280 — 출발 「주소 검색」 → Dialog tab 3개 순서 「주소 검색」「장소 검색」「최근 이용 내역」 · 기본 「주소 검색」 · popup 0', async ({
    page
  }) => {
    let popupCount = 0;
    page.on('popup', () => {
      popupCount += 1;
    });
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openAddressPicker(page, 'quick-request-origin');

    await expect(dialog.getByRole('tab')).toHaveText([...PLACE_TEXT.tabs]);
    await expect(dialog.getByRole('tab', { name: '주소 검색', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('tab', { name: PLACE_TEXT.tab, exact: true })).toHaveAttribute('aria-selected', 'false');
    await expect(dialog.getByTestId('quick-request-address-picker-tab-place')).toHaveText(PLACE_TEXT.tab);
    await expect(dialog.getByTestId('quick-request-address-picker-postcode')).toBeVisible();
    // Daum embed 스크립트 로드·렌더 여유 (87 AC-15와 같은 기준)
    await page.waitForTimeout(1_500);
    expect(popupCount).toBe(0);
  });

  test('AC-02: 「장소 검색」 탭 → 「익」 1자 요청 0 · 「익선」 400ms debounce 후 요청 1회 · 결과 2행 장소명(굵게)·도로명·전화', async ({
    page
  }) => {
    const [road, jibun] = ikseonDocs();
    const requests = trackPlaceRequests(page);
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openPlaceTab(page);
    const input = placeInput(dialog);

    // D-3 — 탭 진입 시 입력 자동 포커스 · placeholder · 보조 문구
    await expect(input).toBeFocused();
    // plan 원문 + 디자인 가이드의 말줄임(…) 허용
    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder?.startsWith(PLACE_TEXT.placeholder), `placeholder ${placeholder}`).toBe(true);
    await expect(dialog.getByTestId('quick-request-place-hint')).toHaveText(PLACE_TEXT.hint);
    await expect(dialog.getByTestId('quick-request-place-idle')).toBeVisible();

    // 1자 → debounce(400ms)를 넉넉히 넘겨도 요청 0
    await input.pressSequentially('익');
    await page.waitForTimeout(1_000);
    expect(requests, '1자 입력 요청 수').toHaveLength(0);
    await expect(dialog.getByTestId('quick-request-place-idle')).toBeVisible();

    // 2자 → 입력이 멈추고 약 400ms 뒤 자동 검색 1회
    const responsePromise = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/quick-request/places');
    await input.pressSequentially('선');
    const typedAt = Date.now();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ q: '익선', page: '1' });
    const delay = requests[0]!.at - typedAt;
    expect(delay, `debounce 지연 ${delay}ms`).toBeGreaterThanOrEqual(300);
    expect(delay, `debounce 지연 ${delay}ms`).toBeLessThan(3_000);

    await expect(placeRow(dialog, 0)).toBeVisible();
    await expect(placeRow(dialog, 1)).toBeVisible();
    await expect(placeRow(dialog, 2)).toHaveCount(0);
    await expect(dialog.getByTestId('quick-request-place-total')).toHaveText('검색 결과 2건');

    // 행 0 — 장소명(굵게) · 카테고리 · 도로명 · 전화
    const name0 = dialog.getByTestId('quick-request-place-0-name');
    await expect(name0).toHaveText(road.place_name);
    const weight = await name0.evaluate((node) => Number(window.getComputedStyle(node).fontWeight));
    expect(weight, '장소명 font-weight').toBeGreaterThanOrEqual(500);
    await expect(dialog.getByTestId('quick-request-place-0-address')).toHaveText(road.road_address_name);
    await expect(placeRow(dialog, 0)).toContainText(road.phone);
    await expect(placeRow(dialog, 0)).toContainText(lastCategory(road.category_name));
    await expect(dialog.getByTestId('quick-request-place-0-jibun')).toHaveCount(0);

    // 행 1 — 도로명 없음 → 지번 + 「지번」 배지 · 전화 없음
    await expect(dialog.getByTestId('quick-request-place-1-name')).toHaveText(jibun.place_name);
    await expect(dialog.getByTestId('quick-request-place-1-address')).toHaveText(jibun.address_name);

    // 결과가 뜬 뒤에도 debounce로 인한 추가 요청 없음
    await page.waitForTimeout(800);
    expect(requests, '「익선」 요청 수').toHaveLength(1);
  });

  test('AC-02 보조(brief 1): 「익선 산스」 0건 → 단어 순서 바꿔 재검색 → 1건 · 「‘산스 익선’(으)로 찾은 결과」', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openPlaceTab(page);
    const response = await searchPlace(page, dialog, '익선 산스');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data: { places: unknown[]; matchedQuery: string | null } };
    expect(body.data.places).toHaveLength(1);
    expect(body.data.matchedQuery).toBe('산스 익선');
    await expect(dialog.getByTestId('quick-request-place-0-name')).toHaveText('산스');
    await expect(dialog.getByTestId('quick-request-place-matched')).toHaveText('‘산스 익선’(으)로 찾은 결과');
  });

  test('AC-03: quick-request-place-0 클릭 → Dialog 닫힘 · 출발 도로명 = road_address_name · 상세주소 = place_name · 담당자·연락처 변경 없음', async ({
    page
  }) => {
    const [road] = ikseonDocs();
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const main = quickRequestMain(page);
    const contactName = main.getByTestId('quick-request-origin-contact-name');
    const contactPhone = main.getByTestId('quick-request-origin-contact-phone');
    await expect(main.getByTestId('quick-request-origin-detail-address')).toHaveValue('');
    const nameBefore = await contactName.inputValue();
    const phoneBefore = await contactPhone.inputValue();
    expect(nameBefore, '출발 담당자 = 프로필 기본값').not.toBe('');

    const dialog = await openPlaceTab(page, 'quick-request-origin');
    await searchPlace(page, dialog, '익선');
    await placeRow(dialog, 0).click();
    await expect(dialog).toBeHidden();

    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveValue(road.road_address_name);
    await expect(main.getByTestId('quick-request-origin-detail-address')).toHaveValue(road.place_name);
    await expect(contactName).toHaveValue(nameBefore);
    await expect(contactPhone).toHaveValue(phoneBefore);
    // 도로명이 있으면 지번 toast 없음
    await expect(page.getByText(PLACE_TEXT.jibunToast, { exact: true })).toHaveCount(0);
  });

  test('AC-04: 출발 상세주소 「3층」 미리 입력 → 장소 선택 → 도로명만 채움 · 상세주소 「3층」 유지', async ({ page }) => {
    const [road] = ikseonDocs();
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const main = quickRequestMain(page);
    const detail = main.getByTestId('quick-request-origin-detail-address');
    await detail.fill('3층');
    await expect(detail).toHaveValue('3층');

    const dialog = await openPlaceTab(page, 'quick-request-origin');
    await searchPlace(page, dialog, '익선');
    await placeRow(dialog, 0).click();
    await expect(dialog).toBeHidden();

    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveValue(road.road_address_name);
    await expect(detail).toHaveValue('3층');
  });

  test('AC-05: 도로명 없는 fixture 행(「지번」 배지) 선택 → 도로명 칸에 지번 주소 · toast 「도로명 주소가 없어 지번 주소를 넣었습니다.」', async ({
    page
  }) => {
    const [, jibun] = ikseonDocs();
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const main = quickRequestMain(page);

    const dialog = await openPlaceTab(page, 'quick-request-destination');
    await searchPlace(page, dialog, '익선');
    const badge = dialog.getByTestId('quick-request-place-1-jibun');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(PLACE_TEXT.jibunBadge);
    await expect(dialog.getByTestId('quick-request-place-1-address')).toHaveText(jibun.address_name);

    await placeRow(dialog, 1).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(PLACE_TEXT.jibunToast, { exact: true })).toBeVisible();
    await expect(main.getByTestId('quick-request-destination-road-address')).toHaveValue(jibun.address_name);
    await expect(main.getByTestId('quick-request-destination-detail-address')).toHaveValue(jibun.place_name);
  });

  test('AC-06: 「없는장소」 → 「검색 결과가 없습니다.」', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openPlaceTab(page);
    const response = await searchPlace(page, dialog, '없는장소');
    expect(response.status()).toBe(200);
    const empty = dialog.getByTestId('quick-request-place-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(PLACE_TEXT.empty);
    await expect(placeRow(dialog, 0)).toHaveCount(0);
  });

  test('AC-07: 「에러」(mock 502) → 인라인 「장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.」 · 「장소 검색」 탭 유지', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openPlaceTab(page);
    const response = await searchPlace(page, dialog, '에러');
    expect(response.status()).toBe(502);
    const error = dialog.getByTestId('quick-request-place-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(PLACE_TEXT.failed);
    await expect(error.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: PLACE_TEXT.tab, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(placeInput(dialog)).toHaveValue('에러');
  });

  test('D-3 보조: 「많은」 → 「더 보기」로 page 3까지(45행) · page 4 요청 없음 · 끝 문구 「결과가 많습니다…」', async ({ page }) => {
    const requests = trackPlaceRequests(page);
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const dialog = await openPlaceTab(page);
    await searchPlace(page, dialog, '많은');
    await expect(placeRow(dialog, 14)).toBeVisible();

    const sentinel = dialog.getByTestId('quick-request-place-sentinel');
    await expect(async () => {
      await sentinel.scrollIntoViewIfNeeded();
      await expect(placeRow(dialog, 44)).toBeAttached({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await sentinel.scrollIntoViewIfNeeded();
    await expect(sentinel).toHaveAttribute('data-state', 'end');
    await expect(sentinel).toContainText(PLACE_TEXT.tooMany);
    await expect(placeRow(dialog, 45)).toHaveCount(0);

    const pages = requests.filter((r) => r.q === '많은').map((r) => r.page);
    expect(pages).toEqual(['1', '2', '3']);
  });

  test('AC-12: 375 — 「장소 검색」 탭 Dialog 전체화면 · 결과 행 높이 >= 44px · 가로 스크롤 없음', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    const dialog = await openPlaceTab(page);
    await searchPlace(page, dialog, '익선');
    await expect(placeRow(dialog, 1)).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box, 'dialog boundingBox').not.toBeNull();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.width)).toBe(VIEWPORT_MOBILE.width);
    expect(box!.height).toBeGreaterThanOrEqual(VIEWPORT_MOBILE.height * 0.9);

    for (const index of [0, 1]) {
      const rowBox = await placeRow(dialog, index).boundingBox();
      expect(rowBox, `row ${index} boundingBox`).not.toBeNull();
      expect(rowBox!.height, `row ${index} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(rowBox!.x + rowBox!.width, `row ${index} 오른쪽 끝`).toBeLessThanOrEqual(VIEWPORT_MOBILE.width + 0.5);
    }
    for (const name of PLACE_TEXT.tabs) {
      const tabBox = await dialog.getByRole('tab', { name, exact: true }).boundingBox();
      expect(tabBox!.height, `tab ${name} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
    const inputBox = await placeInput(dialog).boundingBox();
    expect(inputBox!.height, 'input height').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET - 4);

    await expectNoHorizontalScroll(page);
    const innerOverflow = await dialog.evaluate((root) => {
      const offenders: string[] = [];
      for (const node of [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[]) {
        const style = window.getComputedStyle(node);
        if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') continue;
        if (node.scrollWidth > node.clientWidth + 1) {
          offenders.push(`${node.tagName}[${node.dataset.testid ?? ''}] ${node.scrollWidth}>${node.clientWidth}`);
        }
      }
      return offenders;
    });
    expect(innerOverflow, innerOverflow.join(', ')).toEqual([]);
  });
});
