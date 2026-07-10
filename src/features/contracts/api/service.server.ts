import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  CONTRACT_ATTACHMENT_BUCKET,
  CONTRACT_ATTACHMENT_MAX_BYTES,
  CONTRACT_ATTACHMENT_TOTAL_SIZE_ERROR,
  type ContractAttachmentStatus,
  type ContractAttachmentSummary,
  type ContractDocument,
  type ContractDocumentStatus,
  type ContractFilters,
  type ContractImportPayload,
  type ContractReminderRecipientGroup,
  type ContractReminderRecipientResult,
  type ContractReminderRecipientScanResult,
  type ContractReminderRun,
  type ContractReminderTarget,
  type ContractReminderUnmatchedTarget,
  type ContractUpdatePayload
} from './types';

type ContractDocumentRow = {
  id: number;
  document_number: string;
  document_created_at: string;
  approved_at: string | null;
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
};

type ContractAttachmentRow = {
  id: number;
  contract_id: number;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  file_size: number;
  status: ContractAttachmentStatus;
  uploaded_by_id: string | null;
  deleted_by_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

type ImportEventStatus = 'created' | 'duplicate' | 'failed';

type ContractReminderRunRow = {
  id: number;
  run_key: string;
  request_id: string;
  trigger_source: 'admin' | 'cron';
  status: 'completed' | 'partial_failed' | 'failed';
  target_count: number;
  sent_count: number;
  failed_count: number;
  unmatched_targets: ContractReminderUnmatchedTarget[] | null;
  triggered_by_user_id: string | null;
  created_at: string;
  finished_at: string | null;
};

type ContractReminderTargetRow = {
  id: number;
  document_number: string;
  document_created_at: string;
  approved_at: string | null;
  author_name: string;
  contract_target: string;
  source_document_url: string | null;
};

type ReminderProfileRow = {
  user_id: string;
  email: string;
  full_name: string;
};

const SAFE_EXTENSION_PATTERN = /^[a-z0-9]+$/;
const MAX_SAFE_EXTENSION_LENGTH = 16;
const ACTIVE_ATTACHMENT_NO_ATTACHMENT_MESSAGE =
  '활성 첨부파일이 있는 계약서는 첨부파일 없음으로 지정할 수 없습니다.';

const CONTRACT_SELECT = `
  id,
  document_number,
  document_created_at,
  approved_at,
  author_user_id,
  author_email,
  author_name,
  contract_target,
  contract_summary,
  amount,
  contract_start_date,
  contract_end_date,
  notes,
  no_attachment_required,
  no_attachment_reason,
  status,
  source_type,
  source_message_id,
  source_thread_id,
  source_mail_subject,
  source_document_url,
  external_document_id,
  imported_at,
  synced_at,
  created_by_id,
  updated_by_id,
  created_at,
  updated_at,
  deleted_at
`;

const ATTACHMENT_SELECT = `
  id,
  contract_id,
  file_name,
  storage_bucket,
  storage_path,
  content_type,
  file_size,
  status,
  uploaded_by_id,
  deleted_by_id,
  created_at,
  deleted_at
`;

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function toKstDayStart(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00+09:00`).toISOString();
}

function addDaysToDateString(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function toKstNextDayStart(dateOnly: string): string {
  return toKstDayStart(addDaysToDateString(dateOnly, 1));
}

function parseSort(sortRaw: string | undefined): { column: keyof ContractDocumentRow; ascending: boolean } {
  const fallback = { column: 'approved_at' as keyof ContractDocumentRow, ascending: false };
  if (!sortRaw) {
    return fallback;
  }

  try {
    const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
    const first = sortItems[0];
    const allowed = new Set([
      'approved_at',
      'document_created_at',
      'document_number',
      'author_name',
      'contract_target',
      'amount',
      'updated_at'
    ]);
    if (!first || !allowed.has(first.id)) {
      return fallback;
    }

    return { column: first.id as keyof ContractDocumentRow, ascending: !first.desc };
  } catch {
    return fallback;
  }
}

function toAttachmentSummary(row: ContractAttachmentRow): ContractAttachmentSummary {
  return {
    id: row.id,
    file_name: row.file_name,
    content_type: row.content_type,
    file_size: row.file_size,
    status: row.status,
    created_at: row.created_at,
    deleted_at: row.deleted_at
  };
}

function mapContract(row: ContractDocumentRow, attachments: ContractAttachmentRow[]): ContractDocument {
  const activeAttachments = attachments.filter((attachment) => attachment.status === 'active');
  const activeAttachmentTotalSize = activeAttachments.reduce((total, attachment) => total + attachment.file_size, 0);
  const attachmentStatus =
    row.status === 'soft_deleted'
      ? 'soft_deleted'
      : row.no_attachment_required
        ? 'no_attachment_required'
        : activeAttachments.length > 0
          ? 'has_attachment'
          : 'missing';

  return {
    ...row,
    document_created_at: toDateOnly(row.document_created_at) ?? row.document_created_at,
    contract_start_date: toDateOnly(row.contract_start_date),
    contract_end_date: toDateOnly(row.contract_end_date),
    amount: row.amount == null ? null : Number(row.amount),
    attachment_status: attachmentStatus,
    active_attachment_total_size: activeAttachmentTotalSize,
    attachments: attachments.map(toAttachmentSummary)
  };
}

async function listAttachmentsByContractIds(contractIds: number[]): Promise<Map<number, ContractAttachmentRow[]>> {
  if (contractIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_attachments')
    .select(ATTACHMENT_SELECT)
    .in('contract_id', contractIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const byContractId = new Map<number, ContractAttachmentRow[]>();
  for (const row of (data ?? []) as unknown as ContractAttachmentRow[]) {
    const rows = byContractId.get(row.contract_id) ?? [];
    rows.push(row);
    byContractId.set(row.contract_id, rows);
  }

  return byContractId;
}

function filterByAttachmentStatus(contracts: ContractDocument[], status: ContractFilters['attachment_status']) {
  if (!status) {
    return contracts;
  }

  return contracts.filter((contract) => contract.attachment_status === status);
}

function sanitizeExternalPayload(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|token|secret|credential|cookie/i.test(key)) {
      continue;
    }
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      sanitized[key] = item;
    }
  }

  return sanitized;
}

function getSafeFileExtension(fileName: string): string {
  const pathSafeName = Array.from(fileName.normalize('NFKC'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
  const baseName = pathSafeName.split(/[\\/]/).pop()?.trim() ?? '';
  const dotIndex = baseName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return '';
  }

  const extension = baseName.slice(dotIndex + 1).toLowerCase();
  if (extension.length > MAX_SAFE_EXTENSION_LENGTH || !SAFE_EXTENSION_PATTERN.test(extension)) {
    return '';
  }

  return `.${extension}`;
}

function buildContractAttachmentStoragePath(contractId: number, fileName: string): string {
  return `contracts/${contractId}/${crypto.randomUUID()}${getSafeFileExtension(fileName)}`;
}

function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseUnmatchedTargets(value: unknown): ContractReminderUnmatchedTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const authorName = typeof record.author_name === 'string' ? record.author_name : '';
    const reason = record.reason === 'no_profile_match' ? 'no_profile_match' : null;
    const contractIds = Array.isArray(record.contract_ids)
      ? record.contract_ids.filter((id): id is number => typeof id === 'number')
      : [];
    const documentNumbers = Array.isArray(record.document_numbers)
      ? record.document_numbers.filter((value): value is string => typeof value === 'string')
      : [];

    if (!authorName || !reason) {
      return [];
    }

    return [
      {
        author_name: authorName,
        contract_ids: contractIds,
        document_numbers: documentNumbers,
        reason
      }
    ];
  });
}

function mapReminderRun(row: ContractReminderRunRow): ContractReminderRun {
  return {
    id: row.id,
    run_key: row.run_key,
    request_id: row.request_id,
    trigger_source: row.trigger_source,
    status: row.status,
    target_count: row.target_count,
    sent_count: row.sent_count,
    failed_count: row.failed_count,
    unmatched_targets: parseUnmatchedTargets(row.unmatched_targets),
    created_at: row.created_at,
    finished_at: row.finished_at
  };
}

function mapReminderTarget(row: ContractReminderTargetRow): ContractReminderTarget {
  return {
    id: row.id,
    document_number: row.document_number,
    document_created_at: toDateOnly(row.document_created_at) ?? row.document_created_at,
    approved_at: toDateOnly(row.approved_at),
    author_name: row.author_name,
    contract_target: row.contract_target,
    source_document_url: row.source_document_url
  };
}

const REMINDER_RUN_SELECT =
  'id, run_key, request_id, trigger_source, status, target_count, sent_count, failed_count, unmatched_targets, triggered_by_user_id, created_at, finished_at';

export async function listContracts(
  filters: ContractFilters
): Promise<{ items: ContractDocument[]; total: number; page: number; limit: number }> {
  const supabase = getServiceRoleClient();
  const page = Math.max(Number(filters.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(filters.limit ?? 10), 1), 100);
  const sort = parseSort(filters.sort);
  const search = filters.search?.trim();

  let query = supabase.from('contract_documents').select(CONTRACT_SELECT, { count: 'exact' });

  if (filters.from) {
    query = query.gte('approved_at', toKstDayStart(filters.from));
  }

  if (filters.to) {
    query = query.lt('approved_at', toKstNextDayStart(filters.to));
  }

  if (search) {
    const escaped = search.replaceAll(',', ' ');
    query = query.or(
      `document_number.ilike.%${escaped}%,author_name.ilike.%${escaped}%,contract_target.ilike.%${escaped}%`
    );
  }

  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

  if (filters.attachment_status) {
    query = query.limit(5000);
  } else {
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ContractDocumentRow[];
  const attachmentsByContractId = await listAttachmentsByContractIds(rows.map((row) => row.id));
  const mapped = rows.map((row) => mapContract(row, attachmentsByContractId.get(row.id) ?? []));
  const filtered = filterByAttachmentStatus(mapped, filters.attachment_status);
  const items = filters.attachment_status ? filtered.slice((page - 1) * limit, page * limit) : filtered;

  return {
    items,
    total: filters.attachment_status ? filtered.length : count ?? 0,
    page,
    limit
  };
}

export async function getContractById(id: number): Promise<ContractDocument | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_documents')
    .select(CONTRACT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ContractDocumentRow;
  const attachmentsByContractId = await listAttachmentsByContractIds([row.id]);
  return mapContract(row, attachmentsByContractId.get(row.id) ?? []);
}

export async function recordContractImportEvent(input: {
  requestId: string;
  status: ImportEventStatus;
  documentNumber?: string | null;
  sourceMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  receivedPayload?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('contract_import_events').insert({
    request_id: input.requestId,
    source_message_id: input.sourceMessageId ?? null,
    document_number: input.documentNumber ?? null,
    status: input.status,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    received_payload: sanitizeExternalPayload(input.receivedPayload)
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function importContractDocument(
  payload: ContractImportPayload,
  requestId: string
): Promise<{ status: 'created' | 'duplicate' | 'backfill'; contract: ContractDocument }> {
  const supabase = getServiceRoleClient();
  const sanitizedPayload = sanitizeExternalPayload(payload.external_payload);
  const documentNumber = payload.document_number.trim();

  const { data: existing, error: existingError } = await supabase
    .from('contract_documents')
    .select(CONTRACT_SELECT)
    .eq('document_number', documentNumber)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const existingRow = existing as ContractDocumentRow;

    if (!existingRow.approved_at && payload.approved_at) {
      const { data: backfilled, error: backfillError } = await supabase
        .from('contract_documents')
        .update({
          approved_at: payload.approved_at,
          synced_at: new Date().toISOString()
        })
        .eq('id', existingRow.id)
        .select(CONTRACT_SELECT)
        .single();

      if (backfillError) {
        throw new Error(backfillError.message);
      }

      await recordContractImportEvent({
        requestId,
        status: 'duplicate',
        documentNumber,
        sourceMessageId: payload.source_message_id ?? null,
        receivedPayload: payload.external_payload
      });

      const attachmentsByContractId = await listAttachmentsByContractIds([existingRow.id]);
      return {
        status: 'backfill',
        contract: mapContract(
          backfilled as unknown as ContractDocumentRow,
          attachmentsByContractId.get(existingRow.id) ?? []
        )
      };
    }

    await recordContractImportEvent({
      requestId,
      status: 'duplicate',
      documentNumber,
      sourceMessageId: payload.source_message_id ?? null,
      receivedPayload: payload.external_payload
    });
    const attachmentsByContractId = await listAttachmentsByContractIds([existingRow.id]);
    return {
      status: 'duplicate',
      contract: mapContract(existingRow, attachmentsByContractId.get(existingRow.id) ?? [])
    };
  }

  const { data, error } = await supabase
    .from('contract_documents')
    .insert({
      ...payload,
      document_number: documentNumber,
      document_created_at: toDateOnly(payload.document_created_at),
      approved_at: payload.approved_at,
      contract_start_date: toDateOnly(payload.contract_start_date),
      contract_end_date: toDateOnly(payload.contract_end_date),
      source_type: 'openclaw_gmail',
      external_payload: sanitizedPayload,
      imported_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    })
    .select(CONTRACT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await recordContractImportEvent({
    requestId,
    status: 'created',
    documentNumber,
    sourceMessageId: payload.source_message_id ?? null,
    receivedPayload: payload.external_payload
  });

  return { status: 'created', contract: mapContract(data as unknown as ContractDocumentRow, []) };
}

export async function updateContractDocument(
  id: number,
  payload: ContractUpdatePayload,
  actorUserId: string
): Promise<ContractDocument | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_documents')
    .update({
      ...payload,
      document_created_at: payload.document_created_at ? toDateOnly(payload.document_created_at) : undefined,
      approved_at: 'approved_at' in payload ? payload.approved_at : undefined,
      contract_start_date:
        'contract_start_date' in payload ? toDateOnly(payload.contract_start_date) : undefined,
      contract_end_date: 'contract_end_date' in payload ? toDateOnly(payload.contract_end_date) : undefined,
      updated_by_id: actorUserId
    })
    .eq('id', id)
    .select(CONTRACT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ContractDocumentRow;
  const attachmentsByContractId = await listAttachmentsByContractIds([row.id]);
  return mapContract(row, attachmentsByContractId.get(row.id) ?? []);
}

export async function softDeleteContractDocument(id: number, actorUserId: string): Promise<ContractDocument | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_documents')
    .update({
      status: 'soft_deleted',
      deleted_at: new Date().toISOString(),
      updated_by_id: actorUserId
    })
    .eq('id', id)
    .select(CONTRACT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ContractDocumentRow;
  const attachmentsByContractId = await listAttachmentsByContractIds([row.id]);
  return mapContract(row, attachmentsByContractId.get(row.id) ?? []);
}

export async function uploadContractAttachment(input: {
  contractId: number;
  file: File;
  actorUserId: string;
}): Promise<{ contract: ContractDocument; attachment: ContractAttachmentSummary } | null> {
  const contract = await getContractById(input.contractId);
  if (!contract || contract.status === 'soft_deleted') {
    return null;
  }

  const fileName = input.file.name.trim();
  if (!fileName) {
    throw new Error('파일명이 올바르지 않습니다.');
  }

  if (contract.attachments.some((attachment) => attachment.file_name === fileName)) {
    throw new Error('같은 계약 문서에 동일한 파일명을 다시 업로드할 수 없습니다.');
  }

  if (contract.active_attachment_total_size + input.file.size > CONTRACT_ATTACHMENT_MAX_BYTES) {
    throw new Error(CONTRACT_ATTACHMENT_TOTAL_SIZE_ERROR);
  }

  const storagePath = buildContractAttachmentStoragePath(input.contractId, fileName);
  const supabase = getServiceRoleClient();

  const { error: uploadError } = await supabase.storage
    .from(CONTRACT_ATTACHMENT_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from('contract_attachments')
    .insert({
      contract_id: input.contractId,
      file_name: fileName,
      storage_bucket: CONTRACT_ATTACHMENT_BUCKET,
      storage_path: storagePath,
      content_type: input.file.type || null,
      file_size: input.file.size,
      uploaded_by_id: input.actorUserId
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error) {
    await supabase.storage.from(CONTRACT_ATTACHMENT_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  const updatedContract = await getContractById(input.contractId);
  if (!updatedContract) {
    throw new Error('계약 문서를 찾을 수 없습니다.');
  }

  return {
    contract: updatedContract,
    attachment: toAttachmentSummary(data as unknown as ContractAttachmentRow)
  };
}

export async function getContractAttachmentForDownload(
  contractId: number,
  attachmentId: number
): Promise<ContractAttachmentRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_attachments')
    .select(ATTACHMENT_SELECT)
    .eq('id', attachmentId)
    .eq('contract_id', contractId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as ContractAttachmentRow | null) ?? null;
}

export async function downloadContractAttachment(row: ContractAttachmentRow): Promise<Blob> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function softDeleteContractAttachment(
  contractId: number,
  attachmentId: number,
  actorUserId: string
): Promise<{ contract: ContractDocument; attachment: ContractAttachmentSummary } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_attachments')
    .update({
      status: 'soft_deleted',
      deleted_at: new Date().toISOString(),
      deleted_by_id: actorUserId
    })
    .eq('id', attachmentId)
    .eq('contract_id', contractId)
    .eq('status', 'active')
    .select(ATTACHMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const contract = await getContractById(contractId);
  if (!contract) {
    return null;
  }

  return {
    contract,
    attachment: toAttachmentSummary(data as unknown as ContractAttachmentRow)
  };
}

export async function setContractNoAttachment(input: {
  contractId: number;
  required: boolean;
  reason?: string | null;
  actorUserId: string;
}): Promise<ContractDocument | null> {
  const supabase = getServiceRoleClient();
  if (input.required) {
    const attachmentsByContractId = await listAttachmentsByContractIds([input.contractId]);
    const activeAttachments =
      attachmentsByContractId.get(input.contractId)?.filter((attachment) => attachment.status === 'active') ?? [];
    if (activeAttachments.length > 0) {
      throw new Error(ACTIVE_ATTACHMENT_NO_ATTACHMENT_MESSAGE);
    }
  }

  const { data, error } = await supabase
    .from('contract_documents')
    .update({
      no_attachment_required: input.required,
      no_attachment_reason: input.required ? input.reason ?? null : null,
      updated_by_id: input.actorUserId
    })
    .eq('id', input.contractId)
    .select(CONTRACT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ContractDocumentRow;
  const attachmentsByContractId = await listAttachmentsByContractIds([row.id]);
  return mapContract(row, attachmentsByContractId.get(row.id) ?? []);
}

export async function listContractReminderRecipientGroups(): Promise<ContractReminderRecipientScanResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_documents')
    .select(
      'id, document_number, document_created_at, approved_at, author_name, contract_target, source_document_url'
    )
    .eq('status', 'active')
    .eq('no_attachment_required', false)
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, email, full_name')
    .eq('status', 'active')
    .not('full_name', 'is', null);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profilesByNormalizedName = new Map<string, ReminderProfileRow[]>();
  for (const row of (profileRows ?? []) as unknown as ReminderProfileRow[]) {
    const fullName = row.full_name?.trim();
    const email = row.email?.trim().toLowerCase();
    if (!fullName || !email) {
      continue;
    }

    const key = normalizePersonName(fullName);
    const profiles = profilesByNormalizedName.get(key) ?? [];
    profiles.push({ ...row, email, full_name: fullName });
    profilesByNormalizedName.set(key, profiles);
  }

  const rows = (data ?? []) as unknown as ContractReminderTargetRow[];
  const attachmentsByContractId = await listAttachmentsByContractIds(rows.map((row) => row.id));
  const groups = new Map<string, ContractReminderRecipientGroup>();
  const unmatchedByAuthor = new Map<string, ContractReminderUnmatchedTarget>();

  for (const row of rows) {
    const activeAttachments =
      attachmentsByContractId.get(row.id)?.filter((attachment) => attachment.status === 'active') ?? [];
    if (activeAttachments.length > 0) {
      continue;
    }

    const target = mapReminderTarget(row);
    const normalizedAuthorName = normalizePersonName(target.author_name);
    const matchedProfiles = profilesByNormalizedName.get(normalizedAuthorName) ?? [];

    if (matchedProfiles.length === 0) {
      const unmatched =
        unmatchedByAuthor.get(normalizedAuthorName) ??
        ({
          author_name: target.author_name,
          contract_ids: [],
          document_numbers: [],
          reason: 'no_profile_match'
        } satisfies ContractReminderUnmatchedTarget);
      unmatched.contract_ids.push(target.id);
      unmatched.document_numbers.push(target.document_number);
      unmatchedByAuthor.set(normalizedAuthorName, unmatched);
      continue;
    }

    for (const profile of matchedProfiles) {
      const group =
        groups.get(profile.email) ??
        ({
          recipient_email: profile.email,
          author_name: target.author_name,
          contracts: [],
          document_numbers: []
        } satisfies ContractReminderRecipientGroup);

      if (!group.contracts.some((contract) => contract.id === target.id)) {
        group.contracts.push(target);
        group.document_numbers.push(target.document_number);
      }

      groups.set(profile.email, group);
    }
  }

  return {
    groups: [...groups.values()].sort((a, b) => a.recipient_email.localeCompare(b.recipient_email)),
    unmatched_targets: [...unmatchedByAuthor.values()].sort((a, b) =>
      a.author_name.localeCompare(b.author_name, 'ko')
    )
  };
}

export async function getContractReminderRunByKey(runKey: string): Promise<ContractReminderRun | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_reminder_runs')
    .select(REMINDER_RUN_SELECT)
    .eq('run_key', runKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapReminderRun(data as unknown as ContractReminderRunRow) : null;
}

export async function createContractReminderRun(input: {
  requestId: string;
  runKey: string;
  triggerSource: 'admin' | 'cron';
  actorUserId?: string | null;
  targetCount: number;
}): Promise<ContractReminderRun> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_reminder_runs')
    .insert({
      request_id: input.requestId,
      run_key: input.runKey,
      trigger_source: input.triggerSource,
      triggered_by_user_id: input.actorUserId ?? null,
      target_count: input.targetCount,
      status: 'failed'
    })
    .select(REMINDER_RUN_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapReminderRun(data as unknown as ContractReminderRunRow);
}

export async function finishContractReminderRun(input: {
  runId: number;
  status: ContractReminderRun['status'];
  sentCount: number;
  failedCount: number;
  unmatchedTargets: ContractReminderUnmatchedTarget[];
}): Promise<ContractReminderRun> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('contract_reminder_runs')
    .update({
      status: input.status,
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      unmatched_targets: input.unmatchedTargets,
      finished_at: new Date().toISOString()
    })
    .eq('id', input.runId)
    .select(REMINDER_RUN_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapReminderRun(data as unknown as ContractReminderRunRow);
}

export async function recordContractReminderRecipient(input: {
  runId: number;
  group: ContractReminderRecipientGroup;
  status: ContractReminderRecipientResult['status'];
  errorMessage?: string | null;
}): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('contract_reminder_recipients').insert({
    run_id: input.runId,
    recipient_email: input.group.recipient_email,
    author_name: input.group.author_name,
    contract_ids: input.group.contracts.map((contract) => contract.id),
    document_numbers: input.group.document_numbers,
    status: input.status,
    error_message: input.errorMessage ?? null,
    sent_at: input.status === 'sent' ? new Date().toISOString() : null
  });

  if (error) {
    throw new Error(error.message);
  }
}
