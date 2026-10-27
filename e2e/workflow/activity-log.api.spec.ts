import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
  apiAs,
  approve,
  cancel,
  createDoc,
  decline,
  expectLogRow,
  json,
  marker,
  postDocument,
  purchaseValues,
  putPolicy,
  readPolicy,
  requestIdOf,
  uid,
  uploadAttachment,
  type LogItem
} from './helpers';

/**
 * plan 88 AC-42 — CUD 15 action activity log (x-request-id + action 행 + status, metadata allowlist)
 */

const METADATA_ALLOWLIST = new Set([
  'document_id',
  'document_code',
  'template_key',
  'step',
  'starred',
  'changed_field_keys',
  'attachment_count',
  'error_code'
]);

let user: APIRequestContext;
let user2: APIRequestContext;
let admin: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  user = await apiAs(playwright, 'user');
  user2 = await apiAs(playwright, 'user2');
  admin = await apiAs(playwright, 'admin');
});

test.afterAll(async () => {
  await Promise.all([user, user2, admin].map((ctx) => ctx?.dispose()));
});

test('AC-42: 워크플로우 CUD activity log — request_id·action·status 행, metadata에 입력값 0건', async () => {
  test.setTimeout(240_000);
  const mark = marker();
  const comment = `E2E-WF 감사 댓글 ${mark}`;
  const reason = `E2E-WF 반려 사유 ${mark}`;
  const forbidden = [mark, comment, reason, '194840', 'E2E 은행', 'E2E 업체', 'e2e-wf.png', 'E2E 품목'];

  const checks: Array<{ action: string; response: APIResponse; status: number }> = [];
  const track = (action: string, response: APIResponse, status: number) => {
    expect(response.status(), `${action} ${response.url()}`).toBe(status);
    checks.push({ action, response, status });
  };

  // attachment prepare / complete / delete
  const att = await uploadAttachment(user);
  track('workflow.attachment_upload', att.prepare, 200);
  track('workflow.attachment_upload', att.complete, 201);
  const extra = await uploadAttachment(user, 'e2e-wf-extra.png');
  track('workflow.attachment_delete', await user.delete(`/api/workflow/attachments/${extra.id}`), 200);

  // document POST 201 · 400
  const created = await postDocument(user, {
    values: purchaseValues(mark),
    steps: [[uid('user2')]],
    attachmentIds: [att.id]
  });
  track('workflow.document_create', created, 201);
  const docId = (await json<{ document: { id: string } }>(created)).document.id;
  track(
    'workflow.document_create',
    await postDocument(user, { values: purchaseValues(mark, { amount: '0' }), steps: [[uid('user2')]] }),
    400
  );

  // star · comment
  track(
    'workflow.document_star',
    await user.put(`/api/workflow/documents/${docId}/star`, { data: { starred: true } }),
    200
  );
  track(
    'workflow.comment_create',
    await user.post(`/api/workflow/documents/${docId}/comments`, { data: { content: comment } }),
    201
  );

  // PATCH · approval-line PUT (진행중)
  track(
    'workflow.document_update',
    await user2.patch(`/api/workflow/documents/${docId}`, {
      data: { values: { note: `${mark} 수정`, bank_account: 'E2E 은행 999' } }
    }),
    200
  );
  track(
    'workflow.approval_line_update',
    await user.put(`/api/workflow/documents/${docId}/approval-line`, {
      data: { steps: [[uid('user2')], [uid('admin')]], referrers: [] }
    }),
    200
  );

  // approve 403 (작성자) · 200 (user2)
  track('workflow.document_approve', await approve(user, docId), 403);
  track('workflow.document_approve', await approve(user2, docId, `의견 ${mark}`), 200);

  // decline (2단계 admin)
  track('workflow.document_decline', await decline(admin, docId, reason), 200);

  // cancel (새 문서)
  const toCancel = await createDoc(user, { steps: [[uid('user2')]] });
  track('workflow.document_cancel', await cancel(user, toCancel.id), 200);

  // draft POST / DELETE
  const draft = await user.post('/api/workflow/drafts', {
    data: {
      template_key: 'expense',
      payload: { values: purchaseValues(mark), content_html: '<p>d</p>', steps: [[uid('user2')]], referrers: [] },
      attachment_ids: []
    }
  });
  track('workflow.draft_save', draft, 201);
  const draftId = (await json<{ draft: { id: string } }>(draft)).draft.id;
  track('workflow.draft_delete', await user.delete(`/api/workflow/drafts/${draftId}`), 200);

  // admin grant / revoke
  track('workflow.admin_grant', await admin.post('/api/workflow/admins', { data: { user_id: uid('user2') } }), 201);
  track('workflow.admin_revoke', await admin.delete(`/api/workflow/admins/${uid('user2')}`), 200);

  // policy PUT (현재 값 그대로 저장 → 원복 불필요)
  const policy = await readPolicy(admin);
  const policyRes = await admin.put('/api/workflow/templates/expense/policy', { data: policy });
  track('workflow.template_policy_update', policyRes, 200);
  await putPolicy(admin, policy);

  const actions = new Set(checks.map((check) => check.action));
  expect(actions.size).toBe(15);

  for (const check of checks) {
    const requestId = requestIdOf(check.response);
    const row: LogItem = await expectLogRow(admin, check.action, requestId, check.status);
    const metadata = row.metadata ?? {};
    for (const key of Object.keys(metadata)) {
      expect(METADATA_ALLOWLIST.has(key), `${check.action} metadata key ${key}`).toBe(true);
    }
    const serialized = JSON.stringify(metadata);
    for (const value of forbidden) {
      expect(serialized, `${check.action} metadata contains input`).not.toContain(value);
    }
  }
});
