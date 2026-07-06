import { apiClientWithMessage } from '@/lib/api-client';
import type {
  ContractAttachmentMutationResponse,
  ContractAttachmentSummary,
  ContractDetailResponse,
  ContractFilters,
  ContractMutationResponse,
  ContractNoAttachmentPayload,
  ContractsListResponse,
  ContractUpdatePayload
} from './types';

const INLINE_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'apng',
  'bmp',
  'ico'
]);

const GENERIC_BINARY_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream'
]);

function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

function buildContractsQuery(filters: ContractFilters): string {
  const params = new URLSearchParams();
  if (filters.page) {
    params.set('page', String(filters.page));
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.attachment_status) {
    params.set('attachment_status', filters.attachment_status);
  }
  if (filters.sort) {
    params.set('sort', filters.sort);
  }

  const query = params.toString();
  return query ? `/contracts?${query}` : '/contracts';
}

async function apiFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const response = await fetch(
    endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`,
    {
      method: 'POST',
      body: formData
    }
  );
  const data = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? `API error: ${response.status}`);
  }

  return data;
}

export async function listContracts(
  filters: ContractFilters
): Promise<ContractsListResponse> {
  return apiClientWithMessage<ContractsListResponse>(
    buildContractsQuery(filters)
  );
}

export async function getContractById(id: number) {
  const response = await apiClientWithMessage<ContractDetailResponse>(
    `/contracts/${id}`
  );
  return response.contract;
}

export async function updateContract(
  id: number,
  payload: ContractUpdatePayload
) {
  return apiClientWithMessage<ContractMutationResponse>(`/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function softDeleteContract(id: number) {
  return apiClientWithMessage<ContractMutationResponse>(`/contracts/${id}`, {
    method: 'DELETE'
  });
}

export async function uploadContractAttachment(id: number, file: File) {
  const formData = new FormData();
  formData.set('file', file);
  return apiFormData<ContractAttachmentMutationResponse>(
    `/contracts/${id}/attachments`,
    formData
  );
}

export async function softDeleteContractAttachment(
  id: number,
  attachmentId: number
) {
  return apiClientWithMessage<ContractAttachmentMutationResponse>(
    `/contracts/${id}/attachments/${attachmentId}`,
    {
      method: 'DELETE'
    }
  );
}

export async function setContractNoAttachment(
  id: number,
  payload: ContractNoAttachmentPayload
) {
  return apiClientWithMessage<ContractMutationResponse>(
    `/contracts/${id}/no-attachment`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function downloadContractAttachment(
  id: number,
  attachmentId: number
): Promise<Blob> {
  const response = await fetch(
    getContractAttachmentDownloadUrl(id, attachmentId)
  );
  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      message = data.message ?? message;
    } catch {
      // Binary endpoints may not return JSON on every failure.
    }
    throw new Error(message);
  }
  return response.blob();
}

export function getContractAttachmentDownloadUrl(
  id: number,
  attachmentId: number,
  options?: { inline?: boolean }
): string {
  const endpoint = `/api/contracts/${id}/attachments/${attachmentId}/download`;
  return options?.inline ? `${endpoint}?disposition=inline` : endpoint;
}

export function canOpenContractAttachment(
  attachment: Pick<ContractAttachmentSummary, 'content_type' | 'file_name'>
): boolean {
  const contentType = attachment.content_type
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType === 'application/pdf' || contentType?.startsWith('image/')) {
    return true;
  }

  if (contentType && !GENERIC_BINARY_CONTENT_TYPES.has(contentType)) {
    return false;
  }

  return INLINE_ATTACHMENT_EXTENSIONS.has(
    getFileExtension(attachment.file_name)
  );
}

export function openContractAttachment(
  id: number,
  attachmentId: number
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const url = getContractAttachmentDownloadUrl(id, attachmentId, {
    inline: true
  });
  return window.open(url, '_blank', 'noopener,noreferrer') !== null;
}
