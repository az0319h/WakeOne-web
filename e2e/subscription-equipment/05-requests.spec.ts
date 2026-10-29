import { expect, test } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  apiAs,
  changeStatusViaApi,
  createEquipmentFixture,
  createRequestFixture,
  createRequestViaApi,
  createSubscriptionFixture,
  EQUIPMENT_PATH,
  expectApiError,
  expectLog,
  expectToast,
  fullNameOf,
  gotoLedger,
  json,
  MSG,
  pageAs,
  uniqueTag,
  UI_TIMEOUT,
  userIdOf,
  waitListBody,
  withApi
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-23 요청 등록(화면) · AC-24 중복 409 · AC-25 남의 요청 비공개 · AC-26 수정·취소 · AC-27 처리중 수정·취소 403
 * AC-28 처리 시작 · AC-29 담당자 변경 후보 · AC-30 반려 · AC-31 전이 규칙 · AC-32 완료해도 대장 불변
 */

function requestPathFor(equipmentId: number, requestId: number) {
  return `${EQUIPMENT_PATH}?equipment=${equipmentId}&request=${requestId}`;
}

test.describe('plan 103 · 요청 흐름', () => {
  test('AC-23: 직원 「요청하기」 — 비품 종류 radio 5개·구독 3개 · 5자 미만 막힘 · 「요청을 보냈어요.」 · 목록 접수대기 · asset_request.create 201', async ({
    browser
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 요청 모니터` });
    const subscriptionId = await createSubscriptionFixture({ name: `E2E ${tag} 요청 구독` });

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await page.getByTestId(`equipment-row-${equipment.id}`).click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await expect(dialog.getByTestId('asset-row-requests')).toBeVisible({ timeout: UI_TIMEOUT });
      await dialog.getByTestId('asset-request-open-form').click();
      const form = dialog.getByTestId('asset-request-form');
      await expect(form).toBeVisible({ timeout: UI_TIMEOUT });
      const radios = form.getByRole('radio');
      await expect(radios).toHaveCount(5);
      for (const name of ['고장·수리', '교체', '반납', '분실 신고', '기타']) {
        await expect(form.getByRole('radio', { name, exact: true })).toHaveCount(1);
      }

      await form.getByTestId('asset-request-type-repair').click();
      await form.getByTestId('asset-request-body').fill('줄생김');
      await dialog.getByTestId('asset-request-submit').click();
      await expect(form).toContainText(MSG.bodyTooShort, { timeout: UI_TIMEOUT });

      const body = `E2E ${tag} 화면에 줄이 생겨요.`;
      await form.getByTestId('asset-request-body').fill(body);
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/asset-requests' && response.request().method() === 'POST'
      );
      await dialog.getByTestId('asset-request-submit').click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const requestId = ((await response.json()) as { request: { id: number } }).request.id;
      await expectToast(page, '요청을 보냈어요.');
      const item = dialog.getByTestId(`asset-request-item-${requestId}`);
      await expect(item).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(item).toContainText('접수대기');
      await expect(dialog.getByTestId('asset-row-requests')).toContainText('접수대기');
      await expectLog(response, { action: 'asset_request.create', status: 201, target_type: 'asset_request' });

      await gotoLedger(page, 'subscriptions', `q=${tag}`);
      await waitListBody(page, 'subscriptions');
      await page.getByTestId(`subscription-row-${subscriptionId}`).click();
      const subDialog = page.getByTestId('subscription-detail-dialog');
      await subDialog.getByTestId('asset-request-open-form').click();
      const subForm = subDialog.getByTestId('asset-request-form');
      await expect(subForm).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(subForm.getByRole('radio')).toHaveCount(3);
      for (const name of ['해지', '변경(플랜·이용자)', '기타']) {
        await expect(subForm.getByRole('radio', { name, exact: true })).toHaveCount(1);
      }
    } finally {
      await context.close();
    }
  });

  test('AC-24: 같은 사람·같은 줄 접수대기 요청이 있으면 POST 한 번 더 → 409 「이미 진행 중인 요청이 있어요.」 · 409 로그', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 중복요청 모니터` });
    await withApi(playwright, 'staff', async (api) => {
      await createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id });
      const again = await api.post('/api/asset-requests', {
        data: { target_type: 'equipment', target_id: equipment.id, request_type: 'replace', body: 'E2E 다시 요청합니다.' }
      });
      await expectApiError(again, 409, MSG.duplicateOpen);
      await expectLog(again, { action: 'asset_request.create', status: 409 });
    });
  });

  test('AC-25: 다른 직원 — Dialog 「이 장비의 요청」에 R1 없음 · 단건 404 · 목록 없음 / 권한자는 보임', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 비공개 모니터` });
    const r1 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );

    const other = await pageAs(browser, 'other');
    try {
      await gotoLedger(other.page, 'equipment', `q=${tag}`);
      await waitListBody(other.page, 'equipment');
      await other.page.getByTestId(`equipment-row-${equipment.id}`).click();
      const rowRequests = other.page.getByTestId('equipment-detail-dialog').getByTestId('asset-row-requests');
      await expect(rowRequests).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(other.page.getByTestId('asset-row-requests-empty')).toBeVisible();
      await expect(other.page.getByTestId(`asset-request-item-${r1.id}`)).toHaveCount(0);
    } finally {
      await other.context.close();
    }

    await withApi(playwright, 'other', async (api) => {
      expect((await api.get(`/api/asset-requests/${r1.id}`)).status()).toBe(404);
      const list = await api.get('/api/asset-requests?target_type=equipment&status=all&perPage=50');
      expect(list.status()).toBe(200);
      const items = (await json<{ data: { items: Array<{ id: number }> } }>(list)).data.items;
      expect(items.map((item) => item.id)).not.toContain(r1.id);
    });
    await withApi(playwright, 'hr', async (api) => {
      expect((await api.get(`/api/asset-requests/${r1.id}`)).status()).toBe(200);
      const list = await api.get('/api/asset-requests?target_type=equipment&status=all&perPage=50');
      const items = (await json<{ data: { items: Array<{ id: number }> } }>(list)).data.items;
      expect(items.map((item) => item.id)).toContain(r1.id);
    });
    const hr = await pageAs(browser, 'hr');
    try {
      await gotoLedger(hr.page, 'equipment', `q=${tag}`);
      await waitListBody(hr.page, 'equipment');
      await hr.page.getByTestId(`equipment-row-${equipment.id}`).click();
      await expect(hr.page.getByTestId(`asset-request-item-${r1.id}`)).toBeVisible({ timeout: UI_TIMEOUT });
    } finally {
      await hr.context.close();
    }
  });

  test('AC-26: 직원 접수대기 요청 — 수정 → 「수정됨 yyyy-MM-dd (EEE) HH:mm:ss」 · 취소 확인창 「요청을 취소할까요?」 → 배지 취소 · update/cancel 200 로그', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 수정취소 모니터` });
    const r1 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await gotoLedger(page, 'equipment', `q=${tag}`);
      await waitListBody(page, 'equipment');
      await page.getByTestId(`equipment-row-${equipment.id}`).click();
      const dialog = page.getByTestId('equipment-detail-dialog');
      await dialog.getByTestId(`asset-request-item-${r1.id}`).click();
      const detail = dialog.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });

      await detail.getByTestId('asset-request-edit').click();
      const edited = `E2E ${tag} 내용을 고쳤어요.`;
      await dialog.getByTestId('asset-request-body').fill(edited);
      const updatePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${r1.id}` && response.request().method() === 'PATCH'
      );
      await dialog.getByTestId('asset-request-submit').click();
      const updateResponse = await updatePromise;
      expect(updateResponse.status()).toBe(200);
      await expectToast(page, '요청을 수정했어요.');
      await expect(detail.getByTestId('asset-request-content')).toContainText(edited, { timeout: UI_TIMEOUT });
      const editedLabel = detail.getByTestId('asset-request-edited');
      await expect(editedLabel).toHaveText(new RegExp(`^수정됨 ${ABSOLUTE_DATETIME_RE.source}$`), { timeout: UI_TIMEOUT });

      await detail.getByTestId('asset-request-cancel').click();
      const confirm = page.getByRole('dialog', { name: '요청을 취소할까요?' });
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(confirm.getByRole('button', { name: '닫기', exact: true })).toBeVisible();
      const cancelPromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${r1.id}/cancel` &&
          response.request().method() === 'POST'
      );
      await confirm.getByRole('button', { name: '요청 취소', exact: true }).click();
      const cancelResponse = await cancelPromise;
      expect(cancelResponse.status()).toBe(200);
      await expect(page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-status-badge')).toHaveText('취소', { timeout: UI_TIMEOUT });

      await expectLog(updateResponse, { action: 'asset_request.update', status: 200, target_type: 'asset_request' });
      await expectLog(cancelResponse, { action: 'asset_request.cancel', status: 200, target_type: 'asset_request' });
    } finally {
      await context.close();
    }
  });

  test('AC-27: 처리중 요청 — 직원 화면 수정·취소 버튼 없음 · PATCH/cancel 403 「접수대기일 때만 수정·취소할 수 있어요.」 + 로그', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 처리중 모니터` });
    const r2 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );
    await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, r2.id, 'in_progress'));

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await page.goto(requestPathFor(equipment.id, r2.id), { waitUntil: 'domcontentloaded' });
      const detail = page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-status-badge')).toHaveText('처리중');
      await expect(detail.getByTestId('asset-request-edit')).toHaveCount(0);
      await expect(detail.getByTestId('asset-request-cancel')).toHaveCount(0);
    } finally {
      await context.close();
    }

    await withApi(playwright, 'staff', async (api) => {
      const patch = await api.patch(`/api/asset-requests/${r2.id}`, { data: { body: 'E2E 처리중인데 수정' } });
      await expectApiError(patch, 403, MSG.pendingOnly);
      await expectLog(patch, { action: 'asset_request.update', status: 403 });
      const cancel = await api.post(`/api/asset-requests/${r2.id}/cancel`);
      await expectApiError(cancel, 403, MSG.pendingOnly);
      await expectLog(cancel, { action: 'asset_request.cancel', status: 403 });
    });
  });

  test('AC-28: hr 요청 표에서 R2 → 「처리 시작」 → 처리중 · 담당자 hr · 단계 「처리중」 · status_update pending→in_progress', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 처리시작 모니터` });
    const r2 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );
    const hrName = await fullNameOf('hr');

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await page.goto(`${EQUIPMENT_PATH}?view=requests`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('asset-requests-table')).toBeVisible({ timeout: UI_TIMEOUT });
      await page.getByTestId(`asset-request-row-${r2.id}`).click();
      const detail = page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${r2.id}/status` &&
          response.request().method() === 'POST'
      );
      await detail.getByTestId('asset-request-start').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await expectToast(page, '처리를 시작했어요.');
      await expect(page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-status-badge')).toHaveText('처리중', { timeout: UI_TIMEOUT });
      await expect(detail.getByTestId('asset-request-assignee')).toContainText(hrName);
      const stepper = page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-stepper');
      await expect(stepper.getByTestId('asset-request-step-in_progress')).toHaveAttribute('aria-current', 'step');
      await expect(stepper.getByTestId('asset-request-step-in_progress')).toContainText('처리중');
      await expect(stepper.getByTestId('asset-request-step-pending')).not.toHaveAttribute('aria-current', 'step');

      const log = await expectLog(response, { action: 'asset_request.status_update', status: 200 });
      expect(log.metadata).toMatchObject({ previous_status: 'pending', new_status: 'in_progress' });
    } finally {
      await context.close();
    }
  });

  test('AC-29: 회계팀 「담당자 변경」 후보 = assignee-options managers (active 권한자만 · 직원·동방 없음) → 자신 선택 → 담당자 회계팀 · assignee_update 로그', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 담당변경 모니터` });
    const r2 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );
    await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, r2.id, 'in_progress'));
    const accountingId = userIdOf('accounting');
    const accountingName = await fullNameOf('accounting');
    const managers = await withApi(playwright, 'accounting', async (api) => {
      const response = await api.get('/api/asset-ledger/assignee-options');
      expect(response.status()).toBe(200);
      return (await json<{ data: { managers: Array<{ user_id: string }> } }>(response)).data.managers.map(
        (manager) => manager.user_id
      );
    });
    expect(managers).toContain(accountingId);
    expect(managers).toContain(userIdOf('hr'));
    expect(managers).toContain(userIdOf('admin'));
    expect(managers).not.toContain(userIdOf('staff'));
    expect(managers).not.toContain(userIdOf('dongbang'));

    const { context, page } = await pageAs(browser, 'accounting');
    try {
      await page.goto(`${EQUIPMENT_PATH}?view=requests&request=${r2.id}`, { waitUntil: 'domcontentloaded' });
      const detail = page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      await detail.getByTestId('asset-request-assignee-change').click();
      const options = page.getByTestId(/^asset-request-assignee-option-/);
      await expect(options.first()).toBeVisible({ timeout: UI_TIMEOUT });
      const optionIds = (
        await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''))
      ).map((id) => id.replace('asset-request-assignee-option-', ''));
      expect([...optionIds].sort()).toEqual([...managers].sort());
      expect(optionIds).not.toContain(userIdOf('staff'));
      expect(optionIds).not.toContain(userIdOf('dongbang'));

      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${r2.id}/assignee` &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId(`asset-request-assignee-option-${accountingId}`).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await expectToast(page, '담당자를 바꿨어요.');
      await expect(detail.getByTestId('asset-request-assignee')).toContainText(accountingName, { timeout: UI_TIMEOUT });
      await expectLog(response, { action: 'asset_request.assignee_update', status: 200 });
    } finally {
      await context.close();
    }
  });

  test('AC-30: hr 반려 — 빈 사유 「반려 사유를 입력해 주세요.」 → 사유 입력 후 배지 반려 · 「반려 사유: …」 · 처리 버튼 없음', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 반려 모니터` });
    const r3 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
    );
    const reason = `E2E ${tag} 재고가 없어요`;

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await page.goto(`${EQUIPMENT_PATH}?view=requests&request=${r3.id}`, { waitUntil: 'domcontentloaded' });
      const detail = page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      await detail.getByTestId('asset-request-reject').click();
      const confirm = page.getByRole('dialog', { name: '요청을 반려할까요?' });
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      await confirm.getByRole('button', { name: '반려', exact: true }).click();
      await expect(confirm.getByRole('alert')).toHaveText(MSG.rejectReasonRequired);
      await expect(confirm).toBeVisible();

      await confirm.getByTestId('asset-request-reject-reason').fill(reason);
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${r3.id}/status` &&
          response.request().method() === 'POST'
      );
      await confirm.getByRole('button', { name: '반려', exact: true }).click();
      expect((await responsePromise).status()).toBe(200);
      await expect(confirm).toBeHidden({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-status-badge')).toHaveText('반려', { timeout: UI_TIMEOUT });
      await expect(detail.getByTestId('asset-request-reject-reason-view')).toContainText(`반려 사유: ${reason}`);
      await expect(detail.getByTestId('asset-request-start')).toHaveCount(0);
      await expect(detail.getByTestId('asset-request-complete')).toHaveCount(0);
      await expect(detail.getByTestId('asset-request-reject')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('AC-31: 전이 규칙 — 접수대기→완료 400 「먼저 처리를 시작해 주세요.」 · 완료→처리중 400 「이미 끝난 요청이에요.」 · 직원 상태 변경 403 · 모두 로그', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const e4 = await createEquipmentFixture({ model_serial: `E2E ${tag} R4 모니터` });
    const e5 = await createEquipmentFixture({ model_serial: `E2E ${tag} R5 모니터` });
    const r4 = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: e4.id })
    );
    const r5 = await createRequestFixture({
      target: { type: 'equipment', id: e5.id },
      requester: 'staff',
      status: 'completed',
      assignee: 'hr'
    });

    await withApi(playwright, 'hr', async (api) => {
      const skip = await api.post(`/api/asset-requests/${r4.id}/status`, { data: { status: 'completed' } });
      await expectApiError(skip, 400, MSG.startFirst);
      await expectLog(skip, { action: 'asset_request.status_update', status: 400 });
      const reopen = await api.post(`/api/asset-requests/${r5}/status`, { data: { status: 'in_progress' } });
      await expectApiError(reopen, 400, MSG.alreadyDone);
      await expectLog(reopen, { action: 'asset_request.status_update', status: 400 });
    });
    await withApi(playwright, 'staff', async (api) => {
      const staffChange = await api.post(`/api/asset-requests/${r4.id}/status`, { data: { status: 'in_progress' } });
      expect(staffChange.status()).toBe(403);
      expect((await json<{ success: boolean }>(staffChange)).success).toBe(false);
      await expectLog(staffChange, { action: 'asset_request.status_update', status: 403 });
    });
  });

  test('AC-32: 처리중 고장·수리 요청 「완료 처리」 → 완료 · 비품 status·사용자 그대로 · 「완료해도 장비 정보는 자동으로 바뀌지 않아요.」', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({
      model_serial: `E2E ${tag} 완료 모니터`,
      status: 'in_use',
      assignee: { type: 'user', role: 'staff' }
    });
    const request = await withApi(playwright, 'staff', (api) =>
      createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id, request_type: 'repair' })
    );
    await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, request.id, 'in_progress'));

    const { context, page } = await pageAs(browser, 'hr');
    try {
      await page.goto(`${EQUIPMENT_PATH}?view=requests&request=${request.id}`, { waitUntil: 'domcontentloaded' });
      const detail = page.getByTestId('asset-request-detail');
      await expect(detail).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(detail.getByTestId('asset-request-manager-hint')).toHaveText(MSG.managerHint);
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${request.id}/status` &&
          response.request().method() === 'POST'
      );
      await detail.getByTestId('asset-request-complete').click();
      expect((await responsePromise).status()).toBe(200);
      await expectToast(page, '완료 처리했어요.');
      await expect(page.getByTestId('equipment-detail-dialog').getByTestId('asset-request-status-badge')).toHaveText('완료', { timeout: UI_TIMEOUT });
    } finally {
      await context.close();
    }

    const api = await apiAs(playwright, 'hr');
    try {
      const response = await api.get(`/api/equipment/${equipment.id}`);
      expect(response.status()).toBe(200);
      const item = (
        await json<{ data: { item: { status: string; assignee: { assignee_type: string; user_id: string } | null } } }>(
          response
        )
      ).data.item;
      expect(item.status).toBe('in_use');
      expect(item.assignee?.assignee_type).toBe('user');
      expect(item.assignee?.user_id).toBe(userIdOf('staff'));
    } finally {
      await api.dispose();
    }
  });
});
