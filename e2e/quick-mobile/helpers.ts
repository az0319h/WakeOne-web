import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { AUTH, BASE_URL, type AccountKey } from '../quick-workflow/helpers';
import { waitForOrderPageHydrated } from '../quick-request/helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

export { hideDevOverlays };

/**
 * plan 106 — 퀵 휴대폰 화면 구조 개편 e2e 공용 (docs/plans/106_quick-mobile-restructure-plan.md)
 * - 뷰포트 프리셋: M360 · M375 · M430 · T768(휴대폰 규칙 · isMobile+hasTouch) / D1024 · D1280(PC 회귀)
 * - 44px 스캔(AC-09 공통 정의) · 가로 스크롤 0 · dev 오버레이 숨김 · AI 추천 호출 차단
 * - 데이터 표식은 quick-workflow `buildCreateBody`(담당자 `E2E …`) → scripts/cleanup-e2e-mock-data.mjs가 지운다
 */

export type ViewportName = 'M360' | 'M375' | 'M430' | 'T768' | 'D1024' | 'D1280';

export const VIEWPORTS: Record<ViewportName, { width: number; height: number; mobile: boolean }> = {
  M360: { width: 360, height: 780, mobile: true },
  M375: { width: 375, height: 812, mobile: true },
  M430: { width: 430, height: 932, mobile: true },
  T768: { width: 768, height: 1024, mobile: true },
  D1024: { width: 1024, height: 768, mobile: false },
  D1280: { width: 1280, height: 800, mobile: false }
};

export const MOBILE_VIEWPORTS: ViewportName[] = ['M360', 'M375', 'M430', 'T768'];

export const TEXT = {
  back: '뒤로',
  infoButton: '퀵 권한 안내 보기',
  infoTitle: '퀵 권한 안내',
  tabbar: '퀵 메뉴',
  tabList: '내역',
  tabChat: '대화',
  tabRequest: '요청하기',
  listEnd: '더 이상 요청이 없습니다',
  footnote: '운송 완료 후 실제 금액을 확인하고 승인해주세요.',
  originPast: '픽업 일시는 현재 이후로 선택해 주세요.',
  destinationPast: '도착 희망 일시는 현재 이후로 선택해 주세요.',
  destinationBeforeOrigin: '도착 희망 일시는 픽업 일시 이후로 선택해 주세요.',
  manualAddress: '주소 직접 입력',
  cancelTitle: '퀵 요청을 취소할까요?'
} as const;

export const SCREEN_NAME = {
  list: '퀵 내역',
  request: '퀵 요청',
  chat: '퀵 대화',
  detail: (no: string) => `퀵 ${no}`
} as const;

export type OpenOptions = {
  /** T768 등 — 쿠키 `sidebar_state` (true = 사이드바 펼침) */
  sidebarOpen?: boolean;
  /** 테마 프리셋 이름 (THEMES) — 첫 로드 전에 쿠키·localStorage로 적용 */
  theme?: string;
  /** 대화 AI 추천(`…/messages/suggest`) 차단 — 기본 true (실제 AI 호출 금지) */
  blockAiSuggest?: boolean;
};

/** 실제 AI 추천 호출 차단 — 503 → 규칙 칩(fallback · 토스트 0) */
export async function blockAiSuggest(target: BrowserContext | Page) {
  await target.route('**/api/quick-request/*/messages/suggest', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'e2e: AI suggest blocked' })
    })
  );
}

export async function openAs(
  browser: Browser,
  account: AccountKey,
  viewportName: ViewportName,
  options: OpenOptions = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const vp = VIEWPORTS[viewportName];
  const context = await browser.newContext({
    storageState: AUTH[account],
    baseURL: BASE_URL,
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile
  });
  const host = new URL(BASE_URL).hostname;
  if (options.sidebarOpen !== undefined) {
    await context.addCookies([
      { name: 'sidebar_state', value: String(options.sidebarOpen), domain: host, path: '/' }
    ]);
  }
  if (options.theme) {
    // quick-request `applyThemeBeforeNavigation`과 같은 방식 (cookie `active_theme` + next-themes `theme`=light)
    await context.addCookies([{ name: 'active_theme', value: options.theme, domain: host, path: '/' }]);
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('theme', 'light');
      } catch {
        // storage 차단 환경 무시
      }
    });
  }
  await hideDevOverlays(context);
  if (options.blockAiSuggest !== false) {
    await blockAiSuggest(context);
  }
  const page = await context.newPage();
  return { context, page };
}

/** 계정·뷰포트로 열고 fn 실행 후 닫는다 */
export async function withPage<T>(
  browser: Browser,
  account: AccountKey,
  viewportName: ViewportName,
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  options: OpenOptions = {}
): Promise<T> {
  const { context, page } = await openAs(browser, account, viewportName, options);
  try {
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// 이동
// ---------------------------------------------------------------------------

export async function gotoList(page: Page, query = '') {
  await page.goto(`/dashboard/quick${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
  // 본문(카드·표·빈 상태)은 hydration 뒤에만 그린다 → 필터 버튼·칩 탭이 hydration 전에 무시되지 않게 기다린다
  await expect(
    page
      .getByTestId('quick-dashboard-cards')
      .or(page.getByTestId('quick-dashboard-table'))
      .or(page.getByTestId('quick-dashboard-empty'))
      .first()
  ).toBeVisible({ timeout: 30_000 });
}

export async function gotoRequestForm(page: Page) {
  await page.goto('/dashboard/quick/request', { waitUntil: 'domcontentloaded' });
  // 스트리밍 중엔 숨은 사본(hidden 템플릿)이 잠깐 같이 있다 → main 안의 것만 본다(quick-request helpers와 같음)
  const main = page.getByRole('main');
  await expect(main.getByTestId('quick-request-order-page')).toBeVisible({ timeout: 30_000 });
  await expect(main.getByTestId('quick-request-origin-road-address')).toBeVisible({ timeout: 30_000 });
  await waitForOrderPageHydrated(page);
}

export async function gotoChatList(page: Page, query = '') {
  await page.goto(`/dashboard/quick/chat${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
}

export async function gotoChatRoom(page: Page, requestNo: string) {
  await page.goto(`/dashboard/quick/chat?request=${encodeURIComponent(requestNo)}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
}

export async function gotoDetail(page: Page, requestNo: string, query = '') {
  await page.goto(`/dashboard/quick/${requestNo}${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
  // 휴대폰 트리(`quick-detail-mobile`)는 useMatchMedia라 hydration 뒤에만 생긴다 → hydration 완료 신호로 쓴다
  if ((page.viewportSize()?.width ?? 1280) < 1024 && !query.includes('chat=1')) {
    await expect(page.getByTestId('quick-detail-mobile')).toBeVisible({ timeout: 30_000 });
  }
}

// ---------------------------------------------------------------------------
// 판정
// ---------------------------------------------------------------------------

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
}

/** 「가로 스크롤 없음」 = documentElement.scrollWidth <= clientWidth (plan 공통) */
export async function expectNoHorizontalScroll(page: Page, label = '') {
  const { scrollWidth, clientWidth } = await horizontalOverflow(page);
  expect(scrollWidth, `${label} 가로 스크롤: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth
  );
}

export async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect, 'boundingBox').not.toBeNull();
  return rect!;
}

export async function expectMinSize(locator: Locator, min = 44, label = '') {
  const rect = await box(locator);
  expect(rect.width, `${label} width ${rect.width} >= ${min}`).toBeGreaterThanOrEqual(min - 0.5);
  expect(rect.height, `${label} height ${rect.height} >= ${min}`).toBeGreaterThanOrEqual(min - 0.5);
  return rect;
}

export type TouchTargetIssue = { desc: string; width: number; height: number };

/**
 * AC-09 「44px 스캔」 — 보이는 button · a[href] · role=button/tab/menuitem/option/radio(label 기준) · input · textarea · combobox.
 * 제외: dev 오버레이 · 토스트 · aria-hidden 안 · sr-only(폭 ≤ 1px) · inert.
 */
/** 열림 애니메이션(zoom-in 95% · slide)이 끝날 때까지 — 크기 측정 전에 부른다 */
export async function settleAnimations(page: Page) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .every((animation) => animation.playState !== 'running'),
      undefined,
      { timeout: 5_000 }
    )
    .catch(() => undefined);
}

export async function scanTouchTargets(page: Page, min = 44): Promise<TouchTargetIssue[]> {
  await settleAnimations(page);
  return page.evaluate((minSize) => {
    const selector = [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="radio"]',
      'input:not([type="hidden"])',
      'textarea',
      '[role="combobox"]'
    ].join(',');
    const issues: { desc: string; width: number; height: number }[] = [];
    const seen = new Set<Element>();
    for (const element of Array.from(document.querySelectorAll(selector))) {
      if (
        element.closest(
          '[aria-hidden="true"], [data-sonner-toaster], [data-sonner-toast], .tsqd-parent-container, nextjs-portal, .sr-only, [inert]'
        )
      ) {
        continue;
      }
      let target: Element = element;
      const role = element.getAttribute('role');
      const type = (element.getAttribute('type') ?? '').toLowerCase();
      const isRadioLike =
        role === 'radio' || (element.tagName === 'INPUT' && (type === 'radio' || type === 'checkbox'));
      if (isRadioLike) {
        const id = element.getAttribute('id');
        const label =
          element.closest('label') ?? (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null);
        if (label) target = label;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      const style = window.getComputedStyle(target);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      if (rect.width + 0.5 >= minSize && rect.height + 0.5 >= minSize) continue;
      const testId =
        target.getAttribute('data-testid') ?? element.getAttribute('data-testid') ?? element.closest('[data-testid]')?.getAttribute('data-testid');
      const name =
        element.getAttribute('aria-label') ??
        (element as HTMLElement).innerText?.trim().slice(0, 30) ??
        element.getAttribute('placeholder') ??
        '';
      issues.push({
        desc: `${element.tagName.toLowerCase()}${role ? `[role=${role}]` : ''} testid=${testId ?? '-'} name=${name}`,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10
      });
    }
    return issues;
  }, min);
}

export async function expectAllTouchTargets(page: Page, label: string) {
  const issues = await scanTouchTargets(page);
  expect(issues, `${label} — 44px 미달 요소:\n${issues.map((i) => `${i.desc} (${i.width}×${i.height})`).join('\n')}`).toEqual(
    []
  );
}

/** 탭 바 위로 완전히 보이는 요소 수 (top >= minTop · bottom <= 탭 바 top) */
export async function countFullyVisibleAbove(items: Locator, limitTop: number, minTop = 0) {
  const count = await items.count();
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    const rect = await items.nth(i).boundingBox();
    if (!rect) continue;
    if (rect.y >= minTop - 0.5 && rect.y + rect.height <= limitTop + 0.5) visible += 1;
  }
  return visible;
}

/** 대화 응답 POST …/messages 수집 */
export function collectMessagePosts(page: Page) {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/quick-request\/[^/]+\/messages$/.test(new URL(request.url()).pathname)) {
      posts.push(request.url());
    }
  });
  return posts;
}

/** KST 기준 로컬 datetime-local 값 `yyyy-MM-ddTHH:mm` (offsetMinutes 뒤) — 브라우저 TZ가 Asia/Seoul 가정 */
export function localDatetimeValue(offsetMinutes: number, base = Date.now()): string {
  const date = new Date(base + offsetMinutes * 60_000);
  const kst = new Date(date.getTime() + 9 * 3_600_000);
  return kst.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// AC-09 · AC-10 — 4화면 + 열린 상태 순회
// ---------------------------------------------------------------------------

export type WalkTarget = {
  /** 상세·대화방·상세 대화를 열 요청번호 (해당 계정이 볼 수 있는 건) */
  requestNo: string;
  /** 요청 폼을 열 수 있는 계정인가 (동방특송 false) */
  canCreate: boolean;
  /** 상세 「⋯」가 있는 건인가 */
  hasDetailMore: boolean;
  /** 내역 검색어(카드 수를 줄여 순회를 빠르게) */
  listQuery?: string;
};

export type WalkCheck = (label: string) => Promise<void>;

async function closeOverlay(page: Page, gone: Locator) {
  await page.keyboard.press('Escape');
  await expect(gone).toBeHidden({ timeout: 10_000 });
}

/**
 * 4화면(내역·요청 폼·대화 목록/대화방·상세/상세 대화) + 열린 상태(필터 판 · 주소 검색 · 대화 「⋯」 · 참여자 Drawer · 상세 「⋯」)
 * 를 차례로 열고 매 상태에서 check(label)를 부른다.
 */
export async function walkQuickScreens(page: Page, target: WalkTarget, check: WalkCheck) {
  // 내역
  await gotoList(page, target.listQuery ?? '');
  await expect(page.getByTestId('quick-dashboard-cards').or(page.getByTestId('quick-dashboard-empty'))).toBeVisible({
    timeout: 30_000
  });
  await check('내역');
  await page.getByTestId('quick-dashboard-filter-button').click();
  const filterSheet = page.getByTestId('quick-dashboard-filter-sheet');
  await expect(filterSheet).toBeVisible();
  await page.waitForTimeout(400);
  await check('내역 · 필터 판');
  await page.getByTestId('quick-dashboard-filter-close').click();
  await expect(filterSheet).toBeHidden({ timeout: 10_000 });

  // 요청 폼
  if (target.canCreate) {
    await gotoRequestForm(page);
    await check('요청 폼');
    const road = page.getByTestId('quick-request-origin-road-address');
    await road.click();
    const picker = page.getByTestId('quick-request-address-picker');
    await expect(picker).toBeVisible();
    await page.waitForTimeout(400);
    await check('요청 폼 · 주소 검색');
    await closeOverlay(page, picker);
  }

  // 대화 목록 · 대화방
  await gotoChatList(page);
  await expect(page.getByTestId('quick-chat-list')).toBeVisible({ timeout: 30_000 });
  await check('대화 목록');
  await gotoChatRoom(page, target.requestNo);
  await expect(page.getByTestId('quick-chat-input').or(page.getByTestId('quick-chat-read-only'))).toBeVisible({
    timeout: 30_000
  });
  await check('대화방');
  await page.getByTestId('quick-chat-more').click();
  const chatMenu = page.getByTestId('quick-chat-more-menu');
  await expect(chatMenu).toBeVisible();
  await check('대화방 · ⋯');
  await page.getByTestId('quick-chat-more-participants').click();
  const drawer = page.getByTestId('quick-chat-participants-drawer');
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(400);
  await check('대화방 · 참여자 Drawer');
  await closeOverlay(page, drawer);

  // 상세 · 상세 대화
  await gotoDetail(page, target.requestNo);
  await expect(page.getByTestId('quick-detail-mobile')).toBeVisible({ timeout: 30_000 });
  await check('상세');
  if (target.hasDetailMore) {
    await page.getByTestId('quick-detail-more').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await check('상세 · ⋯');
    await closeOverlay(page, page.getByRole('menu'));
  }
  await gotoDetail(page, target.requestNo, '?chat=1');
  await expect(page.getByTestId('quick-detail-chat')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
  await check('상세 대화');
}

/**
 * hydration 전 클릭은 무시될 수 있다(SSR 버튼) — URL이 바뀔 때까지 다시 누른다.
 * 같은 화면에 그대로 있을 때만 다시 누르므로 이중 이동은 없다.
 */
export async function clickUntilUrl(page: Page, locator: Locator, url: RegExp, timeout = 30_000) {
  const before = page.url();
  await expect(async () => {
    if (page.url() === before) {
      await locator.click({ timeout: 5_000 });
    }
    await expect(page).toHaveURL(url, { timeout: 4_000 });
  }).toPass({ timeout });
}
