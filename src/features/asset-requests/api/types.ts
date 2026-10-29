/**
 * plan 103 — 구독·비품 요청 · 댓글 타입 (FE·BE 계약 · 런타임 의존성 없음).
 * 요청은 요청자 본인 + 권한자만 본다(그 외 404 · D-13).
 */

export const ASSET_TARGET_TYPES = ['subscription', 'equipment'] as const;
export type AssetTargetType = (typeof ASSET_TARGET_TYPES)[number];

export const ASSET_TARGET_LABELS: Record<AssetTargetType, string> = {
  subscription: '구독',
  equipment: '비품'
};

export const EQUIPMENT_REQUEST_TYPES = ['repair', 'replace', 'return', 'lost', 'other'] as const;
export const SUBSCRIPTION_REQUEST_TYPES = ['cancel', 'change', 'other'] as const;
export type EquipmentRequestType = (typeof EQUIPMENT_REQUEST_TYPES)[number];
export type SubscriptionRequestType = (typeof SUBSCRIPTION_REQUEST_TYPES)[number];
export type AssetRequestType = EquipmentRequestType | SubscriptionRequestType;

/** D-12 — 종류 라벨 (RadioGroup 순서 = 배열 순서) */
export const EQUIPMENT_REQUEST_TYPE_LABELS: Record<EquipmentRequestType, string> = {
  repair: '고장·수리',
  replace: '교체',
  return: '반납',
  lost: '분실 신고',
  other: '기타'
};

export const SUBSCRIPTION_REQUEST_TYPE_LABELS: Record<SubscriptionRequestType, string> = {
  cancel: '해지',
  change: '변경(플랜·이용자)',
  other: '기타'
};

export function requestTypesFor(targetType: AssetTargetType): readonly AssetRequestType[] {
  return targetType === 'equipment' ? EQUIPMENT_REQUEST_TYPES : SUBSCRIPTION_REQUEST_TYPES;
}

export function isRequestTypeFor(targetType: AssetTargetType, value: unknown): value is AssetRequestType {
  return typeof value === 'string' && (requestTypesFor(targetType) as readonly string[]).includes(value);
}

export function requestTypeLabel(targetType: AssetTargetType, requestType: string): string {
  if (targetType === 'equipment') {
    return EQUIPMENT_REQUEST_TYPE_LABELS[requestType as EquipmentRequestType] ?? requestType;
  }
  return SUBSCRIPTION_REQUEST_TYPE_LABELS[requestType as SubscriptionRequestType] ?? requestType;
}

export const ASSET_REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'rejected',
  'canceled'
] as const;
export type AssetRequestStatus = (typeof ASSET_REQUEST_STATUSES)[number];

export const ASSET_REQUEST_STATUS_LABELS: Record<AssetRequestStatus, string> = {
  pending: '접수대기',
  in_progress: '처리중',
  completed: '완료',
  rejected: '반려',
  canceled: '취소'
};

export const ASSET_REQUEST_OPEN_STATUSES: readonly AssetRequestStatus[] = ['pending', 'in_progress'];
export const ASSET_REQUEST_DONE_STATUSES: readonly AssetRequestStatus[] = [
  'completed',
  'rejected',
  'canceled'
];

export function isOpenRequestStatus(status: string): boolean {
  return (ASSET_REQUEST_OPEN_STATUSES as readonly string[]).includes(status);
}

/** 요청 화면 상태 칩 (`rstatus`) — 기본 open */
export const ASSET_REQUEST_STATUS_FILTERS = ['open', 'done', 'all'] as const;
export type AssetRequestStatusFilter = (typeof ASSET_REQUEST_STATUS_FILTERS)[number];

export const ASSET_REQUEST_BODY_MIN = 5;
export const ASSET_REQUEST_BODY_MAX = 2000;
export const ASSET_REJECT_REASON_MAX = 500;
export const ASSET_COMMENT_BODY_MAX = 2000;

/** 서버·폼 공용 문구 (plan §요청 상태 전이 · AC-23~31) */
export const ASSET_REQUEST_MESSAGES = {
  bodyTooShort: '내용을 5자 이상 적어 주세요.',
  bodyTooLong: '내용은 2000자까지 쓸 수 있어요.',
  invalidType: '요청 종류를 선택해 주세요.',
  duplicateOpen: '이미 진행 중인 요청이 있어요.',
  notFound: '요청을 찾을 수 없어요.',
  targetNotFound: '대상을 찾을 수 없어요.',
  onlyPending: '접수대기일 때만 수정·취소할 수 있어요.',
  requesterOnly: '요청한 사람만 수정·취소할 수 있어요.',
  alreadyDone: '이미 끝난 요청이에요.',
  startFirst: '먼저 처리를 시작해 주세요.',
  alreadyInProgress: '이미 처리중인 요청이에요.',
  rejectReasonRequired: '반려 사유를 입력해 주세요.',
  rejectReasonTooLong: '반려 사유는 500자까지 쓸 수 있어요.',
  invalidStatus: '바꿀 상태가 올바르지 않아요.',
  statusChanged: '요청 상태가 바뀌었어요. 새로고침해 주세요.',
  assigneeOnlyInProgress: '처리중일 때만 담당자를 바꿀 수 있어요.',
  invalidAssignee: '선택할 수 없는 담당자예요.',
  commentRequired: '댓글을 입력해 주세요.',
  commentTooLong: '댓글은 2000자까지 쓸 수 있어요.',
  commentNotFound: '댓글을 찾을 수 없어요.',
  commentAuthorOnly: '본인 댓글만 수정할 수 있어요.',
  commentDeleteForbidden: '댓글을 삭제할 권한이 없어요.',
  commentDeleted: '삭제된 댓글이에요.',
  forbidden: '권한이 없습니다.'
} as const;

/** 목록·행 Dialog 「이 장비의 요청」 항목 */
export type AssetRequestListItem = {
  id: number;
  target_type: AssetTargetType;
  /** subscription_id 또는 equipment_id */
  target_id: number;
  target_label: string;
  request_type: AssetRequestType;
  status: AssetRequestStatus;
  requester_user_id: string;
  requester_name: string;
  assignee_user_id: string | null;
  /** 담당자 없으면 null(「담당자 없음」) */
  assignee_name: string | null;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

/** 요청 1건 화면 */
export type AssetRequestDetail = AssetRequestListItem & {
  body: string;
  /** 요청자 소속 팀(「웨이크 디자인팀」) · 없으면 null */
  requester_team_label: string | null;
  /** 담당자 소속 팀 · 담당자 없으면 null */
  assignee_team_label: string | null;
  reject_reason: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  /** 요청자가 접수대기 때 고친 시각 → 「수정됨 …」 */
  edited_at: string | null;
};

/** 보는 사람 기준 버튼 노출 (서버 계산 · UI는 이 값만 따른다 · Route가 매번 재검증) */
export type AssetRequestViewerFlags = {
  is_manager: boolean;
  is_requester: boolean;
  can_edit: boolean;
  can_cancel: boolean;
  can_start: boolean;
  can_complete: boolean;
  can_reject: boolean;
  can_change_assignee: boolean;
  can_comment: boolean;
};

export type AssetRequestDetailResponse = {
  request: AssetRequestDetail;
  viewer: AssetRequestViewerFlags;
};

export type AssetRequestDetailApiResponse = { success: true; data: AssetRequestDetailResponse };

export type AssetRequestFilters = {
  target_type: AssetTargetType;
  /** open(접수대기·처리중 · 기본) · done(완료·반려·취소) · all */
  status?: AssetRequestStatusFilter;
  /** 권한자 전용 「내 담당만」 (직원이 보내면 403) */
  mine_assigned?: boolean;
  page?: number;
  perPage?: number;
};

export type AssetRequestListResponse = {
  items: AssetRequestListItem[];
  total: number;
  page: number;
  perPage: number;
  is_manager: boolean;
  /** 권한자: 이 종류 전체 접수대기 수(「처리 대기 N」) · 직원: null */
  pending_count: number | null;
  /** 직원: 내 진행 중 요청 수(「내 요청 N」) · 권한자도 계산 */
  my_open_count: number;
};

export type AssetRequestListApiResponse = { success: true; data: AssetRequestListResponse };

/** `GET /api/asset-requests/summary` — 사이드바·전환 배지 */
export type AssetRequestSummary = {
  is_manager: boolean;
  /** 권한자만 숫자 · 직원 null */
  subscription_pending: number | null;
  equipment_pending: number | null;
  subscription_my_open: number;
  equipment_my_open: number;
};

export type AssetRequestSummaryApiResponse = { success: true; data: AssetRequestSummary };

export type AssetRequestCreatePayload = {
  target_type: AssetTargetType;
  target_id: number;
  request_type: AssetRequestType;
  body: string;
};

export type AssetRequestUpdatePayload = {
  request_type?: AssetRequestType;
  body?: string;
};

export type AssetRequestStatusPayload =
  | { status: 'in_progress' }
  | { status: 'completed' }
  | { status: 'rejected'; reject_reason: string };

export type AssetRequestAssigneePayload = { assignee_user_id: string };

export type AssetRequestMutationResponse = {
  success: true;
  message: string;
  request: AssetRequestDetail;
};

/** 댓글 작성자 역할 배지 — 요청자 / 담당자 / 권한자 */
export type AssetCommentAuthorRole = 'requester' | 'assignee' | 'manager';

export const ASSET_COMMENT_ROLE_LABELS: Record<AssetCommentAuthorRole, string> = {
  requester: '요청자',
  assignee: '담당자',
  manager: '권한자'
};

export type AssetRequestComment = {
  id: number;
  request_id: number;
  author_user_id: string;
  author_name: string;
  /** 서버 계산 역할(요청자 > 담당자 > 권한자) — FE가 요청의 requester/assignee와 비교해 다시 정해도 된다 */
  author_role: AssetCommentAuthorRole;
  /** 작성자가 현재 권한자인지 */
  author_is_manager: boolean;
  parent_id: number | null;
  root_comment_id: number | null;
  path: string;
  depth: number;
  /** soft delete면 빈 문자열 → UI 「삭제된 댓글입니다.」 */
  body: string;
  is_deleted: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetRequestCommentsResponse = {
  comments: AssetRequestComment[];
};

export type AssetRequestCommentsApiResponse = { success: true; data: AssetRequestCommentsResponse };

export type AssetRequestCommentPayload = { body: string };

export type AssetRequestCommentMutationResponse = {
  success: true;
  message: string;
  comment: AssetRequestComment;
};
