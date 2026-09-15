-- 2026-09-15: 식대 잔액 이메일 Cron — 매분 tick (KST HH:mm 정확 매칭)
-- File: 53_wallet_balance_email_cron.sql
-- Plan: 51_wallet-balance-email-plan.md
-- Date: 2026-09-15
-- Status: Completed
-- Summary: invoke_wallet_balance_email_cron_trigger + pg_cron wallet-balance-email-every-minute

create or replace function public.invoke_wallet_balance_email_cron_trigger()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  invoke_secret text;
  request_id bigint;
  edge_url constant text :=
    'https://dgjtcxzfwlvpmryrkgzc.supabase.co/functions/v1/wallet-balance-email-cron-trigger';
begin
  select decrypted_secret
  into invoke_secret
  from vault.decrypted_secrets
  where name = 'EDGE_CRON_INVOKE_SECRET'
  limit 1;

  if invoke_secret is null or invoke_secret = '' then
    raise exception 'Vault secret EDGE_CRON_INVOKE_SECRET is not configured';
  end if;

  select net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := '{}'::jsonb
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_wallet_balance_email_cron_trigger() is
  'pg_cron → Edge Function wallet-balance-email-cron-trigger → POST /api/wallet/balance-email/dispatch';

revoke all on function public.invoke_wallet_balance_email_cron_trigger() from public;
grant execute on function public.invoke_wallet_balance_email_cron_trigger() to postgres;

-- 매분 UTC tick — dispatch route가 KST hour/minute 정확 매칭
select cron.unschedule(jobid)
from cron.job
where jobname = 'wallet-balance-email-every-minute';

select cron.schedule(
  'wallet-balance-email-every-minute',
  '* * * * *',
  'select public.invoke_wallet_balance_email_cron_trigger();'
);
