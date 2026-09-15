-- 2026-09-15: E2E cleanup RPC — wallet balance email + wallet_syncs disposable user cleanup
-- File: 52_e2e_cleanup_wallet_balance_email.sql
-- Plan: 51_wallet-balance-email-plan.md
-- Summary: cleanup_e2e_mock_data에 wallet_balance_email_*·E2E wallet_syncs 삭제 추가

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

  with test_users as (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  )
  delete from public.wallet_balance_email_recipients
  where user_id in (select id from test_users);

  delete from public.wallet_balance_email_runs
  where id in (
    select r.id
    from public.wallet_balance_email_runs r
    where not exists (
      select 1
      from public.wallet_balance_email_recipients rec
      where rec.run_id = r.id
        and rec.user_id not in (
          select id
          from auth.users
          where email ilike '%@example.com'
             or email in ('e2e@test.local', 'prod-verify@test.local')
        )
    )
    and (
      r.due_count = 0
      or exists (
        select 1
        from public.wallet_balance_email_recipients rec2
        where rec2.run_id = r.id
          and rec2.user_id in (
            select id
            from auth.users
            where email ilike '%@example.com'
               or email in ('e2e@test.local', 'prod-verify@test.local')
          )
      )
    )
  );

  get diagnostics deleted_wallet_balance_runs = row_count;

  delete from public.wallet_balance_email_preferences
  where user_id in (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  );

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
     or metadata->>'author_name' = 'E2E 작성자'
     or metadata->>'author_email' = 'e2e@test.local'
     or metadata->>'contract_target' = 'E2E 계약대상'
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

  alter table public.wallet_syncs disable trigger trg_wallet_syncs_no_update;

  delete from public.wallet_syncs
  where user_id in (
    select id
    from auth.users
    where email ilike '%@example.com'
       or email in ('e2e@test.local', 'prod-verify@test.local')
  )
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
