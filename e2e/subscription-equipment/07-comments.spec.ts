import { expect, test, type Page } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  changeStatusViaApi,
  createEquipmentFixture,
  createRequestViaApi,
  EQUIPMENT_PATH,
  expectLog,
  fullNameOf,
  MSG,
  pageAs,
  postCommentViaApi,
  uniqueTag,
  UI_TIMEOUT,
  withApi
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-35 댓글 Realtime(2 컨텍스트) · 답글 들여쓰기 · 이름·역할 배지·절대 시각
 * AC-36 본인 댓글만 수정 · AC-37 soft delete(답글 유지 · 권한자는 남의 댓글 삭제) · AC-38 남의 요청 댓글 404
 */

const REALTIME_TIMEOUT = 5_000;

async function openRequest(page: Page, equipmentId: number, requestId: number) {
  await page.goto(`${EQUIPMENT_PATH}?equipment=${equipmentId}&request=${requestId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('asset-comments-section')).toBeVisible({ timeout: UI_TIMEOUT });
}

async function newRequest(playwright: Parameters<typeof withApi>[0], tag: string) {
  const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 댓글 모니터` });
  const request = await withApi(playwright, 'staff', (api) =>
    createRequestViaApi(api, { target_type: 'equipment', target_id: equipment.id })
  );
  return { equipmentId: equipment.id, requestId: request.id };
}

test.describe('plan 103 · 요청 댓글', () => {
  test('AC-35: 직원 댓글 → hr 화면에 5초 안 표시(Realtime) · hr 답글 들여쓰기 · 이름·역할 배지(요청자/담당자/권한자)·절대 시각', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const { equipmentId, requestId } = await newRequest(playwright, tag);
    const staffName = await fullNameOf('staff');
    const hrName = await fullNameOf('hr');
    const accountingName = await fullNameOf('accounting');

    const staff = await pageAs(browser, 'staff');
    const hr = await pageAs(browser, 'hr');
    try {
      await openRequest(staff.page, equipmentId, requestId);
      await openRequest(hr.page, equipmentId, requestId);
      await expect(hr.page.getByTestId('asset-comments-empty')).toBeVisible();
      // Realtime 채널 구독이 붙을 시간을 준다
      await hr.page.waitForTimeout(1_500);

      const body = `E2E ${tag} 화면이 계속 깜빡여요`;
      await staff.page.getByTestId('asset-comment-input').fill(body);
      const postPromise = staff.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${requestId}/comments` &&
          response.request().method() === 'POST'
      );
      await staff.page.getByTestId('asset-comment-submit').click();
      const postResponse = await postPromise;
      expect(postResponse.status()).toBe(201);
      const c1 = ((await postResponse.json()) as { comment: { id: number } }).comment.id;

      const c1OnHr = hr.page.getByTestId(`asset-comment-${c1}`);
      await expect(c1OnHr, 'hr 화면에 새로고침 없이 5초 안').toContainText(body, { timeout: REALTIME_TIMEOUT });
      await expect(c1OnHr).toContainText(staffName);
      await expect(c1OnHr.getByTestId('asset-comment-role')).toHaveText('요청자');
      await expect(c1OnHr).toContainText(ABSOLUTE_DATETIME_RE);
      await expect(c1OnHr).toHaveAttribute('data-depth', '0');

      // hr 답글 (요청이 접수대기라 담당자 없음 → 「권한자」)
      await staff.page.waitForTimeout(500);
      await c1OnHr.getByTestId(`asset-comment-reply-${c1}`).click();
      const replyBody = `E2E ${tag} 확인해 볼게요`;
      await hr.page.getByTestId('asset-comment-inline-input').fill(replyBody);
      const replyPromise = hr.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${requestId}/comments/${c1}/replies` &&
          response.request().method() === 'POST'
      );
      await hr.page.getByTestId('asset-comment-inline-submit').click();
      const replyResponse = await replyPromise;
      expect(replyResponse.status()).toBe(201);
      const reply = ((await replyResponse.json()) as { comment: { id: number } }).comment.id;

      const replyOnStaff = staff.page.getByTestId(`asset-comment-${reply}`);
      await expect(replyOnStaff, '직원 화면에 답글 Realtime').toContainText(replyBody, { timeout: REALTIME_TIMEOUT });
      await expect(replyOnStaff).toHaveAttribute('data-depth', '1');
      await expect(replyOnStaff).toContainText(hrName);
      await expect(replyOnStaff.getByTestId('asset-comment-role')).toHaveText('권한자');
      await expect(replyOnStaff).toContainText(ABSOLUTE_DATETIME_RE);
      const parentBox = await staff.page.getByTestId(`asset-comment-${c1}`).getByRole('article').boundingBox();
      const replyBox = await replyOnStaff.getByRole('article').boundingBox();
      expect(replyBox!.y, '답글은 원댓글 아래').toBeGreaterThan(parentBox!.y);
      expect(replyBox!.x, '답글은 들여쓰기').toBeGreaterThan(parentBox!.x);

      // 처리 시작(담당자 = hr) 뒤: hr 글 「담당자」 · 회계팀 글 「권한자」
      await withApi(playwright, 'hr', (api) => changeStatusViaApi(api, requestId, 'in_progress'));
      const accountingComment = await withApi(playwright, 'accounting', (api) =>
        postCommentViaApi(api, requestId, `E2E ${tag} 회계팀 확인`)
      );
      await openRequest(staff.page, equipmentId, requestId);
      await expect(staff.page.getByTestId(`asset-comment-${reply}`).getByTestId('asset-comment-role')).toHaveText('담당자', {
        timeout: UI_TIMEOUT
      });
      const accountingItem = staff.page.getByTestId(`asset-comment-${accountingComment.id}`);
      await expect(accountingItem).toContainText(accountingName);
      await expect(accountingItem.getByTestId('asset-comment-role')).toHaveText('권한자');
      await expect(staff.page.getByTestId(`asset-comment-${c1}`).getByTestId('asset-comment-role')).toHaveText('요청자');
    } finally {
      await staff.context.close();
      await hr.context.close();
    }
  });

  test('AC-36: 직원 본인 댓글 수정 → 「수정됨 …」 · hr 댓글에는 수정 버튼 없음 · 남의 댓글 PATCH 403 + 로그', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const { equipmentId, requestId } = await newRequest(playwright, tag);
    const c1 = await withApi(playwright, 'staff', (api) => postCommentViaApi(api, requestId, `E2E ${tag} 직원 원글`));
    const c2 = await withApi(playwright, 'hr', (api) => postCommentViaApi(api, requestId, `E2E ${tag} hr 원글`));

    const { context, page } = await pageAs(browser, 'staff');
    try {
      await openRequest(page, equipmentId, requestId);
      const item = page.getByTestId(`asset-comment-${c1.id}`);
      await expect(item).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId(`asset-comment-${c2.id}`)).toBeVisible();
      await expect(page.getByTestId(`asset-comment-edit-${c2.id}`)).toHaveCount(0);

      await item.getByTestId(`asset-comment-edit-${c1.id}`).click();
      const edited = `E2E ${tag} 직원 고친 글`;
      await item.getByTestId('asset-comment-inline-input').fill(edited);
      const patchPromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${requestId}/comments/${c1.id}` &&
          response.request().method() === 'PATCH'
      );
      await item.getByTestId('asset-comment-inline-submit').click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status()).toBe(200);
      await expect(item).toContainText(edited, { timeout: UI_TIMEOUT });
      await expect(item).toContainText(new RegExp(`수정됨 ${ABSOLUTE_DATETIME_RE.source}`));
      await expectLog(patchResponse, { action: 'asset_request.comment_update', status: 200 });
    } finally {
      await context.close();
    }

    await withApi(playwright, 'staff', async (api) => {
      const response = await api.patch(`/api/asset-requests/${requestId}/comments/${c2.id}`, {
        data: { body: 'E2E 남의 글 고치기' }
      });
      expect(response.status()).toBe(403);
      await expectLog(response, { action: 'asset_request.comment_update', status: 403 });
    });
  });

  test('AC-37: 직원 C1 삭제(AlertModal 「댓글을 삭제할까요?」) → 「삭제된 댓글입니다.」 · 답글 유지 · hr는 남의 댓글 C3 삭제 · comment_delete 로그 · window.confirm 0회', async ({
    browser,
    playwright
  }) => {
    const tag = uniqueTag();
    const { equipmentId, requestId } = await newRequest(playwright, tag);
    const c1 = await withApi(playwright, 'staff', (api) => postCommentViaApi(api, requestId, `E2E ${tag} 지울 원글`));
    const reply = await withApi(playwright, 'hr', (api) =>
      postCommentViaApi(api, requestId, `E2E ${tag} 남을 답글`, c1.id)
    );
    const c3 = await withApi(playwright, 'staff', (api) => postCommentViaApi(api, requestId, `E2E ${tag} 권한자가 지울 글`));

    let nativeDialogs = 0;
    const staff = await pageAs(browser, 'staff');
    staff.page.on('dialog', async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });
    try {
      await openRequest(staff.page, equipmentId, requestId);
      const item = staff.page.getByTestId(`asset-comment-${c1.id}`);
      await item.getByTestId(`asset-comment-delete-${c1.id}`).click();
      const confirm = staff.page.getByRole('dialog', { name: '댓글을 삭제할까요?' });
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      const deletePromise = staff.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${requestId}/comments/${c1.id}` &&
          response.request().method() === 'DELETE'
      );
      await confirm.getByRole('button', { name: '삭제', exact: true }).click();
      const deleteResponse = await deletePromise;
      expect(deleteResponse.status()).toBe(200);
      await expect(item).toContainText(MSG.commentDeleted, { timeout: UI_TIMEOUT });
      await expect(item).not.toContainText(`E2E ${tag} 지울 원글`);
      await expect(staff.page.getByTestId(`asset-comment-${reply.id}`)).toContainText(`E2E ${tag} 남을 답글`);
      await expectLog(deleteResponse, { action: 'asset_request.comment_delete', status: 200 });
    } finally {
      await staff.context.close();
    }

    const hr = await pageAs(browser, 'hr');
    hr.page.on('dialog', async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });
    try {
      await openRequest(hr.page, equipmentId, requestId);
      const item = hr.page.getByTestId(`asset-comment-${c3.id}`);
      await item.getByTestId(`asset-comment-delete-${c3.id}`).click();
      const confirm = hr.page.getByRole('dialog', { name: '댓글을 삭제할까요?' });
      await expect(confirm).toBeVisible({ timeout: UI_TIMEOUT });
      const deletePromise = hr.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/asset-requests/${requestId}/comments/${c3.id}` &&
          response.request().method() === 'DELETE'
      );
      await confirm.getByRole('button', { name: '삭제', exact: true }).click();
      const deleteResponse = await deletePromise;
      expect(deleteResponse.status()).toBe(200);
      await expect(item).toContainText(MSG.commentDeleted, { timeout: UI_TIMEOUT });
      const log = await expectLog(deleteResponse, { action: 'asset_request.comment_delete', status: 200 });
      expect(log.metadata?.deleted_by_manager).toBe(true);
    } finally {
      await hr.context.close();
    }
    expect(nativeDialogs, 'window.confirm 사용 0회').toBe(0);
  });

  test('AC-38: 다른 직원 — 남의 요청 댓글 GET/POST 404 · POST 404 로그', async ({ playwright }) => {
    const tag = uniqueTag();
    const { requestId } = await newRequest(playwright, tag);
    await withApi(playwright, 'other', async (api) => {
      expect((await api.get(`/api/asset-requests/${requestId}/comments`)).status()).toBe(404);
      const post = await api.post(`/api/asset-requests/${requestId}/comments`, { data: { body: 'E2E 남의 요청에 댓글' } });
      expect(post.status()).toBe(404);
      await expectLog(post, { action: 'asset_request.comment_create', status: 404 });
    });
  });
});
