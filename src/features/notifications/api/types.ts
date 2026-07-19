export type NotificationType =
  | 'user.update'
  | 'contract.reminder_admin'
  | 'contract.reminder_recipient';

export type NotificationStatus = 'unread' | 'read';

export type NotificationMetadata = {
  changed_fields?: string[];
  kind?: 'user.update' | 'contract.reminder_admin' | 'contract.reminder_recipient';
  run_id?: number;
  run_key?: string;
  trigger_source?: 'admin' | 'cron';
  sent_count?: number;
  failed_count?: number;
  unmatched_count?: number;
  run_status?: 'completed' | 'partial_failed' | 'failed';
  author_name?: string;
  document_count?: number;
  document_numbers?: string[];
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
