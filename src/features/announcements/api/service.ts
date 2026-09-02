import { apiClient, apiClientWithMessage } from '@/lib/api-client';
import { serializeAnnouncementFiltersToSearchParams } from './filter-utils';
import type {
  AnnouncementAttachmentSummary,
  AnnouncementCreatePayload,
  AnnouncementDetailResponse,
  AnnouncementAttachmentMutationResponse,
  AnnouncementMutationResponse,
  AnnouncementNotifyResponse,
  AnnouncementsFilters,
  AnnouncementsListResponse,
  AnnouncementUpdatePayload
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

type AnnouncementsListApiResponse = {
  success: boolean;
  data: AnnouncementsListResponse;
};

type AnnouncementsOverviewApiResponse = {
  success: boolean;
  data: { announcements: AnnouncementsListResponse['announcements'] };
};

export async function fetchAnnouncements(
  filters: AnnouncementsFilters = {}
): Promise<AnnouncementsListResponse> {
  const searchParams = serializeAnnouncementFiltersToSearchParams(filters);
  const queryString = searchParams.toString();

  const response = await apiClient<AnnouncementsListApiResponse>(
    `/announcements${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function fetchAnnouncementsOverview() {
  const response = await apiClient<AnnouncementsOverviewApiResponse>('/announcements/overview');
  return response.data.announcements;
}

export async function fetchAnnouncementById(id: number) {
  return apiClientWithMessage<AnnouncementDetailResponse>(`/announcements/${id}`).then(
    (response) => response.announcement
  );
}

export async function createAnnouncement(payload: AnnouncementCreatePayload) {
  return apiClientWithMessage<AnnouncementMutationResponse>('/announcements', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAnnouncement(id: number, payload: AnnouncementUpdatePayload) {
  return apiClientWithMessage<AnnouncementMutationResponse>(`/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteAnnouncement(id: number) {
  return apiClientWithMessage<{ success: boolean; message: string }>(`/announcements/${id}`, {
    method: 'DELETE'
  });
}

export async function notifyAnnouncementPublished(id: number) {
  return apiClientWithMessage<AnnouncementNotifyResponse>(`/announcements/${id}/notify`, {
    method: 'POST'
  });
}

export async function uploadAnnouncementAttachment(announcementId: number, file: File) {
  const formData = new FormData();
  formData.set('file', file);

  return apiClientWithMessage<AnnouncementAttachmentMutationResponse>(
    `/announcements/${announcementId}/attachments`,
    {
      method: 'POST',
      body: formData
    }
  );
}

export async function deleteAnnouncementAttachment(announcementId: number, attachmentId: number) {
  return apiClientWithMessage<AnnouncementAttachmentMutationResponse>(
    `/announcements/${announcementId}/attachments/${attachmentId}`,
    {
      method: 'DELETE'
    }
  );
}

export function getAnnouncementAttachmentDownloadUrl(
  announcementId: number,
  attachmentId: number,
  options?: { inline?: boolean }
): string {
  const endpoint = `/api/announcements/${announcementId}/attachments/${attachmentId}/download`;
  return options?.inline ? `${endpoint}?disposition=inline` : endpoint;
}

export function getAnnouncementAttachmentViewerUrl(
  announcementId: number,
  attachmentId: number
): string {
  return `/dashboard/announcements/${announcementId}/attachments/${attachmentId}/view`;
}

export async function downloadAnnouncementAttachment(
  announcementId: number,
  attachmentId: number
): Promise<Blob> {
  const response = await fetch(
    getAnnouncementAttachmentDownloadUrl(announcementId, attachmentId)
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

export function canOpenAnnouncementAttachment(
  attachment: Pick<AnnouncementAttachmentSummary, 'content_type' | 'file_name'>
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

  return INLINE_ATTACHMENT_EXTENSIONS.has(getFileExtension(attachment.file_name));
}

export function openAnnouncementAttachment(
  announcementId: number,
  attachmentId: number
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const url = getAnnouncementAttachmentViewerUrl(announcementId, attachmentId);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
  return true;
}
