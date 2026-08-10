export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'urgent'] as const;

export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_ATTACHMENT_BUCKET = 'announcement-attachments';

export const ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_MB = 10;
export const ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_BYTES =
  ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_MB * 1024 * 1024;

export const ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_MB = 50;
export const ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_BYTES =
  ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_MB * 1024 * 1024;

export const ANNOUNCEMENT_ATTACHMENT_PER_FILE_SIZE_ERROR = `파일당 용량은 ${ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_MB}MB 이하여야 합니다.`;
export const ANNOUNCEMENT_ATTACHMENT_TOTAL_SIZE_ERROR = `공지당 활성 첨부파일 총량은 ${ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_MB}MB 이하여야 합니다.`;

export const ANNOUNCEMENT_ATTACHMENT_PER_FILE_LIMIT_HINT = `파일당 ${ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_MB}MB 이하`;
export const ANNOUNCEMENT_ATTACHMENT_TOTAL_LIMIT_HINT = `공지당 활성 첨부 총량 ${ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_MB}MB 이하`;
export const ANNOUNCEMENT_ATTACHMENT_LIMIT_HINT = `${ANNOUNCEMENT_ATTACHMENT_PER_FILE_LIMIT_HINT}\n${ANNOUNCEMENT_ATTACHMENT_TOTAL_LIMIT_HINT}`;

export const ANNOUNCEMENTS_PAGE_SIZE = 10;
export const ANNOUNCEMENTS_OVERVIEW_LIMIT = 3;
export const ANNOUNCEMENTS_PIN_MAX = 3;
export const ANNOUNCEMENTS_PIN_MAX_ERROR = '고정 공지는 최대 3개까지 가능합니다.';

export type AnnouncementAttachmentSummary = {
  id: number;
  file_name: string;
  content_type: string | null;
  file_size: number;
  created_at: string;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  created_by: string;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  attachments?: AnnouncementAttachmentSummary[];
};

export type AnnouncementListItem = Pick<
  Announcement,
  'id' | 'title' | 'body' | 'priority' | 'is_pinned' | 'created_at' | 'updated_at'
>;

export type AnnouncementsListResponse = {
  announcements: AnnouncementListItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AnnouncementsFilters = {
  limit?: number;
  cursor?: string;
  search?: string;
  priority?: AnnouncementPriority[];
  pinned?: boolean;
};

export type AnnouncementCreatePayload = {
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  is_pinned?: boolean;
  /** 첨부 업로드 예정이면 true — fan-out을 notify API로 연기 */
  defer_notify?: boolean;
};

export type AnnouncementUpdatePayload = Partial<
  Pick<AnnouncementCreatePayload, 'title' | 'body' | 'priority' | 'is_pinned'>
>;

export type AnnouncementDetailResponse = {
  success: boolean;
  message: string;
  announcement: Announcement;
};

export type AnnouncementMutationResponse = AnnouncementDetailResponse;

export type AnnouncementAttachmentMutationResponse = {
  success: boolean;
  message: string;
  announcement: Announcement;
  attachment: AnnouncementAttachmentSummary;
};

export type AnnouncementNotifyResponse = {
  success: boolean;
  message: string;
  notified: boolean;
  announcement_id: number;
};
