/**
 * 워크플로우(plan 88) API 공유 타입 — Route 응답 · 요청 body. frontend service/queries가 import한다.
 */
import type { Affiliation } from '@/features/users/constants/organization';
import type {
  WorkflowApprovalStepsInput,
  WorkflowNotificationSetting,
  WorkflowReferrerInput
} from '../lib/approval-line-rules';
import type { WorkflowDocumentStatus, WorkflowEditPolicy, WorkflowPermissions } from '../lib/permissions';
import type {
  WorkflowFieldRule,
  WorkflowInputValue,
  WorkflowRequiredWhen,
  WorkflowValidationError
} from '../lib/required-rules';

export type { WorkflowDocumentStatus, WorkflowEditPolicy, WorkflowPermissions };
export type { WorkflowNotificationSetting, WorkflowReferrerInput, WorkflowApprovalStepsInput };
export type { WorkflowInputValue };

export type WorkflowStepStatus = 'PENDING' | 'ONGOING' | 'APPROVED' | 'DECLINED';
export type WorkflowActorStatus = 'WAITING' | 'APPROVED' | 'DECLINED';
export type WorkflowEventType =
  | 'WRITE'
  | 'CHANGE_STAGE_STAKE_HOLDERS'
  | 'APPROVE'
  | 'DECLINE'
  | 'CANCEL'
  | 'UPDATE'
  | 'COMMENT';
export type WorkflowPrefillType = 'NONE' | 'DEFAULT' | 'NAME';

/** 목록 탭 · 범위 · 정렬 · 그룹 (URL query 값) */
export const WORKFLOW_TABS = ['in_progress', 'done', 'star', 'all'] as const;
export type WorkflowTab = (typeof WORKFLOW_TABS)[number];
export const WORKFLOW_SCOPES = ['related', 'mine', 'company'] as const;
export type WorkflowScope = (typeof WORKFLOW_SCOPES)[number];
export const WORKFLOW_SORTS = ['updated_desc', 'updated_asc', 'written_desc', 'written_asc'] as const;
export type WorkflowSort = (typeof WORKFLOW_SORTS)[number];
export const WORKFLOW_GROUPS = ['approval_required', 'in_progress'] as const;
export type WorkflowGroup = (typeof WORKFLOW_GROUPS)[number];

/** 첨부 변경·본문 변경을 나타내는 changed_field_keys 특수 키 */
export const WORKFLOW_CHANGED_CONTENT_KEY = '__content';
export const WORKFLOW_CHANGED_ATTACHMENTS_KEY = '__attachments';

export type WorkflowPersonSummary = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

/** 결재선 Combobox · 승인/참조 표시용 구성원 */
export type WorkflowMember = WorkflowPersonSummary & {
  email: string;
  affiliation: Affiliation | null;
  /** 「웨이크」 등 소속 라벨 */
  affiliation_label: string | null;
  position_level: string | null;
  /** 비활성(퇴사) 여부 — 과거 문서 표시용 */
  is_active: boolean;
};

export type WorkflowTemplateField = WorkflowFieldRule & {
  prefill_type: WorkflowPrefillType;
  prefill_default: string | null;
  display_order: number;
};

/** 문서 제출 시점 양식 스냅샷 */
export type WorkflowTemplateSnapshot = {
  template_key: string;
  name: string;
  emoji: string;
  description: string;
  content_visible: boolean;
  attachment_visible: boolean;
  attachment_required: boolean;
  attachment_required_when: WorkflowRequiredWhen | null;
  edit_policy: WorkflowEditPolicy;
  fields: WorkflowTemplateField[];
};

export type WorkflowTemplateRef = {
  key: string;
  name: string;
  emoji: string;
};

export type WorkflowTemplateListItem = {
  id: string;
  template_key: string;
  name: string;
  emoji: string;
  tags: string[];
  display_order: number;
};

export type WorkflowDefaultLine = {
  steps: { step: number; actors: WorkflowMember[] }[];
  referrers: { member: WorkflowMember; notification_setting: WorkflowNotificationSetting }[];
};

export type WorkflowTemplateDetail = WorkflowTemplateListItem & {
  description: string;
  content_default: string;
  content_visible: boolean;
  attachment_visible: boolean;
  attachment_required: boolean;
  attachment_required_when: WorkflowRequiredWhen | null;
  only_visible_for_admin: boolean;
  edit_policy: WorkflowEditPolicy;
  approval_step_edit_enabled: boolean;
  fields: WorkflowTemplateField[];
  default_line: WorkflowDefaultLine;
};

export type WorkflowInputItem = {
  field_key: string;
  value: WorkflowInputValue;
};

export type WorkflowListRow = {
  id: string;
  code: string;
  status: WorkflowDocumentStatus;
  current_step: number;
  total_steps: number;
  template: WorkflowTemplateRef;
  writer: WorkflowPersonSummary;
  written_at: string;
  updated_at: string;
  /** 「요청 유형: …」으로 시작하는 한 줄 요약 (빈 값 제외, 문서번호 미포함) */
  summary: string;
  attachment_count: number;
  /** 결재자 아바타 (최대 3명, 단계·순서대로) */
  approvers_preview: WorkflowPersonSummary[];
  approvers_total: number;
  my_state: {
    approval_required: boolean;
    starred: boolean;
  };
};

export type WorkflowListResponse = {
  success: true;
  rows: WorkflowListRow[];
  total: number;
  /** 다음 페이지 cursor (없으면 null) — `cursor` query로 그대로 넘긴다 */
  next_cursor: string | null;
};

export type WorkflowCounts = {
  in_progress: number;
  done: number;
  star: number;
  all: number;
  approval_required: number;
};

export type WorkflowCountsResponse = { success: true; counts: WorkflowCounts };

export type WorkflowListQuery = {
  tab?: WorkflowTab;
  scope?: WorkflowScope;
  group?: WorkflowGroup | null;
  q?: string | null;
  writer?: string[];
  template?: string[];
  /** today · 7d · 1m · 3m · month:YYYY-MM · range:YYYY-MM-DD..YYYY-MM-DD */
  updated?: string | null;
  sort?: WorkflowSort;
  cursor?: string | null;
  limit?: number;
  /** 참조문서 선택 Dialog에서 자기 자신 제외 */
  exclude?: string | null;
};

export type WorkflowAttachment = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type WorkflowReferenceDocument = {
  id: string;
  code: string;
  template_name: string;
  emoji: string;
  writer_name: string;
  status: WorkflowDocumentStatus;
};

export type WorkflowStepActor = WorkflowMember & {
  status: WorkflowActorStatus;
  acted_at: string | null;
};

export type WorkflowStep = {
  step: number;
  status: WorkflowStepStatus;
  actors: WorkflowStepActor[];
};

export type WorkflowReferrer = WorkflowMember & {
  notification_setting: WorkflowNotificationSetting;
};

/** CHANGE_STAGE_STAKE_HOLDERS diff 항목 */
export type WorkflowLineDiffEntry = {
  kind: 'step' | 'referrer';
  step: number | null;
  before: { user_id: string; name: string; type: '승인' | '참조'; notification_setting?: WorkflowNotificationSetting }[];
  after: { user_id: string; name: string; type: '승인' | '참조'; notification_setting?: WorkflowNotificationSetting }[];
};

export type WorkflowEventPayload = {
  /** CHANGE_STAGE_STAKE_HOLDERS */
  diff?: WorkflowLineDiffEntry[];
  /** 표시용 줄: 「2단계: A(승인) → B(승인)」, 「3단계: 없음 → C(승인)」, 「참조: A → 없음」 */
  diff_lines?: string[];
  /** UPDATE — 스냅샷 field_key, 본문은 `__content`, 첨부는 `__attachments` */
  changed_field_keys?: string[];
  /** APPROVE · DECLINE 처리 단계 */
  step?: number;
};

export type WorkflowEvent = {
  id: string;
  type: WorkflowEventType;
  actor: WorkflowPersonSummary | null;
  /** 댓글 본문 · 승인 의견 · 반려 사유 */
  content: string | null;
  payload: WorkflowEventPayload;
  created_at: string;
};

export type WorkflowDocumentDetail = {
  id: string;
  code: string;
  title: string;
  status: WorkflowDocumentStatus;
  current_step: number;
  total_steps: number;
  template: WorkflowTemplateRef;
  template_snapshot: WorkflowTemplateSnapshot;
  writer: WorkflowMember;
  written_at: string;
  updated_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  edit_policy: WorkflowEditPolicy;
  approval_step_edit_enabled: boolean;
  inputs: WorkflowInputItem[];
  /** field_key → 값 (inputs를 맵으로) */
  values: Record<string, WorkflowInputValue>;
  /** 서버에서 정화된 HTML */
  content_html: string;
  attachments: WorkflowAttachment[];
  /** 열람 가능한 참조문서만 */
  references: WorkflowReferenceDocument[];
  steps: WorkflowStep[];
  referrers: WorkflowReferrer[];
  events: WorkflowEvent[];
  permissions: WorkflowPermissions;
  starred: boolean;
};

export type WorkflowDocumentDetailResponse = { success: true; document: WorkflowDocumentDetail };

export type WorkflowDraftPayload = {
  values: Record<string, WorkflowInputValue>;
  content_html: string;
  steps: WorkflowApprovalStepsInput;
  referrers: WorkflowReferrerInput[];
};

export type WorkflowDraftListItem = {
  id: string;
  template: WorkflowTemplateRef;
  created_at: string;
  updated_at: string;
};

export type WorkflowDraftDetail = WorkflowDraftListItem & {
  payload: WorkflowDraftPayload;
  attachments: WorkflowAttachment[];
};

export type WorkflowAdmin = WorkflowMember & {
  granted_by: string | null;
  created_at: string;
};

/** 변경 결과 공통 요약 */
export type WorkflowDocumentMutationResult = {
  id: string;
  code: string;
  status: WorkflowDocumentStatus;
  current_step: number;
  total_steps: number;
  template_key: string;
};

// ---------------------------------------------------------------------------
// 요청 body
// ---------------------------------------------------------------------------

/** POST /api/workflow/documents — 참조문서는 values[TASK_REFERENCE 필드] (document id 배열) */
export type WorkflowSubmitPayload = {
  template_key: string;
  values: Record<string, WorkflowInputValue>;
  content_html?: string;
  steps: WorkflowApprovalStepsInput;
  referrers: WorkflowReferrerInput[];
  attachment_ids: string[];
  /** 임시저장에서 이어 쓴 경우 — 제출 후 임시저장은 삭제된다 */
  draft_id?: string | null;
};

/** PATCH /api/workflow/documents/[id] — values는 보낸 키만 덮어쓴다 */
export type WorkflowUpdatePayload = {
  values?: Record<string, WorkflowInputValue>;
  content_html?: string;
  add_attachment_ids?: string[];
  remove_attachment_ids?: string[];
};

export type WorkflowApprovalLinePayload = {
  steps: WorkflowApprovalStepsInput;
  referrers: WorkflowReferrerInput[];
};

export type WorkflowApprovePayload = { opinion?: string | null };
export type WorkflowDeclinePayload = { reason?: string | null };
export type WorkflowCommentPayload = { content: string };
export type WorkflowStarPayload = { starred: boolean };

export type WorkflowDraftSavePayload = {
  template_key: string;
  payload: WorkflowDraftPayload;
  attachment_ids: string[];
};

export type WorkflowPolicyPayload = {
  steps: WorkflowApprovalStepsInput;
  referrers: WorkflowReferrerInput[];
  approval_step_edit_enabled?: boolean;
};

export type WorkflowAdminGrantPayload = { user_id: string };

export type WorkflowAttachmentPreparePayload = {
  file_name: string;
  file_size: number;
  content_type?: string | null;
  /** 현재 폼에 이미 있는 첨부 개수 (31번째 사전 차단용 — 최종 검증은 제출 시) */
  existing_count?: number;
};

export type WorkflowAttachmentPrepareResponse = {
  success: true;
  signed_url: string;
  token: string;
  storage_path: string;
};

export type WorkflowAttachmentCompletePayload = {
  storage_path: string;
  file_name: string;
  file_size: number;
  content_type?: string | null;
};

export type WorkflowAttachmentCompleteResponse = {
  success: true;
  attachment: WorkflowAttachment;
};

export type WorkflowAttachmentDownloadResponse = {
  success: true;
  url: string;
  file_name: string;
  mime_type: string | null;
};

/** 4xx/5xx 응답 body — `field_key`가 있으면 해당 칸 FieldError에 붙인다 */
export type WorkflowErrorBody = {
  success: false;
  message: string;
  error: string;
  field_key?: string;
  errors?: WorkflowValidationError[];
};
