import { expect, test } from '@playwright/test';
import {
  desktopPanel,
  expectPanelMatches,
  infoButton,
  openDesktopPanel,
  readSectionChildOrder,
  pageHeading,
  panelTitle,
  USERS_INFO,
  VIEWPORT_DESKTOP_1280
} from '../quick-info/helpers';

// plan 90 — 사용자 관리 ⓘ 한국어화 · 공용 패널 하위 호환 회귀
// (docs/plans/90_quick-dashboard-permission-info-plan.md AC-12·13) — admin storageState(chromium)

test.describe('plan 90 사용자 관리 안내 · 공용 info 패널 회귀', () => {
  test.use({ viewport: VIEWPORT_DESKTOP_1280 });
  test.describe.configure({ timeout: 90_000 });

  test('AC-12: admin /dashboard/users ⓘ → 「사용자 관리 안내」 · 섹션 5개 U-1~U-5 순서 · U-4 강조 상자 1개 · a[href] 0 · 영어 템플릿 0건', async ({
    page
  }) => {
    await page.goto('/dashboard/users', { waitUntil: 'domcontentloaded' });
    await expect(pageHeading(page, '사용자 관리')).toBeVisible({ timeout: 30_000 });
    const panel = await openDesktopPanel(page);

    await expect(panelTitle(panel)).toHaveText('사용자 관리 안내');
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText(
      USERS_INFO.sections.map((section) => section.title)
    );
    await expectPanelMatches(panel, USERS_INFO);

    const callouts = panel.locator("[data-slot='info-section-callout']");
    await expect(callouts).toHaveCount(1);
    const u4 = panel
      .locator("[data-slot='info-section']")
      .filter({ has: page.getByRole('heading', { level: 3, name: USERS_INFO.sections[3].title }) });
    await expect(u4.locator("[data-slot='info-section-callout']")).toHaveCount(1);

    await expect(panel.locator('a[href]')).toHaveCount(0);
    for (const text of ['React Query', 'nuqs', 'Overview']) {
      await expect(panel.getByText(text)).toHaveCount(0);
    }
  });

  // AC-13 원문은 /dashboard/react-query ⓘ를 보라고 하지만, 이 경로는 plan 90 이전부터
  // `src/config/disabled-routes.ts`(DISABLED_DASHBOARD_PATHS)에 있어 /dashboard/overview로 리다이렉트된다(기획 불일치).
  // 같은 목적(links만 있는 기존 content의 하위 호환 렌더)을 도달 가능한 유일한 링크 content —
  // info-sidebar 기본 패널(「Documentation」 · Cmd/Ctrl+I, ⓘ 없는 페이지) — 로 대체 검증한다.
  test('AC-13 (전제 확인): /dashboard/react-query는 비활성 경로 → overview 리다이렉트', async ({ page }) => {
    await page.goto('/dashboard/react-query', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/overview/, { timeout: 30_000 });
    await expect(pageHeading(page, 'React Query')).toHaveCount(0);
  });

  test('AC-13 (대체): ⓘ 없는 /dashboard/overview Cmd/Ctrl+I 기본 패널 — 링크·「Learn more」 그대로 · 목록·강조 상자 0개', async ({
    page
  }) => {
    await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({ timeout: 30_000 });
    await expect(infoButton(page)).toHaveCount(0);
    const panel = desktopPanel(page);
    await expect(async () => {
      if ((await panel.getAttribute('data-state')) !== 'expanded') {
        await page.keyboard.press('ControlOrMeta+i');
      }
      await expect(panel).toHaveAttribute('data-state', 'expanded', { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await expect(panelTitle(panel)).toHaveText('Documentation');
    await expect(panel.getByRole('heading', { level: 3, name: 'Getting Started' })).toBeVisible();
    await expect(
      panel.getByText('Learn how to get started with this application.')
    ).toBeVisible();
    await expect(panel.getByText('Learn more')).toBeVisible();
    const link = panel.getByRole('link', { name: 'Installation Guide' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '#');
    await expect(link).toHaveAttribute('target', '_blank');
    // 렌더 순서: 제목 → 설명 → 링크 블록 (목록·강조 상자 없음)
    expect(await readSectionChildOrder(panel)).toEqual([['h3', 'p', 'div']]);
    await expect(panel.locator("[data-slot='info-section-list']")).toHaveCount(0);
    await expect(panel.locator("[data-slot='info-section-callout']")).toHaveCount(0);
  });
});
