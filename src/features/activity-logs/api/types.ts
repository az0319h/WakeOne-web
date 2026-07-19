export type ActivityAction =
  | 'user.create'
  | 'user.invite'
  | 'user.update'
  | 'user.reactivate'
  | 'user.deactivate'
  | 'office_snack.session_create'
  | 'office_snack.session_update'
  | 'office_snack.session_delete'
  | 'office_snack.candidate_create'
  | 'office_snack.candidate_update'
  | 'office_snack.candidate_delete'
  | 'office_snack.vote_submit'
  | 'contract.import_create'
  | 'contract.import_duplicate'
  | 'contract.import_backfill'
  | 'contract.import_failed'
  | 'contract.update'
  | 'contract.soft_delete'
  | 'contract.attachment_upload'
  | 'contract.attachment_soft_delete'
  | 'contract.no_attachment_set'
  | 'contract.no_attachment_unset'
  | 'contract.reminder_send'
  | 'contract.reminder_failed'
  | 'profile.update'
  | 'profile.password_change'
  | 'notification.read'
  | 'notification.read_all';

export type ActivityTargetType = 'user' | 'profile' | 'office_snack' | 'contract';

export type ActivityLogErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'missing_approved_at'
  | 'duplicate_email'
  | 'forbidden_field'
  | 'inactive_user'
  | 'not_found'
  | 'wrong_password'
  | 'profile_edit_disabled'
  | 'cron_paused'
  | 'safety_filter_blocked'
  | 'internal_error';

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
