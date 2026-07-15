-- 2026-07-15: 계약서 독촉 Cron — 평일(월~금) 18:00 KST 운영 스케줄
-- File: 33_contract_reminder_cron_weekdays.sql
-- Plan: 24_contract-reminder-cron-migration-plan.md
-- Date: 2026-07-15
-- Status: Completed
-- Remote migration: pending (33_contract_reminder_cron_weekdays)
-- Summary: contract-reminder-daily = 0 9 * * 1-5 UTC (평일 18:00 KST, 주말 제외)

create or replace function public.switch_contract_reminder_to_production()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  verify_job_id bigint;
  daily_job_id bigint;
begin
  select jobid
  into verify_job_id
  from cron.job
  where jobname = 'contract-reminder-verify'
  limit 1;

  if verify_job_id is not null then
    perform cron.unschedule(verify_job_id);
  end if;

  select jobid
  into daily_job_id
  from cron.job
  where jobname = 'contract-reminder-daily'
  limit 1;

  if daily_job_id is not null then
    perform cron.unschedule(daily_job_id);
  end if;

  perform cron.schedule(
    'contract-reminder-daily',
    '0 9 * * 1-5',
    'select public.invoke_contract_reminder_cron_trigger();'
  );
end;
$$;

comment on function public.switch_contract_reminder_to_production() is
  'Unschedule verify job; schedule weekdays 0 9 * * 1-5 UTC (Mon–Fri 18:00 KST).';

revoke all on function public.switch_contract_reminder_to_production() from public;
grant execute on function public.switch_contract_reminder_to_production() to postgres;

-- 현재 운영 job 동기화 (이미 동일하면 idempotent)
select cron.unschedule(jobid)
from cron.job
where jobname = 'contract-reminder-daily';

select cron.schedule(
  'contract-reminder-daily',
  '0 9 * * 1-5',
  'select public.invoke_contract_reminder_cron_trigger();'
);
