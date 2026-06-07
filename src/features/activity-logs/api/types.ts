export type ActivityAction =
  | 'user.invite'
  | 'user.update'
  | 'user.reactivate'
  | 'user.deactivate'
  | 'profile.update'
  | 'profile.password_change';

export type ActivityTargetType = 'user' | 'profile';

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
