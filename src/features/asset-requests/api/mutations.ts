import { mutationOptions } from '@tanstack/react-query';
import { equipmentKeys } from '@/features/equipment/api/keys';
import { subscriptionKeys } from '@/features/subscriptions/api/keys';
import { getQueryClient } from '@/lib/query-client';
import { assetRequestKeys } from './keys';
import {
  cancelAssetRequest,
  changeAssetRequestAssignee,
  changeAssetRequestStatus,
  createAssetRequest,
  createAssetRequestComment,
  createAssetRequestReply,
  deleteAssetRequestComment,
  updateAssetRequest,
  updateAssetRequestComment
} from './service';
import type {
  AssetRequestCommentPayload,
  AssetRequestCreatePayload,
  AssetRequestStatusPayload,
  AssetRequestUpdatePayload
} from './types';

/**
 * 요청 생성·수정·상태·담당자 → 요청 목록·단건·summary + 대장 목록·단건(진행 중 요청 칸) invalidate (designer §14-12).
 * 대장 행 자체는 요청 처리로 바뀌지 않는다(D-16) — invalidate는 「진행 중 요청」 표시 갱신용.
 */
function invalidateRequestsAndLedgers() {
  const queryClient = getQueryClient();
  queryClient.invalidateQueries({ queryKey: assetRequestKeys.all });
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
}

/** 댓글 → 댓글·요청 단건(댓글 수)·요청 목록 · 행 단건(요청 항목 댓글 수) */
function invalidateComments(requestId: number) {
  const queryClient = getQueryClient();
  queryClient.invalidateQueries({ queryKey: assetRequestKeys.comments(requestId) });
  queryClient.invalidateQueries({ queryKey: assetRequestKeys.detail(requestId) });
  queryClient.invalidateQueries({ queryKey: assetRequestKeys.lists() });
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.details() });
  queryClient.invalidateQueries({ queryKey: equipmentKeys.details() });
}

export const createAssetRequestMutation = mutationOptions({
  mutationFn: (payload: AssetRequestCreatePayload) => createAssetRequest(payload),
  onSettled: invalidateRequestsAndLedgers
});

export const updateAssetRequestMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: AssetRequestUpdatePayload }) =>
    updateAssetRequest(id, payload),
  onSettled: invalidateRequestsAndLedgers
});

export const cancelAssetRequestMutation = mutationOptions({
  mutationFn: (id: number) => cancelAssetRequest(id),
  onSettled: invalidateRequestsAndLedgers
});

export const changeAssetRequestStatusMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: AssetRequestStatusPayload }) =>
    changeAssetRequestStatus(id, payload),
  onSettled: invalidateRequestsAndLedgers
});

export const changeAssetRequestAssigneeMutation = mutationOptions({
  mutationFn: ({ id, assigneeUserId }: { id: number; assigneeUserId: string }) =>
    changeAssetRequestAssignee(id, { assignee_user_id: assigneeUserId }),
  onSettled: invalidateRequestsAndLedgers
});

export const createAssetRequestCommentMutation = mutationOptions({
  mutationFn: ({
    requestId,
    parentId,
    payload
  }: {
    requestId: number;
    parentId?: number | null;
    payload: AssetRequestCommentPayload;
  }) =>
    parentId
      ? createAssetRequestReply(requestId, parentId, payload)
      : createAssetRequestComment(requestId, payload),
  onSettled: (_data, _error, variables) => invalidateComments(variables.requestId)
});

export const updateAssetRequestCommentMutation = mutationOptions({
  mutationFn: ({
    requestId,
    commentId,
    payload
  }: {
    requestId: number;
    commentId: number;
    payload: AssetRequestCommentPayload;
  }) => updateAssetRequestComment(requestId, commentId, payload),
  onSettled: (_data, _error, variables) => invalidateComments(variables.requestId)
});

export const deleteAssetRequestCommentMutation = mutationOptions({
  mutationFn: ({ requestId, commentId }: { requestId: number; commentId: number }) =>
    deleteAssetRequestComment(requestId, commentId),
  onSettled: (_data, _error, variables) => invalidateComments(variables.requestId)
});
