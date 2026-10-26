import { expect, test, type Browser } from '@playwright/test';
import { DEFAULT_THEME } from '../../src/components/themes/theme.config';
import { setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  applyThemeBeforeNavigation,
  expectThemeApplied,
  type ColorMode
} from '../quick-request/helpers';
import {
  createAs,
  gotoDashboard,
  gotoDetail,
  pageAs,
  uniqueTag,
  type AccountKey
} from '../quick-workflow/helpers';
import {
  attachScreenshot,
  boxesOverlap,
  desktopPanel,
  expectPanelMatches,
  infoButton,
  mobilePanel,
  openDesktopPanel,
  openMobilePanel,
  pageHeading,
  panelBodyText,
  panelTitle,
  QUICK_INFO,
  readSectionChildOrder,
  readSections,
  VIEWPORT_DESKTOP_1280,
  VIEWPORT_MOBILE_390
} from './helpers';

// plan 90 — 퀵 권한 안내 ⓘ 패널 (docs/plans/90_quick-dashboard-permission-info-plan.md AC-01~11)

const DASHBOARD_TITLE: Record<AccountKey, string> = {
  admin: '퀵 내역',
  logistics: '퀵 내역',
  dongbang: '퀵 내역',
  user: '나의 퀵 내역',
  user2: '나의 퀵 내역'
};

/** 계정으로 퀵 대시보드 → ⓘ → 패널 본문 innerText */
async function dashboardPanelText(browser: Browser, account: AccountKey) {
  const { context, page } = await pageAs(browser, account, { viewport: VIEWPORT_DESKTOP_1280 });
  try {
    await gotoDashboard(page);
    await expect(pageHeading(page, DASHBOARD_TITLE[account])).toBeVisible();
    const panel = await openDesktopPanel(page);
    await expect(panelTitle(panel)).toHaveText(QUICK_INFO.title);
    return await panelBodyText(panel);
  } finally {
    await context.close();
  }
}

test.describe('plan 90 퀵 권한 안내 ⓘ 패널', () => {
  test.describe.configure({ timeout: 120_000 });

  let adminText = '';
  let requestNo = '';

  test.beforeAll(async ({ browser }) => {
    await setOpenchatMockMode('ok').catch(() => undefined);
    adminText = await dashboardPanelText(browser, 'admin');
    const created = await createAs('user', uniqueTag('E2E90'));
    requestNo = created.requestNo;
  });

  test('AC-01: admin 1280 · 「퀵 내역」 옆 ⓘ → 패널 제목 「퀵 권한 안내」 · 섹션 제목 7개 Q-1~Q-7 순서', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDashboard(page);
      const heading = pageHeading(page, '퀵 내역');
      await expect(heading).toBeVisible();
      // ⓘ는 제목 「퀵 내역」 옆(같은 줄)에 있다
      const headingBox = await heading.boundingBox();
      const buttonBox = await infoButton(page).boundingBox();
      expect(headingBox && buttonBox).toBeTruthy();
      expect(buttonBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width - 1);
      expect(Math.abs(buttonBox!.y + buttonBox!.height / 2 - (headingBox!.y + headingBox!.height / 2))).toBeLessThan(
        headingBox!.height
      );

      const panel = await openDesktopPanel(page);
      await expect(panel).toBeVisible();
      await expect(panelTitle(panel)).toHaveText('퀵 권한 안내');
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(
        QUICK_INFO.sections.map((section) => section.title)
      );
      // 전체 문구가 §문구 초안 Q와 글자 단위로 일치
      await expectPanelMatches(panel, QUICK_INFO);
      // 렌더 순서: 제목 → 설명 → 목록 → 강조 상자
      const order = await readSectionChildOrder(panel);
      expect(order[0]).toEqual(['h3', 'p', 'info-section-list']);
      expect(order[1]).toEqual(['h3', 'p', 'info-section-callout']);
      expect(order[3]).toEqual(['h3', 'info-section-list']);
      expect(order[6]).toEqual(['h3', 'p']);
    } finally {
      await context.close();
    }
  });

  test('AC-02: user 「나의 퀵 내역」 옆 ⓘ → 패널 본문 innerText가 admin과 완전히 같음 · 「내 권한」 0건', async ({
    browser
  }) => {
    const userText = await dashboardPanelText(browser, 'user');
    expect(userText).toBe(adminText);
    expect(userText).not.toContain('내 권한');
  });

  test('AC-03: 구매물류팀·동방특송 각각 패널 본문 = admin (D-1)', async ({ browser }) => {
    const logisticsText = await dashboardPanelText(browser, 'logistics');
    expect(logisticsText).toBe(adminText);
    const dongbangText = await dashboardPanelText(browser, 'dongbang');
    expect(dongbangText).toBe(adminText);
  });

  test('AC-04: 동방특송 패널 a[href] 0개 · 「Learn more」 0건 · 「Documentation」 0건 (D-7)', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDashboard(page);
      const panel = await openDesktopPanel(page);
      await expect(panelTitle(panel)).toHaveText(QUICK_INFO.title);
      await expect(panel.locator('a[href]')).toHaveCount(0);
      await expect(panel.getByText('Learn more')).toHaveCount(0);
      await expect(panel.getByText('Documentation')).toHaveCount(0);
      await expect(page.getByText('Documentation')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-05: admin Q-1 목록 li 4개(문구 그대로) · Q-2 강조 상자 1개(문구 그대로)', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDashboard(page);
      const panel = await openDesktopPanel(page);
      const section = (title: string) =>
        panel
          .locator("[data-slot='info-section']")
          .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

      const q1 = section(QUICK_INFO.sections[0].title);
      await expect(q1).toHaveCount(1);
      const q1Items = q1.locator("[data-slot='info-section-list'] li");
      await expect(q1Items).toHaveCount(4);
      await expect(q1Items).toHaveText(QUICK_INFO.sections[0].items!);

      const q2 = section(QUICK_INFO.sections[1].title);
      const callout = q2.locator("[data-slot='info-section-callout']");
      await expect(callout).toHaveCount(1);
      await expect(callout).toHaveAttribute('role', 'note');
      expect(await callout.innerText()).toBe(
        '「승인」 또는 「취소」가 된 요청은 관리자를 포함해 누구도 바꿀 수 없습니다.'
      );
      // 강조 상자는 Q-2 한 곳뿐
      await expect(panel.locator("[data-slot='info-section-callout']")).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('AC-06: user 본인 요청 상세 「퀵 요청 상세」 옆 ⓘ → 「퀵 권한 안내」 · 본문 = AC-01 (D-4)', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDetail(page, requestNo);
      await expect(pageHeading(page, '퀵 요청 상세')).toBeVisible();
      const panel = await openDesktopPanel(page);
      await expect(panelTitle(panel)).toHaveText('퀵 권한 안내');
      expect(await panelBodyText(panel)).toBe(adminText);
      await expectPanelMatches(panel, QUICK_INFO);
    } finally {
      await context.close();
    }
  });

  test('AC-07: 동방특송 같은 요청 상세 ⓘ → AC-06과 같은 내용 · a[href] 0개', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'dongbang', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDetail(page, requestNo);
      await expect(pageHeading(page, '퀵 요청 상세')).toBeVisible();
      const panel = await openDesktopPanel(page);
      await expect(panelTitle(panel)).toHaveText('퀵 권한 안내');
      expect(await panelBodyText(panel)).toBe(adminText);
      await expect(panel.locator('a[href]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-08: admin /dashboard/quick 직접 진입 직후(ⓘ 미클릭) Cmd/Ctrl+I → 「퀵 권한 안내」(「Documentation」 아님)', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await page.goto('/dashboard/quick', { waitUntil: 'domcontentloaded' });
      await expect(infoButton(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
      const panel = desktopPanel(page);
      await expect(panel).toHaveAttribute('data-state', 'collapsed');
      // hydration 전 키 입력은 무시될 수 있으므로 펼쳐질 때까지 재시도(토글이므로 펼쳐졌으면 다시 누르지 않음)
      await expect(async () => {
        if ((await panel.getAttribute('data-state')) !== 'expanded') {
          await page.keyboard.press('ControlOrMeta+i');
        }
        await expect(panel).toHaveAttribute('data-state', 'expanded', { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(panelTitle(panel)).toHaveText('퀵 권한 안내');
      await expect(panel.getByText('Documentation')).toHaveCount(0);
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(
        QUICK_INFO.sections.map((section) => section.title)
      );
    } finally {
      await context.close();
    }
  });

  test('AC-09: user /dashboard/quick/request 「🚚 퀵 배송 요청」 옆 ⓘ 0개 (D-4 Out)', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await page.goto('/dashboard/quick/request', { waitUntil: 'domcontentloaded' });
      await expect(pageHeading(page, '🚚 퀵 배송 요청')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-request-order-page')).toBeVisible({ timeout: 30_000 });
      await expect(infoButton(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-10: admin 모바일 390×844 대시보드 ⓘ → Sheet Q-1~Q-7 · 가로 넘침 없음 · ⓘ 44px 이상 · 닫기(X)', async ({
    browser
  }, testInfo) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_MOBILE_390 });
    try {
      await gotoDashboard(page);
      const heading = pageHeading(page, '퀵 내역');
      await expect(heading).toBeVisible();
      const button = infoButton(page);
      await expect(button).toBeVisible();
      const buttonBox = await button.boundingBox();
      expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
      // UI-1: ⓘ가 「퀵 요청하기」와 겹치지 않고 제목과 같은 줄에 있다
      const newButtonBox = await page.getByTestId('quick-request-new-button').boundingBox();
      expect(boxesOverlap(buttonBox!, newButtonBox!)).toBe(false);
      const headingBox = await heading.boundingBox();
      expect(buttonBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width - 1);
      expect(buttonBox!.y).toBeLessThan(headingBox!.y + headingBox!.height);

      const sheet = await openMobilePanel(page);
      await expect(panelTitle(sheet)).toHaveText(QUICK_INFO.title);
      const headings = sheet.getByRole('heading', { level: 3 });
      await expect(headings).toHaveText(QUICK_INFO.sections.map((section) => section.title));
      for (let index = 0; index < QUICK_INFO.sections.length; index += 1) {
        const sectionHeading = headings.nth(index);
        await sectionHeading.scrollIntoViewIfNeeded();
        await expect(sectionHeading).toBeInViewport();
      }
      expect(await readSections(sheet)).toHaveLength(7);
      await attachScreenshot(page, testInfo, 'ac10-mobile-sheet');

      const overflow = await sheet.evaluate((element) => {
        const scroller = element.querySelector("[data-slot='infobar-content']") as HTMLElement | null;
        return {
          sheet: { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth },
          content: scroller
            ? { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth }
            : null
        };
      });
      expect(overflow.sheet.scrollWidth).toBeLessThanOrEqual(overflow.sheet.clientWidth);
      expect(overflow.content).not.toBeNull();
      expect(overflow.content!.scrollWidth).toBeLessThanOrEqual(overflow.content!.clientWidth);

      await sheet.getByRole('button', { name: 'Close info panel' }).click();
      await expect(mobilePanel(page)).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('AC-10 (UI-1·R-3): 모바일 390 상세 — 「퀵 요청 상세」 + ⓘ(44px) + 「목록으로」 겹침 없음 · Sheet 열림', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_MOBILE_390 });
    try {
      await gotoDetail(page, requestNo);
      const heading = pageHeading(page, '퀵 요청 상세');
      await expect(heading).toBeVisible();
      const buttonBox = await infoButton(page).boundingBox();
      expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
      const backBox = await page.getByRole('link', { name: '목록으로' }).boundingBox();
      expect(boxesOverlap(buttonBox!, backBox!)).toBe(false);
      const headingBox = await heading.boundingBox();
      expect(buttonBox!.y).toBeLessThan(headingBox!.y + headingBox!.height);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

      const sheet = await openMobilePanel(page);
      await expect(panelTitle(sheet)).toHaveText(QUICK_INFO.title);
      await expect(sheet.getByRole('heading', { level: 3 })).toHaveCount(7);
    } finally {
      await context.close();
    }
  });

  test('UI-5 회귀: 데스크톱 1280 ⓘ 크기 36px 유지', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_DESKTOP_1280 });
    try {
      await gotoDashboard(page);
      const box = await infoButton(page).boundingBox();
      expect(Math.round(box!.width)).toBe(36);
      expect(Math.round(box!.height)).toBe(36);
    } finally {
      await context.close();
    }
  });

  const THEME_CASES: { theme: string; mode: ColorMode }[] = [
    { theme: DEFAULT_THEME, mode: 'dark' },
    { theme: 'neobrutualism', mode: 'light' },
    { theme: 'light-green', mode: 'dark' }
  ];

  for (const { theme, mode } of THEME_CASES) {
    test(`AC-11: admin ${theme} × ${mode} 패널 — 강조 상자·목록 글자가 배경과 구분 (스크린샷)`, async ({
      browser
    }, testInfo) => {
      const { context, page } = await pageAs(browser, 'admin', { viewport: VIEWPORT_DESKTOP_1280 });
      try {
        const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(
          '127.0.0.1',
          'localhost'
        );
        await applyThemeBeforeNavigation(page, baseURL, theme, mode);
        await gotoDashboard(page);
        await expectThemeApplied(page, theme, mode);
        const panel = await openDesktopPanel(page);
        const callout = panel.locator("[data-slot='info-section-callout']");
        await expect(callout).toBeVisible();
        await callout.scrollIntoViewIfNeeded();
        // 패널 슬라이드 전환(300ms)이 끝난 뒤 측정
        await expect(panel.locator("[data-slot='infobar-container']")).toHaveCSS('opacity', '1');

        const colors = await panel.evaluate((element) => {
          const inner = element.querySelector("[data-slot='infobar-inner']") as HTMLElement;
          const calloutEl = element.querySelector("[data-slot='info-section-callout']") as HTMLElement;
          const calloutText = calloutEl.querySelector('p') as HTMLElement;
          const li = element.querySelector("[data-slot='info-section-list'] li") as HTMLElement;
          const panelStyle = getComputedStyle(inner);
          const calloutStyle = getComputedStyle(calloutEl);
          return {
            panelBg: panelStyle.backgroundColor,
            calloutBg: calloutStyle.backgroundColor,
            calloutBorder: calloutStyle.borderTopColor,
            calloutBorderWidth: calloutStyle.borderTopWidth,
            calloutText: getComputedStyle(calloutText).color,
            listText: getComputedStyle(li).color,
            listStyle: getComputedStyle(li).listStyleType
          };
        });
        testInfo.annotations.push({ type: 'colors', description: JSON.stringify(colors) });
        await attachScreenshot(page, testInfo, `ac11-${theme}-${mode}`);
        const panelShot = testInfo.outputPath(`ac11-${theme}-${mode}-panel.png`);
        await panel.locator("[data-slot='infobar-inner']").screenshot({ path: panelShot });
        await testInfo.attach(`ac11-${theme}-${mode}-panel`, { path: panelShot, contentType: 'image/png' });

        // 강조 상자: 배경이 패널과 다르거나, 테두리가 패널 배경과 다른 색으로 보임
        const boxDistinct =
          colors.calloutBg !== colors.panelBg ||
          (colors.calloutBorder !== colors.panelBg && colors.calloutBorderWidth !== '0px');
        expect(boxDistinct, JSON.stringify(colors)).toBe(true);
        expect(colors.calloutBorderWidth).not.toBe('0px');
        // 글자색 ≠ 배경색
        expect(colors.calloutText).not.toBe(colors.calloutBg);
        expect(colors.listText).not.toBe(colors.panelBg);
        expect(colors.listStyle).toBe('disc');
      } finally {
        await context.close();
      }
    });
  }
});
