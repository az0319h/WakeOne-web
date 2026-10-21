/**
 * 워크플로우 클라이언트 API 호출 (plan 88). 모든 CUD는 `/api/workflow/*` Route 경유 — Supabase 직접 쓰기 없음.
 * 컴포넌트는 이 파일을 직접 부르지 않고 queries.ts / mutations.ts를 쓴다.
 */
import type { WorkflowValidationError } from '../lib/required-rules';
import {
  toWorkflowListSearchParams,
  type WorkflowCountFilters,
  type WorkflowListRequest
} from '../lib/search-params';
import type {
  WorkflowAdmin,
  WorkflowAdminGrantPayload,
  WorkflowApprovalLinePayload,
  WorkflowApprovePayload,
  WorkflowAttachment,
  WorkflowAttachmentCompleteResponse,
  WorkflowAttachmentDownloadResponse,
  WorkflowAttachmentPrepareResponse,
  WorkflowCommentPayload,
  WorkflowCounts,
  WorkflowDeclinePayload,
  WorkflowDocumentDetail,
  WorkflowDocumentMutationResult,
  WorkflowDraftDetail,
  WorkflowDraftListItem,
  WorkflowDraftSavePayload,
  WorkflowErrorBody,
  WorkflowListRow,
  WorkflowMember,
  WorkflowPolicyPayload,
  WorkflowSubmitPayload,
  WorkflowTemplateDetail,
  WorkflowTemplateListItem,
  WorkflowUpdatePayload
} from './types';

/** API 오류 — status · field_key · errors(전체 검증 오류)를 보존한다 */
export class WorkflowApiError extends Error {
  readonly status: number;
  readonly fieldKey: string | null;
  readonly errors: WorkflowValidationError[];

  constructor(
    status: number,
    message: string,
    fieldKey: string | null = null,
    errors: WorkflowValidationError[] = []
  ) {
    super(message);
    this.name = 'WorkflowApiError';
    this.status = status;
    this.fieldKey = fieldKey;
    this.errors = errors;
  }
}

export function isWorkflowApiError(error: unknown): error is WorkflowApiError {
  return error instanceof WorkflowApiError;
}

async function workflowFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api/workflow${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const body = (data ?? {}) as Partial<WorkflowErrorBody>;
    throw new WorkflowApiError(
      response.status,
      body.message || body.error || `요청을 처리하지 못했습니다. (${response.status})`,
      body.field_key ?? null,
      Array.isArray(body.errors) ? body.errors : []
    );
  }

  return data as T;
}

function jsonBody(payload: unknown): RequestInit['body'] {
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// 문서함
// ---------------------------------------------------------------------------
export type WorkflowListPage = {
  rows: WorkflowListRow[];
  total: number;
  next_cursor: string | null;
};

export async function fetchWorkflowDocuments(
  request: WorkflowListRequest,
  options: { cursor?: string | null; exclude?: string | null } = {}
): Promise<WorkflowListPage> {
  const params = toWorkflowListSearchParams(request, options);
  const data = await workflowFetch<WorkflowListPage & { success: true }>(
    `/documents?${params.toString()}`
  );
  return { rows: data.rows, total: data.total, next_cursor: data.next_cursor };
}

export async function fetchWorkflowCounts(filters: WorkflowCountFilters): Promise<WorkflowCounts> {
  const params = toWorkflowListSearchParams(filters);
  const data = await workflowFetch<{ counts: WorkflowCounts }>(
    `/documents/counts?${params.toString()}`
  );
  return data.counts;
}

export async function fetchWorkflowDocument(id: string): Promise<WorkflowDocumentDetail> {
  const data = await workflowFetch<{ document: WorkflowDocumentDetail }>(
    `/documents/${encodeURIComponent(id)}`
  );
  return data.document;
}

type DocumentMutationResponse = {
  message: string;
  document: WorkflowDocumentMutationResult;
};

export function submitWorkflowDocument(payload: WorkflowSubmitPayload) {
  return workflowFetch<DocumentMutationResponse>('/documents', {
    method: 'POST',
    body: jsonBody(payload)
  });
}

export function updateWorkflowDocument(id: string, payload: WorkflowUpdatePayload) {
  return workflowFetch<DocumentMutationResponse>(`/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: jsonBody(payload)
  });
}

export function approveWorkflowDocument(id: string, payload: WorkflowApprovePayload) {
  return workflowFetch<DocumentMutationResponse>(`/documents/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: jsonBody(payload)
  });
}

export function declineWorkflowDocument(id: string, payload: WorkflowDeclinePayload) {
  return workflowFetch<DocumentMutationResponse>(`/documents/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
    body: jsonBody(payload)
  });
}

export function cancelWorkflowDocument(id: string) {
  return workflowFetch<DocumentMutationResponse>(`/documents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: jsonBody({})
  });
}

export function changeWorkflowApprovalLine(id: string, payload: WorkflowApprovalLinePayload) {
  return workflowFetch<DocumentMutationResponse>(
    `/documents/${encodeURIComponent(id)}/approval-line`,
    { method: 'PUT', body: jsonBody(payload) }
  );
}

export function addWorkflowComment(id: string, payload: WorkflowCommentPayload) {
  return workflowFetch<{ message: string }>(`/documents/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: jsonBody(payload)
  });
}

export function setWorkflowStar(id: string, starred: boolean) {
  return workflowFetch<{ message: string }>(`/documents/${encodeURIComponent(id)}/star`, {
    method: 'PUT',
    body: jsonBody({ starred })
  });
}

// ---------------------------------------------------------------------------
// 첨부
// ---------------------------------------------------------------------------
export function fetchWorkflowAttachmentDownload(
  documentId: string,
  attachmentId: string,
  options: { download?: boolean } = {}
) {
  const query = options.download ? '?download=1' : '';
  return workflowFetch<WorkflowAttachmentDownloadResponse>(
    `/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/download${query}`
  );
}

/** lightbox용 blob (signed URL → blob) */
export async function downloadWorkflowAttachmentBlob(
  documentId: string,
  attachmentId: string
): Promise<Blob> {
  const { url } = await fetchWorkflowAttachmentDownload(documentId, attachmentId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('첨부파일을 불러오지 못했습니다.');
  }
  return response.blob();
}

/** prepare → signed PUT → complete (plan 53 패턴) */
export async function uploadWorkflowAttachment(input: {
  file: File;
  existingCount: number;
}): Promise<WorkflowAttachment> {
  const contentType = input.file.type || null;
  const prepared = await workflowFetch<WorkflowAttachmentPrepareResponse>('/attachments/prepare', {
    method: 'POST',
    body: jsonBody({
      file_name: input.file.name,
      file_size: input.file.size,
      content_type: contentType,
      existing_count: input.existingCount
    })
  });

  const upload = await fetch(prepared.signed_url, {
    method: 'PUT',
    headers: contentType ? { 'Content-Type': contentType } : undefined,
    body: input.file
  });
  if (!upload.ok) {
    throw new WorkflowApiError(upload.status, '첨부파일을 올리지 못했습니다.');
  }

  const completed = await workflowFetch<WorkflowAttachmentCompleteResponse>('/attachments/complete', {
    method: 'POST',
    body: jsonBody({
      storage_path: prepared.storage_path,
      file_name: input.file.name,
      file_size: input.file.size,
      content_type: contentType
    })
  });
  return completed.attachment;
}

export function deleteWorkflowAttachment(id: string) {
  return workflowFetch<{ message: string }>(`/attachments/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

// ---------------------------------------------------------------------------
// 임시저장
// ---------------------------------------------------------------------------
export async function fetchWorkflowDrafts(): Promise<WorkflowDraftListItem[]> {
  const data = await workflowFetch<{ drafts: WorkflowDraftListItem[] }>('/drafts');
  return data.drafts;
}

export async function fetchWorkflowDraft(id: string): Promise<WorkflowDraftDetail> {
  const data = await workflowFetch<{ draft: WorkflowDraftDetail }>(
    `/drafts/${encodeURIComponent(id)}`
  );
  return data.draft;
}

type DraftSaveResponse = { message: string; draft: { id: string } };

export function saveWorkflowDraft(input: { draftId: string | null; payload: WorkflowDraftSavePayload }) {
  if (input.draftId) {
    return workflowFetch<DraftSaveResponse>(`/drafts/${encodeURIComponent(input.draftId)}`, {
      method: 'PUT',
      body: jsonBody(input.payload)
    });
  }
  return workflowFetch<DraftSaveResponse>('/drafts', {
    method: 'POST',
    body: jsonBody(input.payload)
  });
}

export function deleteWorkflowDraft(id: string) {
  return workflowFetch<{ message: string }>(`/drafts/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

// ---------------------------------------------------------------------------
// 양식 · 설정 · 구성원
// ---------------------------------------------------------------------------
export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateListItem[]> {
  const data = await workflowFetch<{ templates: WorkflowTemplateListItem[] }>('/templates');
  return data.templates;
}

export async function fetchWorkflowTemplate(templateKey: string): Promise<WorkflowTemplateDetail> {
  const data = await workflowFetch<{ template: WorkflowTemplateDetail }>(
    `/templates/${encodeURIComponent(templateKey)}`
  );
  return data.template;
}

export function saveWorkflowTemplatePolicy(templateKey: string, payload: WorkflowPolicyPayload) {
  return workflowFetch<{ message: string }>(`/templates/${encodeURIComponent(templateKey)}/policy`, {
    method: 'PUT',
    body: jsonBody(payload)
  });
}

export async function fetchWorkflowMembers(): Promise<WorkflowMember[]> {
  const data = await workflowFetch<{ members: WorkflowMember[] }>('/members');
  return data.members;
}

export async function fetchWorkflowAdmins(): Promise<WorkflowAdmin[]> {
  const data = await workflowFetch<{ admins: WorkflowAdmin[] }>('/admins');
  return data.admins;
}

export function grantWorkflowAdmin(payload: WorkflowAdminGrantPayload) {
  return workflowFetch<{ message: string }>('/admins', {
    method: 'POST',
    body: jsonBody(payload)
  });
}

export function revokeWorkflowAdmin(userId: string) {
  return workflowFetch<{ message: string }>(`/admins/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
}
