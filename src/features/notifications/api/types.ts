export type NotificationType = 'user.update';

export type NotificationStatus = 'unread' | 'read';

export type NotificationMetadata = {
  changed_fields?: string[];
  kind?: 'user.update';
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
