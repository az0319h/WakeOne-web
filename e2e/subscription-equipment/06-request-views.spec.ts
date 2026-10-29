import { expect, test, type Page } from '@playwright/test';
import {
  createEquipmentFixture,
  createRequestFixture,
  createSubscriptionFixture,
  EQUIPMENT_PATH,
  pageAs,
  purgeE2eRequests,
  uniqueTag,
  UI_TIMEOUT
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-33 「목록 | 요청」 요청 화면(권한자 전체 · 처리 대기 배지 · 내 담당만 / 직원 본인 건 · 내 요청 배지)
 * AC-34 사이드바 처리 대기 배지(권한자만 · 처리 시작 시 줄어듦)
 *
 * 배지·건수는 시스템 전체 진행 중 요청 수이므로, 시작 전에 이전 E2E 요청(E2E 대장 행에 달린 것만)을 지운다.
 * 상태 구성: 비품 접수대기 2(직원 A 1 · 직원 C 1) · 처리중 1(직원 B · 담당 hr) · 완료 1(직원 B · 담당 hr) + 구독 접수대기 1(직원 C)
 */

type Fixture = { pendingStaff: number; pendingOther: number; inProgress: number; completed: number; subscriptionPending: number };

async function requestRowIds(page: Page): Promise<number[]> {
  const ids = await page
    .getByTestId(/^asset-request-row-\d+$/)
    .evaluateAll((nodes) => nodes.map((node) => Number((node.getAttribute('data-testid') ?? '').split('-').pop())));
  return ids.sort((a, b) => a - b);
}

async function expectRequestRows(page: Page, expected: number[]) {
  await expect.poll(() => requestRowIds(page), { timeout: UI_TIMEOUT }).toEqual([...expected].sort((a, b) => a - b));
}

async function seed(): Promise<Fixture> {
  await purgeE2eRequests();
  const tag = uniqueTag();
  const [ea, eb, ec, ed] = await Promise.all(
    ['A', 'B', 'C', 'D'].map((suffix) => createEquipmentFixture({ model_serial: `E2E ${tag} 요청화면 ${suffix}` }))
  );
  const subscriptionId = await createSubscriptionFixture({ name: `E2E ${tag} 요청화면 구독` });
  return {
    pendingStaff: await createRequestFixture({ target: { type: 'equipment', id: ea.id }, requester: 'staff' }),
    pendingOther: await createRequestFixture({ target: { type: 'equipment', id: eb.id }, requester: 'other' }),
    inProgress: await createRequestFixture({
      target: { type: 'equipment', id: ec.id },
      requester: 'teammate',
      status: 'in_progress',
      assignee: 'hr'
    }),
    completed: await createRequestFixture({
      target: { type: 'equipment', id: ed.id },
      requester: 'teammate',
      status: 'completed',
      assignee: 'hr'
    }),
    subscriptionPending: await createRequestFixture({
      target: { type: 'subscription', id: subscriptionId },
      requester: 'other'
    })
  };
}

test.describe('plan 103 · 요청 화면 · 배지', () => {
  test.describe.configure({ mode: 'serial' });
  let fixture: Fixture;

  test.beforeAll(async () => {
    fixture = await seed();
  });

  test('AC-33: 「요청」 전환 — hr 4건·처리 대기 2·기본 「진행 중」·「내 담당만」 / 직원 본인 건만·내 요청 1·「내 담당만」 없음', async ({
    browser
  }) => {
    const hr = await pageAs(browser, 'hr');
    try {
      await hr.page.goto(EQUIPMENT_PATH, { waitUntil: 'domcontentloaded' });
      const viewSwitch = hr.page.getByTestId('asset-view-switch');
      await expect(viewSwitch).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(hr.page.getByTestId('asset-pending-badge')).toHaveText('처리 대기 2', { timeout: UI_TIMEOUT });
      await viewSwitch.getByTestId('asset-view-requests').click();
      await expect(hr.page).toHaveURL(/[?&]view=requests(&|$)/, { timeout: UI_TIMEOUT });
      await expect(hr.page.getByTestId('asset-requests-table')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(hr.page.getByTestId('asset-request-status-open')).toHaveAttribute('data-state', 'on');
      await expectRequestRows(hr.page, [fixture.pendingStaff, fixture.pendingOther, fixture.inProgress]);

      await hr.page.getByTestId('asset-request-status-all').click();
      await expectRequestRows(hr.page, [fixture.pendingStaff, fixture.pendingOther, fixture.inProgress, fixture.completed]);

      await hr.page.getByTestId('asset-requests-mine-only').click();
      await expect(hr.page).toHaveURL(/[?&]mine_assigned=1(&|$)/, { timeout: UI_TIMEOUT });
      await expectRequestRows(hr.page, [fixture.inProgress, fixture.completed]);

      await hr.page.getByTestId('asset-request-status-open').click();
      await expectRequestRows(hr.page, [fixture.inProgress]);
    } finally {
      await hr.context.close();
    }

    const staff = await pageAs(browser, 'staff');
    try {
      await staff.page.goto(EQUIPMENT_PATH, { waitUntil: 'domcontentloaded' });
      await expect(staff.page.getByTestId('asset-view-switch')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(staff.page.getByTestId('asset-my-open-badge')).toHaveText('내 요청 1', { timeout: UI_TIMEOUT });
      await expect(staff.page.getByTestId('asset-pending-badge')).toHaveCount(0);
      await staff.page.getByTestId('asset-view-requests').click();
      await expect(staff.page).toHaveURL(/[?&]view=requests(&|$)/, { timeout: UI_TIMEOUT });
      await expect(staff.page.getByTestId('asset-requests-table')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(staff.page.getByTestId('asset-requests-mine-note')).toHaveText('내가 보낸 요청만 보여요.');
      await expect(staff.page.getByTestId('asset-requests-mine-only')).toHaveCount(0);
      await expectRequestRows(staff.page, [fixture.pendingStaff]);
      await staff.page.getByTestId('asset-request-status-all').click();
      await expectRequestRows(staff.page, [fixture.pendingStaff]);
    } finally {
      await staff.context.close();
    }
  });

  test('AC-34: 사이드바 배지 — hr 「비품 관리」 2 · 「구독 관리」 1 / 직원 배지 없음 → hr가 1건 처리 시작하면 새로고침 없이 1', async ({
    browser
  }) => {
    const staff = await pageAs(browser, 'staff');
    try {
      await staff.page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
      await expect(staff.page.getByRole('link', { name: '비품 관리', exact: true })).toBeVisible({ timeout: UI_TIMEOUT });
      // 직원은 summary 배지 훅이 0을 돌려준다(조회 없음) — 렌더 안정화만 잠깐 기다린다
      await staff.page.waitForTimeout(2_000);
      await expect(staff.page.getByTestId('nav-badge-equipment')).toHaveCount(0);
      await expect(staff.page.getByTestId('nav-badge-subscriptions')).toHaveCount(0);
    } finally {
      await staff.context.close();
    }

    const hr = await pageAs(browser, 'hr');
    try {
      await hr.page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
      const equipmentBadge = hr.page.getByTestId('nav-badge-equipment');
      await expect(equipmentBadge).toHaveText('2', { timeout: UI_TIMEOUT });
      await expect(equipmentBadge).toBeVisible();
      await expect(hr.page.getByTestId('nav-badge-subscriptions')).toHaveText('1', { timeout: UI_TIMEOUT });

      await hr.page.getByRole('link', { name: '비품 관리', exact: true }).click();
      await expect(hr.page.getByTestId('equipment-page')).toBeVisible({ timeout: UI_TIMEOUT });
      await hr.page.getByTestId('asset-view-requests').click();
      await hr.page.getByTestId(`asset-request-row-${fixture.pendingStaff}`).click();
      const detail = hr.page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      const responsePromise = hr.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${fixture.pendingStaff}/status` &&
          response.request().method() === 'POST'
      );
      await detail.getByTestId('asset-request-start').click();
      expect((await responsePromise).status()).toBe(200);
      await expect(equipmentBadge).toHaveText('1', { timeout: UI_TIMEOUT });
      await expect(hr.page.getByTestId('asset-pending-badge')).toHaveText('처리 대기 1', { timeout: UI_TIMEOUT });
    } finally {
      await hr.context.close();
    }
  });
});
