import { expect, test } from '@playwright/test';
import {
  createOrgChartTestUser,
  readCanvasInnerText,
  uniqueOrgChartEmail
} from '../helpers/org-chart';
import { waitForDashboardPresenceReady } from '../live-users/helpers';

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

async function gotoWakeOrgChartDesktop(page: import('@playwright/test').Page) {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto('/dashboard/org-chart?affiliation=wake');
  await expect(page.getByTestId('org-chart-canvas')).toBeVisible({ timeout: 30_000 });
}

async function waitForPersonOnCanvas(
  page: import('@playwright/test').Page,
  fullName: string
) {
  const canvas = page.getByTestId('org-chart-canvas');
  await expect
    .poll(async () => readCanvasInnerText(canvas), { timeout: 30_000 })
    .toContain(fullName);
}

async function hoverPersonNode(page: import('@playwright/test').Page, userId: string) {
  const node = page.getByTestId(`org-chart-person-node-${userId}`);
  await expect(node).toBeVisible({ timeout: 30_000 });
  await node.scrollIntoViewIfNeeded();
  await node.hover();
  const card = page.getByTestId('org-chart-person-hover-card');
  await expect(card).toBeVisible({ timeout: 10_000 });
}

async function ensureTreeItemExpanded(
  page: import('@playwright/test').Page,
  name: string | RegExp
) {
  const item = page.getByRole('treeitem', { name });
  await expect(item).toBeVisible({ timeout: 15_000 });
  if ((await item.getAttribute('aria-expanded')) === 'false') {
    await item.click();
  }
}

test.describe('조직도 person hover 연락처 카드', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.setTimeout(90_000);

  test('AC-01: person hover 시 email·phone이 표시된다', async ({ page }) => {
    const stamp = Date.now();
    const contactEmail = uniqueOrgChartEmail('hover-ac01');
    const person = await createOrgChartTestUser('hover-ac01', {
      fullName: `E2E Hover AC01 ${stamp}`,
      email: contactEmail,
      phone: '01012345678',
      rank: '마케팅팀',
      position_level: '과장'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, person.fullName);
    await hoverPersonNode(page, person.userId);

    const card = page.getByTestId('org-chart-person-hover-card');
    await expect(card.getByText(contactEmail)).toBeVisible();
    await expect(card.getByText('010-1234-5678')).toBeVisible();
  });

  test('AC-02: phone=null이면 phone 자리에 — 가 표시된다', async ({ page }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-ac02', {
      fullName: `E2E Hover AC02 ${stamp}`,
      phone: null,
      rank: '디자인팀',
      position_level: '대리'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, person.fullName);
    await hoverPersonNode(page, person.userId);

    const card = page.getByTestId('org-chart-person-hover-card');
    await expect(card.getByText('—').first()).toBeVisible();
  });

  test('AC-03: email=null이면 email 자리에 — 가 표시된다', async ({ page }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-ac03', {
      fullName: `E2E Hover AC03 ${stamp}`,
      // profiles.email is NOT NULL — empty string exercises the same UI path as null
      email: '',
      rank: '인사팀',
      position_level: '주임'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, person.fullName);
    await hoverPersonNode(page, person.userId);

    const card = page.getByTestId('org-chart-person-hover-card');
    await expect(card.getByText('—').first()).toBeVisible();
  });

  test('AC-04: team 노드 hover 시 hover card가 없다', async ({ page }) => {
    await createOrgChartTestUser('hover-ac04', {
      fullName: `E2E Hover AC04 ${Date.now()}`,
      rank: '마케팅팀',
      position_level: '사원'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, '마케팅팀');

    const canvas = page.getByTestId('org-chart-canvas');
    await canvas.getByText('마케팅팀', { exact: true }).hover();

    await expect(page.getByTestId('org-chart-person-hover-card')).toHaveCount(0, {
      timeout: 1_000
    });
  });

  test('AC-05: mobile viewport는 d3 canvas가 없다', async ({ page }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-ac05', {
      fullName: `E2E Hover AC05 ${stamp}`,
      rank: '디자인팀',
      position_level: '대리',
      leader_role: 'team_leader'
    });

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByTestId('org-chart-canvas')).toHaveCount(0);
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await ensureTreeItemExpanded(page, '디자인팀');
    await ensureTreeItemExpanded(page, new RegExp(`${person.fullName} 대리\\(T\\)`));
    await expect(
      page.getByRole('treeitem', { name: `${person.fullName} 대리(T)` })
    ).toBeVisible();
    await expect(page.getByTestId('org-chart-person-hover-card')).toHaveCount(0);
  });

  test('AC-08: org-chart는 dashboard layout DashboardPresenceTrack을 상속한다', async ({
    page
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/dashboard/org-chart');
    await expect(page.getByTestId('org-chart-page-content')).toBeVisible({
      timeout: 30_000
    });
    await waitForDashboardPresenceReady(page);
  });

  test('PLAN70-AC-08: viewport resize 시 hover card가 즉시 close된다', async ({
    page
  }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-resize', {
      fullName: `E2E Hover Resize ${stamp}`,
      rank: '마케팅팀',
      position_level: '과장'
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await waitForPersonOnCanvas(page, person.fullName);
    await hoverPersonNode(page, person.userId);

    await expect(page.getByTestId('org-chart-person-hover-card')).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 });

    await expect(page.getByTestId('org-chart-person-hover-card')).toHaveCount(0, {
      timeout: 3_000
    });
    await expect(page.getByTestId('org-chart-canvas')).toBeVisible();
  });

  test('PLAN70-AC-09: zoom 후 화면 맞춤 시 canvas가 정상 유지된다', async ({
    page
  }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-zoom-fit', {
      fullName: `E2E Hover ZoomFit ${stamp}`,
      rank: '마케팅팀',
      position_level: '과장'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, person.fullName);

    const canvas = page.getByTestId('org-chart-canvas');
    await page.getByRole('button', { name: '확대' }).click();
    await page.getByRole('button', { name: '화면 맞춤' }).click();

    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => readCanvasInnerText(canvas), { timeout: 15_000 })
      .toContain(person.fullName);
  });
});

test.describe('조직도 person hover 연락처 카드 (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(90_000);

  test('AC-07: admin도 person hover 시 user와 동일한 email·phone을 본다', async ({
    page
  }) => {
    const stamp = Date.now();
    const contactEmail = uniqueOrgChartEmail('admin-hover');
    const person = await createOrgChartTestUser('hover-ac07', {
      fullName: `E2E Hover AC07 ${stamp}`,
      email: contactEmail,
      phone: '01098765432',
      rank: '마케팅팀',
      position_level: '과장'
    });

    await gotoWakeOrgChartDesktop(page);
    await waitForPersonOnCanvas(page, person.fullName);
    await hoverPersonNode(page, person.userId);

    const card = page.getByTestId('org-chart-person-hover-card');
    await expect(card.getByText(contactEmail)).toBeVisible();
    await expect(card.getByText('010-9876-5432')).toBeVisible();
  });
});
