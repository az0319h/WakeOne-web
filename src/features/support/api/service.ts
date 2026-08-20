import { apiClient, apiClientWithMessage } from '@/lib/api-client';
import { serializeSupportFiltersToSearchParams } from './filter-utils';
import type {
  SupportCommentCreatePayload,
  SupportCommentMutationResponse,
  SupportCommentUpdatePayload,
  SupportCommentsResponse,
  SupportCreatePayload,
  SupportDetailResponse,
  SupportFilters,
  SupportListApiResponse,
  SupportListResponse,
  SupportMutationResponse,
  SupportStatus,
  SupportUpdateContentPayload
} from './types';

export async function fetchSupportRequests(
  filters: SupportFilters = {}
): Promise<SupportListResponse> {
  const searchParams = serializeSupportFiltersToSearchParams(filters);
  const queryString = searchParams.toString();

  const response = await apiClient<SupportListApiResponse>(
    `/support${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function fetchSupportRequestById(id: number) {
  return apiClientWithMessage<SupportDetailResponse>(`/support/${id}`).then(
    (response) => response.request
  );
}

export async function createSupportRequest(payload: SupportCreatePayload) {
  return apiClientWithMessage<SupportMutationResponse>('/support', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSupportRequestContent(
  id: number,
  payload: SupportUpdateContentPayload
) {
  return apiClientWithMessage<SupportMutationResponse>(`/support/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateSupportRequestStatus(id: number, status: SupportStatus) {
  return apiClientWithMessage<SupportMutationResponse>(`/support/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function fetchSupportComments(id: number) {
  return apiClient<SupportCommentsResponse>(`/support/${id}/comments`).then(
    (response) => response.comments
  );
}

export async function createSupportComment(
  supportRequestId: number,
  payload: SupportCommentCreatePayload
) {
  return apiClientWithMessage<SupportCommentMutationResponse>(
    `/support/${supportRequestId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function createSupportCommentReply(
  supportRequestId: number,
  commentId: number,
  payload: SupportCommentCreatePayload
) {
  return apiClientWithMessage<SupportCommentMutationResponse>(
    `/support/${supportRequestId}/comments/${commentId}/replies`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function updateSupportComment(
  supportRequestId: number,
  commentId: number,
  payload: SupportCommentUpdatePayload
) {
  return apiClientWithMessage<SupportCommentMutationResponse>(
    `/support/${supportRequestId}/comments/${commentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteSupportComment(supportRequestId: number, commentId: number) {
  return apiClientWithMessage<SupportCommentMutationResponse>(
    `/support/${supportRequestId}/comments/${commentId}`,
    {
      method: 'DELETE'
    }
  );
}
