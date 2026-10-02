-- 2026-10-02: Google pending 승인 요청 admin 인앱 알림 타입
-- File: 57_notifications_user_approval_request_admin_type.sql
-- Plan: 59_google-auth-admin-notif-activity-log-result-plan.md
-- Date: 2026-10-02
-- Status: Completed
-- Remote migration: applied via MCP (2026-10-02)
-- Summary: notifications.type CHECK에 user.approval_request_admin 추가

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'user.approval_request_admin',
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
