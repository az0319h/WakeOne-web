import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import { createAs, uniqueTag, type AccountKey } from '../quick-workflow/helpers';
import {
  getUnreadTotalAs,
  markAllConversationsReadAs,
  sendMessageAs,
  SUBSCRIBE_SETTLE_MS
} from '../quick-chat/helpers';
import { QUICK_INFO, desktopPanel, mobilePanel, panelBodyText, panelTitle } from '../quick-info/helpers';
import {
  clickUntilUrl,
  expectAllTouchTargets,
  expectMinSize,
  expectNoHorizontalScroll,
  gotoChatList,
  gotoDetail,
  gotoList,
  gotoRequestForm,
  openAs,
  SCREEN_NAME,
  TEXT,
  walkQuickScreens,
  withPage,
  type ViewportName
} from './helpers';

/**
 * plan 106 §A 공통 틀 (AC-01 ~ AC-11) — docs/plans/106_quick-mobile-restructure-plan.md
 * AC-12(PC 회귀)는 106-pc-regression.spec.ts
 */
test.describe('plan 106 A. 공통 틀 (휴대폰 lg 미만)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  const fx = { tag: '', userNo: '', listNos: [] as string[] };

  test.beforeAll(async () => {
    fx.tag = uniqueTag('E2E106S');
    const created = await createAs('user', fx.tag);
    fx.userNo = created.requestNo;
    await sendMessageAs('user', fx.userNo, 'plan 106 공통 틀 확인용 메시지');
    for (let i = 0; i < 3; i += 1) {
      fx.listNos.push((await createAs('user', fx.tag)).requestNo);
    }
  });

  function banner(page: Page) {
    return page.getByRole('banner');
  }

  async function expectScreenName(page: Page, name: string, hiddenHeading: string) {
    await expect(banner(page).getByText(name, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: hiddenHeading, exact: true })).toBeHidden();
    const bannerText = await banner(page).innerText();
    expect(bannerText, `상단바 영어 0: ${bannerText}`).not.toMatch(/Quick|Request|Chat/);
  }

  test('AC-01: M375 user — 4화면 큰 제목·설명 숨김 · 상단바 「퀵 내역」「퀵 요청」「퀵 대화」「퀵 {번호}」 · 영어 0건', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoList(page);
      await expectScreenName(page, SCREEN_NAME.list, '나의 퀵 내역');
      await expect(page.getByText('한국 시간 기준 · 오늘 포함 · 조회 기간은 목록 위에서 선택합니다')).toBeHidden();

      await gotoRequestForm(page);
      await expectScreenName(page, SCREEN_NAME.request, '🚚 퀵 배송 요청');
      await expect(page.getByText('동방특송 퀵 배송 요청을 한 화면에서 작성합니다.')).toBeHidden();

      await gotoChatList(page);
      await expectScreenName(page, SCREEN_NAME.chat, '퀵 대화');
      await expect(page.getByText('요청 건별 대화 · 선택한 기간 + 안 읽은 대화')).toBeHidden();

      await gotoDetail(page, fx.userNo);
      await expectScreenName(page, SCREEN_NAME.detail(fx.userNo), '퀵 요청 상세');
      await expect(page.getByText('진행 상황과 배차 정보를 확인합니다.')).toBeHidden();
    });
  });

  test('AC-02: M375 user — 내역·상세 ⓘ top < 200 · 44×44 · 「퀵 권한 안내 보기」 · 패널 「퀵 권한 안내」 · 본문 = D1280 패널', async ({
    browser
  }) => {
    const desktopText = await withPage(browser, 'user', 'D1280', async (page) => {
      await gotoList(page);
      const button = page.getByRole('button', { name: 'Show information' });
      await expect(button).toBeVisible({ timeout: 30_000 });
      const panel = desktopPanel(page);
      await expect(async () => {
        if ((await panel.getAttribute('data-state')) !== 'expanded') await button.click();
        await expect(panel).toHaveAttribute('data-state', 'expanded', { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await expect(panelTitle(panel)).toHaveText(QUICK_INFO.title);
      return panelBodyText(panel);
    });

    await withPage(browser, 'user', 'M375', async (page) => {
      for (const open of [() => gotoList(page), () => gotoDetail(page, fx.userNo)]) {
        await open();
        const button = page.getByTestId('quick-mobile-info-button');
        await expect(button).toBeVisible({ timeout: 30_000 });
        await expect(button).toHaveAccessibleName(TEXT.infoButton);
        const rect = await expectMinSize(button, 44, 'ⓘ');
        expect(rect.y, `ⓘ top ${rect.y} < 200`).toBeLessThan(200);
        const sheet = mobilePanel(page);
        await expect(async () => {
          if ((await sheet.count()) === 0) await button.click();
          await expect(sheet).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
        await expect(panelTitle(sheet)).toHaveText(TEXT.infoTitle);
        expect(await panelBodyText(sheet)).toBe(desktopText);
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0, { timeout: 10_000 });
      }
    });
  });

  test('AC-03 (r1): M375·M360·T768 상단바 버튼 ≥ 44 · 검색·테마 Select 숨김 · breadcrumb 1개 / D1024·D1280 56px · 28/32/32 · 검색·테마 Select 보임', async ({
    browser
  }) => {
    for (const vp of ['M375', 'M360', 'T768'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        for (const path of ['/dashboard/overview', '/dashboard/quick']) {
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          const header = banner(page);
          await expect(header).toBeVisible({ timeout: 30_000 });
          await expect(header.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible({ timeout: 30_000 });
          await expectMinSize(header.getByRole('button', { name: 'Toggle Sidebar' }), 44, `${vp} ${path} 사이드바`);
          await expectMinSize(header.getByRole('button', { name: 'Toggle theme' }), 44, `${vp} ${path} 테마`);
          await expectMinSize(header.getByTestId('notification-bell'), 44, `${vp} ${path} 알림`);
          await expect(header.getByRole('button', { name: /Search/ })).toBeHidden();
          await expect(header.getByRole('combobox', { name: 'Theme' })).toBeHidden();
          const visibleCrumbs = await header.getByRole('navigation', { name: 'breadcrumb' }).evaluate((nav) =>
            // 보이는 항목 = ol 자식 중 구분선(aria-hidden · role=presentation) 제외 · 표시·폭 > 0 (마지막 항목은 BreadcrumbPage span)
            Array.from(nav.querySelector('ol')?.children ?? []).filter((child) => {
              if (child.getAttribute('aria-hidden') === 'true' || child.getAttribute('role') === 'presentation') return false;
              const style = window.getComputedStyle(child);
              return style.display !== 'none' && child.getBoundingClientRect().width > 0;
            }).length
          );
          expect(visibleCrumbs, `${vp} ${path} breadcrumb 보이는 항목`).toBe(1);
        }
      });
    }
    const expected = { sidebar: 28, theme: 32, bell: 32 };
    for (const vp of ['D1024', 'D1280'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        for (const path of ['/dashboard/overview', '/dashboard/quick']) {
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          const header = banner(page);
          await expect(header.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible({ timeout: 30_000 });
          const headerBox = await header.boundingBox();
          expect(headerBox!.height, `${vp} 상단바 높이`).toBe(56);
          const sizes = {
            sidebar: (await header.getByRole('button', { name: 'Toggle Sidebar' }).boundingBox())!,
            theme: (await header.getByRole('button', { name: 'Toggle theme' }).boundingBox())!,
            bell: (await header.getByTestId('notification-bell').boundingBox())!
          };
          for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
            expect(sizes[key].width, `${vp} ${key} width`).toBe(expected[key]);
            expect(sizes[key].height, `${vp} ${key} height`).toBe(expected[key]);
          }
          await expect(header.getByRole('button', { name: /Search/ })).toBeVisible();
          await expect(header.getByRole('combobox', { name: 'Theme' })).toBeVisible();
        }
      });
    }
  });

  test('AC-04: M375 — viewport meta에 viewport-fit=cover · body padding-left/right 0px (/dashboard/quick · /auth/sign-in)', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoList(page);
      const read = () =>
        page.evaluate(() => {
          const meta = document.querySelector('meta[name="viewport"]');
          const style = window.getComputedStyle(document.body);
          return { content: meta?.getAttribute('content') ?? '', left: style.paddingLeft, right: style.paddingRight };
        });
      const quick = await read();
      expect(quick.content).toContain('viewport-fit=cover');
      expect(quick.left).toBe('0px');
      expect(quick.right).toBe('0px');
    });
    const anon = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    try {
      const page = await anon.newPage();
      await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        const style = window.getComputedStyle(document.body);
        return { content: meta?.getAttribute('content') ?? '', left: style.paddingLeft, right: style.paddingRight };
      });
      expect(result.content).toContain('viewport-fit=cover');
      expect(result.left).toBe('0px');
      expect(result.right).toBe('0px');
    } finally {
      await anon.close();
    }
  });

  test('AC-05: M375 탭 바 — user·logistics 3개 「내역」「대화」「요청하기」 · dongbang 2개 · ≥ 44 · current · 이동 / D1280 0', async ({
    browser
  }) => {
    for (const account of ['user', 'logistics', 'dongbang'] as AccountKey[]) {
      await withPage(browser, account, 'M375', async (page) => {
        await gotoList(page);
        const tabbar = page.getByRole('navigation', { name: TEXT.tabbar });
        await expect(tabbar).toBeVisible({ timeout: 30_000 });
        await expect(tabbar).toHaveAttribute('data-testid', 'quick-mobile-tabbar');
        const links = tabbar.getByRole('link');
        const labels = account === 'dongbang' ? [TEXT.tabList, TEXT.tabChat] : [TEXT.tabList, TEXT.tabChat, TEXT.tabRequest];
        await expect(links).toHaveCount(labels.length);
        for (let i = 0; i < labels.length; i += 1) {
          await expect(links.nth(i)).toContainText(labels[i]);
          const rect = await links.nth(i).boundingBox();
          expect(rect!.height, `${account} 탭 ${labels[i]} 높이`).toBeGreaterThanOrEqual(44);
        }
        if (account === 'dongbang') {
          await expect(page.getByTestId('quick-mobile-tab-request')).toHaveCount(0);
        }
        await expect(page.getByTestId('quick-mobile-tab-list')).toHaveAttribute('aria-current', 'page');

        await page.getByTestId('quick-mobile-tab-chat').click();
        await expect(page).toHaveURL(/\/dashboard\/quick\/chat$/, { timeout: 30_000 });
        await expect(tabbar).toBeVisible();
        await expect(page.getByTestId('quick-mobile-tab-chat')).toHaveAttribute('aria-current', 'page');
        await expect(page.getByTestId('quick-mobile-tab-list')).not.toHaveAttribute('aria-current', 'page');

        if (account !== 'dongbang') {
          await page.getByTestId('quick-mobile-tab-request').click();
          await expect(page).toHaveURL(/\/dashboard\/quick\/request$/, { timeout: 30_000 });
          await expect(page.getByTestId('quick-request-order-page')).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId('quick-mobile-tabbar')).toHaveCount(0);
        }
      });
    }
    await withPage(browser, 'user', 'D1280', async (page) => {
      await gotoList(page);
      await expect(page.getByTestId('quick-mobile-tabbar')).toBeHidden();
    });
  });

  test('AC-06: M375 dongbang 내역 — 「대화」 탭 배지 2(= unread-total) → user 메시지 1개 → 5초 안 3', async ({ browser }) => {
    await markAllConversationsReadAs('dongbang');
    const fresh = await createAs('user', uniqueTag('E2E106S6'));
    await sendMessageAs('user', fresh.requestNo, '안 읽음 1');
    await sendMessageAs('user', fresh.requestNo, '안 읽음 2');
    await expect.poll(() => getUnreadTotalAs('dongbang'), { timeout: 15_000 }).toBe(2);

    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page);
      const badge = page.getByTestId('quick-mobile-tab-chat-badge');
      await expect(badge).toHaveText('2', { timeout: 30_000 });
      expect(await getUnreadTotalAs('dongbang')).toBe(2);
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      await sendMessageAs('user', fresh.requestNo, '안 읽음 3');
      await expect(badge).toHaveText('3', { timeout: 5_000 });
    });
  });

  test('AC-07 (r1): M375 탭 바 — 요청·상세·상세 대화·대화방 0 · 내역·대화 목록 보임 · T768 사이드바 겹침 0 · 사이드바 펼침 6곳 가로 스크롤 0', async ({
    browser
  }) => {
    const paths = {
      hidden: [
        '/dashboard/quick/request',
        `/dashboard/quick/${fx.userNo}`,
        `/dashboard/quick/${fx.userNo}?chat=1`,
        `/dashboard/quick/chat?request=${fx.userNo}`
      ],
      visible: ['/dashboard/quick', '/dashboard/quick/chat']
    };
    await withPage(browser, 'user', 'M375', async (page) => {
      for (const path of paths.hidden) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('banner').or(page.getByTestId('quick-chat-header')).first()).toBeAttached({
          timeout: 30_000
        });
        await page.waitForLoadState('load');
        await expect(page.getByTestId('quick-mobile-tabbar'), path).toBeHidden();
      }
      for (const path of paths.visible) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('quick-mobile-tabbar'), path).toBeVisible({ timeout: 30_000 });
      }
    });

    for (const sidebarOpen of [true, false]) {
      await withPage(
        browser,
        'user',
        'T768',
        async (page) => {
          for (const path of [...paths.hidden, ...paths.visible]) {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('load');
            await expect(page.getByTestId('quick-detail').or(page.getByTestId('quick-dashboard')).or(page.getByTestId('quick-chat-messenger')).or(page.getByTestId('quick-request-order-page')).first()).toBeVisible({ timeout: 30_000 });
            await page.waitForTimeout(300);
            await expectNoHorizontalScroll(page, `T768 sidebar=${sidebarOpen} ${path}`);
            if (paths.visible.includes(path)) {
              const tabbar = page.getByTestId('quick-mobile-tabbar');
              await expect(tabbar).toBeVisible({ timeout: 30_000 });
              const overlap = await page.evaluate(() => {
                const bar = document.querySelector('[data-testid="quick-mobile-tabbar"]')!.getBoundingClientRect();
                const sidebar = document.querySelector('[data-sidebar="sidebar"]');
                if (!sidebar) return 0;
                const s = sidebar.getBoundingClientRect();
                const visible = s.right > 0 && s.width > 0 && window.getComputedStyle(sidebar).visibility !== 'hidden';
                if (!visible) return 0;
                const x = Math.max(0, Math.min(bar.right, s.right) - Math.max(bar.left, Math.max(0, s.left)));
                const y = Math.max(0, Math.min(bar.bottom, s.bottom) - Math.max(bar.top, s.top));
                return x * y;
              });
              expect(overlap, `T768 sidebar=${sidebarOpen} ${path} 탭 바 ∩ 사이드바 면적`).toBe(0);
            }
          }
        },
        { sidebarOpen }
      );
    }
  });

  test('AC-08: M375 「뒤로」 — ① 바로 진입 상세 → 내역(replace) ② 내역→상세→뒤로→goBack 상세 아님 ③ 요청 폼 바로 진입 → 내역', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      // ①
      await gotoDetail(page, fx.userNo);
      const back = page.getByTestId('quick-mobile-back');
      await expect(back).toBeVisible();
      await expect(back).toHaveAccessibleName(TEXT.back);
      await expectMinSize(back, 44, '뒤로');
      await clickUntilUrl(page, back, /\/dashboard\/quick$/);

      // ②
      await gotoList(page, `?search=${fx.tag}`);
      const link = page.getByTestId(`quick-card-link-${fx.userNo}`);
      await expect(link).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, link, new RegExp(`/dashboard/quick/${fx.userNo}$`));
      await expect(page.getByTestId('quick-detail-mobile')).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, page.getByTestId('quick-mobile-back'), /\/dashboard\/quick(\?|$)/);
      await expect(page.getByTestId('quick-dashboard')).toBeVisible();
      await page.goBack().catch(() => undefined);
      await page.waitForTimeout(800);
      expect(page.url(), 'goBack 뒤 상세가 아님').not.toMatch(new RegExp(`/dashboard/quick/${fx.userNo}`));

      // ③
      await gotoRequestForm(page);
      await clickUntilUrl(page, page.getByTestId('quick-mobile-back'), /\/dashboard\/quick$/);
    });
  });

  test('AC-09: M375 user·dongbang·admin — 4화면 + 열린 상태 44px 스캔 미달 0', async ({ browser }) => {
    const targets: Record<'user' | 'dongbang' | 'admin', { canCreate: boolean; hasDetailMore: boolean }> = {
      user: { canCreate: true, hasDetailMore: true },
      dongbang: { canCreate: false, hasDetailMore: true },
      admin: { canCreate: true, hasDetailMore: true }
    };
    const failures: string[] = [];
    for (const account of Object.keys(targets) as (keyof typeof targets)[]) {
      await withPage(browser, account, 'M375', async (page) => {
        await walkQuickScreens(
          page,
          { requestNo: fx.userNo, listQuery: `?search=${fx.tag}`, ...targets[account] },
          async (label) => {
            try {
              await expectAllTouchTargets(page, `${account} ${label}`);
            } catch (error) {
              failures.push(String((error as Error).message).split('\n\nExpected')[0]);
            }
          }
        );
      });
    }
    expect(failures, failures.join('\n---\n')).toEqual([]);
  });

  test('AC-10 (r1): M360·M375·M430·T768 × user·dongbang + M375 테마 3종 + T768 사이드바 펼침 — 4화면 + 열린 상태 가로 스크롤 0', async ({
    browser
  }) => {
    test.setTimeout(900_000);
    const failures: string[] = [];
    const run = async (
      account: 'user' | 'dongbang',
      vp: ViewportName,
      options: { theme?: string; sidebarOpen?: boolean } = {}
    ) => {
      const { context, page } = await openAs(browser, account, vp, options);
      try {
        await walkQuickScreens(
          page,
          { requestNo: fx.userNo, listQuery: `?search=${fx.tag}`, canCreate: account === 'user', hasDetailMore: true },
          async (label) => {
            try {
              await expectNoHorizontalScroll(page, `${account} ${vp} ${JSON.stringify(options)} ${label}`);
            } catch (error) {
              failures.push(String((error as Error).message).split('\n')[0]);
            }
          }
        );
      } finally {
        await context.close();
      }
    };
    for (const vp of ['M360', 'M375', 'M430', 'T768'] as ViewportName[]) {
      for (const account of ['user', 'dongbang'] as const) {
        await run(account, vp);
      }
    }
    const wideThemes = ['neobrutualism', 'notebook', 'mono'];
    const themeNames = THEMES.map((theme) => theme.value);
    for (const theme of wideThemes) {
      expect(themeNames, `THEMES에 ${theme}`).toContain(theme);
      await run('user', 'M375', { theme });
    }
    for (const account of ['user', 'dongbang'] as const) {
      await run(account, 'T768', { sidebarOpen: true });
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('AC-11: T768 dongbang 4건 이상 — 카드 첫 두 장 같은 y(±4)·다른 x · 탭 바 보임 · 가로 스크롤 0', async ({ browser }) => {
    await withPage(browser, 'dongbang', 'T768', async (page) => {
      await gotoList(page, `?search=${fx.tag}`);
      const cards = page.getByTestId('quick-dashboard-cards').getByRole('listitem');
      await expect(cards.first()).toBeVisible({ timeout: 30_000 });
      expect(await cards.count()).toBeGreaterThanOrEqual(4);
      const a = (await cards.nth(0).boundingBox())!;
      const b = (await cards.nth(1).boundingBox())!;
      expect(Math.abs(a.y - b.y), `y ${a.y} vs ${b.y}`).toBeLessThanOrEqual(4);
      expect(Math.abs(a.x - b.x), `x ${a.x} vs ${b.x}`).toBeGreaterThan(10);
      await expect(page.getByTestId('quick-mobile-tabbar')).toBeVisible();
      await expectNoHorizontalScroll(page, 'T768 dongbang 내역');
    });
  });
});
