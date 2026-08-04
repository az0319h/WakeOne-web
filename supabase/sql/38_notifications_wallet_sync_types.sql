-- File: 38_notifications_wallet_sync_types.sql
-- Plan: 32_wallet-kbcard-sync-plan.md
-- Date: 2026-08-04
-- Status: In Progress
-- Remote migration: applied via MCP (2026-08-04)
-- Summary: KB카드 지갑 동기화 인앱 알림 타입(wallet.sync_admin, wallet.sync_recipient) 허용.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'wallet.sync_admin',
      'wallet.sync_recipient'
    )
  );
