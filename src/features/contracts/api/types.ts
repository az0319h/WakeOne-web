export const CONTRACT_DOCUMENT_STATUSES = ['active', 'soft_deleted'] as const;
export const CONTRACT_ATTACHMENT_STATUSES = ['active', 'soft_deleted'] as const;
export const CONTRACT_ATTACHMENT_BUCKET = 'contract-attachments';
export const CONTRACT_ATTACHMENT_MAX_BYTES = 1024 * 1024;

export type ContractDocumentStatus = (typeof CONTRACT_DOCUMENT_STATUSES)[number];
export type ContractAttachmentStatus = (typeof CONTRACT_ATTACHMENT_STATUSES)[number];

export type ContractAttachmentSummary = {
  id: number;
  file_name: string;
  content_type: string | null;
  file_size: number;
  status: ContractAttachmentStatus;
  created_at: string;
  deleted_at: string | null;
};

export type ContractDocument = {
  id: number;
  document_number: string;
  document_created_at: string;
  author_user_id: string | null;
  author_email: string | null;
  author_name: string;
  contract_target: string;
  contract_summary: string;
  amount: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  notes: string | null;
  no_attachment_required: boolean;
  no_attachment_reason: string | null;
  status: ContractDocumentStatus;
  source_type: string;
  source_message_id: string | null;
  source_thread_id: string | null;
  source_mail_subject: string | null;
  source_document_url: string | null;
  external_document_id: string | null;
  imported_at: string | null;
  synced_at: string | null;
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  attachment_status: 'missing' | 'has_attachment' | 'no_attachment_required' | 'soft_deleted';
  active_attachment_total_size: number;
  attachments: ContractAttachmentSummary[];
};

export type ContractFilters = {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
  attachment_status?: 'missing' | 'has_attachment' | 'no_attachment_required' | 'soft_deleted';
  sort?: string;
};

export type ContractsListResponse = {
  success: boolean;
  message: string;
  items: ContractDocument[];
  total: number;
  page: number;
  limit: number;
};

export type ContractDetailResponse = {
  success: boolean;
  message: string;
  contract: ContractDocument;
};

export type ContractMutationResponse = ContractDetailResponse;

export type ContractAttachmentMutationResponse = {
  success: boolean;
  message: string;
  contract: ContractDocument;
  attachment: ContractAttachmentSummary;
};

export type ContractImportPayload = {
  document_number: string;
  document_created_at: string;
  author_name: string;
  author_email?: string | null;
  contract_target: string;
  contract_summary: string;
  amount?: number | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  notes?: string | null;
  source_message_id?: string | null;
  source_thread_id?: string | null;
  source_mail_subject?: string | null;
  source_document_url?: string | null;
  external_document_id?: string | null;
  external_payload?: Record<string, unknown> | null;
};

export type ContractUpdatePayload = Partial<
  Pick<
    ContractImportPayload,
    | 'document_created_at'
    | 'author_name'
    | 'author_email'
    | 'contract_target'
    | 'contract_summary'
    | 'amount'
    | 'contract_start_date'
    | 'contract_end_date'
    | 'notes'
    | 'source_document_url'
    | 'external_document_id'
  >
>;

export type ContractNoAttachmentPayload = {
  no_attachment_required: boolean;
  no_attachment_reason?: string | null;
};

export type ContractReminderTarget = {
  id: number;
  document_number: string;
  document_created_at: string;
  author_name: string;
  author_email: string;
  contract_target: string;
};

export type ContractReminderRecipientGroup = {
  recipient_email: string;
  author_name: string;
  contracts: ContractReminderTarget[];
  document_numbers: string[];
};

export type ContractReminderRecipientResult = {
  recipient_email: string;
  author_name: string;
  document_numbers: string[];
  status: 'sent' | 'failed';
  error_message: string | null;
};

export type ContractReminderRun = {
  id: number;
  run_key: string;
  request_id: string;
  trigger_source: 'admin' | 'cron';
  status: 'completed' | 'partial_failed' | 'failed';
  target_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  finished_at: string | null;
};

export type ContractReminderRunResponse = {
  success: boolean;
  message: string;
  run: ContractReminderRun | null;
  recipients: ContractReminderRecipientResult[];
};
