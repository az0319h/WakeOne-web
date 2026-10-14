-- 2026-10-14: E2E cleanup — fixture 계정(관리자 등) 실데이터 보존
-- File: 82_e2e_cleanup_preserve_fixture_real_data.sql
-- Summary: cleanup_e2e_mock_data가 fixture 이메일 알림·활동로그·wallet 전체 삭제하지 않도록 수정 (E2E marker·test doc만)

create or replace function public.cleanup_e2e_mock_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_announcements integer := 0;
  deleted_benefit_documents integer := 0;
  deleted_benefit_events integer := 0;
  deleted_contracts integer := 0;
  deleted_runs integer := 0;
  deleted_logs integer := 0;
  deleted_users integer := 0;
  deleted_notifications integer := 0;
  deleted_wallet_balance_runs integer := 0;
  fixture_emails constant text[] := array[
    '1234@naver.com',
    '4321@naver.com',
    'wakeone.ops@gmail.com'
  ];
  test_doc_pattern constant text := '^(AC|E2E|PV|P28|P29|ATT|KBAR)';
  test_run_pattern constant text := '^(AC|E2E|PV|P28|P29|ATT|KBAR)';
begin
  -- Storage 실제 객체는 scripts/cleanup-e2e-mock-data.mjs에서 먼저 삭제한다.
  delete from public.notifications
  where type = 'announcement.published'
    and coalesce(metadata->>'announcement_id', '') ~ '^[0-9]+$'
    and (metadata->>'announcement_id')::bigint in (
      select id
      from public.announcements
      where title ilike 'E2E-ANN-%'
    );

  delete from public.announcement_attachments
  where announcement_id in (
    select id
    from public.announcements
    where title ilike 'E2E-ANN-%'
  );

  delete from public.announcements
  where title ilike 'E2E-ANN-%';

  get diagnostics deleted_announcements = row_count;

  delete from public.benefit_import_events
  where document_number ~ test_doc_pattern
     or task_key ilike 'e2e%';

  get diagnostics deleted_benefit_events = row_count;

  delete from public.benefit_documents
  where document_number ~ test_doc_pattern
     or task_key ilike 'e2e%'
     or applicant_name ~ '^E2E[ -]';

  get diagnostics deleted_benefit_documents = row_count;

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
  where user_id in (select public.e2e_disposable_user_ids())
     or user_id in (
       select p.user_id
       from public.profiles p
       where p.full_name ~ '^E2E[ -]'
         or p.full_name ~ '^E2E-WBE'
     );

  delete from public.wallet_balance_email_runs r
  where not exists (
    select 1
    from public.wallet_balance_email_recipients rec
    where rec.run_id = r.id
  );

  get diagnostics deleted_wallet_balance_runs = row_count;

  delete from public.wallet_balance_email_preferences
  where user_id in (select public.e2e_disposable_user_ids())
     or user_id in (
       select p.user_id
       from public.profiles p
       where p.full_name ~ '^E2E[ -]'
         or p.full_name ~ '^E2E-WBE'
     );

  delete from public.notifications
  where recipient_user_id in (select public.e2e_disposable_user_ids())
     or title ilike '%E2E%'
     or body ilike '%E2E%'
     or metadata::text ilike '%E2E%'
     or coalesce(metadata->>'document_number', '') ~ test_doc_pattern
     or coalesce(metadata->>'task_key', '') ilike 'e2e%';

  get diagnostics deleted_notifications = row_count;

  alter table public.activity_logs disable trigger trg_activity_logs_no_update;

  delete from public.activity_logs
  where metadata->>'document_number' ~ test_doc_pattern
     or metadata->>'run_key' ~ test_run_pattern
     or metadata->>'author_name' = 'E2E 작성자'
     or metadata->>'author_email' = 'e2e@test.local'
     or metadata->>'contract_target' = 'E2E 계약대상'
     or metadata::text ilike '%E2E%'
     or actor_user_id in (select public.e2e_disposable_user_ids())
     or target_user_id in (select public.e2e_disposable_user_ids())
     or coalesce(actor_display_name, '') ~ '^E2E[ -]'
     or coalesce(target_label, '') ~ 'E2E[ -]'
     or coalesce(target_label, '') ~ test_doc_pattern
     or (
       action = 'benefit.import_failed'
       and actor_email = 'anonymous'
       and target_label = 'benefit:unknown'
       and http_status = 401
     );

  get diagnostics deleted_logs = row_count;

  alter table public.activity_logs enable trigger trg_activity_logs_no_update;

  alter table public.wallet_syncs disable trigger trg_wallet_syncs_no_update;

  delete from public.wallet_syncs
  where user_id in (select public.e2e_disposable_user_ids())
     or matched_name ~ '^E2E[ -]'
     or matched_name ~ '^E2E-WBE';

  alter table public.wallet_syncs enable trigger trg_wallet_syncs_no_update;

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
      'announcements', deleted_announcements,
      'benefit_documents', deleted_benefit_documents,
      'benefit_import_events', deleted_benefit_events,
      'contracts', deleted_contracts,
      'reminder_runs', deleted_runs,
      'wallet_balance_email_runs', deleted_wallet_balance_runs,
      'activity_logs', deleted_logs,
      'notifications', deleted_notifications,
      'users', deleted_users
    ),
    'remaining', jsonb_build_object(
      'announcements', (
        select count(*) from public.announcements where title ilike 'E2E-ANN-%'
      ),
      'benefit_documents', (
        select count(*)
        from public.benefit_documents
        where document_number ~ test_doc_pattern
           or task_key ilike 'e2e%'
           or applicant_name ~ '^E2E[ -]'
      ),
      'benefit_import_events', (
        select count(*)
        from public.benefit_import_events
        where document_number ~ test_doc_pattern
           or task_key ilike 'e2e%'
      ),
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
      'fixture_e2e_notifications', (
        select count(*)
        from public.notifications n
        where n.recipient_user_id in (
          select user_id from public.profiles where email = any(fixture_emails)
        )
        and (
          n.title ilike '%E2E%'
          or n.body ilike '%E2E%'
          or n.metadata::text ilike '%E2E%'
          or coalesce(n.metadata->>'document_number', '') ~ test_doc_pattern
          or coalesce(n.metadata->>'task_key', '') ilike 'e2e%'
        )
      ),
      'marker_notifications', (
        select count(*)
        from public.notifications
        where title ilike '%E2E%'
           or body ilike '%E2E%'
           or metadata::text ilike '%E2E%'
           or coalesce(metadata->>'document_number', '') ~ test_doc_pattern
           or coalesce(metadata->>'task_key', '') ilike 'e2e%'
      ),
      'fixture_e2e_activity_logs', (
        select count(*)
        from public.activity_logs al
        where (
          al.actor_user_id in (
            select user_id from public.profiles where email = any(fixture_emails)
          )
          or al.target_user_id in (
            select user_id from public.profiles where email = any(fixture_emails)
          )
          or al.actor_email = any(fixture_emails)
        )
        and (
          al.metadata::text ilike '%E2E%'
          or coalesce(al.actor_display_name, '') ~ '^E2E[ -]'
          or coalesce(al.target_label, '') ~ 'E2E[ -]'
          or coalesce(al.metadata->>'document_number', '') ~ test_doc_pattern
          or coalesce(al.metadata->>'run_key', '') ~ test_run_pattern
        )
      ),
      'activity_logs_e2e', (
        select count(*)
        from public.activity_logs
        where metadata::text ilike '%E2E%'
           or coalesce(actor_display_name, '') ~ '^E2E[ -]'
           or coalesce(target_label, '') ~ 'E2E[ -]'
           or coalesce(metadata->>'document_number', '') ~ test_doc_pattern
           or coalesce(metadata->>'run_key', '') ~ test_run_pattern
      ),
      'fixture_e2e_wallet_syncs', (
        select count(*)
        from public.wallet_syncs ws
        where ws.matched_name ~ '^E2E[ -]'
           or ws.matched_name ~ '^E2E-WBE'
      ),
      'fixture_e2e_wallet_preferences', (
        select count(*)
        from public.wallet_balance_email_preferences w
        join public.profiles p on p.user_id = w.user_id
        where p.full_name ~ '^E2E[ -]'
           or p.full_name ~ '^E2E-WBE'
      ),
      'fixture_e2e_wallet_recipients', (
        select count(*)
        from public.wallet_balance_email_recipients w
        join public.profiles p on p.user_id = w.user_id
        where p.full_name ~ '^E2E[ -]'
           or p.full_name ~ '^E2E-WBE'
      ),
      'fixture_google_tasks_mock', (
        select count(*)
        from public.google_tasks_connections
        where google_email = 'e2e-mock@gmail.com'
      ),
      'users', (
        select count(*)
        from auth.users u
        where u.id in (select public.e2e_disposable_user_ids())
      ),
      'profiles_e2e', (
        select count(*)
        from public.profiles p
        where p.full_name ~ '^E2E[ -]'
          and p.email <> all(fixture_emails)
      )
    )
  );
end;
$$;

revoke all on function public.cleanup_e2e_mock_data() from public;
grant execute on function public.cleanup_e2e_mock_data() to service_role;
