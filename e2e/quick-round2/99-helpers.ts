import fs from 'node:fs';
import path from 'node:path';
import { expect, request as playwrightRequest, type Locator, type Page } from '@playwright/test';
import { addressPickerDialog, openAddressPicker } from '../quick-request/helpers';
import { AUTH, BASE_URL } from '../quick-workflow/helpers';

/**
 * plan 99 — 퀵 주소 「장소 검색」 탭(카카오 로컬 키워드 검색 서버 프록시) e2e 공용
 * docs/plans/99_quick-place-keyword-search-plan.md
 * - 서버는 `E2E_KAKAO_PLACES_MOCK=1`(외부 fetch 계층만 `e2e/fixtures/kakao-places.json`으로 대체)로 떠 있어야 한다
 * - 미설정(AC-10)은 `E2E_KAKAO_PLACES_UNCONFIGURED=1` 서버 + `99-place-search-unconfigured.spec.ts`
 * - Route 분당 30회 제한은 사용자 단위 · 서버 메모리 → spec별로 계정을 나눈다
 *   (UI·AC-08 = user.json · AC-13 테마 = user2.json · AC-09 = 일회용 계정)
 */

export const PLACES_PATH = '/api/quick-request/places';

/** plan D-1~D-5 · U-2~U-4 문구 (구현 상수가 아니라 plan 원문으로 판정) */
export const PLACE_TEXT = {
  tab: '장소 검색',
  tabs: ['주소 검색', '장소 검색', '최근 이용 내역'],
  tabsUnconfigured: ['주소 검색', '최근 이용 내역'],
  placeholder: '가게·건물 이름으로 검색 (예: 익선 산스)',
  hint: '가게·건물 이름으로 찾습니다. 주소를 아시면 「주소 검색」 탭을 이용하세요.',
  empty: '검색 결과가 없습니다.',
  failed: '장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  jibunBadge: '지번',
  jibunToast: '도로명 주소가 없어 지번 주소를 넣었습니다.',
  queryRequired: '검색어를 입력해 주세요.',
  queryTooLong: '검색어는 50자 이내로 입력해 주세요.',
  invalidRequest: '요청 형식이 올바르지 않습니다.',
  rateLimited: '잠시 후 다시 시도해 주세요.',
  notConfigured: '장소 검색이 아직 설정되지 않았습니다.',
  unauthorized: '인증이 필요합니다.',
  forbidden: '접근 권한이 없습니다.',
  tooMany: '결과가 많습니다. 검색어를 더 구체적으로 입력해 주세요.'
} as const;

/** mock fixture의 카카오 형태 문서 */
type KakaoDoc = {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  phone: string;
  category_name: string;
};

type KakaoFixture = { queries: Record<string, { documents?: KakaoDoc[] }> };

export function readKakaoFixture(): KakaoFixture {
  const file = path.resolve(process.cwd(), 'e2e/fixtures/kakao-places.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as KakaoFixture;
}

/** fixture 「익선」 2건 — [0] 도로명 있음 · [1] 도로명 없음(지번만) */
export function ikseonDocs(): [KakaoDoc, KakaoDoc] {
  const docs = readKakaoFixture().queries['익선']?.documents ?? [];
  expect(docs.length, 'fixture 익선 2건').toBe(2);
  const [road, jibun] = docs as [KakaoDoc, KakaoDoc];
  expect(road.road_address_name, 'fixture 익선[0] 도로명').not.toBe('');
  expect(jibun.road_address_name, 'fixture 익선[1] 도로명 없음').toBe('');
  return [road, jibun];
}

/** `category_name` 마지막 세그먼트 (plan §API 정규화) */
export function lastCategory(categoryName: string): string {
  return categoryName.split('>').pop()!.trim();
}

/** `/api/quick-request/places` 요청 기록 (AC-02 debounce·1자 0건 · 페이지 수) */
export function trackPlaceRequests(page: Page) {
  const requests: { q: string | null; page: string | null; at: number }[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname !== PLACES_PATH) return;
    requests.push({ q: url.searchParams.get('q'), page: url.searchParams.get('page'), at: Date.now() });
  });
  return requests;
}

export function placeInput(dialog: Locator) {
  return dialog.getByTestId('quick-request-place-input');
}

export function placeRow(dialog: Locator, index: number) {
  return dialog.getByTestId(`quick-request-place-${index}`);
}

/** 주소 검색 Dialog를 열고 「장소 검색」 탭으로 이동 (탭 클릭 시 입력 자동 포커스 · plan D-3) */
export async function openPlaceTab(page: Page, prefix = 'quick-request-origin') {
  const dialog = await openAddressPicker(page, prefix);
  const tab = dialog.getByRole('tab', { name: PLACE_TEXT.tab, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(placeInput(dialog)).toBeVisible();
  return dialog;
}

/** 검색어 입력 후 첫 페이지 응답까지 기다린다 (debounce 400ms 자동 검색) */
export async function searchPlace(page: Page, dialog: Locator, query: string) {
  const responsePromise = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === PLACES_PATH && url.searchParams.get('q') === query.trim();
  });
  await placeInput(dialog).fill(query);
  return responsePromise;
}

/**
 * mock 서버 확인 — 「에러」는 fixture에서만 502가 된다 (실제 키·미설정 서버면 200/503).
 * admin 세션으로 1회 호출(UI·API spec 계정의 분당 한도와 분리).
 */
export async function expectPlacesMockServer() {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: AUTH.admin });
  try {
    const response = await api.get(`${PLACES_PATH}?q=${encodeURIComponent('에러')}`);
    expect(
      response.status(),
      `E2E_KAKAO_PLACES_MOCK=1 서버가 필요하다 (${BASE_URL} · q=에러 → 502 기대)`
    ).toBe(502);
  } finally {
    await api.dispose();
  }
}

export function isUnconfiguredRun(): boolean {
  return process.env.E2E_KAKAO_PLACES_UNCONFIGURED === '1';
}

export { addressPickerDialog };
