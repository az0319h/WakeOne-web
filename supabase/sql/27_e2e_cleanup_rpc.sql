-- E2E / verifier 목 데이터 일괄 삭제 RPC (Playwright globalTeardown · verifier Step 7)
-- File: 27_e2e_cleanup_rpc.sql
-- Status: Superseded by 36_e2e_cleanup_rpc_extend.sql (remote apply 36)
-- Summary: security definer cleanup for append-only activity_logs trigger bypass

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
begin
  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ '^(AC|E2E|PV)'
  )
  delete from public.contract_attachments
  where contract_id in (select id from test_contracts);

  delete from public.contract_import_events
  where document_number ~ '^(AC|E2E|PV)';

  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ '^(AC|E2E|PV)'
  )
  delete from public.contract_reminder_recipients
  where contract_ids && array(select id from test_contracts);

  delete from public.contract_reminder_runs
  where run_key ~ '^(AC|E2E|PV)';

  get diagnostics deleted_runs = row_count;

  delete from public.contract_documents
  where document_number ~ '^(AC|E2E|PV)';

  get diagnostics deleted_contracts = row_count;

  alter table public.activity_logs disable trigger trg_activity_logs_no_update;

  with test_users as (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  )
  delete from public.activity_logs
  where metadata->>'document_number' ~ '^(AC|E2E|PV)'
     or metadata->>'run_key' ~ '^(AC|E2E|PV)'
     or (
       metadata->>'email' is not null
       and metadata->>'email' ilike '%@example.com'
     )
     or metadata->>'email' in ('e2e@test.local', 'prod-verify@test.local')
     or actor_user_id in (select id from test_users)
     or target_user_id in (select id from test_users);

  get diagnostics deleted_logs = row_count;

  alter table public.activity_logs enable trigger trg_activity_logs_no_update;

  delete from auth.users
  where email ilike '%@example.com'
     or email in ('e2e@test.local', 'prod-verify@test.local');

  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'deleted', jsonb_build_object(
      'contracts', deleted_contracts,
      'reminder_runs', deleted_runs,
      'activity_logs', deleted_logs,
      'users', deleted_users
    ),
    'remaining', jsonb_build_object(
      'contracts', (
        select count(*)
        from public.contract_documents
        where document_number ~ '^(AC|E2E|PV)'
      ),
      'reminder_runs', (
        select count(*)
        from public.contract_reminder_runs
        where run_key ~ '^(AC|E2E|PV)'
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
