import { expect, test, type Page } from '@playwright/test';
import {
  createEquipmentFixture,
  createRequestFixture,
  createSubscriptionFixture,
  expectApiError,
  expectLog,
  expectToast,
  fullNameOf,
  gotoLedger,
  logsByRequestId,
  MSG,
  pageAs,
  rowsOf,
  service,
  uniqueTag,
  UI_TIMEOUT,
  userIdOf,
  waitListBody,
  withApi
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-16 구독 추가(대상자 3종) · AC-17 비품 추가(자산번호 자동 · 409 · 400) · AC-18 수정 · AC-19 삭제 AlertModal · AC-20 요청 있으면 삭제 불가
 * 화면에서 만든 행은 이름/모델·시리얼을 `E2E`로 시작(cleanup 대상 · source='manual').
 */

async function nextNotebookNumber(): Promise<string> {
  const { data, error } = await service().from('equipment_items').select('asset_no').like('asset_no', 'N-%');
  if (error) throw new Error(error.message);
  const max = (data ?? [])
    .map((row) => Number((row as { asset_no: string }).asset_no.split('-')[1]))
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => Math.max(acc, value), 0);
  return `N-${String(max + 1).padStart(3, '0')}`;
}

async function selectOption(page: Page, triggerTestId: string, value: string) {
  await page.getByTestId(triggerTestId).click();
  await page.getByTestId(`${triggerTestId}-option-${value}`).click();
}

test.describe('plan 103 · 대장 추가·수정·삭제', () => {
  test('AC-16: hr 구독 추가 — 대상자 사람·팀·소속 전체 → 「구독을 추가했어요.」 · 표 행 + 칩 3개 · subscription.create 201', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const staffId = userIdOf('staff');
    const staffName = await fullNameOf('staff');
    const name = `E2E ${tag} 화면추가 구독`;

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await page.getByTestId('subscription-create-button').click();
      const sheet = page.getByTestId('subscription-form-sheet');
      await expect(sheet).toBeVisible({ timeout: UI_TIMEOUT });

      await selectOption(page, 'subscription-form-category', 'collaboration');
      await page.getByTestId('subscription-form-name').fill(name);
      await page.getByTestId('subscription-form-plan').fill('E2E 팀 플랜');
      await selectOption(page, 'subscription-form-status', 'active');

      const picker = sheet.getByTestId('assignee-picker');
      await picker.getByTestId('assignee-picker-tab-user').click();
      await picker.getByTestId('assignee-picker-open-user').click();
      await page.getByTestId(`assignee-option-user-${staffId}`).click();
      await picker.getByTestId('assignee-picker-tab-team').click();
      await picker.getByTestId('assignee-picker-open-team').click();
      await page.getByTestId('assignee-option-team-wake-디자인팀').click();
      await picker.getByTestId('assignee-picker-tab-affiliation').click();
      await picker.getByTestId('assignee-option-affiliation-wake').click();
      await expect(picker.getByRole('list', { name: '고른 대상자' }).getByRole('listitem')).toHaveCount(3);

      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/subscriptions' && response.request().method() === 'POST'
      );
      await page.getByTestId('asset-form-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const created = (await response.json()) as { item: { id: number } };
      await expectToast(page, '구독을 추가했어요.');
      await expect(sheet).toBeHidden({ timeout: UI_TIMEOUT });

      const row = page.getByTestId(`subscription-row-${created.item.id}`);
      await expect(row).toBeVisible({ timeout: UI_TIMEOUT });
      const assigneeCell = row.getByRole('cell').nth(3);
      await expect(assigneeCell).toContainText(staffName);
      await expect(assigneeCell).toContainText('웨이크 디자인팀');
      await expect(assigneeCell).toContainText('외 1');

      await row.click();
      const dialog = page.getByTestId('subscription-detail-dialog');
      await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(dialog).toContainText(staffName, { timeout: UI_TIMEOUT });
      await expect(dialog).toContainText('웨이크 디자인팀');
      await expect(dialog).toContainText('웨이크 전 직원');

      const log = await expectLog(response, { action: 'subscription.create', status: 201, target_type: 'subscription' });
      expect(log.metadata?.assignee_count).toBe(3);
      const rows = await logsByRequestId(response.headers()['x-request-id']);
      expect(rows.filter((item) => item.action === 'subscription.create')).toHaveLength(1);
    } finally {
      await context.close();
    }
  });

  test('AC-17: 회계팀 비품 추가 — 품목 「노트북·컴퓨터」 → 자산번호 N-{최대+1} 자동 · 「비품을 추가했어요.」 · 같은 번호 409 · 접두사 불일치 400', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const expected = await nextNotebookNumber();

    const { context, page } = await pageAs(browser, 'accounting');
    let createdId = 0;
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await page.getByTestId('equipment-create-button').click();
      const sheet = page.getByTestId('equipment-form-sheet');
      await expect(sheet).toBeVisible({ timeout: UI_TIMEOUT });
      await selectOption(page, 'equipment-form-kind', 'notebook');
      await expect(page.getByTestId('equipment-form-asset-no')).toHaveValue(expected, { timeout: UI_TIMEOUT });
      await page.getByTestId('equipment-form-model-serial').fill(`E2E ${tag} 노트북`);

      const responsePromise = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/equipment' && response.request().method() === 'POST'
      );
      await page.getByTestId('asset-form-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      createdId = ((await response.json()) as { item: { id: number; asset_no: string } }).item.id;
      await expectToast(page, '비품을 추가했어요.');
      await expect(sheet).toBeHidden({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId(`equipment-row-${createdId}`)).toContainText(expected, { timeout: UI_TIMEOUT });
      await expectLog(response, { action: 'equipment.create', status: 201, target_type: 'equipment_item' });

      // 폼에서 같은 번호 → 자산번호 칸 아래 「이미 있는 자산번호예요.」
      await page.getByTestId('equipment-create-button').click();
      await expect(sheet).toBeVisible({ timeout: UI_TIMEOUT });
      await selectOption(page, 'equipment-form-kind', 'notebook');
      const assetNo = page.getByTestId('equipment-form-asset-no');
      await expect(assetNo).not.toHaveValue('', { timeout: UI_TIMEOUT });
      await assetNo.fill(expected);
      await page.getByTestId('equipment-form-model-serial').fill(`E2E ${tag} 중복`);
      const dupPromise = page.waitForResponse(
        (res) => new URL(res.url()).pathname === '/api/equipment' && res.request().method() === 'POST'
      );
      await page.getByTestId('asset-form-submit').click();
      expect((await dupPromise).status()).toBe(409);
      await expect(sheet).toContainText(MSG.duplicateAssetNo, { timeout: UI_TIMEOUT });
      await expect(sheet).toBeVisible();
    } finally {
      await context.close();
    }

    await withApi(playwright, 'accounting', async (api) => {
      const duplicate = await api.post('/api/equipment', {
        data: { kind: 'notebook', asset_no: expected, model_serial: `E2E ${tag} API 중복`, status: 'in_use' }
      });
      await expectApiError(duplicate, 409, MSG.duplicateAssetNo);
      await expectLog(duplicate, { action: 'equipment.create', status: 409 });

      const mismatch = await api.post('/api/equipment', {
        data: { kind: 'monitor', asset_no: `N-${7000 + Math.floor(Math.random() * 2000)}`, model_serial: `E2E ${tag} 불일치` }
      });
      await expectApiError(mismatch, 400, MSG.prefixMismatch);
      await expectLog(mismatch, { action: 'equipment.create', status: 400 });
    });
    expect(createdId).toBeGreaterThan(0);
  });

  test('AC-18: hr Dialog 「수정」 → 값 채워진 Sheet → 상태 「수리중」 저장 → Dialog·표 배지 수리중 · equipment.update 200 · changed_fields에 status', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const model = `E2E ${tag} 수정 모니터`;
    const equipment = await createEquipmentFixture({ model_serial: model, status: 'in_use' });

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      const row = page.getByTestId(`equipment-row-${equipment.id}`);
      await row.click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT });
      await dialog.getByTestId('asset-edit-button').click();
      const sheet = page.getByTestId('equipment-form-sheet');
      await expect(sheet).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-form-model-serial')).toHaveValue(model, { timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-form-asset-no')).toHaveValue(equipment.asset_no);

      await selectOption(page, 'equipment-form-status', 'repair');
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/equipment/${equipment.id}` &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('asset-form-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await expectToast(page, '비품을 저장했어요.');
      await expect(sheet).toBeHidden({ timeout: UI_TIMEOUT });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('수리중', { timeout: UI_TIMEOUT });
      await expect(row).toContainText('수리중', { timeout: UI_TIMEOUT });

      const log = await expectLog(response, { action: 'equipment.update', status: 200, target_type: 'equipment_item' });
      expect(log.metadata?.changed_fields).toEqual(expect.arrayContaining(['status']));
    } finally {
      await context.close();
    }
  });

  test('AC-19: hr 삭제 — AlertModal 「이 비품을 삭제할까요?」 취소 시 유지 · 확인 시 사라짐 · equipment.delete 200 · 구독 「이 구독을 삭제할까요?」 · window.confirm 0회', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 삭제 모니터` });
    const subscriptionId = await createSubscriptionFixture({ name: `E2E ${tag} 삭제 구독` });

    const { context, page } = await pageAs(browser, 'hr');
    let nativeDialogs = 0;
    page.on('dialog', async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      const row = page.getByTestId(`equipment-row-${equipment.id}`);
      await row.click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await expect(dialog.getByTestId('asset-delete-button')).toBeEnabled({ timeout: UI_TIMEOUT });

      await dialog.getByTestId('asset-delete-button').click();
      const confirm = page.getByRole('dialog', { name: '이 비품을 삭제할까요?' });
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      await confirm.getByRole('button', { name: '취소', exact: true }).click();
      await expect(confirm).toBeHidden();
      await expect(row).toBeAttached();
      expect((await service().from('equipment_items').select('id').eq('id', equipment.id)).data).toHaveLength(1);

      await dialog.getByTestId('asset-delete-button').click();
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/equipment/${equipment.id}` &&
          response.request().method() === 'DELETE'
      );
      await confirm.getByRole('button', { name: '삭제', exact: true }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await expectToast(page, '삭제했어요.');
      await expect(page.getByTestId(`equipment-row-${equipment.id}`)).toHaveCount(0, { timeout: UI_TIMEOUT });
      await expectLog(response, { action: 'equipment.delete', status: 200, target_type: 'equipment_item' });

      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await page.getByTestId(`subscription-row-${subscriptionId}`).click();
      const subDialog = page.getByTestId('subscription-detail-dialog');
      await subDialog.getByTestId('asset-delete-button').click();
      const subConfirm = page.getByRole('dialog', { name: '이 구독을 삭제할까요?' });
      await expect(subConfirm).toBeVisible({ timeout: UI_TIMEOUT });
      const subResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/subscriptions/${subscriptionId}` &&
          response.request().method() === 'DELETE'
      );
      await subConfirm.getByRole('button', { name: '삭제', exact: true }).click();
      const subResponse = await subResponsePromise;
      expect(subResponse.status()).toBe(200);
      await expect(page.getByTestId(`subscription-row-${subscriptionId}`)).toHaveCount(0, { timeout: UI_TIMEOUT });
      await expectLog(subResponse, { action: 'subscription.delete', status: 200, target_type: 'subscription' });
      expect(await rowsOf(page, 'subscriptions').count()).toBe(0);
      expect(nativeDialogs, 'window.confirm 사용 0회').toBe(0);
    } finally {
      await context.close();
    }
  });

  test('AC-20: 요청 1건 있는 비품 — 삭제 버튼 비활성 + 안내 · DELETE 409 「요청 기록이 있어 삭제할 수 없어요.」 · 409 로그', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 요청있는 모니터` });
    await createRequestFixture({ target: { type: 'equipment', id: equipment.id }, requester: 'staff' });

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await page.getByTestId(`equipment-row-${equipment.id}`).click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await expect(dialog.getByTestId('asset-delete-button')).toBeDisabled({ timeout: UI_TIMEOUT });
      await expect(dialog.getByTestId('asset-delete-blocked-note')).toHaveText(MSG.equipmentDeleteBlocked);
    } finally {
      await context.close();
    }

    await withApi(playwright, 'hr', async (api) => {
      const response = await api.delete(`/api/equipment/${equipment.id}`);
      await expectApiError(response, 409, MSG.hasRequests);
      await expectLog(response, { action: 'equipment.delete', status: 409 });
    });
    expect((await service().from('equipment_items').select('id').eq('id', equipment.id)).data, '409 뒤 행 유지').toHaveLength(1);
  });
});
