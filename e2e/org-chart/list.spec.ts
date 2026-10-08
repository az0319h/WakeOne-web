import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createOrgChartTestUser,
  membersOfTeam,
  readCanvasInnerText,
  type OrgChartNode
} from '../helpers/org-chart';
import { createPendingGoogleUser as createPending } from '../helpers/supabase-direct-auth';
import { createUserRequest } from '../helpers/auth-request';
import { waitForDashboardPresenceReady } from '../live-users/helpers';

async function expectCanvasContains(canvas: Locator, text: string) {
  await expect
    .poll(async () => readCanvasInnerText(canvas), { timeout: 30_000 })
    .toContain(text);
}

async function ensureTreeItemExpanded(page: Page, name: string | RegExp) {
  const item = page.getByRole('treeitem', { name });
  await expect(item).toBeVisible({ timeout: 15_000 });
  if ((await item.getAttribute('aria-expanded')) === 'false') {
    await item.click();
  }
}

test.describe('조직도 목록 (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.setTimeout(90_000);

  test('AC-01: Overview sidebar에 조직도 nav가 보인다', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: '조직도' })).toBeVisible();
  });

  test('AC-02: 조직도 페이지 제목·설명·소속 탭 3개', async ({ page }) => {
    await page.goto('/dashboard/org-chart');

    await expect(page.getByRole('heading', { name: '조직도' })).toBeVisible();
    await expect(
      page.getByText('임직원 조직을 확인합니다.')
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: '웨이크', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '산스', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '산스파운드리', exact: true })).toBeVisible();
  });

  test('AC-03: active user는 d3에 표시되고 inactive user는 미표시', async ({
    page,
    playwright
  }) => {
    const active = await createOrgChartTestUser('ac03-active', {
      fullName: `E2E AC03 Active ${Date.now()}`,
      rank: '마케팅팀',
      position_level: '과장'
    });
    const inactive = await createOrgChartTestUser('ac03-inactive', {
      fullName: `E2E AC03 Inactive ${Date.now()}`,
      rank: '디자인팀',
      position_level: '대리',
      status: 'inactive'
    });

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.get('/api/org-chart?affiliation=wake');
      const body = (await response.json()) as { nodes?: OrgChartNode[] };
      const names = (body.nodes ?? [])
        .filter((node) => node.nodeType === 'person')
        .map((node) => node.fullName);
      expect(names).toContain(active.fullName);
      expect(names).not.toContain(inactive.fullName);
    } finally {
      await userRequest.dispose();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('tree')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: '마케팅팀' })).toBeVisible();
    await expect(page.getByRole('button', { name: '팀 목록' })).toHaveCount(0);
    await ensureTreeItemExpanded(page, '마케팅팀');
    await expect(page.getByText(active.fullName, { exact: false })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(inactive.fullName, { exact: false })).toHaveCount(0);
  });

  test('PLAN70-AC-01: desktop canvas가 viewport fill (height > 500px)', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/org-chart?affiliation=wake');

    const canvas = page.getByTestId('org-chart-canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    const box = await canvas.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(500);
  });

  test('PLAN70-AC-10: affiliation 전환 후에도 canvas fill 유지', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/org-chart?affiliation=wake');

    const canvas = page.getByTestId('org-chart-canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    await page.getByRole('tab', { name: '산스', exact: true }).click();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    const box = await canvas.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(500);
  });

  test('AC-04: wake 탭 CEO 아래 COO·팀 노드 (본부 분기 없음)', async ({
    page,
    playwright
  }) => {
    const stamp = Date.now();
    const ceo = await createOrgChartTestUser('ac04-ceo', {
      fullName: `E2E AC04 CEO ${stamp}`,
      rank: '경영진',
      position_level: 'CEO'
    });
    const coo = await createOrgChartTestUser('ac04-coo', {
      fullName: `E2E AC04 COO ${stamp}`,
      rank: '경영진',
      position_level: 'COO'
    });
    await createOrgChartTestUser('ac04-team', {
      fullName: `E2E AC04 Member ${stamp}`,
      rank: '마케팅팀',
      position_level: '사원'
    });

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.get('/api/org-chart?affiliation=wake');
      const body = (await response.json()) as { nodes?: OrgChartNode[] };
      const nodes = body.nodes ?? [];
      const ceoNode = nodes.find((node) => node.userId === ceo.userId);
      const cooNode = nodes.find((node) => node.userId === coo.userId);
      const ceoCount = nodes.filter(
        (node) => node.nodeType === 'person' && node.positionLevel === 'CEO'
      ).length;
      if (ceoCount === 1) {
        expect(ceoNode?.parentId).toBeNull();
        expect(cooNode?.parentId).toBe(ceo.userId);
      } else {
        expect(ceoNode?.parentId).toBe('root:wake');
        expect(cooNode?.parentId).toBe('root:wake');
      }
      expect(nodes.some((node) => node.nodeType === 'team' && node.name === '마케팅팀')).toBe(
        true
      );
    } finally {
      await userRequest.dispose();
    }

    await page.goto('/dashboard/org-chart?affiliation=wake');
    const canvas = page.getByTestId('org-chart-canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await expectCanvasContains(canvas, ceo.fullName);
    await expectCanvasContains(canvas, coo.fullName);
    await expectCanvasContains(canvas, '마케팅팀');
    await expect
      .poll(async () => readCanvasInnerText(canvas))
      .not.toContain('사업본부');
  });

  test('AC-05: 동일 팀에서 대리(T)가 과장(P)보다 위', async ({ playwright, page }) => {
    const stamp = Date.now();
    const teamLeader = await createOrgChartTestUser('ac05-t', {
      fullName: `E2E AC05 T ${stamp}`,
      rank: '디자인팀',
      position_level: '대리',
      leader_role: 'team_leader'
    });
    const partLeader = await createOrgChartTestUser('ac05-p', {
      fullName: `E2E AC05 P ${stamp}`,
      rank: '디자인팀',
      position_level: '과장',
      leader_role: 'part_leader'
    });

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.get('/api/org-chart?affiliation=wake');
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { nodes?: OrgChartNode[] };
      const members = membersOfTeam(body.nodes ?? [], '디자인팀');
      const names = members.map((node) => node.fullName);
      expect(names.indexOf(teamLeader.fullName)).toBeLessThan(
        names.indexOf(partLeader.fullName)
      );
    } finally {
      await userRequest.dispose();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await ensureTreeItemExpanded(page, '디자인팀');
    await ensureTreeItemExpanded(page, new RegExp(`E2E AC05 T ${stamp}`));
    const memberItems = page.getByRole('treeitem').filter({ hasText: /E2E AC05 (T|P)/ });
    await expect(memberItems.first()).toContainText('E2E AC05 T');
    const memberTexts = await memberItems.allTextContents();
    expect(memberTexts.join('\n').indexOf('E2E AC05 T')).toBeLessThan(
      memberTexts.join('\n').indexOf('E2E AC05 P')
    );
  });

  test('AC-06: mobile viewport는 ReUI tree만 (d3 canvas 없음)', async ({ page }) => {
    await createOrgChartTestUser('ac06-mobile', {
      fullName: `E2E AC06 Mobile ${Date.now()}`,
      rank: '마케팅팀',
      position_level: '주임'
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');

    await expect(page.getByTestId('org-chart-canvas')).toHaveCount(0);
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('tree')).toBeVisible();
    await expect(page.getByTestId('org-chart-leadership')).toHaveCount(0);
    await expect(page.getByTestId('org-chart-teams')).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: '마케팅팀' })).toBeVisible();
    await expect(page.getByRole('button', { name: '팀 목록' })).toHaveCount(0);
    await expect(page.getByTestId('org-chart-canvas')).toHaveCount(0);
  });

  test('AC-10: user 조직도에 admin은 없고 active user만 표시', async ({
    page,
    playwright
  }) => {
    const stamp = Date.now();
    const visibleUser = await createOrgChartTestUser('ac10-user', {
      fullName: `E2E AC10 User ${stamp}`,
      rank: '인사팀',
      position_level: '대리'
    });
    const hiddenAdmin = await createOrgChartTestUser('ac10-admin', {
      fullName: `E2E AC10 Admin ${stamp}`,
      rank: '경영진',
      position_level: 'CEO',
      system_role: 'admin'
    });

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.get('/api/org-chart?affiliation=wake');
      const body = (await response.json()) as { nodes?: OrgChartNode[] };
      const names = (body.nodes ?? [])
        .filter((node) => node.nodeType === 'person')
        .map((node) => node.fullName);
      expect(names).toContain(visibleUser.fullName);
      expect(names).not.toContain(hiddenAdmin.fullName);
    } finally {
      await userRequest.dispose();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await ensureTreeItemExpanded(page, '인사팀');
    await expect(page.getByText(visibleUser.fullName, { exact: false })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText(hiddenAdmin.fullName, { exact: false })).toHaveCount(0);
  });

  test('TREE-02: CEO → COO → 마케팅팀 → E (경영진 팀 노드 없음)', async ({
    page,
    playwright
  }) => {
    const stamp = Date.now();
    await createOrgChartTestUser('tree02-ceo', {
      fullName: `E2E TREE02 CEO ${stamp}`,
      rank: '경영진',
      position_level: 'CEO'
    });
    await createOrgChartTestUser('tree02-coo', {
      fullName: `E2E TREE02 COO ${stamp}`,
      rank: '경영진',
      position_level: 'COO'
    });
    const member = await createOrgChartTestUser('tree02-e', {
      fullName: `E2E TREE02 E ${stamp}`,
      rank: '마케팅팀',
      position_level: '과장'
    });

    const userRequest = await createUserRequest(playwright);
    try {
      const response = await userRequest.get('/api/org-chart?affiliation=wake');
      const body = (await response.json()) as { nodes?: OrgChartNode[] };
      const nodes = body.nodes ?? [];
      const marketingTeam = nodes.find(
        (node) => node.nodeType === 'team' && node.name === '마케팅팀'
      );
      expect(marketingTeam).toBeTruthy();
      expect(nodes.find((node) => node.nodeType === 'team' && node.name === '경영진')).toBeFalsy();

      const memberNode = nodes.find((node) => node.userId === member.userId);
      expect(memberNode?.parentId).toBe(marketingTeam?.id);
    } finally {
      await userRequest.dispose();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByRole('tree')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('treeitem').filter({ hasText: `E2E TREE02 CEO ${stamp}` })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('treeitem').filter({ hasText: `E2E TREE02 COO ${stamp}` })
    ).toBeVisible();
    const treeItemTexts = await page.getByRole('treeitem').allTextContents();
    const treeText = treeItemTexts.join('\n');
    expect(treeText.indexOf(`E2E TREE02 CEO ${stamp}`)).toBeLessThan(
      treeText.indexOf(`E2E TREE02 COO ${stamp}`)
    );
    await ensureTreeItemExpanded(page, '마케팅팀');
    await expect(page.getByText(member.fullName, { exact: false })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('treeitem', { name: '경영진' })).toHaveCount(0);
  });

  test('AC-17: org-chart는 dashboard layout 하위 (sidebar·page content)', async ({
    page
  }) => {
    await page.goto('/dashboard/org-chart');
    await expect(page.getByRole('link', { name: '조직도' })).toBeVisible();
    await expect(page.getByTestId('org-chart-page-content')).toBeVisible({
      timeout: 30_000
    });
    await expect(page).toHaveURL(/\/dashboard\/org-chart/);
  });

  test('AC-12: org-chart는 dashboard layout DashboardPresenceTrack을 상속한다', async ({
    page
  }) => {
    await page.goto('/dashboard/org-chart');
    await expect(page.getByTestId('org-chart-page-content')).toBeVisible({
      timeout: 30_000
    });
    await waitForDashboardPresenceReady(page);
  });
});

test.describe('조직도 승인 flow (admin)', () => {
  test.setTimeout(90_000);

  test('AC-07: user 승인 후 조직도 웨이크 탭에 표시', async ({ page }) => {
    const pending = await createPending('ac07-org');
    const fullName = `E2E AC07 Org ${Date.now()}`;

    await page.goto(
      `/dashboard/users?status=pending_approval&name=${encodeURIComponent(pending.email.split('@')[0])}`
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });

    const row = page.getByRole('row').filter({ hasText: pending.email });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: '수락' }).click({ force: true });

    const sheet = page.getByRole('dialog').filter({ hasText: '가입 요청 승인' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
    await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
    await sheet.getByRole('combobox', { name: '소속' }).click();
    await page.getByRole('option', { name: '웨이크', exact: true }).click();
    await sheet.getByRole('combobox', { name: '부서/사업장' }).click();
    await page.getByRole('option', { name: '마케팅팀', exact: true }).click();
    await sheet.getByRole('combobox', { name: '직급' }).click();
    await page.getByRole('option', { name: '과장', exact: true }).click();
    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'User', exact: true }).click();
    await sheet.getByRole('button', { name: '미설정' }).click();

    await sheet.getByRole('button', { name: '승인' }).click();
    await expect(page.getByText('사용자가 승인되었습니다.')).toBeVisible({ timeout: 15_000 });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard/org-chart?affiliation=wake');
    await expect(page.getByTestId('org-chart-mobile-tree')).toBeVisible({
      timeout: 30_000
    });
    await ensureTreeItemExpanded(page, '마케팅팀');
    await expect(page.getByText(fullName, { exact: false })).toBeVisible({
      timeout: 30_000
    });
  });
});
