import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page
} from '@playwright/test';
import { createUserRequest, e2eBaseURL } from '../helpers/auth-request';
import { createOrgChartTestUser, type OrgChartUserOptions } from '../helpers/org-chart';
import { serviceClient } from '../quick-workflow/helpers';

/**
 * plan 102 — overview 생일 카드 휠 목록
 * docs/plans/102_overview-birthday-wheel-list-plan.md (AC-01 ~ AC-21)
 *
 * - chromium 프로젝트(admin.json) · user는 `browser.newContext({ storageState: 'e2e/.auth/user.json' })`
 * - Playwright clock 미사용: 기준일은 서버(KST)가 정한다 → `GET /api/birthdays`의 `referenceDate` 기준 상대 날짜로 시드
 * - 시드: `createOrgChartTestUser`(example.com) · 생일 연도 1992(윤년) · 이름 `E2E생일-{역할}-{난수}` · afterAll 삭제
 * - 실직원 데이터와 섞이므로 위치·개수는 API 응답으로 계산해 비교한다(고정 개수 금지)
 * - AC-04(동방 403)는 e2e/quick-round2/95-dongbang-visibility.spec.ts · AC-19·AC-21은 CLI(node --test·tsc·lint·build·cleanup)
 * - 메일 Route 호출 없음(이 기능은 이메일 무관)
 */

test.describe.configure({ mode: 'default', timeout: 120_000 });

type Celebrant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  affiliation: 'wake' | 'sans' | 'sans_foundry' | null;
  month_day: string;
  days_offset: number;
};

type BirthdaysBody = {
  success: boolean;
  message?: string;
  data?: { referenceDate: string; celebrants: Celebrant[] };
};

type SeedRole =
  | 'today'
  | 'plus2'
  | 'minus3'
  | 'noaff'
  | 'dongbang'
  | 'inactive'
  | 'pending'
  | 'null';

type SeedUser = { userId: string; fullName: string };

const OVERVIEW = '/dashboard/overview';
const ADMIN_STORAGE = 'e2e/.auth/admin.json';
const USER_STORAGE = 'e2e/.auth/user.json';
const ROW_HEIGHT = 64;
const TAB_LABELS = ['전체', '웨이크', '산스', '산스파운드리'] as const;
const AFFILIATION_LABEL: Record<'wake' | 'sans' | 'sans_foundry', string> = {
  wake: '웨이크',
  sans: '산스',
  sans_foundry: '산스파운드리'
};

function kstToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/** 기준일 + n일의 `MM-DD` (UTC 달력 계산 · 시계 의존 없음) */
function shiftMonthDay(referenceDate: string, days: number): string {
  const [year, month, day] = referenceDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** `2026-10-29` / `10-29` → `10월 29일` */
function monthDayLabel(value: string): string {
  const parts = value.split('-');
  const [month, day] = parts.slice(-2).map(Number);
  return `${month}월 ${day}일`;
}

function randomTag(): string {
  return Math.random().toString(36).slice(2, 7);
}

async function fetchBirthdays(api: APIRequestContext) {
  const response = await api.get('/api/birthdays');
  const body = (await response.json()) as BirthdaysBody;
  return { response, body };
}

async function getCelebrants(api: APIRequestContext) {
  const { response, body } = await fetchBirthdays(api);
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body.data!;
}

function centerCelebrant(list: Celebrant[]): Celebrant | undefined {
  return list.find((celebrant) => celebrant.days_offset >= 0) ?? list[list.length - 1];
}

function card(page: Page): Locator {
  return page.getByTestId('birthday-celebrants-card');
}

function rows(page: Page): Locator {
  return card(page).getByTestId('birthday-row');
}

function wheel(page: Page): Locator {
  return card(page).getByTestId('birthday-wheel');
}

function rowByName(page: Page, fullName: string): Locator {
  return rows(page).filter({ hasText: fullName });
}

async function waitWheelReady(page: Page) {
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  await expect(wheel(page)).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
}

async function openOverview(page: Page) {
  await page.goto(OVERVIEW);
  await waitWheelReady(page);
}

async function rowAttributes(page: Page) {
  return rows(page).evaluateAll((elements) =>
    elements.map((element) => ({
      userId: element.getAttribute('data-user-id') ?? '',
      affiliation: element.getAttribute('data-affiliation') ?? '',
      daysOffset: Number(element.getAttribute('data-days-offset')),
      current: element.getAttribute('aria-current') === 'true'
    }))
  );
}

async function centerIndex(page: Page): Promise<number> {
  return rows(page).evaluateAll((elements) =>
    elements.findIndex((element) => element.getAttribute('aria-current') === 'true')
  );
}

async function centerUserId(page: Page): Promise<string | null> {
  return rows(page).evaluateAll(
    (elements) =>
      elements.find((element) => element.getAttribute('aria-current') === 'true')?.getAttribute('data-user-id') ??
      null
  );
}

async function wheelScrollTop(page: Page): Promise<number> {
  return wheel(page).evaluate((element) => Math.round(element.scrollTop));
}

/** 가운데 줄 세로 중심과 휠 세로 중심의 차이(px) */
async function centerOffsetPx(page: Page): Promise<number> {
  const index = await centerIndex(page);
  expect(index, 'aria-current 줄').toBeGreaterThanOrEqual(0);
  const wheelBox = await wheel(page).boundingBox();
  const rowBox = await rows(page).nth(index).boundingBox();
  expect(wheelBox && rowBox, 'bounding box').toBeTruthy();
  return Math.abs(rowBox!.y + rowBox!.height / 2 - (wheelBox!.y + wheelBox!.height / 2));
}

async function selectTab(page: Page, label: (typeof TAB_LABELS)[number]) {
  const tab = card(page).getByRole('tab', { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await waitWheelReady(page);
}

async function newAdminContext(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  return browser.newContext({
    baseURL: e2eBaseURL,
    storageState: ADMIN_STORAGE,
    viewport: { width: 1440, height: 900 },
    ...options
  });
}

async function confettiStorageValue(page: Page, referenceDate: string) {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    `wakeone:birthday-confetti:${referenceDate}`
  );
}

// ---------------------------------------------------------------------------
// 1) 시드 전 — 실데이터만 (AC-15 ② · AC-09 헤더 인원 N)
// ---------------------------------------------------------------------------

test.describe('plan 102 생일 휠 — 시드 전(실데이터)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('AC-15 ②: 오늘 생일 없음 → 컨페티 없음 · 「다가오는 생일」 · 「오늘 M월 d일 · 생일 등록 N명」 · 「D-DAY!」 없음', async ({
    page,
    request
  }) => {
    const data = await getCelebrants(request);
    const todayCount = data.celebrants.filter((celebrant) => celebrant.days_offset === 0).length;
    test.skip(
      todayCount > 0,
      `실데이터에 오늘 생일자 ${todayCount}명 — ② E2E skip, AC-15 ①은 node --test(shouldFireBirthdayConfetti)로 판정`
    );
    test.skip(data.celebrants.length === 0, '회사 전체 0명 → 카드 숨김(D-13)');

    await openOverview(page);
    await expect(card(page)).toHaveAttribute('aria-label', '다가오는 생일 축하');
    // hydration 후 움직임 설정이 반영(회전 링)된 뒤에도 컨페티가 터지지 않아야 한다
    await expect(card(page).getByTestId('birthday-row-ring')).toHaveCount(1);
    await page.waitForTimeout(1_500);
    await expect(card(page)).toHaveAttribute('data-confetti-fired', 'false');
    await expect(card(page).getByTestId('birthday-header-badge')).toHaveText('다가오는 생일');
    await expect(card(page).getByTestId('birthday-header-meta')).toHaveText(
      `오늘 ${monthDayLabel(data.referenceDate)} · 생일 등록 ${data.celebrants.length}명`
    );
    await expect(card(page).getByText('D-DAY!')).toHaveCount(0);
    expect(await confettiStorageValue(page, data.referenceDate)).toBeNull();
  });

  test('AC-09 ⑤(헤더 인원): 탭마다 「생일 등록 {N}명」 N = 그 탭 인원 (오늘 생일 없는 날에만 표시 · D-12)', async ({
    page,
    request
  }) => {
    const data = await getCelebrants(request);
    test.skip(
      data.celebrants.some((celebrant) => celebrant.days_offset === 0),
      '오늘 생일자가 있으면 헤더가 D-11 문구라 인원 N이 표시되지 않는다'
    );

    await openOverview(page);
    const meta = card(page).getByTestId('birthday-header-meta');
    const counts: Record<(typeof TAB_LABELS)[number], number> = {
      전체: data.celebrants.length,
      산스: data.celebrants.filter((c) => c.affiliation === 'sans').length,
      산스파운드리: data.celebrants.filter((c) => c.affiliation === 'sans_foundry').length,
      웨이크: data.celebrants.filter((c) => c.affiliation === 'wake').length
    };
    for (const label of ['산스', '산스파운드리', '웨이크', '전체'] as const) {
      await card(page).getByRole('tab', { name: label, exact: true }).click();
      await expect(card(page).getByRole('tab', { name: label, exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(meta, label).toHaveText(
        `오늘 ${monthDayLabel(data.referenceDate)} · 생일 등록 ${counts[label]}명`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2) 시드 후 — 상대 날짜 일회용 사용자
// ---------------------------------------------------------------------------

test.describe('plan 102 생일 휠 — 시드(상대 날짜)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  let referenceDate = '';
  const seeds = {} as Record<SeedRole, SeedUser>;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    referenceDate = kstToday();
    const tag = randomTag();
    const birthdayAt = (days: number) => `1992-${shiftMonthDay(referenceDate, days)}`;
    const plan: Record<SeedRole, OrgChartUserOptions> = {
      today: { affiliation: 'sans_foundry', birthday: birthdayAt(0) },
      plus2: { affiliation: 'sans', birthday: birthdayAt(2) },
      minus3: { affiliation: 'wake', birthday: birthdayAt(-3) },
      noaff: { affiliation: null, birthday: birthdayAt(5) },
      dongbang: {
        affiliation: 'dongbang',
        birthday: birthdayAt(0),
        rank: null,
        position_level: null
      },
      inactive: { affiliation: 'wake', status: 'inactive', birthday: birthdayAt(0) },
      pending: { affiliation: 'wake', status: 'pending_approval', birthday: birthdayAt(0) },
      null: { affiliation: 'wake', birthday: null }
    };

    for (const [role, options] of Object.entries(plan) as [SeedRole, OrgChartUserOptions][]) {
      const fullName = `E2E생일-${role}-${tag}`;
      const created = await createOrgChartTestUser(`e2e102-${role}`, { ...options, fullName });
      seeds[role] = { userId: created.userId, fullName };
    }
  });

  test.afterAll(async () => {
    const admin = serviceClient();
    for (const seed of Object.values(seeds)) {
      await admin.auth.admin.deleteUser(seed.userId).catch(() => undefined);
    }
  });

  test('AC-01: GET /api/birthdays admin 200 · 키 6개 · 연도·연락처 없음 · MM-DD · 범위 · 정렬 · 시드 offset', async ({
    request
  }) => {
    const { response, body } = await fetchBirthdays(request);
    expect(response.status(), JSON.stringify(body)).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data!;
    expect(data.referenceDate).toBe(referenceDate);
    expect(data.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.celebrants.length).toBeGreaterThan(0);

    const expectedKeys = ['affiliation', 'avatar_url', 'days_offset', 'full_name', 'month_day', 'user_id'];
    for (const celebrant of data.celebrants) {
      expect(Object.keys(celebrant).sort(), celebrant.user_id).toEqual(expectedKeys);
      expect(celebrant).not.toHaveProperty('email');
      expect(celebrant).not.toHaveProperty('phone');
      expect(celebrant).not.toHaveProperty('birthday');
      expect(celebrant.month_day).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
      expect([null, 'wake', 'sans', 'sans_foundry']).toContain(celebrant.affiliation);
      expect(Number.isInteger(celebrant.days_offset)).toBe(true);
      expect(celebrant.days_offset).toBeGreaterThanOrEqual(-183);
      expect(celebrant.days_offset).toBeLessThanOrEqual(182);
    }

    // 응답 본문 어디에도 연도 포함 생일·이메일 키가 없다
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/"birthday"|"email"|"phone"/);
    expect(raw).not.toContain('1992-');

    for (let index = 1; index < data.celebrants.length; index += 1) {
      const previous = data.celebrants[index - 1];
      const current = data.celebrants[index];
      const ordered =
        previous.days_offset < current.days_offset ||
        (previous.days_offset === current.days_offset &&
          previous.full_name.localeCompare(current.full_name, 'ko') <= 0);
      expect(ordered, `정렬 ${previous.full_name}(${previous.days_offset}) → ${current.full_name}(${current.days_offset})`).toBe(true);
    }

    const byId = new Map(data.celebrants.map((celebrant) => [celebrant.user_id, celebrant]));
    expect(byId.get(seeds.today.userId)?.days_offset).toBe(0);
    expect(byId.get(seeds.plus2.userId)?.days_offset).toBe(2);
    expect(byId.get(seeds.minus3.userId)?.days_offset).toBe(-3);
    expect(byId.get(seeds.noaff.userId)?.days_offset).toBe(5);
    expect(byId.get(seeds.today.userId)?.month_day).toBe(shiftMonthDay(referenceDate, 0));
    expect(byId.get(seeds.today.userId)?.affiliation).toBe('sans_foundry');
    expect(byId.get(seeds.noaff.userId)?.affiliation).toBeNull();
  });

  test('AC-02: user.json(non-admin) GET /api/birthdays 200 · admin 응답과 user_id 목록 동일', async ({
    request,
    playwright
  }) => {
    const admin = await getCelebrants(request);
    const userApi = await createUserRequest(playwright);
    try {
      const user = await getCelebrants(userApi);
      expect(user.celebrants.map((celebrant) => celebrant.user_id)).toEqual(
        admin.celebrants.map((celebrant) => celebrant.user_id)
      );
      expect(user.referenceDate).toBe(admin.referenceDate);
    } finally {
      await userApi.dispose();
    }
  });

  test('AC-03: 비로그인 GET /api/birthdays → 401', async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({
      baseURL: e2eBaseURL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      const response = await anonymous.get('/api/birthdays');
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });

  test('AC-04 ②(S-10a): admin 응답에 S_dongbang·affiliation=dongbang 행 0건 (403은 95 spec)', async ({
    request
  }) => {
    const data = await getCelebrants(request);
    expect(data.celebrants.map((celebrant) => celebrant.user_id)).not.toContain(seeds.dongbang.userId);
    expect(data.celebrants.filter((celebrant) => (celebrant.affiliation as string) === 'dongbang')).toHaveLength(0);
  });

  test('AC-05: S_inactive·S_pending·S_null 없음 (plan 58 AC-04 회귀)', async ({ request }) => {
    const ids = (await getCelebrants(request)).celebrants.map((celebrant) => celebrant.user_id);
    expect(ids).toContain(seeds.today.userId);
    expect(ids).not.toContain(seeds.inactive.userId);
    expect(ids).not.toContain(seeds.pending.userId);
    expect(ids).not.toContain(seeds.null.userId);
  });

  test('AC-06: GET /api/birthdays/this-month → 404 (옛 경로 삭제)', async ({ request }) => {
    const response = await request.get('/api/birthdays/this-month');
    expect(response.status()).toBe(404);
  });

  test('AC-07: 1440 overview — 카드가 같은 열 맨 위 · 탭 4개 순서 · 전체 선택 · 줄 offset 비감소 · 시드 순서 · 행 수 = API', async ({
    page,
    request
  }) => {
    const data = await getCelebrants(request);
    await openOverview(page);

    const cardBox = (await card(page).boundingBox())!;
    const belowCards = [
      page.getByTestId('announcements-overview-card'),
      page.getByLabel('이번 달 식대 잔액', { exact: true })
    ];
    let compared = 0;
    for (const below of belowCards) {
      if ((await below.count()) === 0) continue;
      const box = (await below.first().boundingBox())!;
      expect(Math.abs(box.x - cardBox.x), '같은 열(x)').toBeLessThanOrEqual(2);
      expect(cardBox.y + cardBox.height, '생일 카드가 위').toBeLessThanOrEqual(box.y + 1);
      compared += 1;
    }
    expect(compared, '같은 열 아래 카드(공지 또는 식대) 1개 이상').toBeGreaterThan(0);

    const tabs = card(page).getByRole('tab');
    await expect(tabs).toHaveText([...TAB_LABELS]);
    await expect(card(page).getByRole('tab', { name: '전체', exact: true })).toHaveAttribute('aria-selected', 'true');

    const attrs = await rowAttributes(page);
    expect(attrs).toHaveLength(data.celebrants.length);
    for (let index = 1; index < attrs.length; index += 1) {
      expect(attrs[index].daysOffset, `줄 ${index}`).toBeGreaterThanOrEqual(attrs[index - 1].daysOffset);
    }
    expect(attrs.map((attr) => attr.userId)).toEqual(data.celebrants.map((celebrant) => celebrant.user_id));

    const indexOf = (userId: string) => attrs.findIndex((attr) => attr.userId === userId);
    expect(indexOf(seeds.minus3.userId)).toBeGreaterThanOrEqual(0);
    expect(indexOf(seeds.minus3.userId)).toBeLessThan(indexOf(seeds.today.userId));
    expect(indexOf(seeds.today.userId)).toBeLessThan(indexOf(seeds.plus2.userId));
  });

  test('AC-08: 첫 화면 가운데 줄 = days_offset ≥ 0 첫 항목 · aria-current 1개 · 세로 중심 ±8px · 링 표시', async ({
    page,
    request
  }) => {
    const data = await getCelebrants(request);
    await openOverview(page);

    const current = (await rowAttributes(page)).filter((attr) => attr.current);
    expect(current, 'aria-current="true" 1개').toHaveLength(1);
    expect(current[0].userId).toBe(centerCelebrant(data.celebrants)!.user_id);
    expect(await centerOffsetPx(page)).toBeLessThanOrEqual(8);

    const centerRow = rows(page).nth(await centerIndex(page));
    await expect(centerRow.getByTestId('birthday-row-ring')).toBeVisible();
    await expect(card(page).getByTestId('birthday-row-ring')).toHaveCount(1);
  });

  test('AC-09: 소속 탭 필터 — 산스·웨이크·산스파운드리 · 소속 없음은 전체에만 · 탭별 가운데 줄', async ({
    page,
    request
  }) => {
    const data = await getCelebrants(request);
    await openOverview(page);

    await selectTab(page, '산스');
    const sans = data.celebrants.filter((celebrant) => celebrant.affiliation === 'sans');
    const sansAttrs = await rowAttributes(page);
    expect(sansAttrs).toHaveLength(sans.length);
    expect(sansAttrs.every((attr) => attr.affiliation === 'sans')).toBe(true);
    await expect(rowByName(page, seeds.plus2.fullName)).toHaveCount(1);
    await expect(rowByName(page, seeds.minus3.fullName)).toHaveCount(0);
    await expect(rowByName(page, seeds.today.fullName)).toHaveCount(0);
    await expect(rowByName(page, seeds.noaff.fullName)).toHaveCount(0);
    expect(await centerUserId(page)).toBe(centerCelebrant(sans)!.user_id);
    expect(await centerOffsetPx(page)).toBeLessThanOrEqual(8);

    await selectTab(page, '웨이크');
    const wake = data.celebrants.filter((celebrant) => celebrant.affiliation === 'wake');
    expect((await rowAttributes(page)).every((attr) => attr.affiliation === 'wake')).toBe(true);
    await expect(rows(page)).toHaveCount(wake.length);
    await expect(rowByName(page, seeds.minus3.fullName)).toHaveCount(1);
    await expect(rowByName(page, seeds.noaff.fullName)).toHaveCount(0);
    expect(await centerUserId(page)).toBe(centerCelebrant(wake)!.user_id);

    await selectTab(page, '산스파운드리');
    const foundry = data.celebrants.filter((celebrant) => celebrant.affiliation === 'sans_foundry');
    expect((await rowAttributes(page)).every((attr) => attr.affiliation === 'sans_foundry')).toBe(true);
    await expect(rows(page)).toHaveCount(foundry.length);
    await expect(rowByName(page, seeds.today.fullName)).toHaveCount(1);
    await expect(rowByName(page, seeds.noaff.fullName)).toHaveCount(0);
    expect(await centerUserId(page)).toBe(centerCelebrant(foundry)!.user_id);

    await selectTab(page, '전체');
    await expect(rowByName(page, seeds.noaff.fullName)).toHaveCount(1);
    await expect(rows(page)).toHaveCount(data.celebrants.length);
    expect(await centerUserId(page)).toBe(centerCelebrant(data.celebrants)!.user_id);
  });

  test('AC-10: 「전체」 탭만 소속 칩(소속 없음 제외) · 「웨이크」 탭 소속 칩 0개', async ({ page }) => {
    await openOverview(page);

    const attrs = await rowAttributes(page);
    const chipTexts = await rows(page).evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.querySelector('[data-testid="birthday-row-affiliation"]')?.textContent?.trim() ?? null
      )
    );
    attrs.forEach((attr, index) => {
      if (attr.affiliation === 'none') {
        expect(chipTexts[index], `${attr.userId} 소속 없음 → 칩 없음`).toBeNull();
      } else {
        expect(chipTexts[index], attr.userId).toBe(
          AFFILIATION_LABEL[attr.affiliation as keyof typeof AFFILIATION_LABEL]
        );
      }
    });
    await expect(rowByName(page, seeds.noaff.fullName).getByTestId('birthday-row-affiliation')).toHaveCount(0);
    await expect(rowByName(page, seeds.today.fullName).getByTestId('birthday-row-affiliation')).toHaveText('산스파운드리');

    await selectTab(page, '웨이크');
    await expect(card(page).getByTestId('birthday-row-affiliation')).toHaveCount(0);
  });

  test('AC-11: ① 한 줄 스크롤 → 다음 사람 가운데 ② 줄 클릭 → 1초 안 가운데 ③ 포커스 + Enter → 가운데 · 페이지 이동·Dialog 없음', async ({
    page
  }) => {
    await openOverview(page);
    const startUrl = page.url();
    const total = await rows(page).count();
    const start = await centerIndex(page);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(total, '아래로 한 줄 이동할 여유').toBeGreaterThan(start + 2);

    // ① 목록을 한 줄(64px) 아래로 스크롤
    await wheel(page).evaluate((element, delta) => element.scrollBy({ top: delta }), ROW_HEIGHT);
    await expect.poll(() => centerIndex(page), { timeout: 3_000 }).toBe(start + 1);
    await expect.poll(() => wheelScrollTop(page), { timeout: 3_000 }).toBe((start + 1) * ROW_HEIGHT);

    // ② 가운데가 아닌 줄(한 줄 아래) 클릭 → 최대 1초 안에 가운데
    const clickTarget = start + 2;
    const clickedUserId = await rows(page).nth(clickTarget).getAttribute('data-user-id');
    await rows(page).nth(clickTarget).click();
    await expect.poll(() => centerUserId(page), { timeout: 1_000 }).toBe(clickedUserId);
    await expect.poll(() => wheelScrollTop(page), { timeout: 3_000 }).toBe(clickTarget * ROW_HEIGHT);
    expect(await centerOffsetPx(page)).toBeLessThanOrEqual(8);

    // ③ 다른 줄(위 한 줄)에 포커스 후 Enter
    const enterTarget = clickTarget - 1;
    const enterUserId = await rows(page).nth(enterTarget).getAttribute('data-user-id');
    await rows(page).nth(enterTarget).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => centerUserId(page), { timeout: 1_000 }).toBe(enterUserId);
    await expect.poll(() => wheelScrollTop(page), { timeout: 3_000 }).toBe(enterTarget * ROW_HEIGHT);

    expect(page.url()).toBe(startUrl);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('AC-12: 오늘 생일 — 배지 「D-DAY!」 · 헤더 「오늘은 …생일이에요!」 · 줄 칩 D-DAY · 부제 · aria-label', async ({
    page
  }) => {
    await openOverview(page);
    await expect(card(page)).toHaveAttribute('aria-label', '오늘 생일 축하');
    await expect(card(page).getByTestId('birthday-header-badge')).toHaveText('D-DAY!');
    const headline = (await card(page).getByTestId('birthday-header-meta').textContent())?.trim() ?? '';
    expect(headline.startsWith('오늘은 '), headline).toBe(true);
    expect(headline.endsWith('생일이에요!'), headline).toBe(true);

    const todayRow = rowByName(page, seeds.today.fullName);
    await expect(todayRow.getByTestId('birthday-row-chip')).toHaveText('D-DAY');
    await expect(todayRow).toContainText(`${monthDayLabel(referenceDate)} · 팀원들이 함께 축하합니다.`);
    await expect(todayRow).toHaveAttribute('data-days-offset', '0');
  });

  test('AC-13: 새 context(빈 localStorage) 첫 진입 → 컨페티 발사 · 저장 키 \'1\' · canvas 존재', async ({ browser }) => {
    const context = await newAdminContext(browser);
    try {
      const page = await context.newPage();
      await openOverview(page);
      await expect(card(page)).toHaveAttribute('data-confetti-fired', 'true', { timeout: 15_000 });
      expect(await confettiStorageValue(page, referenceDate)).toBe('1');
      await expect(card(page).getByTestId('birthday-confetti-canvas')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('AC-14: 같은 context 새로고침 · 다른 메뉴 → overview 재진입 → 두 번 모두 컨페티 없음 · 「D-DAY!」 유지', async ({
    browser
  }) => {
    const context = await newAdminContext(browser);
    try {
      const page = await context.newPage();
      // AC-13 상태 재현(첫 진입 발사)
      await openOverview(page);
      await expect(card(page)).toHaveAttribute('data-confetti-fired', 'true', { timeout: 15_000 });

      // ① 새로고침
      await page.reload();
      await waitWheelReady(page);
      // hydration 후 움직임 설정 반영(Lottie 렌더)까지 기다린 뒤 판정
      await expect(card(page).getByTestId('birthday-dday-lottie').first()).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1_000);
      await expect(card(page)).toHaveAttribute('data-confetti-fired', 'false');
      await expect(card(page).getByTestId('birthday-header-badge')).toHaveText('D-DAY!');

      // ② 다른 메뉴 → overview 재진입 (사이드바 링크 · 클라이언트 이동)
      await page.getByRole('link', { name: '공지사항' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/announcements/, { timeout: 30_000 });
      await page.getByRole('link', { name: '대시보드' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/overview/, { timeout: 30_000 });
      await waitWheelReady(page);
      await expect(card(page).getByTestId('birthday-dday-lottie').first()).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1_000);
      await expect(card(page)).toHaveAttribute('data-confetti-fired', 'false');
      await expect(card(page).getByTestId('birthday-header-badge')).toHaveText('D-DAY!');
      expect(await confettiStorageValue(page, referenceDate)).toBe('1');
    } finally {
      await context.close();
    }
  });

  test('AC-16: reducedMotion reduce · 빈 localStorage → 컨페티 없음 · 저장 키 없음 · Lottie 0개 · 줄 클릭 즉시 이동', async ({
    browser
  }) => {
    const context = await newAdminContext(browser, { reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await openOverview(page);
      await page.waitForTimeout(1_500);
      await expect(card(page)).toHaveAttribute('data-confetti-fired', 'false');
      expect(await confettiStorageValue(page, referenceDate)).toBeNull();
      await expect(card(page).getByTestId('birthday-dday-lottie')).toHaveCount(0);
      // 링은 회전 없이 고정 테두리로 표시
      await expect(card(page).getByTestId('birthday-row-ring')).toHaveCount(1);

      const start = await centerIndex(page);
      const target = start + 1;
      const targetUserId = await rows(page).nth(target).getAttribute('data-user-id');
      await rows(page).nth(target).click();
      // 부드러운 스크롤 없이 즉시 index × 64
      expect(await wheelScrollTop(page)).toBe(target * ROW_HEIGHT);
      await expect.poll(() => centerUserId(page), { timeout: 500 }).toBe(targetUserId);
      expect(await confettiStorageValue(page, referenceDate)).toBeNull();
    } finally {
      await context.close();
    }
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 }
  ]) {
    test(`AC-17: ${viewport.width}×${viewport.height} 카드 높이 414±12 · 아래 카드와 너비 ±2 · 글자 넘침 없음 · 가로 스크롤 없음`, async ({
      page
    }) => {
      await page.setViewportSize(viewport);
      await openOverview(page);

      const cardBox = (await card(page).boundingBox())!;
      expect(Math.abs(cardBox.height - 414), `높이 ${cardBox.height}`).toBeLessThanOrEqual(12);

      const announcements = page.getByTestId('announcements-overview-card');
      const below =
        (await announcements.count()) > 0 ? announcements.first() : page.getByLabel('이번 달 식대 잔액', { exact: true }).first();
      const belowBox = (await below.boundingBox())!;
      expect(Math.abs(belowBox.width - cardBox.width), `너비 ${cardBox.width} vs ${belowBox.width}`).toBeLessThanOrEqual(2);

      const overflow = await card(page).evaluate((element) => {
        const offenders: string[] = [];
        if (element.scrollWidth > element.clientWidth) offenders.push(`card ${element.scrollWidth}>${element.clientWidth}`);
        element.querySelectorAll('[data-testid="birthday-row"], [data-testid="birthday-header-meta"]').forEach((node) => {
          const el = node as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 1) offenders.push(`${el.dataset.testid} ${el.scrollWidth}>${el.clientWidth}`);
        });
        return offenders;
      });
      expect(overflow).toEqual([]);

      const pageOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth);
    });
  }

  test('AC-18: user · 390×844 — 카드 화면 안 · 높이 414±12 · 탭 4개 카드 안 · 탭 가로 스크롤 없음 · 휠 스크롤로 가운데 변경 · 페이지 가로 스크롤 없음', async ({
    browser
  }) => {
    const context = await browser.newContext({
      baseURL: e2eBaseURL,
      storageState: USER_STORAGE,
      viewport: { width: 390, height: 844 }
    });
    try {
      const page = await context.newPage();
      await openOverview(page);
      await card(page).scrollIntoViewIfNeeded();

      const cardBox = (await card(page).boundingBox())!;
      expect(cardBox.x).toBeGreaterThanOrEqual(0);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
      expect(Math.abs(cardBox.height - 414), `높이 ${cardBox.height}`).toBeLessThanOrEqual(12);

      const tabs = card(page).getByRole('tab');
      await expect(tabs).toHaveCount(4);
      for (let index = 0; index < 4; index += 1) {
        const tab = tabs.nth(index);
        await expect(tab).toBeVisible();
        const box = (await tab.boundingBox())!;
        expect(box.x, `탭 ${index} 왼쪽`).toBeGreaterThanOrEqual(cardBox.x);
        expect(box.x + box.width, `탭 ${index} 오른쪽`).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      }
      const tabList = card(page).getByTestId('birthday-tabs');
      const tabScroll = await tabList.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
      expect(tabScroll.scrollWidth).toBeLessThanOrEqual(tabScroll.clientWidth);

      // 손가락(휠) 스크롤 → 가운데 줄 변경
      const before = await centerUserId(page);
      const total = await rows(page).count();
      const startIndex = await centerIndex(page);
      const direction = startIndex < total - 1 ? 1 : -1;
      const wheelBox = (await wheel(page).boundingBox())!;
      await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
      await page.mouse.wheel(0, direction * ROW_HEIGHT * 2);
      await expect.poll(() => centerUserId(page), { timeout: 5_000 }).not.toBe(before);

      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageWidth).toBeLessThanOrEqual(390);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3) 정적 확인 (AC-20)
// ---------------------------------------------------------------------------

test.describe('plan 102 생일 휠 — 정적(AC-20)', () => {
  const ROOT = process.cwd();
  const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

  function listFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full) : [full];
    });
  }

  test('AC-20: Skeleton fallback · applyDongbangScope · embla/Carousel/sessionStorage 0건 · this-month 없음 · 의존성 제거 · 빈 상태 분기', async () => {
    // ① overview 생일 Suspense fallback = Skeleton 기반 BirthdayCelebrantsBannerSkeleton (Spinner 아님 · plan 26)
    const layout = read('src/app/dashboard/overview/layout.tsx');
    expect(layout).toMatch(/<Suspense fallback=\{<BirthdayCelebrantsBannerSkeleton \/>\}>\s*<BirthdayCelebrantsSection \/>/);
    const skeleton = read('src/features/birthday-celebrants/components/birthday-celebrants-banner-skeleton.tsx');
    expect(skeleton).toContain("data-testid='birthday-celebrants-skeleton'");
    expect(skeleton).toMatch(/from '@\/components\/ui\/skeleton'/);
    expect(skeleton).not.toMatch(/Spinner|PageLoadingSpinner/);

    // ② service.server.ts가 동방 제외 — plan 95 `applyDongbangScope` 또는 반영 전 직접 필터 (plan 102 r3 · 커밋 분리)
    expect(read('src/features/birthday-celebrants/api/service.server.ts')).toMatch(
      /applyDongbangScope\(|\.or\(EXCLUDE_DONGBANG_OR_FILTER\)/
    );

    // ③ 기능 폴더에 embla·Carousel·sessionStorage 0건
    const featureFiles = listFiles(path.join(ROOT, 'src/features/birthday-celebrants'));
    const hits = featureFiles.flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return ['embla', 'Carousel', 'sessionStorage']
        .filter((needle) => text.includes(needle))
        .map((needle) => `${path.relative(ROOT, file)}: ${needle}`);
    });
    expect(hits).toEqual([]);

    // ④ 옛 Route 디렉터리 없음
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/birthdays/this-month'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/birthdays/route.ts'))).toBe(true);

    // ⑤ package.json 의존성 제거
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('embla-carousel-auto-height');

    // ⑥ 회사 전체 0명 → 섹션 null · 탭 0명 → 빈 문구 분기
    const section = read('src/features/birthday-celebrants/components/birthday-celebrants-section.tsx');
    expect(section).toMatch(/celebrants\.length === 0\)\s*\{\s*return null;/);
    const wheelCard = read('src/features/birthday-celebrants/components/birthday-celebrants-wheel-card.tsx');
    expect(wheelCard).toContain('생일이 등록된 사람이 없어요.');
    expect(wheelCard).toContain("data-testid='birthday-wheel-empty'");
  });
});
