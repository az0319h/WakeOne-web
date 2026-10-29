import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIResponse } from '@playwright/test';
import {
  createEquipmentFixture,
  logsByRequestId,
  pageAs,
  uniqueTag,
  UI_TIMEOUT,
  userIdOf,
  apiAs
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-44 메일 코드·메일 Route 호출 0 · AC-45 activity log 14 action(2xx + 4xx · target_type · metadata 민감값 없음) · AC-46 로그 화면 라벨
 */

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

type Call = { response: APIResponse; action: string; status: number; target_type: string };

test.describe('plan 103 · 활동 로그 · 메일 없음', () => {
  test('AC-44: 새 feature·API에 메일 라이브러리 0건 · 새 spec에 메일 Route 호출 0건', () => {
    const root = process.cwd();
    const sourceDirs = [
      'src/features/subscriptions',
      'src/features/equipment',
      'src/features/asset-requests',
      'src/features/asset-ledger',
      'src/app/api/subscriptions',
      'src/app/api/equipment',
      'src/app/api/asset-requests',
      'src/app/api/asset-ledger'
    ];
    const mailPattern = /nodemailer|sendMail|resend|smtp/i;
    const sourceFiles = sourceDirs.flatMap((dir) => walk(path.join(root, dir)));
    expect(sourceFiles.length).toBeGreaterThan(20);
    const mailHits = sourceFiles.filter((file) => mailPattern.test(fs.readFileSync(file, 'utf8')));
    expect(mailHits, '메일 코드 0건').toEqual([]);

    // 패턴 문자열을 조각으로 만들어 이 파일 자체가 걸리지 않게 한다
    const routePattern = new RegExp(`${['contracts', 'reminders'].join('/')}|${['balance', 'email'].join('-')}`);
    const specFiles = [
      ...walk(path.join(root, 'e2e/subscription-equipment')),
      path.join(root, 'e2e/helpers/asset-ledger.ts'),
      path.join(root, 'e2e/auth.asset-ledger.setup.ts')
    ];
    const routeHits = specFiles.filter((file) => routePattern.test(fs.readFileSync(file, 'utf8')));
    expect(routeHits, '메일 Route 호출 0건').toEqual([]);
  });

  test('AC-45: 14 action 모두 2xx 행 + 403/400 행 · target_type 일치 · metadata에 금액·카드·메모·요청 본문·댓글 본문 없음', async ({
    playwright
  }) => {
    test.setTimeout(240_000);
    const tag = uniqueTag();
    const secret = {
      amount: 86123,
      amount2: 99321,
      card: '7913',
      memo: `E2E 메모 비공개 ${tag}`,
      owner: `e2e-log-${tag.toLowerCase()}@example.com`,
      purchase: 351234,
      body: `E2E 요청 본문 비공개 ${tag}`,
      body2: `E2E 수정 본문 비공개 ${tag}`,
      comment: `E2E 댓글 본문 비공개 ${tag}`,
      comment2: `E2E 댓글 수정 비공개 ${tag}`,
      reply: `E2E 답글 본문 비공개 ${tag}`
    };
    const calls: Call[] = [];
    const record = (response: APIResponse, action: string, status: number, target_type: string) => {
      expect(response.status(), `${action} → ${status}`).toBe(status);
      calls.push({ response, action, status, target_type });
    };

    const hr = await apiAs(playwright, 'hr');
    const staff = await apiAs(playwright, 'staff');
    const accounting = await apiAs(playwright, 'accounting');
    try {
      // 구독 CUD
      const subCreate = await hr.post('/api/subscriptions', {
        data: {
          category: 'software',
          name: `E2E ${tag} 로그 구독`,
          status: 'active',
          amount: secret.amount,
          currency: 'KRW',
          card_last4: secret.card,
          owner_account: secret.owner,
          manager_memo: secret.memo
        }
      });
      record(subCreate, 'subscription.create', 201, 'subscription');
      const subscriptionId = ((await subCreate.json()) as { item: { id: number } }).item.id;
      record(await staff.post('/api/subscriptions', { data: { category: 'software', name: `E2E ${tag} x` } }), 'subscription.create', 403, 'subscription');
      record(await hr.post('/api/subscriptions', { data: { category: 'software', name: '' } }), 'subscription.create', 400, 'subscription');
      record(
        await hr.patch(`/api/subscriptions/${subscriptionId}`, { data: { plan_name: 'E2E 플랜', amount: secret.amount2 } }),
        'subscription.update',
        200,
        'subscription'
      );
      record(await staff.patch(`/api/subscriptions/${subscriptionId}`, { data: { plan_name: 'x' } }), 'subscription.update', 403, 'subscription');
      record(await hr.patch(`/api/subscriptions/${subscriptionId}`, { data: { card_last4: '12' } }), 'subscription.update', 400, 'subscription');

      // 비품 CUD
      const assetNo = `M-${5000 + Math.floor(Math.random() * 4999)}`;
      const eqCreate = await hr.post('/api/equipment', {
        data: {
          kind: 'monitor',
          asset_no: assetNo,
          model_serial: `E2E ${tag} 로그 모니터`,
          purchase_amount: secret.purchase,
          manager_memo: secret.memo
        }
      });
      record(eqCreate, 'equipment.create', 201, 'equipment_item');
      const equipmentId = ((await eqCreate.json()) as { item: { id: number } }).item.id;
      record(await staff.post('/api/equipment', { data: { kind: 'monitor', asset_no: 'M-0001' } }), 'equipment.create', 403, 'equipment_item');
      record(
        await hr.post('/api/equipment', { data: { kind: 'monitor', asset_no: 'X-1', model_serial: `E2E ${tag} 형식` } }),
        'equipment.create',
        400,
        'equipment_item'
      );
      record(await hr.patch(`/api/equipment/${equipmentId}`, { data: { status: 'repair' } }), 'equipment.update', 200, 'equipment_item');
      record(await staff.patch(`/api/equipment/${equipmentId}`, { data: { status: 'stored' } }), 'equipment.update', 403, 'equipment_item');
      record(await hr.patch(`/api/equipment/${equipmentId}`, { data: { status: 'nope' } }), 'equipment.update', 400, 'equipment_item');

      // 요청 생성·수정
      const reqCreate = await staff.post('/api/asset-requests', {
        data: { target_type: 'equipment', target_id: equipmentId, request_type: 'repair', body: secret.body }
      });
      record(reqCreate, 'asset_request.create', 201, 'asset_request');
      const requestId = ((await reqCreate.json()) as { request: { id: number } }).request.id;
      record(
        await staff.post('/api/asset-requests', {
          data: { target_type: 'equipment', target_id: equipmentId, request_type: 'repair', body: 'abc' }
        }),
        'asset_request.create',
        400,
        'asset_request'
      );
      record(await staff.patch(`/api/asset-requests/${requestId}`, { data: { body: secret.body2 } }), 'asset_request.update', 200, 'asset_request');
      record(await hr.patch(`/api/asset-requests/${requestId}`, { data: { body: secret.body2 } }), 'asset_request.update', 403, 'asset_request');

      // 댓글
      const commentCreate = await staff.post(`/api/asset-requests/${requestId}/comments`, { data: { body: secret.comment } });
      record(commentCreate, 'asset_request.comment_create', 201, 'asset_request_comment');
      const commentId = ((await commentCreate.json()) as { comment: { id: number } }).comment.id;
      const replyCreate = await hr.post(`/api/asset-requests/${requestId}/comments/${commentId}/replies`, {
        data: { body: secret.reply }
      });
      record(replyCreate, 'asset_request.comment_create', 201, 'asset_request_comment');
      const replyId = ((await replyCreate.json()) as { comment: { id: number } }).comment.id;
      record(await staff.post(`/api/asset-requests/${requestId}/comments`, { data: { body: '' } }), 'asset_request.comment_create', 400, 'asset_request_comment');
      record(
        await staff.patch(`/api/asset-requests/${requestId}/comments/${commentId}`, { data: { body: secret.comment2 } }),
        'asset_request.comment_update',
        200,
        'asset_request_comment'
      );
      record(
        await staff.patch(`/api/asset-requests/${requestId}/comments/${replyId}`, { data: { body: secret.comment2 } }),
        'asset_request.comment_update',
        403,
        'asset_request_comment'
      );
      record(await staff.delete(`/api/asset-requests/${requestId}/comments/${replyId}`), 'asset_request.comment_delete', 403, 'asset_request_comment');
      record(await staff.delete(`/api/asset-requests/${requestId}/comments/${commentId}`), 'asset_request.comment_delete', 200, 'asset_request_comment');

      // 상태·담당자
      record(await staff.post(`/api/asset-requests/${requestId}/status`, { data: { status: 'in_progress' } }), 'asset_request.status_update', 403, 'asset_request');
      record(await hr.post(`/api/asset-requests/${requestId}/status`, { data: { status: 'in_progress' } }), 'asset_request.status_update', 200, 'asset_request');
      record(
        await staff.patch(`/api/asset-requests/${requestId}/assignee`, { data: { assignee_user_id: userIdOf('staff') } }),
        'asset_request.assignee_update',
        403,
        'asset_request'
      );
      record(
        await hr.patch(`/api/asset-requests/${requestId}/assignee`, { data: { assignee_user_id: userIdOf('staff') } }),
        'asset_request.assignee_update',
        400,
        'asset_request'
      );
      record(
        await accounting.patch(`/api/asset-requests/${requestId}/assignee`, {
          data: { assignee_user_id: userIdOf('accounting') }
        }),
        'asset_request.assignee_update',
        200,
        'asset_request'
      );

      // 취소 (새 접수대기 요청)
      const second = await createEquipmentFixture({ model_serial: `E2E ${tag} 취소 모니터` });
      const r2Create = await staff.post('/api/asset-requests', {
        data: { target_type: 'equipment', target_id: second.id, request_type: 'return', body: secret.body }
      });
      expect(r2Create.status()).toBe(201);
      const r2 = ((await r2Create.json()) as { request: { id: number } }).request.id;
      record(await hr.post(`/api/asset-requests/${r2}/cancel`), 'asset_request.cancel', 403, 'asset_request');
      record(await staff.post(`/api/asset-requests/${r2}/cancel`), 'asset_request.cancel', 200, 'asset_request');

      // 삭제 (요청 있는 비품 409 · 요청 없는 비품 200 · 구독 200)
      record(await hr.delete(`/api/equipment/${second.id}`), 'equipment.delete', 409, 'equipment_item');
      record(await staff.delete(`/api/equipment/${second.id}`), 'equipment.delete', 403, 'equipment_item');
      const third = await hr.post('/api/equipment', {
        data: { kind: 'keyboard', asset_no: `K-${5000 + Math.floor(Math.random() * 4999)}`, model_serial: `E2E ${tag} 지울 키보드` }
      });
      expect(third.status()).toBe(201);
      const thirdId = ((await third.json()) as { item: { id: number } }).item.id;
      record(await hr.delete(`/api/equipment/${thirdId}`), 'equipment.delete', 200, 'equipment_item');
      record(await staff.delete(`/api/subscriptions/${subscriptionId}`), 'subscription.delete', 403, 'subscription');
      record(await hr.delete(`/api/subscriptions/${subscriptionId}`), 'subscription.delete', 200, 'subscription');
    } finally {
      await hr.dispose();
      await staff.dispose();
      await accounting.dispose();
    }

    const forbiddenFragments = [
      String(secret.amount),
      String(secret.amount2),
      secret.card,
      secret.memo,
      secret.owner,
      String(secret.purchase),
      secret.body,
      secret.body2,
      secret.comment,
      secret.comment2,
      secret.reply
    ];
    const seen = new Map<string, Set<string>>();
    for (const call of calls) {
      const requestId = call.response.headers()['x-request-id'];
      expect(requestId, `${call.action} ${call.status} x-request-id`).toBeTruthy();
      const rows = await logsByRequestId(requestId);
      const row = rows.find((item) => item.action === call.action);
      expect(row, `${call.action} ${call.status} 로그 행`).toBeTruthy();
      expect(row!.http_status, `${call.action} http_status`).toBe(call.status);
      expect(row!.target_type, `${call.action} ${call.status} target_type`).toBe(call.target_type);
      const metadataText = JSON.stringify(row!.metadata ?? {});
      for (const fragment of forbiddenFragments) {
        expect(metadataText, `${call.action} metadata에 민감값 없음`).not.toContain(fragment);
      }
      const kinds = seen.get(call.action) ?? new Set<string>();
      kinds.add(call.status < 300 ? '2xx' : '4xx');
      seen.set(call.action, kinds);
    }
    const actions = [
      'subscription.create',
      'subscription.update',
      'subscription.delete',
      'equipment.create',
      'equipment.update',
      'equipment.delete',
      'asset_request.create',
      'asset_request.update',
      'asset_request.cancel',
      'asset_request.status_update',
      'asset_request.assignee_update',
      'asset_request.comment_create',
      'asset_request.comment_update',
      'asset_request.comment_delete'
    ];
    expect(actions).toHaveLength(14);
    for (const action of actions) {
      expect([...(seen.get(action) ?? [])].sort(), `${action} 2xx·4xx 행`).toEqual(['2xx', '4xx']);
    }
  });

  test('AC-46: admin /dashboard/logs action 필터에 새 한국어 라벨 · asset.create/update/delete 없음', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto('/dashboard/logs', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: '활동 로그' })).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible({ timeout: UI_TIMEOUT });
      // hydration 전 클릭은 Popover가 안 열려서, 열릴 때까지 다시 누른다
      await expect(async () => {
        await page.getByRole('toolbar').getByRole('button', { name: '활동 유형', exact: true }).click();
        await expect(page.getByPlaceholder('활동 유형')).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: UI_TIMEOUT });
      for (const label of [
        '구독 추가',
        '구독 수정',
        '구독 삭제',
        '비품 추가',
        '비품 수정',
        '비품 삭제',
        '자산 요청 등록',
        '자산 요청 수정',
        '자산 요청 취소',
        '자산 요청 상태 변경',
        '자산 요청 담당자 변경',
        '자산 요청 댓글 등록',
        '자산 요청 댓글 수정',
        '자산 요청 댓글 삭제'
      ]) {
        await expect(page.getByRole('option', { name: label, exact: true }), label).toHaveCount(1, { timeout: UI_TIMEOUT });
      }
      for (const removed of ['asset.create', 'asset.update', 'asset.delete']) {
        await expect(page.getByRole('option', { name: removed })).toHaveCount(0);
      }
      await expect(page.getByRole('option', { name: '구독 추가', exact: true })).toBeAttached();
    } finally {
      await context.close();
    }
  });
});
