-- 2026-09-15: 식대 잔액 확인 이메일 preferences·run·recipient + notifications.type 확장
-- File: 50_wallet_balance_email.sql
-- Plan: 51_wallet-balance-email-plan.md
-- Date: 2026-09-15
-- Status: Completed
-- Remote migration: applied via MCP (2026-09-15)
-- Summary: wallet balance email preferences, dispatch run/recipient logs, wallet.balance_email notification type

create table if not exists public.wallet_balance_email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  hour smallint not null default 12 check (hour >= 0 and hour <= 23),
  minute smallint not null default 15 check (minute >= 0 and minute <= 59),
  exclude_weekends boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users (id) on delete set null
);

create index if not exists idx_wallet_balance_email_preferences_enabled_schedule
  on public.wallet_balance_email_preferences (enabled, hour, minute)
  where enabled = true;

create table if not exists public.wallet_balance_email_runs (
  id bigint generated always as identity primary key,
  run_key text not null,
  request_id uuid not null,
  trigger_source text not null default 'cron' check (trigger_source in ('cron', 'admin')),
  status text not null default 'failed' check (status in ('completed', 'partial_failed', 'failed')),
  due_count integer not null default 0 check (due_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint wallet_balance_email_runs_run_key_key unique (run_key),
  constraint wallet_balance_email_runs_run_key_length_check check (char_length(run_key) <= 80)
);

create index if not exists idx_wallet_balance_email_runs_created_at
  on public.wallet_balance_email_runs (created_at desc);

create index if not exists idx_wallet_balance_email_runs_status
  on public.wallet_balance_email_runs (status);

create table if not exists public.wallet_balance_email_recipients (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.wallet_balance_email_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_email text not null,
  status text not null check (status in ('sent', 'failed', 'blocked', 'skipped')),
  error_message text,
  notification_id bigint references public.notifications (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wallet_balance_email_recipients_run_user_key unique (run_id, user_id),
  constraint wallet_balance_email_recipients_email_length_check check (char_length(recipient_email) <= 320),
  constraint wallet_balance_email_recipients_error_message_length_check check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists idx_wallet_balance_email_recipients_run
  on public.wallet_balance_email_recipients (run_id);

create index if not exists idx_wallet_balance_email_recipients_user
  on public.wallet_balance_email_recipients (user_id);

create index if not exists idx_wallet_balance_email_recipients_status
  on public.wallet_balance_email_recipients (status);

alter table public.wallet_balance_email_preferences enable row level security;
alter table public.wallet_balance_email_runs enable row level security;
alter table public.wallet_balance_email_recipients enable row level security;

drop policy if exists wallet_balance_email_preferences_self_select on public.wallet_balance_email_preferences;
create policy wallet_balance_email_preferences_self_select
on public.wallet_balance_email_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists wallet_balance_email_preferences_admin_select on public.wallet_balance_email_preferences;
create policy wallet_balance_email_preferences_admin_select
on public.wallet_balance_email_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists wallet_balance_email_runs_admin_select on public.wallet_balance_email_runs;
create policy wallet_balance_email_runs_admin_select
on public.wallet_balance_email_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists wallet_balance_email_recipients_admin_select on public.wallet_balance_email_recipients;
create policy wallet_balance_email_recipients_admin_select
on public.wallet_balance_email_recipients
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

revoke insert, update, delete on public.wallet_balance_email_preferences from authenticated;
revoke insert, update, delete on public.wallet_balance_email_preferences from anon;
revoke insert, update, delete on public.wallet_balance_email_runs from authenticated;
revoke insert, update, delete on public.wallet_balance_email_runs from anon;
revoke insert, update, delete on public.wallet_balance_email_recipients from authenticated;
revoke insert, update, delete on public.wallet_balance_email_recipients from anon;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'contract.import_admin',
      'contract.import_author',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'wallet.balance_email',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created'
    )
  );
