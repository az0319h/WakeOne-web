import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  apiAs,
  approve,
  cancel,
  codePattern,
  createDoc,
  decline,
  docNotifications,
  expectDocNotification,
  expectError,
  getDetail,
  inactiveUserId,
  json,
  kstToday,
  marker,
  paymentValues,
  postDocument,
  purchaseValues,
  putPolicy,
  readPolicy,
  REQ_PAYMENT,
  requestIdOf,
  uid,
  uploadAttachment,
  type Policy
} from './helpers';

/**
 * plan 88 `docs/plans/88_workflow-expense-plan.md` — API AC
 * AC-06 · 13 · 14 · 15 · 21 · 22 · 27 · 28 · 30 · 41
 */

let user: APIRequestContext;
let user2: APIRequestContext;
let hr: APIRequestContext;
let admin: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  user = await apiAs(playwright, 'user');
  user2 = await apiAs(playwright, 'user2');
  hr = await apiAs(playwright, 'hr');
  admin = await apiAs(playwright, 'admin');
});

test.afterAll(async () => {
  await Promise.all([user, user2, hr, admin].map((ctx) => ctx?.dispose()));
});

test.describe('plan 88 워크플로우 API', () => {
  test('AC-06: 기본 결재선 policy PUT 검증 (빈 단계·비활성·중복 400, 0단계 허용)', async () => {
    const original: Policy = await readPolicy(admin);
    const inactive = await inactiveUserId();
    try {
      const base = { referrers: [], approval_step_edit_enabled: true };
      const emptyStep = await admin.put('/api/workflow/templates/expense/policy', {
        data: { ...base, steps: [[uid('user2')], []] }
      });
      await expectError(emptyStep, 400, '승인자가 없는 단계가 있습니다.');

      const inactiveRes = await admin.put('/api/workflow/templates/expense/policy', {
        data: { ...base, steps: [[inactive]] }
      });
      await expectError(inactiveRes, 400, '비활성 사용자는 지정할 수 없습니다.');

      const dup = await admin.put('/api/workflow/templates/expense/policy', {
        data: { ...base, steps: [[uid('user2')], [uid('user2')]] }
      });
      await expectError(dup, 400, '같은 승인자를 여러 번 지정할 수 없습니다.');

      const zero = await admin.put('/api/workflow/templates/expense/policy', {
        data: { ...base, steps: [] }
      });
      expect(zero.status(), await zero.text()).toBe(200);
    } finally {
      await putPolicy(admin, original);
    }
  });

  test('AC-13: 문서 POST 조건부 필수 서버 검증 (①~⑥ + x-request-id)', async () => {
    const steps = [[uid('user2')]];
    const mark = marker();
    const att1 = await uploadAttachment(user);

    // ① 입, 출금 요청 + bank_account 빈 값
    const r1 = await postDocument(user, {
      values: paymentValues(mark, { bank_account: '' }),
      steps,
      attachmentIds: [att1.id]
    });
    await expectError(r1, 400, '계좌정보(은행명) 항목을 입력해 주세요.');
    requestIdOf(r1);

    // ② 구매 요청 + 첨부 0개
    const r2 = await postDocument(user, { values: purchaseValues(mark), steps, attachmentIds: [] });
    await expectError(r2, 400, '첨부파일을 1개 이상 올려 주세요.');
    requestIdOf(r2);

    // ④ request_type 「기타」
    const r4 = await postDocument(user, {
      values: purchaseValues(mark, { request_type: '기타' }),
      steps,
      attachmentIds: [att1.id]
    });
    await expectError(r4, 400, '요청 유형 값이 올바르지 않습니다.');
    requestIdOf(r4);

    // ⑤ amount 0
    const r5 = await postDocument(user, {
      values: purchaseValues(mark, { amount: '0' }),
      steps,
      attachmentIds: [att1.id]
    });
    await expectError(r5, 400, '금액은 0보다 큰 숫자로 입력해 주세요.');
    requestIdOf(r5);

    // ⑥ 클라이언트가 required:false 필드 정의를 보내도 서버는 DB 정의로 검증 (brand 누락)
    const r6 = await postDocument(user, {
      values: purchaseValues(mark, { brand: '' }),
      steps,
      attachmentIds: [att1.id],
      extra: {
        fields: [{ field_key: 'brand', name: '사용 브랜드', type: 'SELECT', required: false, required_when: null }],
        template: { fields: [{ field_key: 'brand', required: false }] }
      }
    });
    await expectError(r6, 400);
    requestIdOf(r6);

    // ③ 구매 요청 필수 전부 + 첨부 + vendor/bank 빈 값 → 201
    const r3 = await postDocument(user, {
      values: purchaseValues(mark, { vendor_account_holder: '', bank_account: '' }),
      steps,
      attachmentIds: [att1.id]
    });
    expect(r3.status(), await r3.text()).toBe(201);
    requestIdOf(r3);
    const body = await json<{ document: { code: string } }>(r3);
    expect(body.document.code).toMatch(/^\d{4}-\d{4,}$/);
  });

  test('AC-14: 결재선 검증 (0단계·작성자 본인·비활성)', async () => {
    const mark = marker();
    const att = await uploadAttachment(user);
    const values = purchaseValues(mark);

    const r1 = await postDocument(user, { values, steps: [], attachmentIds: [att.id] });
    await expectError(r1, 400, '승인자를 1명 이상 지정해 주세요.');

    const r2 = await postDocument(user, { values, steps: [[uid('user')]], attachmentIds: [att.id] });
    await expectError(r2, 400, '작성자는 승인자로 지정할 수 없습니다.');

    const r3 = await postDocument(user, {
      values,
      steps: [[await inactiveUserId()]],
      attachmentIds: [att.id]
    });
    await expectError(r3, 400, '비활성 사용자는 지정할 수 없습니다.');
  });

  test('AC-15: 문서번호 연도별 일련번호 +1, 접두어 없음, 임시저장은 번호 미소모', async () => {
    const first = await createDoc(user, { steps: [[uid('user2')]] });
    const mark = marker();
    const draft = await user.post('/api/workflow/drafts', {
      data: {
        template_key: 'expense',
        payload: {
          values: purchaseValues(mark),
          content_html: '<p>draft</p>',
          steps: [[uid('user2')]],
          referrers: []
        },
        attachment_ids: []
      }
    });
    expect(draft.status(), await draft.text()).toBe(201);
    const draftId = (await json<{ draft: { id: string } }>(draft)).draft.id;
    const second = await createDoc(user, { steps: [[uid('user2')]] });

    const year = kstToday().slice(0, 4);
    for (const code of [first.code, second.code]) {
      expect(code).toMatch(codePattern());
      expect(code.startsWith(`${year}-`)).toBe(true);
      expect(code).not.toMatch(/[A-Za-z]/);
    }
    const n1 = Number(first.code.split('-')[1]);
    const n2 = Number(second.code.split('-')[1]);
    expect(n2).toBe(n1 + 1);

    const del = await user.delete(`/api/workflow/drafts/${draftId}`);
    expect(del.status()).toBe(200);
  });

  test('AC-21: 1단계 반려 → DECLINED, 2단계 미진행, 작성자·참조자 반려 알림', async () => {
    const doc = await createDoc(user, {
      steps: [[uid('user2')], [uid('hr')]],
      referrers: [{ user_id: uid('admin'), notification_setting: 'START_AND_END' }]
    });
    const res = await decline(user2, doc.id, '금액 확인 필요');
    expect(res.status(), await res.text()).toBe(200);

    const detail = await getDetail(user, doc.id);
    expect(detail.status).toBe('DECLINED');
    const step2 = detail.steps.find((step) => step.step === 2);
    expect(step2?.status).toBe('PENDING');
    const declineEvent = detail.events.find((event) => event.type === 'DECLINE');
    expect(declineEvent?.content).toBe('금액 확인 필요');
    expect((declineEvent as unknown as { actor: { user_id: string } }).actor.user_id).toBe(uid('user2'));

    await expectDocNotification(admin, uid('user'), doc.id, 'workflow.declined');
    await expectDocNotification(admin, uid('admin'), doc.id, 'workflow.declined');
    expect(await docNotifications(admin, uid('hr'), doc.id, 'workflow.approval_requested')).toHaveLength(0);
  });

  test('AC-22: 권한 매트릭스 (작성자 승인·결재선 밖 승인·수정·참조자 수정·승인자 취소 → 403)', async () => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    await expectError(await approve(user, doc.id), 403);
    await expectError(await approve(admin, doc.id), 403);
    await expectError(
      await admin.patch(`/api/workflow/documents/${doc.id}`, { data: { values: { note: `${doc.mark} admin` } } }),
      403
    );
    await expectError(await cancel(user2, doc.id), 403, '작성자만 문서를 취소할 수 있습니다.');

    // ④ 참조자(결재선 밖)는 수정 불가
    const referred = await createDoc(user, {
      steps: [[uid('user2')]],
      referrers: [{ user_id: uid('hr'), notification_setting: 'START_AND_END' }]
    });
    await expectError(
      await hr.patch(`/api/workflow/documents/${referred.id}`, {
        data: { values: { note: `${referred.mark} hr` } }
      }),
      403
    );
  });

  test('AC-27: PATCH에도 조건부 필수 적용 (입, 출금 요청 + bank 빈 값 → 400)', async () => {
    const doc = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    const res = await user.patch(`/api/workflow/documents/${doc.id}`, {
      data: {
        values: { request_type: REQ_PAYMENT, vendor_account_holder: 'E2E 업체', bank_account: '' }
      }
    });
    await expectError(res, 400, '계좌정보(은행명) 항목을 입력해 주세요.');
  });

  test('AC-28: 완료·반려·취소 문서 → 수정·결재선·승인·취소 409, 댓글 201', async () => {
    const line = { steps: [[uid('user2')]], referrers: [] };
    const NOT_IN_PROGRESS = '진행중인 문서만 처리할 수 있습니다.';

    const done = await createDoc(user, { steps: [[uid('user2')]] });
    expect((await approve(user2, done.id)).status()).toBe(200);
    const declined = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    expect((await decline(user2, declined.id)).status()).toBe(200);
    const canceled = await createDoc(user, { steps: [[uid('user2')]] });
    expect((await cancel(user, canceled.id)).status()).toBe(200);

    for (const [label, doc, approver, approveMessage] of [
      // 본인이 이미 처리한 문서를 다시 승인 → 「이미 처리된 문서입니다.」 (BE 409 문구 분리 규칙)
      ['DONE', done, user2, '이미 처리된 문서입니다.'],
      ['DECLINED', declined, hr, NOT_IN_PROGRESS],
      ['CANCELED', canceled, user2, NOT_IN_PROGRESS]
    ] as const) {
      await test.step(label, async () => {
        await expectError(
          await user.patch(`/api/workflow/documents/${doc.id}`, { data: { values: { note: `${doc.mark} x` } } }),
          409,
          NOT_IN_PROGRESS
        );
        await expectError(
          await user.put(`/api/workflow/documents/${doc.id}/approval-line`, { data: line }),
          409,
          NOT_IN_PROGRESS
        );
        await expectError(await approve(approver, doc.id), 409, approveMessage);
        await expectError(await cancel(user, doc.id), 409, NOT_IN_PROGRESS);
        const comment = await user.post(`/api/workflow/documents/${doc.id}/comments`, {
          data: { content: `E2E-WF 댓글 ${label}` }
        });
        expect(comment.status(), await comment.text()).toBe(201);
      });
    }
  });

  test('AC-30: 결재선 변경 제한 (완료 단계 409·승인자 제거 409·비작성자 403)', async () => {
    const docA = await createDoc(user, { steps: [[uid('user2')], [uid('hr')]] });
    expect((await approve(user2, docA.id)).status()).toBe(200);
    await expectError(
      await user.put(`/api/workflow/documents/${docA.id}/approval-line`, {
        data: { steps: [[uid('admin')], [uid('hr')]], referrers: [] }
      }),
      409,
      '완료된 단계는 변경할 수 없습니다.'
    );
    await expectError(
      await user2.put(`/api/workflow/documents/${docA.id}/approval-line`, {
        data: { steps: [[uid('user2')], [uid('hr')]], referrers: [] }
      }),
      403
    );

    const docB = await createDoc(user, { steps: [[uid('user2'), uid('admin')], [uid('hr')]] });
    expect((await approve(user2, docB.id)).status()).toBe(200);
    await expectError(
      await user.put(`/api/workflow/documents/${docB.id}/approval-line`, {
        data: { steps: [[uid('admin')], [uid('hr')]], referrers: [] }
      }),
      409,
      '이미 승인한 승인자는 뺄 수 없습니다.'
    );
  });

  test('AC-41: 본문 HTML 서버 정화 (script·onerror·javascript: 제거, 허용 태그 유지)', async () => {
    const html = [
      '<p><strong>굵게</strong></p>',
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(2)">',
      '<p><a href="javascript:alert(3)">bad</a> <a href="https://example.com/ok">ok</a></p>',
      '<ul><li>항목</li></ul>',
      '<table><tbody><tr><td>셀</td></tr></tbody></table>'
    ].join('');
    const doc = await createDoc(user, { steps: [[uid('user2')]], contentHtml: html });
    const detail = await getDetail(user, doc.id);
    const saved = detail.content_html;
    expect(saved).not.toContain('<script');
    expect(saved).not.toContain('onerror');
    expect(saved).not.toContain('javascript:');
    expect(saved).toContain('<strong>');
    expect(saved).toContain('<ul>');
    expect(saved).toContain('<table>');
    expect(saved).toContain('<a href="https://example.com/ok"');
  });
});
