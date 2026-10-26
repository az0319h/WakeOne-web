import { expect, test } from '@playwright/test';
import { listOpenchatMockRequests, openchatRequestsFor, setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  APP_URL,
  dbNotifications,
  dbQuickRequest,
  expectDetailStatus,
  expectLogFor,
  fixtureUser,
  gotoDashboard,
  gotoDetail,
  MSG,
  pageAs,
  seedQuickRequest,
  STATUS_LABEL,
  callManyAs
} from './helpers';

// plan 89 §C 동방특송 처리 흐름 — docs/plans/89_quick-workflow-dongbang-openchat-plan.md
test.describe('plan 89 C. 동방특송 처리 흐름', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await setOpenchatMockMode('ok');
  });

  test('AC-16: 대시보드 표 「접수」 → 「접수 및 배차중」 · accepted webhook · 요청자 알림 · accept 로그', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('requested');
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, `?search=${requestNo}`);
      const table = page.getByTestId('quick-dashboard-table');
      const action = table.getByTestId(`quick-row-action-${requestNo}`);
      await expect(action).toHaveText(/접수/, { timeout: 30_000 });
      await action.click();
      await expect(page.getByText('퀵 요청을 접수했습니다.', { exact: true })).toBeVisible({
        timeout: 15_000
      });
      const row = table.getByRole('row').filter({ has: page.getByTestId(`quick-row-detail-${requestNo}`) });
      await expect(row.getByText(STATUS_LABEL.dispatching, { exact: true })).toBeVisible({ timeout: 15_000 });

      await gotoDetail(page, requestNo);
      await expectDetailStatus(page, 'dispatching');
    } finally {
      await context.close();
    }

    const accepted = await openchatRequestsFor(requestNo, 'accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].headers['x-wakeone-event']).toBe('quick_request.accepted');
    const lines = String(accepted[0].body.text).split('\n');
    expect(lines[0]).toBe(`✅접수완료 및 배차중 - ${requestNo}`);
    expect(accepted[0].body.text).toContain(`상세 확인: ${APP_URL}/dashboard/quick/${requestNo}`);

    const user = await fixtureUser('user');
    const notifications = await dbNotifications(user.userId, requestNo);
    const requesterEvents = notifications.filter((item) => item.type === 'quick_request.requester_event');
    expect(requesterEvents).toHaveLength(1);
    expect(requesterEvents[0].title).toBe('퀵 요청이 접수되었습니다');
    await expectLogFor('quick_request.accept', requestNo, 200);
  });

  test('AC-17 · AC-18: 배차완료 Dialog 필수 4필드 에러·미전송 → 입력 저장 → 「배차완료 및 결과」 · 상세 표시 · webhook · dispatch 로그', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('dispatching');
    const { context, page } = await pageAs(browser, 'dongbang');
    const dispatchCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes(`/api/quick-request/${requestNo}/dispatch`)) dispatchCalls.push(req.method());
    });
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-dispatch').click();
      const dialog = page.getByTestId('quick-dispatch-dialog');
      await expect(dialog).toBeVisible();

      // AC-17 — 4필드 모두 비움
      await dialog.getByTestId('quick-dispatch-submit').click();
      for (const message of [
        '예상금액을 입력해 주세요.',
        '차량정보를 입력해 주세요.',
        '기사 이름을 입력해 주세요.',
        '기사 연락처를 입력해 주세요.'
      ]) {
        await expect(dialog.getByText(message, { exact: true })).toBeVisible();
      }
      // 하나만 비움 (기사 연락처)
      await dialog.getByTestId('quick-dispatch-estimated-amount').fill('20000');
      await dialog.getByTestId('quick-dispatch-vehicle-info').fill('오토바이 8514');
      await dialog.getByTestId('quick-dispatch-driver-name').fill('홍길동');
      await dialog.getByTestId('quick-dispatch-submit').click();
      await expect(dialog.getByText('기사 연락처를 입력해 주세요.', { exact: true })).toBeVisible();
      await expect(dialog.getByText('예상금액을 입력해 주세요.', { exact: true })).toHaveCount(0);
      // 잘못된 형식
      await dialog.getByTestId('quick-dispatch-driver-phone').fill('0101234');
      await dialog.getByTestId('quick-dispatch-submit').click();
      await expect(
        dialog.getByText('연락처는 11자리 숫자만 입력할 수 있습니다.', { exact: true })
      ).toBeVisible();
      await page.waitForTimeout(500);
      expect(dispatchCalls, 'dispatch 요청 미전송').toEqual([]);

      // AC-18 — 저장
      await dialog.getByTestId('quick-dispatch-driver-phone').fill('01012345678');
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(`/api/quick-request/${requestNo}/dispatch`) && res.request().method() === 'POST'
      );
      await dialog.getByTestId('quick-dispatch-submit').click();
      expect((await responsePromise).status()).toBe(200);
      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expectDetailStatus(page, 'dispatched');
      await expect(page.getByTestId('quick-detail-estimated-amount')).toContainText('20,000원');
      const dispatchSection = page.getByTestId('quick-detail-section-dispatch');
      await expect(dispatchSection).toContainText('오토바이 8514');
      await expect(dispatchSection).toContainText('홍길동');
      await expect(page.getByTestId('quick-detail-driver-phone')).toContainText('010-1234-5678');
    } finally {
      await context.close();
    }

    const dispatched = await openchatRequestsFor(requestNo, 'dispatched');
    expect(dispatched).toHaveLength(1);
    const text = String(dispatched[0].body.text);
    const lines = text.split('\n');
    expect(lines[0]).toBe(`🚚배차등록 완료 - ${requestNo}`);
    for (const line of [
      '예상금액: 20,000원(부가세 별도)',
      '차량정보: 오토바이 8514',
      '기사이름: 홍길동',
      '기사 연락처: 010-1234-5678'
    ]) {
      expect(lines).toContain(line);
    }
    await expectLogFor('quick_request.dispatch', requestNo, 200);
  });

  test('AC-19: 수정 Sheet 도착 상세주소·도착 연락처·차량 종류 변경 → 즉시 반영 · update 로그 changedFields · webhook 없음', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('dispatching');
    const before = (await listOpenchatMockRequests()).filter((e) => e.body.requestNo === requestNo).length;
    const { context, page } = await pageAs(browser, 'dongbang');
    const newDetail = `E2E89 수정 도착 ${Date.now()}`;
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-edit').click();
      const sheet = page.getByTestId('quick-edit-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByTestId('quick-edit-save')).toBeDisabled();

      await sheet.getByTestId('quick-request-destination-detail-address').fill(newDetail);
      await sheet.getByTestId('quick-request-destination-contact-phone').fill('01099998888');
      const motorcycle = sheet.getByTestId('quick-request-vehicle-오토바이');
      const damas = sheet.getByTestId('quick-request-vehicle-다마스');
      await damas.click();
      await expect(damas).toHaveAttribute('aria-pressed', 'true');
      await motorcycle.click();
      await expect(motorcycle).toHaveAttribute('aria-pressed', 'false');

      const patchPromise = page.waitForResponse(
        (res) => res.url().endsWith(`/api/quick-request/${requestNo}`) && res.request().method() === 'PATCH'
      );
      await sheet.getByTestId('quick-edit-save').click();
      const patch = await patchPromise;
      expect(patch.status(), await patch.text()).toBe(200);
      await expect(page.getByText('퀵 요청을 수정했습니다.', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(sheet).toBeHidden();

      const route = page.getByTestId('quick-detail-section-route');
      await expect(route).toContainText(newDetail);
      await expect(route).toContainText('010-9999-8888');
      await expect(page.getByTestId('quick-detail-section-goods')).toContainText('다마스');
      await expect(page.getByTestId('quick-detail-section-goods')).not.toContainText('오토바이');
    } finally {
      await context.close();
    }

    const row = await dbQuickRequest(requestNo);
    expect(row.destination.detailAddress).toBe(newDetail);
    expect(row.destination.contactPhone).toBe('01099998888');
    expect(row.vehicle_types).toEqual(['다마스']);
    const log = await expectLogFor('quick_request.update', requestNo, 200);
    const changed = (log.metadata?.changedFields ?? []) as string[];
    expect(changed).toEqual(expect.arrayContaining(['destination', 'vehicleTypes']));
    const after = (await listOpenchatMockRequests()).filter((e) => e.body.requestNo === requestNo).length;
    expect(after).toBe(before);
  });

  test('AC-20: dispatched 최종금액 23000 → 상세·표 23,000원 · 요청자 알림 「최종금액이 입력되었습니다. 확인 후 승인해 주세요.」', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('dispatched');
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-set-final').click();
      const dialog = page.getByTestId('quick-final-amount-dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByTestId('quick-final-amount-input').fill('23000');
      await dialog.getByTestId('quick-final-amount-submit').click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expect(page.getByTestId('quick-detail-final-amount')).toContainText('23,000원', {
        timeout: 15_000
      });

      await gotoDashboard(page, `?search=${requestNo}`);
      const row = page
        .getByTestId('quick-dashboard-table')
        .getByRole('row')
        .filter({ has: page.getByTestId(`quick-row-detail-${requestNo}`) });
      await expect(row).toContainText('23,000원', { timeout: 30_000 });
    } finally {
      await context.close();
    }

    const user = await fixtureUser('user');
    const notifications = await dbNotifications(user.userId, requestNo);
    expect(notifications.map((item) => item.title)).toContain(
      '최종금액이 입력되었습니다. 확인 후 승인해 주세요.'
    );
    expect((await dbQuickRequest(requestNo)).final_amount).toBe(23000);
    await expectLogFor('quick_request.final_amount_set', requestNo, 200);
  });

  test('AC-21: 같은 requested 건 accept 동시 2회 → 200 1건 · 409 1건(메시지) · webhook 1회', async () => {
    const { requestNo } = await seedQuickRequest('requested');
    const responses = await callManyAs('dongbang', (api) =>
      Promise.all([
        api.post(`/api/quick-request/${requestNo}/accept`),
        api.post(`/api/quick-request/${requestNo}/accept`)
      ])
    );
    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);
    const conflict = responses.find((res) => res.status === 409)!;
    expect(conflict.body.message).toBe(MSG.stale);
    expect(await openchatRequestsFor(requestNo, 'accepted')).toHaveLength(1);
  });
});
