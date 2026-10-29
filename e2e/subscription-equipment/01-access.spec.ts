import { expect, test } from '@playwright/test';
import {
  createEquipmentFixture,
  createSubscriptionFixture,
  EQUIPMENT_PATH,
  expectNoHorizontalScroll,
  fullNameOf,
  gotoLedger,
  MSG,
  pageAs,
  sidebarGroupLabelOf,
  SUBSCRIPTIONS_PATH,
  toastRegion,
  uniqueTag,
  UI_TIMEOUT,
  VIEWPORT_PHONE,
  waitListBody,
  withApi,
  type AssetRole
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-01 사이드바·제목 · AC-02 직원 화면 · AC-03 권한자 화면 · AC-04 동방 차단 · AC-15 휴대폰 카드·Dialog
 */

test.describe('plan 103 · 접근 · 역할별 화면', () => {
  test('AC-01: 직원 사이드바 「자산」 › 「구독 관리」·「비품 관리」 → 두 페이지 제목·testid', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'staff');
    try {
      await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
      const subscriptionsLink = page.getByRole('link', { name: '구독 관리', exact: true });
      const equipmentLink = page.getByRole('link', { name: '비품 관리', exact: true });
      await expect(subscriptionsLink).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(equipmentLink).toBeVisible();
      expect(await sidebarGroupLabelOf(subscriptionsLink)).toBe('자산');
      expect(await sidebarGroupLabelOf(equipmentLink)).toBe('자산');

      await subscriptionsLink.click();
      await expect(page).toHaveURL(new RegExp(`${SUBSCRIPTIONS_PATH}(\\?.*)?$`), { timeout: UI_TIMEOUT });
      await expect(page.getByRole('heading', { name: '구독 관리' })).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('subscriptions-page')).toBeVisible();

      await page.getByRole('link', { name: '비품 관리', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${EQUIPMENT_PATH}(\\?.*)?$`), { timeout: UI_TIMEOUT });
      await expect(page.getByRole('heading', { name: '비품 관리' })).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-page')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-02: 직원 — 추가 버튼·관리 정보·수정/삭제 없음 · 결제/회계장부/구입일 칸 없음', async ({ browser }) => {
    const tag = uniqueTag();
    const subscriptionId = await createSubscriptionFixture({
      name: `E2E ${tag} 직원보기 구독`,
      category: 'software',
      card_last4: '4321',
      amount: 12000,
      currency: 'KRW',
      billing_cycle: 'monthly',
      manager_memo: 'E2E 관리 메모'
    });
    const equipment = await createEquipmentFixture({
      model_serial: `E2E ${tag} 직원보기 모니터`,
      ledger_entity: 'wake',
      purchased_on: '2026-01-02',
      manager_memo: 'E2E 관리 메모'
    });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await expect(page.getByTestId(`subscription-row-${subscriptionId}`)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('subscription-create-button')).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: '결제', exact: true })).toHaveCount(0);
      await page.getByTestId(`subscription-row-${subscriptionId}`).click();
      const subDialog = page.getByTestId('subscription-detail-dialog');
      await expect(subDialog).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(subDialog.getByTestId('asset-row-requests')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(subDialog.getByTestId('asset-manager-section')).toHaveCount(0);
      await expect(subDialog.getByTestId('asset-edit-button')).toHaveCount(0);
      await expect(subDialog.getByTestId('asset-delete-button')).toHaveCount(0);

      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await expect(page.getByTestId(`equipment-row-${equipment.id}`)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-create-button')).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: '회계장부', exact: true })).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: '구입일', exact: true })).toHaveCount(0);
      await page.getByTestId(`equipment-row-${equipment.id}`).click();
      const eqDialog = page.getByTestId('equipment-detail-dialog');
      await expect(eqDialog).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(eqDialog.getByTestId('asset-row-requests')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(eqDialog.getByTestId('asset-manager-section')).toHaveCount(0);
      await expect(eqDialog.getByTestId('asset-edit-button')).toHaveCount(0);
      await expect(eqDialog.getByTestId('asset-delete-button')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  for (const role of ['admin', 'hr', 'accounting'] as const satisfies readonly AssetRole[]) {
    test(`AC-03: 권한자(${role}) — 추가 버튼·「관리 정보」(권한자만 보여요)·수정/삭제·결제/회계장부/구입일 칸`, async ({
      browser
    }) => {
      const tag = uniqueTag();
      const subscriptionId = await createSubscriptionFixture({
        name: `E2E ${tag} 권한자보기 구독`,
        card_last4: '4321',
        amount: 12000,
        currency: 'KRW',
        billing_cycle: 'monthly'
      });
      const equipment = await createEquipmentFixture({
        model_serial: `E2E ${tag} 권한자보기 모니터`,
        ledger_entity: 'wake',
        purchased_on: '2026-01-02'
      });

      const { context, page } = await pageAs(browser, role);
      try {
        await gotoLedger(page, 'subscriptions', `q=${tag}`);
        await waitListBody(page, 'subscriptions');
        await expect(page.getByTestId('subscription-create-button')).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(page.getByRole('columnheader', { name: '결제', exact: true })).toBeVisible();
        await page.getByTestId(`subscription-row-${subscriptionId}`).click();
        const subDialog = page.getByTestId('subscription-detail-dialog');
        const subManager = subDialog.getByTestId('asset-manager-section');
        await expect(subManager).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(subManager).toContainText('관리 정보');
        await expect(subManager).toContainText('권한자만 보여요');
        await expect(subDialog.getByTestId('asset-edit-button')).toBeVisible();
        await expect(subDialog.getByTestId('asset-delete-button')).toBeVisible();

        await gotoLedger(page, 'equipment', `q=${tag}`);
        await waitListBody(page, 'equipment');
        await expect(page.getByTestId('equipment-create-button')).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(page.getByRole('columnheader', { name: '회계장부', exact: true })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: '구입일', exact: true })).toBeVisible();
        await page.getByTestId(`equipment-row-${equipment.id}`).click();
        const eqDialog = page.getByTestId('equipment-detail-dialog');
        const eqManager = eqDialog.getByTestId('asset-manager-section');
        await expect(eqManager).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(eqManager).toContainText('관리 정보');
        await expect(eqManager).toContainText('권한자만 보여요');
        await expect(eqDialog.getByTestId('asset-edit-button')).toBeVisible();
        await expect(eqDialog.getByTestId('asset-delete-button')).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }

  test('AC-04: 동방 — 두 페이지 /dashboard/quick redirect + flash · API 4개 403 · 사이드바 「자산」 없음', async ({
    browser,
    playwright
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      for (const path of [SUBSCRIPTIONS_PATH, EQUIPMENT_PATH]) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page, path).toHaveURL(/\/dashboard\/quick(\?.*)?$/, { timeout: UI_TIMEOUT });
        await expect(toastRegion(page), `flash ${path}`).toContainText(MSG.dongbangToast, { timeout: 15_000 });
      }
      await expect(page.getByRole('link', { name: '구독 관리', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: '비품 관리', exact: true })).toHaveCount(0);
      const groupLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-slot="sidebar-group-label"]')).map((node) =>
          node.textContent?.trim()
        )
      );
      expect(groupLabels.length, '사이드바 그룹 라벨이 그려짐').toBeGreaterThan(0);
      expect(groupLabels).not.toContain('자산');
    } finally {
      await context.close();
    }

    await withApi(playwright, 'dongbang', async (api) => {
      for (const path of [
        '/api/subscriptions',
        '/api/equipment',
        '/api/asset-requests?target_type=equipment',
        '/api/asset-ledger/assignee-options'
      ]) {
        const response = await api.get(path);
        expect(response.status(), path).toBe(403);
        expect(await response.json(), path).toEqual({ success: false, message: MSG.dongbangForbidden });
      }
    });
  });

  test('AC-15: 휴대폰(390×844) — 표 숨김 · 카드 · Dialog 화면 가득 · 「요청하기」 스크롤 없이 보임 · 가로 스크롤 없음', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({
      model_serial: `E2E ${tag} 휴대폰 모니터`,
      assignee: { type: 'user', role: 'staff' }
    });
    const staffName = await fullNameOf('staff');

    const { context, page } = await pageAs(browser, 'staff', VIEWPORT_PHONE);
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      const card = page.getByTestId(`equipment-card-${equipment.id}`);
      await expect(card).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-table')).toBeHidden();
      await expect(card).toContainText(equipment.asset_no);
      await expect(card).toContainText(`E2E ${tag} 휴대폰 모니터`);
      await expect(card).toContainText(staffName);
      await expect(card).toContainText('사용중');
      await expectNoHorizontalScroll(page);

      await card.click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT });
      const openForm = dialog.getByTestId('asset-request-open-form');
      await expect(openForm).toBeVisible({ timeout: UI_TIMEOUT });

      const dialogBox = await dialog.boundingBox();
      expect(dialogBox, 'Dialog box').toBeTruthy();
      expect(Math.round(dialogBox!.height), 'Dialog 높이 = 화면 높이').toBeGreaterThanOrEqual(VIEWPORT_PHONE.height - 1);
      expect(Math.round(dialogBox!.y), 'Dialog 위쪽 0').toBeLessThanOrEqual(1);

      const buttonBox = await openForm.boundingBox();
      expect(buttonBox, '요청하기 box').toBeTruthy();
      expect(buttonBox!.y, '요청하기 화면 안(위)').toBeGreaterThanOrEqual(0);
      expect(buttonBox!.y + buttonBox!.height, '요청하기 화면 안(아래)').toBeLessThanOrEqual(VIEWPORT_PHONE.height);
      await expect(openForm).toBeInViewport();
      await expectNoHorizontalScroll(page);
    } finally {
      await context.close();
    }
  });
});
