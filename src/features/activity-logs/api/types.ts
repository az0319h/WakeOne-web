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
  | 'asset.create'
  | 'asset.update'
  | 'asset.delete'
  | 'contract.import_create'
  | 'contract.import_duplicate'
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
  | 'profile.password_change';

export type ActivityTargetType = 'user' | 'profile' | 'office_snack' | 'asset' | 'contract';

export type ActivityLogErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'duplicate_email'
  | 'forbidden_field'
  | 'inactive_user'
  | 'not_found'
  | 'wrong_password'
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
  category?: string;
  usage_location?: string;
  session_state?: string;
};

export type ActivityLog = {
  id: number;
  request_id: string;
  actor_user_id: string | null;
  actor_email: string;
  actor_display_name: string | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_user_id: string | null;
  target_label: string;
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
  action?: string;
  actor_search?: string;
  search?: string;
};
