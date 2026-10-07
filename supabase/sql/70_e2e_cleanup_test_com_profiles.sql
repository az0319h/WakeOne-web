-- 2026-10-06: E2E cleanup RPC — @test.com · full_name ^E2E  disposable user 확장
-- File: 70_e2e_cleanup_test_com_profiles.sql
-- Plan: 69_org-chart-mobile-tree-plan.md (verifier Step 7 blind spot)
-- Status: Completed (remote applied)
-- Summary: person-hover 등 @test.com 계정·E2E full_name 프로필 cleanup 포함

create or replace function public.is_e2e_disposable_auth_email(p_email text)
returns boolean
language sql
immutable
as $$
  select p_email ilike '%@example.com'
      or p_email ilike '%@test.com'
      or p_email in ('e2e@test.local', 'prod-verify@test.local');
$$;

create or replace function public.e2e_disposable_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where public.is_e2e_disposable_auth_email(u.email)
     or u.id in (
       select p.user_id
       from public.profiles p
       where p.full_name ~ '^E2E '
         and p.email not in (
           '1234@naver.com',
           '4321@naver.com',
           'wakeone.ops@gmail.com'
         )
     );
$$;

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
  deleted_wallet_balance_runs integer := 0;
  test_doc_pattern constant text := '^(AC|E2E|PV|P28|P29|ATT)';
  test_run_pattern constant text := '^(AC|E2E|PV|P28|P29|ATT)';
begin
  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ test_doc_pattern
       or author_name = 'E2E 작성자'
       or author_email = 'e2e@test.local'
       or contract_target = 'E2E 계약대상'
  )
  delete from public.contract_attachments
  where contract_id in (select id from test_contracts);

  delete from public.contract_import_events
  where document_number ~ test_doc_pattern;

  with test_contracts as (
    select id
    from public.contract_documents
    where document_number ~ test_doc_pattern
       or author_name = 'E2E 작성자'
       or author_email = 'e2e@test.local'
       or contract_target = 'E2E 계약대상'
  )
  delete from public.contract_reminder_recipients
  where contract_ids && array(select id from test_contracts);

  delete from public.contract_reminder_runs
  where run_key ~ test_run_pattern;

  get diagnostics deleted_runs = row_count;

  delete from public.contract_documents
  where document_number ~ test_doc_pattern
     or author_name = 'E2E 작성자'
     or author_email = 'e2e@test.local'
     or contract_target = 'E2E 계약대상';

  get diagnostics deleted_contracts = row_count;

  delete from public.wallet_balance_email_recipients
  where user_id in (select public.e2e_disposable_user_ids());

  delete from public.wallet_balance_email_runs
  where id in (
    select r.id
    from public.wallet_balance_email_runs r
    where not exists (
      select 1
      from public.wallet_balance_email_recipients rec
      where rec.run_id = r.id
        and rec.user_id not in (select public.e2e_disposable_user_ids())
    )
    and (
      r.due_count = 0
      or exists (
        select 1
        from public.wallet_balance_email_recipients rec2
        where rec2.run_id = r.id
          and rec2.user_id in (select public.e2e_disposable_user_ids())
      )
    )
  );

  get diagnostics deleted_wallet_balance_runs = row_count;

  delete from public.wallet_balance_email_preferences
  where user_id in (select public.e2e_disposable_user_ids());

  delete from public.notifications
  where recipient_user_id in (select public.e2e_disposable_user_ids());

  get diagnostics deleted_notifications_disposable = row_count;

  alter table public.activity_logs disable trigger trg_activity_logs_no_update;

  delete from public.activity_logs
  where metadata->>'document_number' ~ test_doc_pattern
     or metadata->>'run_key' ~ test_run_pattern
     or metadata->>'author_name' = 'E2E 작성자'
     or metadata->>'author_email' = 'e2e@test.local'
     or metadata->>'contract_target' = 'E2E 계약대상'
     or (
       metadata->>'email' is not null
       and (
         metadata->>'email' ilike '%@example.com'
         or metadata->>'email' ilike '%@test.com'
       )
     )
     or metadata->>'email' in ('e2e@test.local', 'prod-verify@test.local')
     or actor_user_id in (select public.e2e_disposable_user_ids())
     or target_user_id in (select public.e2e_disposable_user_ids())
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

  alter table public.wallet_syncs disable trigger trg_wallet_syncs_no_update;

  delete from public.wallet_syncs
  where user_id in (select public.e2e_disposable_user_ids())
     or matched_name ~ '^E2E-WBE-';

  alter table public.wallet_syncs enable trigger trg_wallet_syncs_no_update;

  delete from public.wallet_balance_email_preferences
  where user_id in (
    select user_id
    from public.profiles
    where email in ('1234@naver.com', '4321@naver.com')
  );

  delete from public.wallet_balance_email_recipients
  where user_id in (
    select user_id
    from public.profiles
    where email in ('1234@naver.com', '4321@naver.com')
  );

  delete from public.google_tasks_connections
  where google_email = 'e2e-mock@gmail.com'
     or user_id in (select public.e2e_disposable_user_ids());

  delete from auth.users u
  where u.id in (select public.e2e_disposable_user_ids());

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
      'wallet_balance_email_runs', deleted_wallet_balance_runs,
      'activity_logs', deleted_logs,
      'notifications', deleted_notifications_disposable + deleted_notifications_fixture,
      'users', deleted_users
    ),
    'remaining', jsonb_build_object(
      'contracts', (
        select count(*)
        from public.contract_documents
        where document_number ~ test_doc_pattern
           or author_name = 'E2E 작성자'
           or author_email = 'e2e@test.local'
           or contract_target = 'E2E 계약대상'
      ),
      'contracts_e2e_author', (
        select count(*)
        from public.contract_documents
        where author_name = 'E2E 작성자'
           or author_email = 'e2e@test.local'
           or contract_target = 'E2E 계약대상'
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
        from auth.users u
        where u.id in (select public.e2e_disposable_user_ids())
      ),
      'profiles_e2e', (
        select count(*)
        from public.profiles p
        where p.full_name ~ '^E2E '
          and p.email not in (
            '1234@naver.com',
            '4321@naver.com',
            'wakeone.ops@gmail.com'
          )
      )
    )
  );
end;
$$;

revoke all on function public.cleanup_e2e_mock_data() from public;
grant execute on function public.cleanup_e2e_mock_data() to service_role;

revoke all on function public.is_e2e_disposable_auth_email(text) from public;
grant execute on function public.is_e2e_disposable_auth_email(text) to service_role;

revoke all on function public.e2e_disposable_user_ids() from public;
grant execute on function public.e2e_disposable_user_ids() to service_role;
