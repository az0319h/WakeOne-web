export const SUPPORT_STATUSES = ['pending', 'received', 'completed'] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  pending: '접수대기',
  received: '접수됨',
  completed: '처리완료'
};

export const SUPPORT_PAGE_SIZE = 10;

export type SupportRequest = {
  id: number;
  submitted_by: string;
  submitter_name: string;
  submitter_email: string;
  title: string;
  body: string;
  status: SupportStatus;
  status_updated_at: string | null;
  status_updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportListItem = Pick<
  SupportRequest,
  | 'id'
  | 'submitted_by'
  | 'submitter_name'
  | 'submitter_email'
  | 'title'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

export type SupportListResponse = {
  requests: SupportListItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SupportFilters = {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: SupportStatus[];
  submitted_by?: string;
};

export type SupportCreatePayload = {
  title: string;
  body: string;
};

export type SupportUpdateContentPayload = {
  title: string;
  body: string;
};

export type SupportUpdateStatusPayload = {
  status: SupportStatus;
};

export type SupportCommentAuthorRole = 'admin' | 'user';

export type SupportComment = {
  id: number;
  support_request_id: number;
  author_user_id: string;
  author_name: string;
  author_role: SupportCommentAuthorRole;
  parent_id: number | null;
  root_comment_id: number | null;
  path: string;
  depth: number;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupportCommentCreatePayload = {
  body: string;
};

export type SupportCommentUpdatePayload = {
  body: string;
};

export type SupportDetailResponse = {
  success: boolean;
  message: string;
  request: SupportRequest;
};

export type SupportMutationResponse = SupportDetailResponse;

export type SupportCommentsResponse = {
  success: boolean;
  comments: SupportComment[];
};

export type SupportCommentMutationResponse = {
  success: boolean;
  message: string;
  comment: SupportComment;
};

export type SupportListApiResponse = {
  success: boolean;
  data: SupportListResponse;
};
