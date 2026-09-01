-- 2026-09-01: 계약서 import in-app 알림 타입 확장 (plan 47)
-- File: 47_notifications_contract_import_types.sql
-- Plan: 47_contract-import-notifications-plan.md
-- Date: 2026-09-01
-- Status: Approved
-- Remote migration: applied via MCP (2026-09-01)
-- Summary: notifications.type CHECK에 contract.import_admin · contract.import_author 추가

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
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created'
    )
  );
