-- 2026-09-28: 식대 잔액 이메일 slot2 preferences + admin dispatch 인앱 알림 타입
-- File: 55_wallet_balance_email_slot2_admin_notif.sql
-- Plan: 55_wallet-balance-email-admin-dual-slot-plan.md
-- Date: 2026-09-28
-- Status: Completed
-- Remote migration: applied via MCP (2026-09-28)
-- Summary: slot2_enabled/hour2/minute2 columns, wallet.balance_email_admin notification type, slot2 partial index

alter table public.wallet_balance_email_preferences
  add column if not exists slot2_enabled boolean not null default false,
  add column if not exists hour2 smallint not null default 12 check (hour2 >= 0 and hour2 <= 23),
  add column if not exists minute2 smallint not null default 15 check (minute2 >= 0 and minute2 <= 59);

create index if not exists idx_wallet_balance_email_preferences_enabled_schedule_slot2
  on public.wallet_balance_email_preferences (enabled, hour2, minute2)
  where enabled = true and slot2_enabled = true;

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
      'wallet.balance_email_admin',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created'
    )
  );
