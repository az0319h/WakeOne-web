import type { ContractReminderUnmatchedTarget } from '@/features/contracts/api/types';

export type SystemEmailLogRunStatus = 'completed' | 'partial_failed' | 'failed';

export type SystemEmailLogTriggerSource = 'admin' | 'cron';

export type SystemEmailLogRecipientStatus = 'sent' | 'failed';

export type SystemEmailLogsFilters = {
  page?: number;
  limit?: number;
  sort?: string;
};

export type SystemEmailLogRun = {
  id: number;
  run_key: string;
  request_id: string;
  trigger_source: SystemEmailLogTriggerSource;
  status: SystemEmailLogRunStatus;
  target_count: number;
  sent_count: number;
  failed_count: number;
  unmatched_count: number;
  created_at: string;
  finished_at: string | null;
};

export type SystemEmailLogRecipient = {
  id: number;
  recipient_email: string;
  author_name: string;
  contract_ids: number[];
  document_numbers: string[];
  status: SystemEmailLogRecipientStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type SystemEmailLogRunDetail = SystemEmailLogRun & {
  unmatched_targets: ContractReminderUnmatchedTarget[];
  recipients: SystemEmailLogRecipient[];
};

export type SystemEmailLogsListResponse = {
  items: SystemEmailLogRun[];
  total: number;
  page: number;
  limit: number;
};

export type SystemEmailLogDetailResponse = {
  run: SystemEmailLogRunDetail;
};
