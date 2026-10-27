export type NotificationType =
  | 'user.update'
  | 'user.approval_request_admin'
  | 'contract.reminder_admin'
  | 'contract.reminder_recipient'
  | 'contract.import_admin'
  | 'contract.import_author'
  | 'wallet.sync_admin'
  | 'wallet.sync_recipient'
  | 'wallet.balance_email'
  | 'wallet.balance_email_admin'
  | 'announcement.published'
  | 'support.created'
  | 'support.updated'
  | 'support.status_changed'
  | 'support.comment_created'
  | 'support.reply_created'
  | 'benefit.import_operations'
  | 'benefit.import_applicant'
  | 'benefit.document_cancel_operations'
  | 'benefit.document_cancel_applicant'
  | 'benefit.document_restore_operations'
  | 'benefit.document_restore_applicant'
  | 'workflow.approval_requested'
  | 'workflow.referrer_requested'
  | 'workflow.completed'
  | 'workflow.declined'
  | 'workflow.canceled'
  | 'workflow.comment_created'
  | 'quick_request.vendor_event'
  | 'quick_request.requester_event'
  /** plan 93 — 퀵 대화 메시지 (보낸 사람을 뺀 참여자 전원) */
  | 'quick_request.chat_message';

export type NotificationStatus = 'unread' | 'read';

export type NotificationMetadata = {
  changed_fields?: string[];
  kind?:
    | 'user.update'
    | 'user.approval_request_admin'
    | 'contract.reminder_admin'
    | 'contract.reminder_recipient'
    | 'contract.import_admin'
    | 'contract.import_author'
    | 'wallet.sync_admin'
    | 'wallet.sync_recipient'
    | 'wallet.balance_email'
    | 'wallet.balance_email_admin'
    | 'announcement.published'
    | 'support.created'
    | 'support.updated'
    | 'support.status_changed'
    | 'support.comment_created'
    | 'support.reply_created'
    | 'benefit.import_operations'
    | 'benefit.import_applicant'
    | 'benefit.document_cancel_operations'
    | 'benefit.document_cancel_applicant'
    | 'benefit.document_restore_operations'
    | 'benefit.document_restore_applicant'
    | 'workflow.approval_requested'
    | 'workflow.referrer_requested'
    | 'workflow.completed'
    | 'workflow.declined'
    | 'workflow.canceled'
    | 'workflow.comment_created'
    | 'quick_request.vendor_event'
    | 'quick_request.requester_event'
    | 'quick_request.chat_message';
  benefit_document_id?: number;
  benefit_type?: 'book' | 'fitness' | 'education';
  applicant_user_id?: string;
  actor_user_id?: string;
  contract_id?: number;
  document_number?: string;
  import_status?: 'created' | 'backfill';
  announcement_id?: number;
  support_request_id?: number;
  comment_id?: number;
  parent_id?: number | null;
  previous_status?: string;
  new_status?: string;
  run_id?: number;
  run_key?: string;
  trigger_source?: 'admin' | 'cron';
  due_count?: number;
  sent_count?: number;
  failed_count?: number;
  blocked_count?: number;
  skipped_count?: number;
  unmatched_count?: number;
  run_status?: 'completed' | 'partial_failed' | 'failed';
  author_name?: string;
  document_count?: number;
  document_numbers?: string[];
  request_id?: string;
  matched_count?: number;
  target_user_id?: string;
  google_email?: string;
  google_display_name?: string | null;
  /** plan 88 — 클릭 이동 `/dashboard/workflow?doc={workflow_document_id}` */
  workflow_document_id?: string;
  document_code?: string;
  template_key?: string;
  /** plan 89 — 클릭 이동 `/dashboard/quick/{quick_request_no}` */
  quick_request_no?: string;
  quick_request_id?: string;
  /** created · cancelled (vendor) / accepted · dispatched · final_amount_set · approved · cancelled (requester) / chat_message (plan 93) */
  quick_request_event?: string;
  /** plan 93 — 클릭 이동 `/dashboard/quick/chat?request={quick_request_no}` · 자동 읽음은 `quick_request_id`로 매칭 */
  quick_request_message_id?: number;
};

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
  metadata: NotificationMetadata;
};

export type NotificationsListResponse = {
  notifications: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type NotificationsFilters = {
  limit?: number;
  cursor?: string;
  /** Admin only: `self` (default) or target user UUID */
  notif_user?: string;
};
