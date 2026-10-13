-- 2026-10-11: E2E cleanup 전 테이블·fixture 산출물 완전 정리
-- File: 74_e2e_cleanup_complete.sql
-- Plan: verifier Step 7 follow-up
-- Date: 2026-10-11
-- Status: Completed
-- Remote migration: applied (e2e_cleanup_complete)
-- Summary: E2E 공지·복지비·알림·활동 로그와 fixture 계정 산출물 cleanup/remaining 검증 확장

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
       select user_id from public.profiles where email = any(fixture_emails)
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
       select user_id from public.profiles where email = any(fixture_emails)
     );

  delete from public.notifications
  where recipient_user_id in (select public.e2e_disposable_user_ids())
     or recipient_user_id in (
       select user_id from public.profiles where email = any(fixture_emails)
     )
     or title ilike '%E2E%'
     or body ilike '%E2E%'
     or metadata::text ilike '%E2E%';

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
     or actor_user_id in (
       select user_id from public.profiles where email = any(fixture_emails)
     )
     or target_user_id in (
       select user_id from public.profiles where email = any(fixture_emails)
     )
     or actor_email = any(fixture_emails)
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
     or user_id in (
       select user_id from public.profiles where email = any(fixture_emails)
     )
     or matched_name ~ '^E2E[ -]';

  alter table public.wallet_syncs enable trigger trg_wallet_syncs_no_update;

  delete from public.google_tasks_connections
  where google_email = 'e2e-mock@gmail.com'
     or user_id in (select public.e2e_disposable_user_ids())
     or user_id in (
       select user_id from public.profiles where email = any(fixture_emails)
     );

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
      'fixture_notifications', (
        select count(*)
        from public.notifications
        where recipient_user_id in (
          select user_id from public.profiles where email = any(fixture_emails)
        )
      ),
      'marker_notifications', (
        select count(*)
        from public.notifications
        where title ilike '%E2E%'
           or body ilike '%E2E%'
           or metadata::text ilike '%E2E%'
      ),
      'fixture_activity_logs', (
        select count(*)
        from public.activity_logs
        where actor_user_id in (
                select user_id from public.profiles where email = any(fixture_emails)
              )
           or target_user_id in (
                select user_id from public.profiles where email = any(fixture_emails)
              )
           or actor_email = any(fixture_emails)
      ),
      'activity_logs_e2e', (
        select count(*)
        from public.activity_logs
        where metadata::text ilike '%E2E%'
           or coalesce(actor_display_name, '') ~ '^E2E[ -]'
           or coalesce(target_label, '') ~ 'E2E[ -]'
      ),
      'fixture_wallet_syncs', (
        select count(*)
        from public.wallet_syncs
        where user_id in (
                select user_id from public.profiles where email = any(fixture_emails)
              )
           or matched_name ~ '^E2E[ -]'
      ),
      'fixture_wallet_preferences', (
        select count(*)
        from public.wallet_balance_email_preferences
        where user_id in (
          select user_id from public.profiles where email = any(fixture_emails)
        )
      ),
      'fixture_wallet_recipients', (
        select count(*)
        from public.wallet_balance_email_recipients
        where user_id in (
          select user_id from public.profiles where email = any(fixture_emails)
        )
      ),
      'fixture_google_tasks', (
        select count(*)
        from public.google_tasks_connections
        where google_email = 'e2e-mock@gmail.com'
           or user_id in (
             select user_id from public.profiles where email = any(fixture_emails)
           )
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
