-- E2E / verifier / 운영 수동 검증에서 생성된 목 데이터 정리 (스키마 변경 없음)
-- 실행: Supabase MCP execute_sql (또는 psql). apply_migration 사용 금지.
-- 참조: .cursor/skills/e2e-remote-cleanup/SKILL.md

begin;

-- 1) 계약 도메인 — document_number 접두 (AC*, E2E*, PV*)
with test_contracts as (
  select id
  from public.contract_documents
  where document_number ~ '^(AC|E2E|PV)-'
)
delete from public.contract_attachments
where contract_id in (select id from test_contracts);

delete from public.contract_import_events
where document_number ~ '^(AC|E2E|PV)-';

with test_contracts as (
  select id
  from public.contract_documents
  where document_number ~ '^(AC|E2E|PV)-'
)
delete from public.contract_reminder_recipients
where contract_ids && array(select id from test_contracts);

delete from public.contract_documents
where document_number ~ '^(AC|E2E|PV)-';

-- 2) activity_logs — append-only 트리거 임시 해제 후 테스트 관련 행 삭제
alter table public.activity_logs disable trigger trg_activity_logs_no_update;

with test_users as (
  select id
  from auth.users
  where email ilike '%@example.com'
     or email in ('e2e@test.local', 'prod-verify@test.local')
)
delete from public.activity_logs
where metadata->>'document_number' ~ '^(AC|E2E|PV)-'
   or (
     metadata->>'email' is not null
     and metadata->>'email' ilike '%@example.com'
   )
   or metadata->>'email' in ('e2e@test.local', 'prod-verify@test.local')
   or actor_user_id in (select id from test_users)
   or target_user_id in (select id from test_users);

alter table public.activity_logs enable trigger trg_activity_logs_no_update;

-- 3) E2E 목 사용자 — profiles는 auth.users FK cascade
delete from auth.users
where email ilike '%@example.com'
   or email in ('e2e@test.local', 'prod-verify@test.local');

commit;
