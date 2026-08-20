import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { supportKeys } from './keys';
import {
  createSupportComment,
  createSupportCommentReply,
  createSupportRequest,
  deleteSupportComment,
  updateSupportComment,
  updateSupportRequestContent,
  updateSupportRequestStatus
} from './service';
import type {
  SupportCommentCreatePayload,
  SupportCommentUpdatePayload,
  SupportCreatePayload,
  SupportStatus,
  SupportUpdateContentPayload
} from './types';

function invalidateSupport() {
  getQueryClient().invalidateQueries({ queryKey: supportKeys.all });
}

function invalidateSupportComments(supportRequestId: number) {
  const queryClient = getQueryClient();
  queryClient.invalidateQueries({ queryKey: supportKeys.comments(supportRequestId) });
  queryClient.invalidateQueries({ queryKey: supportKeys.all });
}

export const createSupportRequestMutation = mutationOptions({
  mutationFn: (payload: SupportCreatePayload) => createSupportRequest(payload),
  onSettled: invalidateSupport
});

export const updateSupportRequestMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: SupportUpdateContentPayload }) =>
    updateSupportRequestContent(id, payload),
  onSettled: invalidateSupport
});

export const updateSupportStatusMutation = mutationOptions({
  mutationFn: ({ id, status }: { id: number; status: SupportStatus }) =>
    updateSupportRequestStatus(id, status),
  onSettled: invalidateSupport
});

export const createSupportCommentMutation = mutationOptions({
  mutationFn: ({
    supportRequestId,
    payload
  }: {
    supportRequestId: number;
    payload: SupportCommentCreatePayload;
  }) => createSupportComment(supportRequestId, payload),
  onSettled: (_data, _error, variables) => {
    invalidateSupportComments(variables.supportRequestId);
  }
});

export const createSupportCommentReplyMutation = mutationOptions({
  mutationFn: ({
    supportRequestId,
    commentId,
    payload
  }: {
    supportRequestId: number;
    commentId: number;
    payload: SupportCommentCreatePayload;
  }) => createSupportCommentReply(supportRequestId, commentId, payload),
  onSettled: (_data, _error, variables) => {
    invalidateSupportComments(variables.supportRequestId);
  }
});

export const updateSupportCommentMutation = mutationOptions({
  mutationFn: ({
    supportRequestId,
    commentId,
    payload
  }: {
    supportRequestId: number;
    commentId: number;
    payload: SupportCommentUpdatePayload;
  }) => updateSupportComment(supportRequestId, commentId, payload),
  onSettled: (_data, _error, variables) => {
    invalidateSupportComments(variables.supportRequestId);
  }
});

export const deleteSupportCommentMutation = mutationOptions({
  mutationFn: ({
    supportRequestId,
    commentId
  }: {
    supportRequestId: number;
    commentId: number;
  }) => deleteSupportComment(supportRequestId, commentId),
  onSettled: (_data, _error, variables) => {
    invalidateSupportComments(variables.supportRequestId);
  }
});
