export type ActivityAction =
  | "user.create"
  | "user.invite"
  | "user.update"
  | "user.approval_request"
  | "user.approve"
  | "user.reject"
  | "user.reactivate"
  | "user.deactivate"
  | "contract.import_create"
  | "contract.import_duplicate"
  | "contract.import_backfill"
  | "contract.import_failed"
  | "contract.update"
  | "contract.soft_delete"
  | "contract.attachment_upload"
  | "contract.attachment_soft_delete"
  | "contract.no_attachment_set"
  | "contract.no_attachment_unset"
  | "contract.reminder_send"
  | "contract.reminder_failed"
  | "wallet.sync_create"
  | "wallet.sync_failed"
  | "wallet.balance_email_pref_update"
  | "wallet.balance_email_send"
  | "wallet.balance_email_failed"
  | "wallet.balance_email_blocked"
  | "wallet.balance_email_dispatch"
  | "benefit.import_create"
  | "benefit.import_duplicate"
  | "benefit.import_failed"
  | "benefit.document_cancel"
  | "benefit.document_restore"
  | "profile.update"
  | "profile.password_change"
  | "auth.sign_in"
  | "auth.password_reset_request"
  | "auth.password_reset_complete"
  | "auth.force_password_change"
  | "notification.read"
  | "notification.read_all"
  | "announcement.create"
  | "announcement.update"
  | "announcement.delete"
  | "announcement.attachment_upload"
  | "announcement.attachment_delete"
  | "support.create"
  | "support.update"
  | "support.status_update"
  | "support.comment_create"
  | "support.comment_update"
  | "support.comment_delete"
  | "google_tasks.connect"
  | "google_tasks.connect_failed"
  | "google_tasks.disconnect"
  | "google_tasks.tasklist.create"
  | "google_tasks.tasklist.update"
  | "google_tasks.tasklist.delete"
  | "google_tasks.tasklist.clear_completed"
  | "google_tasks.task.create"
  | "google_tasks.task.update"
  | "google_tasks.task.delete"
  | "google_tasks.task.complete"
  | "google_tasks.task.uncomplete"
  | "google_tasks.task.move"
  | "quick_request.note_create"
  | "quick_request.note_update"
  | "quick_request.note_delete"
  | "quick_request.recent_address_record"
  | "quick_request.create"
  | "quick_request.update"
  | "quick_request.final_amount_set"
  | "quick_request.accept"
  | "quick_request.dispatch"
  | "quick_request.approve"
  | "quick_request.cancel"
  /** plan 93 — 퀵 대화 메시지 전송 (본문은 남기지 않는다 · 읽음 갱신은 로그 Out) */
  | "quick_request.message_create"
  /** plan 98 — 퀵 대화 첨부 준비(prepare · signed upload URL) · pending 첨부 취소 (파일명·storage_path 금지) */
  | "quick_request.message_attachment_prepare"
  | "quick_request.message_attachment_delete"
  /** plan 101 — 퀵 대화 참여자 초대 · 제외/나가기 (metadata `participant_user_id` · `self`) */
  | "quick_request.participant_add"
  | "quick_request.participant_remove"
  /** plan 100 — 퀵 대화 AI 답장 추천 (외부 AI 전송 + 일일 카운터 증가 · 전 분기 기록 · 본문·추천 문장 금지 · 숫자 메타만) */
  | "quick_request.chat_ai_suggest"
  /** legacy — plan 92에서 Route 삭제. 과거 로그 표시용으로만 유지(신규 기록 없음) */
  | "quick_request.openchat_resend"
  | "workflow.document_create"
  | "workflow.document_update"
  | "workflow.document_approve"
  | "workflow.document_decline"
  | "workflow.document_cancel"
  | "workflow.approval_line_update"
  | "workflow.comment_create"
  | "workflow.document_star"
  | "workflow.attachment_upload"
  | "workflow.attachment_delete"
  | "workflow.draft_save"
  | "workflow.draft_delete"
  | "workflow.template_policy_update"
  | "workflow.admin_grant"
  | "workflow.admin_revoke"
  | "push_subscription.create"
  | "push_subscription.delete"
  | "push_preference.update"
  | "push.test_send"
  /** plan 105 — 다른 계정 로그인 시 그 기기에 남은 이전 사용자 푸시 구독 해제 */
  | "push_subscription.detach"
  /** plan 103 —구독 관리 · 비품 관리 · 자산 요청 (metadata에 금액·카드·주계정·관리 메모·요청/댓글 본문·반려 사유 금지) */
  | "subscription.create"
  | "subscription.update"
  | "subscription.delete"
  | "equipment.create"
  | "equipment.update"
  | "equipment.delete"
  | "asset_request.create"
  | "asset_request.update"
  | "asset_request.cancel"
  | "asset_request.status_update"
  | "asset_request.assignee_update"
  | "asset_request.comment_create"
  | "asset_request.comment_update"
  | "asset_request.comment_delete";

export type ActivityTargetType =
  | "user"
  | "profile"
  | "contract"
  | "wallet"
  | "benefit"
  | "auth"
  | "announcement"
  | "support_request"
  | "support_comment"
  | "google_tasks"
  | "quick_request_note"
  | "quick_request_address"
  | "quick_request"
  | "workflow_document"
  | "workflow_draft"
  | "workflow_attachment"
  | "workflow_template"
  | "workflow_admin"
  /** plan 103 */
  | "subscription"
  | "equipment_item"
  | "asset_request"
  | "asset_request_comment";

export type ActivityLogErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "validation"
  | "missing_approved_at"
  | "duplicate_email"
  | "forbidden_field"
  | "inactive_user"
  | "not_pending"
  | "not_found"
  | "wrong_password"
  | "invalid_otp"
  | "profile_edit_disabled"
  | "cron_paused"
  | "safety_filter_blocked"
  | "internal_error"
  | "gone"
  | "duplicate_label"
  | "limit_exceeded"
  | "conflict"
  /** plan 100 — AI 답장 추천: 503 꺼짐 · 502 호출 실패(timeout·rate limit·인증·중단·기타) · 200 rules 사유(refusal·형식 오류·전부 필터) */
  | "ai_disabled"
  | "ai_timeout"
  | "ai_rate_limited"
  | "ai_auth_error"
  | "ai_aborted"
  | "ai_upstream_error"
  | "ai_refusal"
  | "ai_invalid_output"
  | "ai_filtered";

export type ActivityLogMetadata = {
  error_code?: ActivityLogErrorCode;
  message?: string;
  validation_errors?: Record<string, string>;
  changed_fields?: string[];
  attempted_target?: string;
  asset_number?: string;
  asset_name?: string;
  document_number?: string;
  source_message_id?: string;
  task_key?: string;
  benefit_type?: string;
  /** plan 80 — fitness 귀속 월 `YYYY-MM` */
  benefit_month?: string;
  benefit_month_reason?: string;
  source_type?: string;
  file_name?: string;
  recipient_email?: string;
  missing_document_numbers?: string[];
  status?: string;
  unmatched_count?: number;
  unmatched_author_names?: string[];
  verification_mode?: string;
  safety_filter_result?: string;
  category?: string;
  usage_location?: string;
  session_state?: string;
  notification_id?: number;
  count?: number;
  duplicate_run?: boolean;
  catch_up_run?: boolean;
  pending_count?: number;
  announcement_id?: number;
  support_request_id?: number;
  comment_id?: number;
  parent_id?: number | null;
  root_comment_id?: number | null;
  depth?: number;
  deleted_by_admin?: boolean;
  body_length?: number;
  previous_status?: string;
  new_status?: string;
  title?: string;
  must_change?: boolean;
  target_user_id?: string;
  enabled?: boolean;
  hour?: number;
  minute?: number;
  exclude_weekends?: boolean;
  run_id?: number;
  recipient_status?: string;
  due_count?: number;
  sent_count?: number;
  failed_count?: number;
  blocked_count?: number;
  skipped_count?: number;
  deleted_count?: number;
  google_email?: string;
  tasklist_id?: string;
  task_id?: string;
  parent_task_id?: string;
  previous_tasklist_id?: string;
  approval_source?: string;
  rejection_reason?: string;
  birthday_set?: boolean;
  admin_profile?: boolean;
  affiliation?: string;
  /** plan 88 — workflow allowlist (입력값·금액·계좌·댓글·사유·파일명 금지) */
  document_id?: string;
  document_code?: string;
  template_key?: string;
  step?: number;
  starred?: boolean;
  changed_field_keys?: string[];
  attachment_count?: number;
  /** plan 89 — 퀵 요청 (주소·연락처·기사 정보·금액은 남기지 않는다) */
  quick_request_no?: string;
  changedFields?: string[];
  recentAddressesRecorded?: boolean;
  /** plan 93 — 퀵 대화 (본문 `body` 금지 · `body_length`는 기존 키). `recipient_count`는 plan 94 D-2로 제거(알림이 응답 뒤 after()로 이동) */
  message_id?: number;
  /** plan 98 — 퀵 대화 첨부 (파일명·storage_path·서명 URL 금지 · `attachment_count`는 기존 키) */
  total_bytes?: number;
  attachment_id?: number;
  /** plan 101 — 퀵 대화 참여자 (초대·제외 대상 user id · `self` = 본인 나가기) */
  participant_user_id?: string;
  self?: boolean;
  /**
   * plan 100 — AI 답장 추천 (본문·추천 문장·마스킹 전 데이터 금지 · 숫자·출처만) · `ai`|`rules`
   * plan 105 — 휴대폰 알림 구독 등록·해제 출처 `manual`|`auto_resume`|`sign_out`|`forced_sign_out`
   */
  source?: "ai" | "rules" | "manual" | "auto_resume" | "sign_out" | "forced_sign_out";
  message_count?: number;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  /** plan 103 — 구독·비품·자산 요청 (금액·카드·주계정·관리 메모·요청/댓글 본문·반려 사유 금지) */
  subscription_id?: number;
  name?: string;
  assignee_count?: number;
  equipment_id?: number;
  asset_no?: string;
  kind?: string;
  asset_request_id?: number;
  target_type?: string;
  target_id?: number;
  request_type?: string;
  assignee_user_id?: string;
  deleted_by_manager?: boolean;
  /** plan 91 — 휴대폰 푸시 (endpoint 전체·p256dh·auth 키는 절대 남기지 않는다) */
  created?: boolean;
  device_count?: number;
  endpoint_host?: string;
  disabled_groups?: string[];
  attempted?: number;
  sent?: number;
  removed?: number;
  /** plan 105 — detach 결과 (endpoint 전체·키·owner hash 금지) */
  result?: "detached" | "none" | "mine";
  /** plan 105 — `auto_resume` POST 409 사유 */
  reason?: "owned_by_other" | "deactivated_after_marker";
};

export type ActivityLog = {
  id: number;
  request_id: string;
  actor_user_id: string | null;
  actor_email: string;
  actor_display_name: string | null;
  /** Read-time join from profiles.full_name (plan 29) */
  actor_display_name_resolved?: string | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_user_id: string | null;
  target_label: string;
  /** Read-time join from profiles.full_name for user targets (plan 29) */
  target_label_resolved?: string;
  http_method: string;
  http_path: string;
  http_status: number;
  metadata: ActivityLogMetadata;
  created_at: string;
};

export type ActivityLogsListResponse = {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
};

export type ActivityLogsFilters = {
  page?: number;
  limit?: number;
  sort?: string;
  /** Admin only: `self` (default), `all`, or target user UUID */
  log_user?: string;
  action?: string;
  search?: string;
};
