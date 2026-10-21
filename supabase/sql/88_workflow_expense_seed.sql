-- 2026-10-21: plan 88 — 지출결의서 양식 seed (공통 틀의 첫 양식 · 조건부 필수 규칙 포함)
-- File: 88_workflow_expense_seed.sql
-- Plan: 88_workflow-expense-plan.md
-- Date: 2026-10-21
-- Status: Completed
-- Remote migration: 88_workflow_expense_seed — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: workflow_templates(expense) + workflow_template_fields 15칸 upsert (idempotent).
--          조건부 필수 = required_when {"field_key":"request_type","in":[...]} · 첨부 attachment_required_when (두 유형 모두).
--          기본 결재선(default approvers/referrers)은 비워 둔다. 재실행 시 관리자가 바꾼 approval_step_edit_enabled는 유지한다.

insert into public.workflow_templates (
  template_key, name, description, emoji, content_default, content_visible,
  attachment_visible, attachment_required, attachment_required_when,
  only_visible_for_admin, edit_policy, approval_step_edit_enabled, display_order, tags, is_active
) values (
  'expense',
  '지출결의서',
  E'일하는 데 필요한 비용 신청 및  입, 출금 요청 시 작성해주세요.\n\n'
  || E'✅ 공통 필수 값 : 요청 유형 / 작성자 / 작성일 / 사용브랜드 / 금액\n\n'
  || E'✅ 입출금요청 필수 값\n'
  || E'       1. 업체명 및 예금주 → 사업자등록증에 기재된 업체명과 통장 사본에 기재된 예금주를 정확히 작성\n'
  || E'       2. 계좌정보 → 은행명과 계좌번호를 모두 작성\n'
  || E'       3. 첨부파일(견적서, 발주서, 거래명세서 등)\n'
  || E'       * 첫 거래처의 경우 사업자등록증 및 통장사본 필수 \n'
  || E'       \n'
  || E'✅ 구매요청 필수 값 : 품명 및 수량 / 수령지 / 수령인정보 / 링크 / 첨부파일(장바구니 캡처본)\n'
  || E'       ex) 수령지 → 본사(X), 서울 중구 을지로264, 동대문 스파크플러스 11층 0000호\n'
  || E'　         수령인 → OOO(X), OOO(010-0000-0000) \n\n'
  || E'✅ 해외송금의 경우 \n'
  || E'       1. 계약서 \n'
  || E'       2. 인보이스 → 수취인 정보 및 은행 정보가 정확히 기재되어 있는지 반드시 확인해주세요.\n\n'
  || E'📌 구입 사유 필수 작성\n'
  || E'구매 물품의 사용 목적과 사용처를 확인할 수 있도록, 최소한 ‘무엇을 위해 구입하는지’ 구체적으로 작성해 주세요.\n\n'
  || E'요청 유형을 고르면 필요한 칸에 빨간 점이 표시돼요. 필수가 아닌 칸은 비워 두셔도 됩니다.',
  '📄',
  '',
  true,
  true,
  false,
  '{"field_key": "request_type", "in": ["입, 출금 요청", "구매 요청"]}'::jsonb,
  false,
  'AUTHOR_AND_APPROVER',
  true,
  1,
  '{}',
  true
)
on conflict (template_key) do update set
  name = excluded.name,
  description = excluded.description,
  emoji = excluded.emoji,
  content_default = excluded.content_default,
  content_visible = excluded.content_visible,
  attachment_visible = excluded.attachment_visible,
  attachment_required = excluded.attachment_required,
  attachment_required_when = excluded.attachment_required_when,
  only_visible_for_admin = excluded.only_visible_for_admin,
  edit_policy = excluded.edit_policy,
  display_order = excluded.display_order,
  tags = excluded.tags,
  is_active = excluded.is_active;

with tpl as (
  select id from public.workflow_templates where template_key = 'expense'
),
fields (field_key, name, type, options, required, required_when, prefill_type, display_order) as (
  values
    ('request_type', '요청 유형', 'SELECT', '["입, 출금 요청", "구매 요청"]'::jsonb, true, null::jsonb, 'NONE', 1),
    ('writer_name', '작성자', 'STRING', '[]'::jsonb, true, null::jsonb, 'NAME', 2),
    ('written_date', '작성일', 'DATE', '[]'::jsonb, true, null::jsonb, 'DEFAULT', 3),
    ('brand', '사용 브랜드', 'SELECT', '["산스", "킨키", "비욘드푸드", "웨이크", "산스파운드리"]'::jsonb, true, null::jsonb, 'NONE', 4),
    ('amount', '금액', 'AMOUNT_OF_MONEY', '[]'::jsonb, true, null::jsonb, 'NONE', 5),
    ('due_date', '입금 ,구매 요청기한', 'DATE', '[]'::jsonb, false, null::jsonb, 'NONE', 6),
    ('vendor_account_holder', '업체명 및 예금주', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["입, 출금 요청"]}'::jsonb, 'NONE', 7),
    ('bank_account', '계좌정보(은행명)', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["입, 출금 요청"]}'::jsonb, 'NONE', 8),
    ('item_quantity', '품명 및 수량', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["구매 요청"]}'::jsonb, 'NONE', 9),
    ('delivery_address', '수령지', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["구매 요청"]}'::jsonb, 'NONE', 10),
    ('recipient', '수령인(연락처필수)', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["구매 요청"]}'::jsonb, 'NONE', 11),
    ('link_url', '링크(URL)', 'STRING', '[]'::jsonb, false,
      '{"field_key": "request_type", "in": ["구매 요청"]}'::jsonb, 'NONE', 12),
    ('purchase_reason', '구매 사유(상세히)', 'STRING', '[]'::jsonb, true, null::jsonb, 'NONE', 13),
    ('note', '비고', 'STRING', '[]'::jsonb, false, null::jsonb, 'NONE', 14),
    ('reference_documents', '참조문서', 'TASK_REFERENCE', '[]'::jsonb, false, null::jsonb, 'NONE', 15)
)
insert into public.workflow_template_fields (
  template_id, field_key, name, type, options, required, required_when, prefill_type, prefill_default, display_order
)
select tpl.id, f.field_key, f.name, f.type, f.options, f.required, f.required_when, f.prefill_type, null, f.display_order
from tpl cross join fields f
on conflict (template_id, field_key) do update set
  name = excluded.name,
  type = excluded.type,
  options = excluded.options,
  required = excluded.required,
  required_when = excluded.required_when,
  prefill_type = excluded.prefill_type,
  prefill_default = excluded.prefill_default,
  display_order = excluded.display_order;
