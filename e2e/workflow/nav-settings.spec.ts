import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fillKbarSearch, gotoDashboard, kbarSearchInput, submitKbarSelection } from '../kbar/helpers';
import {
  addApprover,
  addReferrer,
  pickMember,
  apiAs,
  contextAs,
  expectError,
  expectToast,
  openCompose,
  putPolicy,
  readPolicy,
  SETTINGS_PATH,
  uid,
  VIEWPORT_DESKTOP,
  WORKFLOW_PATH,
  gotoWorkflow,
  type Policy
} from './helpers';

/** plan 88 AC-01 ~ AC-05 — 사이드바·kbar·설정 가드·관리자 지정·기본 결재선 */

let admin: APIRequestContext;
let user: APIRequestContext;
let originalPolicy: Policy;

test.beforeAll(async ({ playwright }) => {
  admin = await apiAs(playwright, 'admin');
  user = await apiAs(playwright, 'user');
  originalPolicy = await readPolicy(admin);
});

test.afterAll(async () => {
  await putPolicy(admin, originalPolicy);
  // AC-04 중간 실패 대비 — hr 관리자 지정 원복
  await admin.delete(`/api/workflow/admins/${uid('hr')}`);
  await Promise.all([admin, user].map((ctx) => ctx?.dispose()));
});

async function openSidebar(page: Page) {
  await page.setViewportSize(VIEWPORT_DESKTOP);
  await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('link', { name: '문서함', exact: true });
  await page.waitForLoadState('load');
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  }
  await expect(link).toBeVisible({ timeout: 20_000 });
}

function settingsLink(page: Page) {
  return page.getByRole('link', { name: '워크플로우 설정', exact: true });
}

test.describe('plan 88 nav · settings', () => {
  test('AC-01: user 사이드바 「워크플로우」 → 문서함, 설정 link 0건, kbar 검색', async ({ browser }) => {
    const context = await contextAs(browser, 'user');
    const page = await context.newPage();
    try {
      await openSidebar(page);
      await expect(page.getByText('워크플로우', { exact: true }).first()).toBeVisible();
      await expect(settingsLink(page)).toHaveCount(0);
      await page.getByRole('link', { name: '문서함', exact: true }).click();
      await expect(page).toHaveURL(WORKFLOW_PATH);
      await expect(page.getByTestId('workflow-page')).toBeVisible({ timeout: 30_000 });

      await gotoDashboard(page);
      await page.keyboard.press('ControlOrMeta+k');
      await expect(kbarSearchInput(page)).toBeVisible({ timeout: 10_000 });
      await fillKbarSearch(page, '문서함');
      await submitKbarSelection(page);
      await expect(page).toHaveURL(WORKFLOW_PATH);
    } finally {
      await context.close();
    }
  });

  test('AC-02: admin 사이드바에 「문서함」·「워크플로우 설정」 둘 다', async ({ browser }) => {
    const context = await contextAs(browser, 'admin');
    const page = await context.newPage();
    try {
      await openSidebar(page);
      await expect(page.getByRole('link', { name: '문서함', exact: true })).toBeVisible();
      await expect(settingsLink(page)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-03: user settings 직접 진입 redirect + flash, policy PUT·admins POST 403', async ({ browser }) => {
    const context = await contextAs(browser, 'user');
    const page = await context.newPage();
    try {
      await page.goto(SETTINGS_PATH, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(WORKFLOW_PATH);
      await expectToast(page, '워크플로우 관리자 권한이 필요합니다.');
      await expect(page.getByTestId('workflow-settings-page')).toHaveCount(0);
    } finally {
      await context.close();
    }

    await expectError(
      await user.put('/api/workflow/templates/expense/policy', {
        data: { steps: [], referrers: [], approval_step_edit_enabled: true }
      }),
      403,
      '워크플로우 관리자 권한이 필요합니다.'
    );
    await expectError(
      await user.post('/api/workflow/admins', { data: { user_id: uid('user2') } }),
      403,
      '관리자 권한이 필요합니다.'
    );
  });

  test('AC-04: admin이 hr를 워크플로우 관리자로 지정·해제', async ({ browser }) => {
    const hrId = uid('hr');
    const adminCtx = await contextAs(browser, 'admin');
    const hrCtx = await contextAs(browser, 'hr');
    const adminPage = await adminCtx.newPage();
    const hrPage = await hrCtx.newPage();
    try {
      await adminPage.goto(SETTINGS_PATH, { waitUntil: 'domcontentloaded' });
      const admins = adminPage.getByTestId('workflow-admins');
      await expect(admins).toBeVisible({ timeout: 30_000 });
      await admins.getByTestId('workflow-admin-add').click();
      await pickMember(adminPage, hrId);
      await expectToast(adminPage, '워크플로우 관리자를 지정했습니다.');
      await expect(admins.getByTestId(`workflow-admin-remove-${hrId}`)).toBeVisible();

      await openSidebar(hrPage);
      await expect(settingsLink(hrPage)).toBeVisible();
      await hrPage.goto(SETTINGS_PATH, { waitUntil: 'domcontentloaded' });
      await expect(hrPage.getByTestId('workflow-settings-page')).toBeVisible({ timeout: 30_000 });
      await expect(hrPage.getByTestId('workflow-admins')).toHaveCount(0);
      await expect(hrPage.getByTestId('workflow-template-policy-expense')).toBeVisible();

      await admins.getByTestId(`workflow-admin-remove-${hrId}`).click();
      const modal = adminPage.getByRole('dialog', { name: '워크플로우 관리자 해제' });
      await expect(modal).toBeVisible();
      await modal.getByRole('button', { name: '해제' }).click();
      await expectToast(adminPage, '워크플로우 관리자를 해제했습니다.');

      await openSidebar(hrPage);
      await expect(settingsLink(hrPage)).toHaveCount(0);
      await hrPage.goto(SETTINGS_PATH, { waitUntil: 'domcontentloaded' });
      await expect(hrPage).toHaveURL(WORKFLOW_PATH);
    } finally {
      await adminCtx.close();
      await hrCtx.close();
    }
  });

  test('AC-05: 기본 결재선 저장 → user 작성 폼에 자동 채움', async ({ browser }) => {
    await putPolicy(admin, { steps: [], referrers: [], approval_step_edit_enabled: true });
    const adminCtx = await contextAs(browser, 'admin');
    const userCtx = await contextAs(browser, 'user');
    const adminPage = await adminCtx.newPage();
    const userPage = await userCtx.newPage();
    try {
      await adminPage.goto(SETTINGS_PATH, { waitUntil: 'domcontentloaded' });
      const section = adminPage.getByTestId('workflow-template-policy-expense');
      await expect(section).toBeVisible({ timeout: 30_000 });

      await section.getByTestId('workflow-step-add').click();
      await addApprover(adminPage, section, 1, uid('user2'));
      await section.getByTestId('workflow-step-add').click();
      await addApprover(adminPage, section, 2, uid('hr'));
      await addReferrer(adminPage, section, uid('admin'));
      await section.getByTestId(`workflow-referrer-notify-${uid('admin')}`).click();
      await adminPage.getByRole('menuitemradio', { name: '승인 완료 시 알림' }).click();
      await expect(section.getByTestId(`workflow-referrer-notify-${uid('admin')}`)).toContainText('완료 알림');

      await section.getByTestId('workflow-policy-save').click();
      await expectToast(adminPage, '기본 결재선이 저장되었습니다.');

      const saved = await readPolicy(admin);
      expect(saved.steps).toEqual([[uid('user2')], [uid('hr')]]);
      expect(saved.referrers).toEqual([{ user_id: uid('admin'), notification_setting: 'END' }]);

      await gotoWorkflow(userPage);
      await openCompose(userPage);
      const line = userPage.getByTestId('workflow-compose-form').getByTestId('workflow-approval-line');
      await expect(line.getByTestId(`workflow-actor-1-${uid('user2')}`)).toBeVisible();
      await expect(line.getByTestId(`workflow-actor-2-${uid('hr')}`)).toBeVisible();
      await expect(line.getByTestId(`workflow-referrer-notify-${uid('admin')}`)).toBeVisible();
    } finally {
      await adminCtx.close();
      await userCtx.close();
    }
  });
});
