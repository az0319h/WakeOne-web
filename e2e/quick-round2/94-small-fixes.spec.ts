import { expect, test, type Page } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  CONTACT_PHONE_DEST,
  CONTACT_PHONE_ORIGIN,
  NOTIFY_TITLE,
  NOTIFY_TYPE,
  STATUS_LABEL,
  VIEWPORT_MOBILE,
  callAs,
  dbNotificationsByEvent,
  dispatchAs,
  fixtureUser,
  gotoDashboard,
  gotoDetail,
  pageAs,
  seedQuickRequest,
  uniqueTag
} from '../quick-workflow/helpers';
import { sendMessageAs } from '../quick-chat/helpers';
import { PLATE_INVALID, PLATE_VALID, TEXT, grepDir, profilePhone } from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 94 §C 작은 수정 (7·8·9·12) — docs/plans/94_quick-realtime-and-small-fixes-plan.md
 * AC-14(표 행 클릭) · AC-15(모바일 카드) · AC-16(부가세 포함) · AC-17(자동차등록번호) · AC-18(처리 이력 역순) · AC-19(tel 링크)
 */
test.describe('plan 94 C. 행 클릭 · 부가세 · 자동차등록번호 · 처리 이력 · tel', () => {
  test.describe.configure({ timeout: 150_000 });

  const DISPATCH_WITH = (vehicleInfo: string) => ({
    estimatedAmount: 20000,
    vehicleInfo,
    driverName: '홍길동',
    driverPhone: '01012345678'
  });

  async function expectDetailUrl(page: Page, requestNo: string) {
    await expect(page).toHaveURL(new RegExp(`/dashboard/quick/${requestNo}$`), { timeout: 15_000 });
    await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
  }

  test('AC-14: 1280 동방 — 행 cursor-pointer · 「요청자」 셀 클릭 → 상세 · 행 포커스+Enter → 상세 · 「새 대화 N」 → 퀵 대화 · 「접수」 버튼은 버튼 동작만(상세 이동 없음)', async ({
    browser
  }) => {
    const user = await fixtureUser('user');
    const { requestNo } = await seedQuickRequest('requested', 'user', uniqueTag('E2E94ROW'));
    await sendMessageAs('user', requestNo, '행 클릭 배지용 메시지');

    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      const openRow = async () => {
        await gotoDashboard(page, `?search=${requestNo}`);
        const table = page.getByTestId('quick-dashboard-table');
        const row = table.getByTestId(`quick-row-${requestNo}`);
        await expect(row).toBeVisible({ timeout: 30_000 });
        return { table, row };
      };

      // 셀 클릭
      const first = await openRow();
      await expect(first.row).toHaveCSS('cursor', 'pointer');
      await expect(first.row).toHaveAttribute('tabindex', '0');
      await expect(first.row).toHaveAttribute('aria-label', `${requestNo} 상세 보기`);
      await expect(first.table.getByTestId(`quick-row-detail-${requestNo}`), '「상세」 열 유지').toBeVisible();
      await first.row.getByText(user.fullName, { exact: true }).click();
      await expectDetailUrl(page, requestNo);

      // 행 포커스 + Enter
      const second = await openRow();
      await second.row.focus();
      await expect(second.row).toBeFocused();
      await page.keyboard.press('Enter');
      await expectDetailUrl(page, requestNo);

      // 「새 대화 N」 배지 → 「퀵 대화」 (행 이동 아님)
      const third = await openRow();
      await third.table.getByTestId(`quick-unread-${requestNo}`).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/quick/chat\\?request=${requestNo}`), { timeout: 15_000 });
      await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });

      // 「접수」 버튼 → 접수만 · URL은 대시보드 그대로
      const fourth = await openRow();
      const action = fourth.table.getByTestId(`quick-row-action-${requestNo}`);
      await expect(action).toHaveText(/접수/);
      await action.click();
      await expect(page.getByText(TEXT.acceptedToast, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/dashboard\/quick(\?.*)?$/);
      await expect(page.getByTestId('quick-detail')).toHaveCount(0);
      await expect(fourth.row.getByText(STATUS_LABEL.dispatching, { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('AC-15 (plan 106 AC-17): 375 동방 — 카드 본문 탭 → 상세 · 카드 안 「접수」 탭은 접수만 · 「상세 보기」 버튼 0 · 카드 덮는 링크(quick-card-link)', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('requested', 'user', uniqueTag('E2E94CARD'));
    const { context, page } = await pageAs(browser, 'dongbang', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoDashboard(page, `?search=${requestNo}`);
      const card = page.getByTestId(`quick-card-${requestNo}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      // plan 106 D-8 — 휴대폰 카드 「상세 보기」 버튼 삭제 · 카드 전체를 덮는 링크(`quick-card-link-{no}` · 「{no} 상세 보기」)
      await expect(card.getByTestId(`quick-card-detail-${requestNo}`), '「상세 보기」 버튼 0').toHaveCount(0);
      const link = card.getByTestId(`quick-card-link-${requestNo}`);
      await expect(link).toBeVisible();
      await expect(link).toHaveAccessibleName(`${requestNo} 상세 보기`);
      await expect(link).toHaveAttribute('href', new RegExp(`/dashboard/quick/${requestNo}$`));
      await expect(link).toHaveCSS('cursor', 'pointer');
      // 본문(패딩 영역 · 버튼·링크 밖) 탭
      await card.click({ position: { x: 8, y: 8 } });
      await expectDetailUrl(page, requestNo);

      await gotoDashboard(page, `?search=${requestNo}`);
      const again = page.getByTestId(`quick-card-${requestNo}`);
      await expect(again).toBeVisible({ timeout: 30_000 });
      const action = again.getByTestId(`quick-card-action-${requestNo}`);
      await expect(action).toHaveText(/접수/);
      await action.click();
      await expect(page.getByText(TEXT.acceptedToast, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/dashboard\/quick(\?.*)?$/);
      await expect(page.getByTestId('quick-detail')).toHaveCount(0);
      await expect(again.getByText(STATUS_LABEL.dispatching, { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('AC-16: 배차 Dialog·최종금액 Dialog 「부가세 포함 금액으로 입력」 · 상세 「예상금액·최종금액은 부가세 포함 금액입니다.」 · grep 「부가세 별도」 0건', async ({
    browser
  }) => {
    expect(grepDir('src', TEXT.vatExcludedLegacy), '「부가세 별도」 0건').toEqual([]);

    const { requestNo } = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E94VAT'));
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-dispatch').click();
      const dispatchDialog = page.getByTestId('quick-dispatch-dialog');
      await expect(dispatchDialog).toBeVisible();
      await expect(dispatchDialog.getByText(TEXT.vatIncludedInput, { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dispatchDialog).toBeHidden();

      await dispatchAs('dongbang', requestNo, DISPATCH_WITH(PLATE_VALID[0]));
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-set-final').click();
      const finalDialog = page.getByTestId('quick-final-amount-dialog');
      await expect(finalDialog).toBeVisible();
      await expect(finalDialog.getByText(TEXT.vatIncludedInput, { exact: true })).toBeVisible();
      await expect(finalDialog).toContainText('예상금액 20,000원(부가세 포함)');
      await page.keyboard.press('Escape');
      await expect(finalDialog).toBeHidden();

      await expect(page.getByTestId('quick-detail-section-amount')).toContainText(TEXT.vatIncludedDetail);
    } finally {
      await context.close();
    }
  });

  test('AC-17: 배차 Dialog label 「자동차등록번호」·placeholder · 유효 3종 200 · 「오토바이 8514」·「abc」 400 같은 문구(UI 미전송) · 상세 라벨·값 · 알림 본문 · 수정 Sheet 동일 검사', async ({
    browser
  }) => {
    const user = await fixtureUser('user');
    const main = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E94PLT'));
    const { context, page } = await pageAs(browser, 'dongbang');
    const dispatchCalls: string[] = [];
    const patchCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes(`/api/quick-request/${main.requestNo}/dispatch`)) dispatchCalls.push(req.method());
      if (req.url().endsWith(`/api/quick-request/${main.requestNo}`) && req.method() === 'PATCH') patchCalls.push('PATCH');
    });
    try {
      await gotoDetail(page, main.requestNo);
      await page.getByTestId('quick-detail-dispatch').click();
      const dialog = page.getByTestId('quick-dispatch-dialog');
      await expect(dialog).toBeVisible();
      const plate = dialog.getByTestId('quick-dispatch-vehicle-info');
      await expect(dialog.getByLabel(TEXT.plateLabel)).toBeVisible();
      await expect(plate).toHaveAttribute('placeholder', TEXT.platePlaceholder);
      await expect(plate).toHaveAttribute('maxlength', '20');
      await expect(dialog.getByText('차량정보', { exact: false })).toHaveCount(0);

      await dialog.getByTestId('quick-dispatch-estimated-amount').fill('20000');
      await dialog.getByTestId('quick-dispatch-driver-name').fill('홍길동');
      await dialog.getByTestId('quick-dispatch-driver-phone').fill('01012345678');
      for (const invalid of PLATE_INVALID) {
        await plate.fill(invalid);
        await dialog.getByTestId('quick-dispatch-submit').click();
        await expect(dialog.getByText(TEXT.plateInvalid, { exact: true }), invalid).toBeVisible();
      }
      await plate.fill('');
      await dialog.getByTestId('quick-dispatch-submit').click();
      await expect(dialog.getByText(TEXT.plateRequired, { exact: true })).toBeVisible();
      await page.waitForTimeout(500);
      expect(dispatchCalls, '형식 오류는 dispatch 미전송').toEqual([]);

      await plate.fill(PLATE_VALID[0]);
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(`/api/quick-request/${main.requestNo}/dispatch`) && res.request().method() === 'POST'
      );
      await dialog.getByTestId('quick-dispatch-submit').click();
      expect((await responsePromise).status()).toBe(200);
      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expect(page.getByTestId('quick-detail-status')).toHaveText(STATUS_LABEL.dispatched, { timeout: 20_000 });
      const dispatchSection = page.getByTestId('quick-detail-section-dispatch');
      await expect(dispatchSection).toContainText(TEXT.plateLabel);
      await expect(dispatchSection).toContainText(PLATE_VALID[0]);
      await expect(dispatchSection).not.toContainText('차량정보');

      // 수정 Sheet(dispatched) — 같은 라벨·placeholder·검사
      await page.getByTestId('quick-detail-edit').click();
      const sheet = page.getByTestId('quick-edit-sheet');
      await expect(sheet).toBeVisible();
      const editPlate = sheet.getByTestId('quick-edit-vehicle-info');
      await expect(editPlate).toHaveValue(PLATE_VALID[0]);
      await expect(editPlate).toHaveAttribute('placeholder', TEXT.platePlaceholder);
      await expect(sheet.getByLabel(TEXT.plateLabel)).toBeVisible();
      await editPlate.fill(PLATE_INVALID[1]);
      await sheet.getByTestId('quick-edit-save').click();
      await expect(sheet.getByText(TEXT.plateInvalid, { exact: true })).toBeVisible();
      await page.waitForTimeout(500);
      expect(patchCalls, '형식 오류는 PATCH 미전송').toEqual([]);
      await sheet.getByTestId('quick-edit-close').click();
      // 저장하지 않은 수정 → 가드 AlertModal(plan 14 표준) 「나가기」
      await page.getByRole('button', { name: '나가기' }).click();
      await expect(sheet).toBeHidden();
    } finally {
      await context.close();
    }

    // 알림 본문 — 92 AC-12 값 교체
    const dispatched = (await dbNotificationsByEvent(main.requestNo, 'dispatched')).filter(
      (row) => row.recipient_user_id === user.userId
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe(NOTIFY_TYPE.requester);
    expect(dispatched[0].title).toBe(NOTIFY_TITLE.dispatched(main.requestNo));
    expect(dispatched[0].body).toBe(`${PLATE_VALID[0]} · 기사 홍길동 · 예상 20,000원`);

    // API — 유효 3종(나머지 2종) 200 · 무효 2종 400 같은 문구 (dispatch · PATCH)
    for (const valid of PLATE_VALID.slice(1)) {
      const seeded = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E94PLV'));
      const result = await callAs('dongbang', (api) =>
        api.post(`/api/quick-request/${seeded.requestNo}/dispatch`, { data: DISPATCH_WITH(valid) })
      );
      expect(result.status, `${valid} → 200 ${JSON.stringify(result.body)}`).toBe(200);
    }
    const pending = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E94PLI'));
    for (const invalid of PLATE_INVALID) {
      const result = await callAs('dongbang', (api) =>
        api.post(`/api/quick-request/${pending.requestNo}/dispatch`, { data: DISPATCH_WITH(invalid) })
      );
      expect(result.status, `${invalid} → 400`).toBe(400);
      expect((result.body.errors as Record<string, string>)?.vehicleInfo).toBe(TEXT.plateInvalid);
      expect(result.headers['x-request-id']).toBeTruthy();
    }
    for (const invalid of PLATE_INVALID) {
      const result = await callAs('dongbang', (api) =>
        api.patch(`/api/quick-request/${main.requestNo}`, { data: { dispatchVehicleInfo: invalid } })
      );
      expect(result.status, `PATCH ${invalid} → 400`).toBe(400);
      expect((result.body.errors as Record<string, string>)?.dispatchVehicleInfo).toBe(TEXT.plateInvalid);
    }
    const patched = await callAs('dongbang', (api) =>
      api.patch(`/api/quick-request/${main.requestNo}`, { data: { dispatchVehicleInfo: PLATE_VALID[1] } })
    );
    expect(patched.status, 'PATCH 유효 → 200').toBe(200);
  });

  test('AC-18: 처리 이력 — 최종금액 입력 → 배차 완료 → 접수 → 등록(최신 위) · 절대 시각 · 취소 건은 「취소」 맨 위', async ({ page }) => {
    const flow = await seedQuickRequest('dispatchedWithFinal', 'user', uniqueTag('E2E94HIS'));
    await gotoDetail(page, flow.requestNo);
    const history = page.getByTestId('quick-detail-section-history');
    const items = history.getByRole('listitem');
    await expect(items).toHaveCount(4);
    const testIds = await items.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.testid));
    expect(testIds).toEqual([
      'quick-detail-history-final-amount',
      'quick-detail-history-dispatched',
      'quick-detail-history-accepted',
      'quick-detail-history-created'
    ]);
    await expect(items.nth(0)).toContainText('최종금액 입력');
    await expect(items.nth(1)).toContainText('배차 완료');
    await expect(items.nth(2)).toContainText('접수');
    await expect(items.nth(3)).toContainText('등록');
    for (let index = 0; index < 4; index += 1) {
      await expect(items.nth(index)).toContainText(ABSOLUTE_DATETIME_RE);
    }

    const cancelled = await seedQuickRequest('cancelled', 'user', uniqueTag('E2E94HISC'));
    await gotoDetail(page, cancelled.requestNo);
    const cancelledItems = page.getByTestId('quick-detail-section-history').getByRole('listitem');
    await expect(cancelledItems).toHaveCount(2);
    await expect(cancelledItems.first()).toHaveAttribute('data-testid', 'quick-detail-history-cancelled');
    await expect(cancelledItems.first()).toContainText('취소');
    await expect(cancelledItems.last()).toHaveAttribute('data-testid', 'quick-detail-history-created');
  });

  test('AC-19: 배차 완료 건 상세 — 요청자·기사·출발/도착 담당 연락처가 tel: 링크 · 표시 010-1234-5678', async ({ page }) => {
    const user = await fixtureUser('user');
    const { requestNo } = await seedQuickRequest('dispatched', 'user', uniqueTag('E2E94TEL'));
    await gotoDetail(page, requestNo);

    const driver = page.getByTestId('quick-detail-driver-phone');
    await expect(driver).toHaveAttribute('href', 'tel:01012345678');
    await expect(driver).toHaveText('010-1234-5678');

    const route = page.getByTestId('quick-detail-section-route');
    await expect(route.getByRole('link', { name: '010-5550-1234' })).toHaveAttribute('href', `tel:${CONTACT_PHONE_ORIGIN}`);
    await expect(route.getByRole('link', { name: '010-5550-5678' })).toHaveAttribute('href', `tel:${CONTACT_PHONE_DEST}`);

    const phone = await profilePhone(user.userId);
    const requestSection = page.getByTestId('quick-detail-section-request');
    if (phone) {
      const link = requestSection.getByRole('link', { name: /^\d{2,3}-\d{3,4}-\d{4}$/ });
      await expect(link).toHaveAttribute('href', `tel:${phone}`);
    } else {
      await expect(requestSection).toContainText('—');
    }

    const telLinks = page.getByRole('link').filter({ hasText: /^\d{2,3}-\d{3,4}-\d{4}$/ });
    const hrefs = await telLinks.evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href')));
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) expect(href).toMatch(/^tel:\d+$/);
  });
});
