-- 2026-07-19: E2E cleanup RPC 확장 — P28/P29 계약·run, E2E-* activity_logs·알림, fixture full_name 복구
-- File: 36_e2e_cleanup_rpc_extend.sql

create or replace function public.cleanup_e2e_mock_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_contracts integer := 0;
  deleted_runs integer := 0;
  deleted_logs integer := 0;
  deleted_users integer := 0;
  deleted_notifications_disposable integer := 0;
  deleted_notifications_fixture integer := 0;
  test_doc_pattern constant text := '^(AC|E2E|PV|P28|P29)';
  test_run_pattern constant text := '^(AC|E2E|PV|P28|P29)';
begin
  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ test_doc_pattern
  )
  delete from public.contract_attachments
  where contract_id in (select id from test_contracts);

  delete from public.contract_import_events
  where document_number ~ test_doc_pattern;

  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ test_doc_pattern
  )
  delete from public.contract_reminder_recipients
  where contract_ids && array(select id from test_contracts);

  delete from public.contract_reminder_runs
  where run_key ~ test_run_pattern;

  get diagnostics deleted_runs = row_count;

  delete from public.contract_documents
  where document_number ~ test_doc_pattern;

  get diagnostics deleted_contracts = row_count;

  delete from public.notifications
  where recipient_user_id in (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  );

  get diagnostics deleted_notifications_disposable = row_count;

  alter table public.activity_logs disable trigger trg_activity_logs_no_update;

  with test_users as (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  )
  delete from public.activity_logs
  where metadata->>'document_number' ~ test_doc_pattern
     or metadata->>'run_key' ~ test_run_pattern
     or (
       metadata->>'email' is not null
       and metadata->>'email' ilike '%@example.com'
     )
     or metadata->>'email' in ('e2e@test.local', 'prod-verify@test.local')
     or actor_user_id in (select id from test_users)
     or target_user_id in (select id from test_users)
     or coalesce(actor_display_name, '') ~ '^E2E-'
     or coalesce(target_label, '') ~ 'E2E-'
     or coalesce(target_label, '') ~ test_doc_pattern;

  get diagnostics deleted_logs = row_count;

  alter table public.activity_logs enable trigger trg_activity_logs_no_update;

  delete from public.notifications
  where type = 'user.update'
    and recipient_user_id in (
      select user_id
      from public.profiles
      where email in ('1234@naver.com', '4321@naver.com', 'wakeone.ops@gmail.com')
    );

  get diagnostics deleted_notifications_fixture = row_count;

  delete from auth.users
  where email ilike '%@example.com'
     or email in ('e2e@test.local', 'prod-verify@test.local');

  get diagnostics deleted_users = row_count;

  update public.profiles
  set full_name = '테스트 계정1', updated_at = now()
  where email = '1234@naver.com';

  update public.profiles
  set full_name = '테스트 계정2', updated_at = now()
  where email = '4321@naver.com';

  update public.profiles
  set full_name = '관리자', updated_at = now()
  where email = 'wakeone.ops@gmail.com';

  return jsonb_build_object(
    'deleted', jsonb_build_object(
      'contracts', deleted_contracts,
      'reminder_runs', deleted_runs,
      'activity_logs', deleted_logs,
      'notifications', deleted_notifications_disposable + deleted_notifications_fixture,
      'users', deleted_users
    ),
    'remaining', jsonb_build_object(
      'contracts', (
        select count(*)
        from public.contract_documents
        where document_number ~ test_doc_pattern
      ),
      'reminder_runs', (
        select count(*)
        from public.contract_reminder_runs
        where run_key ~ test_run_pattern
      ),
      'activity_logs_e2e', (
        select count(*)
        from public.activity_logs
        where coalesce(actor_display_name, '') ~ '^E2E-'
           or coalesce(target_label, '') ~ 'E2E-'
      ),
      'users', (
        select count(*)
        from auth.users
        where email ilike '%@example.com'
           or email in ('e2e@test.local', 'prod-verify@test.local')
      )
    )
  );
end;
$$;

revoke all on function public.cleanup_e2e_mock_data() from public;
grant execute on function public.cleanup_e2e_mock_data() to service_role;
