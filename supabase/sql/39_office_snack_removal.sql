-- 2026-08-06: 사무실 간식(office-snacks) 완전 제거
-- File: 39_office_snack_removal.sql
-- Plan: 35_office-snack-removal-plan.md
-- Date: 2026-08-06
-- Status: Completed
-- Summary: delete office_snack.* activity logs (append-only trigger bypass), truncate and drop office snack tables, view, and functions

drop trigger if exists trg_activity_logs_no_update on public.activity_logs;

delete from public.activity_logs
where action like 'office_snack.%'
   or target_type = 'office_snack';

create trigger trg_activity_logs_no_update
before update or delete on public.activity_logs
for each row execute function public.prevent_activity_log_mutation();

drop view if exists public.office_snack_results;

truncate table public.office_snack_votes,
               public.office_snack_candidates,
               public.office_snack_sessions
restart identity cascade;

drop table if exists public.office_snack_votes cascade;
drop table if exists public.office_snack_candidates cascade;
drop table if exists public.office_snack_sessions cascade;

drop function if exists public.validate_office_snack_vote_candidates();
drop function if exists public.prevent_office_snack_vote_mutation();
