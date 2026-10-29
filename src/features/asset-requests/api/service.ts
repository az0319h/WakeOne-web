import { toSearchParams } from '@/features/asset-ledger/api/filter-utils';
import { apiClientWithMessage } from '@/lib/api-client';
import type {
  AssetRequestAssigneePayload,
  AssetRequestCommentMutationResponse,
  AssetRequestCommentPayload,
  AssetRequestCommentsApiResponse,
  AssetRequestComment,
  AssetRequestCreatePayload,
  AssetRequestDetailApiResponse,
  AssetRequestDetailResponse,
  AssetRequestFilters,
  AssetRequestListApiResponse,
  AssetRequestListResponse,
  AssetRequestMutationResponse,
  AssetRequestStatusPayload,
  AssetRequestSummary,
  AssetRequestSummaryApiResponse,
  AssetRequestUpdatePayload
} from './types';

/** plan 103 — 요청·댓글 API 클라이언트. 직원 화면에서는 `mine_assigned`를 보내지 않는다(403). */

export function serializeAssetRequestFilters(filters: AssetRequestFilters): URLSearchParams {
  return toSearchParams({
    target_type: filters.target_type,
    status: filters.status && filters.status !== 'open' ? filters.status : undefined,
    mine_assigned: filters.mine_assigned ? true : undefined,
    page: filters.page && filters.page > 1 ? filters.page : undefined,
    perPage: filters.perPage
  });
}

export async function fetchAssetRequests(filters: AssetRequestFilters): Promise<AssetRequestListResponse> {
  const response = await apiClientWithMessage<AssetRequestListApiResponse>(
    `/asset-requests?${serializeAssetRequestFilters(filters).toString()}`
  );
  return response.data;
}

export async function fetchAssetRequestDetail(id: number): Promise<AssetRequestDetailResponse> {
  const response = await apiClientWithMessage<AssetRequestDetailApiResponse>(`/asset-requests/${id}`);
  return response.data;
}

export async function fetchAssetRequestSummary(): Promise<AssetRequestSummary> {
  const response = await apiClientWithMessage<AssetRequestSummaryApiResponse>('/asset-requests/summary');
  return response.data;
}

export async function fetchAssetRequestComments(id: number): Promise<AssetRequestComment[]> {
  const response = await apiClientWithMessage<AssetRequestCommentsApiResponse>(`/asset-requests/${id}/comments`);
  return response.data.comments;
}

export function createAssetRequest(payload: AssetRequestCreatePayload) {
  return apiClientWithMessage<AssetRequestMutationResponse>('/asset-requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAssetRequest(id: number, payload: AssetRequestUpdatePayload) {
  return apiClientWithMessage<AssetRequestMutationResponse>(`/asset-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function cancelAssetRequest(id: number) {
  return apiClientWithMessage<AssetRequestMutationResponse>(`/asset-requests/${id}/cancel`, { method: 'POST' });
}

export function changeAssetRequestStatus(id: number, payload: AssetRequestStatusPayload) {
  return apiClientWithMessage<AssetRequestMutationResponse>(`/asset-requests/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function changeAssetRequestAssignee(id: number, payload: AssetRequestAssigneePayload) {
  return apiClientWithMessage<AssetRequestMutationResponse>(`/asset-requests/${id}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function createAssetRequestComment(requestId: number, payload: AssetRequestCommentPayload) {
  return apiClientWithMessage<AssetRequestCommentMutationResponse>(`/asset-requests/${requestId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createAssetRequestReply(requestId: number, parentId: number, payload: AssetRequestCommentPayload) {
  return apiClientWithMessage<AssetRequestCommentMutationResponse>(
    `/asset-requests/${requestId}/comments/${parentId}/replies`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function updateAssetRequestComment(requestId: number, commentId: number, payload: AssetRequestCommentPayload) {
  return apiClientWithMessage<AssetRequestCommentMutationResponse>(
    `/asset-requests/${requestId}/comments/${commentId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  );
}

export function deleteAssetRequestComment(requestId: number, commentId: number) {
  return apiClientWithMessage<AssetRequestCommentMutationResponse>(
    `/asset-requests/${requestId}/comments/${commentId}`,
    { method: 'DELETE' }
  );
}
