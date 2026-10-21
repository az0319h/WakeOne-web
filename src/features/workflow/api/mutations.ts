/**
 * 워크플로우 CUD mutationOptions — 캐시 무효화는 반드시 여기 `onSettled`에서 한다
 * (컴포넌트 `onSuccess`는 toast·닫기 등 UI 전용).
 */
import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { workflowKeys } from './keys';
import {
  addWorkflowComment,
  approveWorkflowDocument,
  cancelWorkflowDocument,
  changeWorkflowApprovalLine,
  declineWorkflowDocument,
  deleteWorkflowAttachment,
  deleteWorkflowDraft,
  grantWorkflowAdmin,
  revokeWorkflowAdmin,
  saveWorkflowDraft,
  saveWorkflowTemplatePolicy,
  setWorkflowStar,
  submitWorkflowDocument,
  updateWorkflowDocument,
  uploadWorkflowAttachment
} from './service';
import type {
  WorkflowApprovalLinePayload,
  WorkflowDocumentDetail,
  WorkflowDraftSavePayload,
  WorkflowPolicyPayload,
  WorkflowSubmitPayload,
  WorkflowUpdatePayload
} from './types';

function invalidateWorkflow() {
  return getQueryClient().invalidateQueries({ queryKey: workflowKeys.all });
}

function invalidateDrafts() {
  return getQueryClient().invalidateQueries({ queryKey: workflowKeys.drafts() });
}

export const submitWorkflowDocumentMutation = mutationOptions({
  mutationFn: (payload: WorkflowSubmitPayload) => submitWorkflowDocument(payload),
  onSettled: invalidateWorkflow
});

export const updateWorkflowDocumentMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: string; payload: WorkflowUpdatePayload }) =>
    updateWorkflowDocument(id, payload),
  onSettled: invalidateWorkflow
});

export const approveWorkflowDocumentMutation = mutationOptions({
  mutationFn: ({ id, opinion }: { id: string; opinion: string }) =>
    approveWorkflowDocument(id, { opinion: opinion || null }),
  onSettled: invalidateWorkflow
});

export const declineWorkflowDocumentMutation = mutationOptions({
  mutationFn: ({ id, reason }: { id: string; reason: string }) =>
    declineWorkflowDocument(id, { reason: reason || null }),
  onSettled: invalidateWorkflow
});

export const cancelWorkflowDocumentMutation = mutationOptions({
  mutationFn: ({ id }: { id: string }) => cancelWorkflowDocument(id),
  onSettled: invalidateWorkflow
});

export const changeWorkflowApprovalLineMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: string; payload: WorkflowApprovalLinePayload }) =>
    changeWorkflowApprovalLine(id, payload),
  onSettled: invalidateWorkflow
});

export const addWorkflowCommentMutation = mutationOptions({
  mutationFn: ({ id, content }: { id: string; content: string }) =>
    addWorkflowComment(id, { content }),
  onSettled: invalidateWorkflow
});

type StarContext = { previous: WorkflowDocumentDetail | undefined };

/** 중요 ★ — 낙관적 업데이트(plan 37 방식), 실패 시 롤백 */
export const setWorkflowStarMutation = mutationOptions({
  mutationFn: ({ id, starred }: { id: string; starred: boolean }) => setWorkflowStar(id, starred),
  onMutate: async ({ id, starred }): Promise<StarContext> => {
    const queryClient = getQueryClient();
    const key = workflowKeys.detail(id);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<WorkflowDocumentDetail>(key);
    if (previous) {
      queryClient.setQueryData<WorkflowDocumentDetail>(key, { ...previous, starred });
    }
    return { previous };
  },
  onError: (_error, { id }, context) => {
    if (context?.previous) {
      getQueryClient().setQueryData(workflowKeys.detail(id), context.previous);
    }
  },
  onSettled: invalidateWorkflow
});

export const uploadWorkflowAttachmentMutation = mutationOptions({
  mutationFn: (input: { file: File; existingCount: number }) => uploadWorkflowAttachment(input),
  onSettled: invalidateDrafts
});

export const deleteWorkflowAttachmentMutation = mutationOptions({
  mutationFn: ({ id }: { id: string }) => deleteWorkflowAttachment(id),
  onSettled: invalidateDrafts
});

export const saveWorkflowDraftMutation = mutationOptions({
  mutationFn: (input: { draftId: string | null; payload: WorkflowDraftSavePayload }) =>
    saveWorkflowDraft(input),
  onSettled: invalidateWorkflow
});

export const deleteWorkflowDraftMutation = mutationOptions({
  mutationFn: ({ id }: { id: string }) => deleteWorkflowDraft(id),
  onSettled: invalidateWorkflow
});

export const saveWorkflowTemplatePolicyMutation = mutationOptions({
  mutationFn: ({ templateKey, payload }: { templateKey: string; payload: WorkflowPolicyPayload }) =>
    saveWorkflowTemplatePolicy(templateKey, payload),
  onSettled: invalidateWorkflow
});

export const grantWorkflowAdminMutation = mutationOptions({
  mutationFn: ({ userId }: { userId: string }) => grantWorkflowAdmin({ user_id: userId }),
  onSettled: invalidateWorkflow
});

export const revokeWorkflowAdminMutation = mutationOptions({
  mutationFn: ({ userId }: { userId: string }) => revokeWorkflowAdmin(userId),
  onSettled: invalidateWorkflow
});
