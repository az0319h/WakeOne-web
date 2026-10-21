import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { formatAbsoluteDateTimeKo } from '../../src/lib/format-datetime';

/**
 * plan 86 — 카카오 스타일 단일 화면 (`quick-request-order-page`) e2e helpers
 * plan 87 — 물품 크기 · 사용자별 특이사항 칩(DB) · 주소 검색 Dialog · 최근 주소
 */

export const QUICK_REQUEST_PATH = '/dashboard/quick/request';

export const ORIGIN_PHONE = '01012345678';
export const DEST_PHONE = '01087654321';

export const VIEWPORT_DESKTOP = { width: 1280, height: 800 } as const;
export const VIEWPORT_TABLET = { width: 768, height: 1024 } as const;
export const VIEWPORT_MOBILE = { width: 375, height: 812 } as const;

export function quickRequestHeading(page: Page) {
  return page.getByRole('heading', { name: /퀵 배송 요청/ });
}

export function quickRequestMain(page: Page) {
  return page.getByRole('main');
}

export function quickRequestOrderPage(page: Page) {
  return quickRequestMain(page).getByTestId('quick-request-order-page');
}

export function desktopSummary(page: Page) {
  return quickRequestMain(page).getByTestId('quick-request-summary');
}

export function previewMessage(page: Page) {
  return page.getByTestId('quick-request-preview-message');
}

export async function openQuickRequestNavLink(page: Page) {
  await page.setViewportSize(VIEWPORT_DESKTOP);
  await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('link', { name: '퀵 요청하기' });
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  }
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();
}

export async function gotoQuickRequest(
  page: Page,
  viewport: { width: number; height: number } = VIEWPORT_DESKTOP
) {
  await page.setViewportSize(viewport);
  await page.goto(QUICK_REQUEST_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(QUICK_REQUEST_PATH);
  await expect(quickRequestHeading(page)).toBeVisible({ timeout: 30_000 });
  await expect(quickRequestOrderPage(page)).toBeVisible({ timeout: 30_000 });
  await waitForOrderPageHydrated(page);
}

/**
 * SSR 직후(hydration 전) fill은 React hydration 시 controlled 값으로 덮인다.
 * 대수 프리셋 클릭이 aria-pressed에 반영될 때까지(=onClick 동작) 기다린 뒤 기본값(1대)으로 되돌린다.
 */
export async function waitForOrderPageHydrated(page: Page) {
  const main = quickRequestMain(page);
  const probe = main.getByTestId('quick-request-vehicle-count-2');
  await expect(async () => {
    await probe.click();
    await expect(probe).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  const preset1 = main.getByTestId('quick-request-vehicle-count-1');
  await preset1.click();
  await expect(preset1).toHaveAttribute('aria-pressed', 'true');
}

/** 차량 카드 testid — 컴포넌트와 동일 규칙 (공백→-, 괄호 제거) */
export function vehicleCardTestId(type: string) {
  return `quick-request-vehicle-${type.replace(/\s+/g, '-').replace(/[()]/g, '')}`;
}

export function vehicleCard(page: Page, type: string): Locator {
  return quickRequestMain(page).getByTestId(vehicleCardTestId(type));
}

export async function selectVehicles(page: Page, vehicles: string[]) {
  for (const vehicle of vehicles) {
    const card = vehicleCard(page, vehicle);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
  }
}

export async function fillItem(page: Page, item: string) {
  const field = quickRequestMain(page).getByTestId('quick-request-item-description');
  await field.scrollIntoViewIfNeeded();
  await field.fill(item);
  await expect(field).toHaveValue(item);
}

export async function setVehicleCount(
  page: Page,
  count: { preset: number } | { custom: number }
) {
  const main = quickRequestMain(page);
  if ('custom' in count) {
    await main.getByTestId('quick-request-vehicle-count-custom-toggle').click();
    const input = main.getByTestId('quick-request-vehicle-count-custom-input');
    await input.fill(String(count.custom));
    await expect(input).toHaveValue(String(count.custom));
    return;
  }
  await main.getByTestId(`quick-request-vehicle-count-${count.preset}`).click();
}

export async function fillLocationByPrefix(
  page: Page,
  prefix: string,
  {
    road,
    detail,
    name,
    phone
  }: { road: string; detail: string; name?: string; phone?: string }
) {
  const main = quickRequestMain(page);
  await main.getByTestId(`${prefix}-road-address`).fill(road);
  await main.getByTestId(`${prefix}-detail-address`).fill(detail);
  if (name !== undefined) {
    await main.getByTestId(`${prefix}-contact-name`).fill(name);
  }
  if (phone !== undefined) {
    await main.getByTestId(`${prefix}-contact-phone`).fill(phone);
  }
}

export type FillOrderOptions = {
  /** plan 87 r1 — 「기타」일 때만 채운다(다른 크기면 textarea 숨김). 빈 문자열이면 미입력 (AC-03·07·17) */
  item?: string;
  vehicles?: string[];
  vehicleOther?: string;
  count?: { preset: number } | { custom: number };
  /** 출발 담당/연락은 프로필 기본값을 덮어쓴다 (phone null 계정 대비) */
  originRoad?: string;
  /** plan 87 — 특이사항 칩 라벨 (group + role 셀렉터) */
  originNotes?: string[];
  /** plan 87 — 물품 크기. null이면 미선택 (AC-02) */
  goodsSize?: GoodsSize | null;
  pickupDatetime?: string;
  destDatetime?: string;
  freight?: 'monthly' | 'collect';
};

/** 단일 화면 전 필수 입력 — 화면 위→아래 순서 (주소 → 배송 수단 → 일정 → 물품 → 특이 → 결제) */
export async function fillQuickRequestOrder(page: Page, options: FillOrderOptions = {}) {
  const {
    item = 'E2E 물품 테스트',
    vehicles = ['오토바이'],
    vehicleOther,
    count = { preset: 1 },
    originRoad = '서울 중구 세종대로 110',
    originNotes = [],
    goodsSize = 's',
    pickupDatetime,
    destDatetime,
    freight = 'monthly'
  } = options;
  const main = quickRequestMain(page);

  await fillLocationByPrefix(page, 'quick-request-origin', {
    road: originRoad,
    detail: '1층',
    name: 'E2E 출발',
    phone: ORIGIN_PHONE
  });
  await fillLocationByPrefix(page, 'quick-request-destination', {
    road: '경기 성남시 분당구 판교역로 166',
    detail: '2층',
    name: 'E2E 도착',
    phone: DEST_PHONE
  });

  await selectVehicles(page, vehicles);
  if (vehicleOther !== undefined) {
    await main.getByTestId('quick-request-vehicle-other').fill(vehicleOther);
  }
  await setVehicleCount(page, count);

  if (pickupDatetime) {
    await main.getByRole('radio', { name: '날짜/시간 선택' }).first().click();
    await main.getByTestId('quick-request-origin-scheduled-datetime').fill(pickupDatetime);
  } else {
    await main.getByRole('radio', { name: '즉시 요청' }).click();
  }
  if (destDatetime) {
    await main.getByRole('radio', { name: '날짜/시간 선택' }).last().click();
    await main.getByTestId('quick-request-destination-scheduled-datetime').fill(destDatetime);
  } else {
    await main.getByRole('radio', { name: '최대한 빠르게' }).click();
  }

  if (goodsSize) {
    await selectGoodsSize(page, goodsSize);
  }

  // plan 87 r1 — 물품 내용 textarea는 「기타」 선택 시에만 보인다
  if (goodsSize === 'other' && item) {
    await fillItem(page, item);
  }

  for (const note of originNotes) {
    const chip = noteChip(page, 'origin', note);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  }

  await main.getByTestId(`quick-request-freight-${freight}`).click();
}

export async function clickDesktopRegister(page: Page) {
  await quickRequestMain(page).getByTestId('quick-request-register-button').click();
}

export async function clickMobileRegister(page: Page) {
  await quickRequestMain(page).getByTestId('quick-request-mobile-register-button').click();
}

/** Dialog 확인 → notify 501 · toast 2종 · Dialog 닫힘 (AC-13·16 공통) */
export async function confirmPreviewAndExpect501(page: Page) {
  await expect(previewMessage(page)).toContainText(/새 퀵 요청/);
  const notifyPromise = page.waitForResponse(
    (res) => res.url().includes('/api/quick-request/notify') && res.request().method() === 'POST'
  );
  await page.getByTestId('quick-request-confirm-button').click();
  const response = await notifyPromise;
  expect(response.status()).toBe(501);
  await expect(page.getByText('카톡 API 연동 후 자동 전송됩니다.', { exact: true })).toBeVisible({
    timeout: 10_000
  });
  await expect(page.getByText('메시지가 복사되었습니다.', { exact: true })).toBeVisible({
    timeout: 10_000
  });
  await expect(previewMessage(page)).toBeHidden();
}

export function expectedAbsoluteDatetimeFromLocalInput(localValue: string): string {
  return formatAbsoluteDateTimeKo(new Date(localValue).toISOString());
}

export async function fetchUserProfileFromDashboard(page: Page) {
  await page.goto('/dashboard/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('profile-readonly-full-name')).toBeVisible({ timeout: 30_000 });
  const fullName = (await page.getByTestId('profile-readonly-full-name').innerText()).trim();
  const phoneLabel = (await page.getByTestId('profile-readonly-phone').innerText()).trim();
  const phone = phoneLabel === '미설정' ? '' : phoneLabel.replace(/\D/g, '');
  return { fullName, phone };
}

/** plan 86 D2 — 문서 가로 스크롤 0 (scrollWidth <= clientWidth · 픽셀 비교 아님) */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth
  );
}

/** 페이지 앵커 내부 스크롤 컨테이너(overflow auto/scroll)도 가로 넘침 0인지 측정 */
export async function expectNoInnerHorizontalOverflow(page: Page) {
  const offenders = await quickRequestOrderPage(page).evaluate((root) => {
    const result: string[] = [];
    const nodes = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') continue;
      if (node.tagName === 'TEXTAREA') continue;
      if (node.scrollWidth > node.clientWidth + 1) {
        result.push(`${node.tagName}[${node.dataset.testid ?? ''}] ${node.scrollWidth}>${node.clientWidth}`);
      }
    }
    return result;
  });
  expect(offenders, offenders.join(', ')).toEqual([]);
}

export type ColorMode = 'light' | 'dark';

/** cookie `active_theme` + next-themes localStorage `theme` 주입 (페이지 이동 전에 호출) */
export async function applyThemeBeforeNavigation(
  page: Page,
  baseURL: string,
  theme: string,
  mode: ColorMode
) {
  await page.context().addCookies([{ name: 'active_theme', value: theme, url: baseURL }]);
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {
      // storage 차단 환경 무시
    }
  }, mode);
  await page.emulateMedia({ colorScheme: mode });
}

export async function expectThemeApplied(page: Page, theme: string, mode: ColorMode) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        dark: document.documentElement.classList.contains('dark')
      }))
    )
    .toEqual({ theme, dark: mode === 'dark' });
}

// ---------------------------------------------------------------------------
// plan 87 — 물품 크기
// ---------------------------------------------------------------------------

export type GoodsSize = 'xs' | 's' | 'm' | 'other';

export const GOODS_SIZE_LABELS: Record<GoodsSize, string> = {
  xs: '초소형',
  s: '소형',
  m: '중형',
  other: '기타'
};

export function goodsSizeGroup(page: Page) {
  return quickRequestMain(page).getByRole('radiogroup', { name: '물품 크기' });
}

export function itemDescriptionField(page: Page) {
  return quickRequestMain(page).getByTestId('quick-request-item-description');
}

export async function selectGoodsSize(page: Page, size: GoodsSize) {
  const card = quickRequestMain(page).getByTestId(`quick-request-goods-size-${size}`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(
    goodsSizeGroup(page).getByRole('radio', { name: GOODS_SIZE_LABELS[size], exact: true })
  ).toBeChecked();
}

// ---------------------------------------------------------------------------
// plan 87 — 특이사항 칩 (사용자별 DB · seed 「동승 필요」)
// ---------------------------------------------------------------------------

export const SEED_NOTE_LABEL = '동승 필요';
/** e2e가 만드는 칩 라벨 접두 — cleanup 스크립트도 같은 규칙으로 지운다 */
export const E2E_NOTE_PREFIX = 'E2E';

export type NoteSide = 'origin' | 'destination';

export type QuickRequestNoteDto = { id: number; label: string };

export function notesGroup(page: Page, side: NoteSide) {
  return quickRequestMain(page).getByTestId(`quick-request-${side}-notes`);
}

export function noteChip(page: Page, side: NoteSide, label: string) {
  return notesGroup(page, side).getByRole('button', { name: label, exact: true });
}

export async function listNotesApi(request: APIRequestContext): Promise<QuickRequestNoteDto[]> {
  const response = await request.get('/api/quick-request/notes');
  expect(response.status(), 'GET /api/quick-request/notes').toBe(200);
  const body = (await response.json()) as { data?: { notes?: QuickRequestNoteDto[] } };
  return body.data?.notes ?? [];
}

/**
 * fixture 사용자 칩을 seed 상태로 되돌린다 (API).
 * - 「동승 필요」 외 칩을 모두 삭제 (fixture 계정은 e2e 전용)
 * - 「동승 필요」가 없으면 다시 추가
 */
export async function resetNotesToSeed(request: APIRequestContext) {
  const notes = await listNotesApi(request);
  for (const note of notes) {
    if (note.label === SEED_NOTE_LABEL) continue;
    const response = await request.delete(`/api/quick-request/notes/${note.id}`);
    expect(response.status(), `DELETE note ${note.id}`).toBe(200);
  }
  if (!notes.some((note) => note.label === SEED_NOTE_LABEL)) {
    const response = await request.post('/api/quick-request/notes', {
      data: { label: SEED_NOTE_LABEL }
    });
    expect(response.status(), 'POST seed note').toBe(201);
  }
  const after = await listNotesApi(request);
  expect(after.map((note) => note.label)).toEqual([SEED_NOTE_LABEL]);
  return after;
}

// ---------------------------------------------------------------------------
// plan 87 — 주소 검색 Dialog · 최근 이용 내역
// ---------------------------------------------------------------------------

export function addressPickerDialog(page: Page) {
  return page.getByRole('dialog', { name: '주소 검색' });
}

export async function openAddressPicker(page: Page, prefix = 'quick-request-origin') {
  const trigger = quickRequestMain(page).getByTestId(`${prefix}-address-search`);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = addressPickerDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export type RecentAddressDto = {
  roadAddress: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
  lastUsedAt: string;
};

export async function listRecentAddressesApi(
  request: APIRequestContext
): Promise<RecentAddressDto[]> {
  const response = await request.get('/api/quick-request/recent-addresses');
  expect(response.status(), 'GET /api/quick-request/recent-addresses').toBe(200);
  const body = (await response.json()) as { data?: { addresses?: RecentAddressDto[] } };
  return body.data?.addresses ?? [];
}
