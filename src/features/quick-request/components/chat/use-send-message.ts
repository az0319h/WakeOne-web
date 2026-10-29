'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { deleteQuickChatAttachmentMutation, sendQuickRequestMessageMutation } from '../../api/mutations';
import type { QuickRequestChatViewer } from '../../api/types';
import { QUICK_CHAT_MESSAGES } from '../../schemas/quick-request-chat';
import {
  createTempMessageId,
  getMessagesCache,
  updateMessagesCache,
  type QuickChatAttachmentItem
} from '../../lib/quick-chat-cache';

type UseSendMessageOptions = {
  requestNo: string;
  viewer: QuickRequestChatViewer;
  /** 실패 시 입력창이 비어 있으면 본문 복원 (U-10) · 재시도 성공 시 같은 본문이면 비움 */
  getDraft: () => string;
  setDraft: (value: string) => void;
};

/**
 * plan 93 AC-33·34 — optimistic 전송. 캐시 조작은 `mutations.ts`(onMutate/onSuccess/onError/onSettled),
 * 여기서는 UI만: 실패 토스트 · 입력 복원 · 재시도 · 임시 항목 삭제(서버 데이터 아님 → AlertModal 대상 아님).
 * plan 98 — `send(body, attachments)`: 본문 `''` + 첨부 허용 · 재시도는 캐시 임시 행의 첨부 ids 재사용(재업로드 없음 · AC-10) ·
 * 삭제는 임시 행 제거 + pending 첨부 DELETE(fire-and-forget).
 */
export function useSendMessage({ requestNo, viewer, getDraft, setDraft }: UseSendMessageOptions) {
  const queryClient = useQueryClient();
  const deleteAttachment = useMutation(deleteQuickChatAttachmentMutation);
  const deleteAttachmentMutate = deleteAttachment.mutate;
  const mutation = useMutation({
    ...sendQuickRequestMessageMutation,
    onError: (...args) => {
      sendQuickRequestMessageMutation.onError?.(...args);
      const [error, variables] = args;
      notifyError(error instanceof Error && error.message ? error.message : QUICK_CHAT_MESSAGES.sendFailed);
      if (variables.body && getDraft().trim().length === 0) {
        setDraft(variables.body);
      }
    },
    onSuccess: (...args) => {
      sendQuickRequestMessageMutation.onSuccess?.(...args);
      const [, variables] = args;
      if (variables.body && getDraft() === variables.body) {
        setDraft('');
      }
    }
  });

  const send = useCallback(
    (body: string, attachments: readonly QuickChatAttachmentItem[] = []) => {
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return;
      mutation.mutate({
        requestNo,
        tempId: createTempMessageId(),
        body: trimmed,
        viewer,
        attachmentIds: attachments.map((attachment) => attachment.id),
        attachments: [...attachments]
      });
    },
    [mutation, requestNo, viewer]
  );

  const retry = useCallback(
    (tempId: string) => {
      const temp = getMessagesCache(queryClient, requestNo)?.messages.find((message) => message.id === tempId);
      if (!temp) return;
      mutation.mutate({
        requestNo,
        tempId,
        body: temp.body,
        viewer,
        attachmentIds: temp.attachments.map((attachment) => attachment.id),
        attachments: temp.attachments
      });
    },
    [mutation, queryClient, requestNo, viewer]
  );

  const discard = useCallback(
    (tempId: string) => {
      const temp = getMessagesCache(queryClient, requestNo)?.messages.find((message) => message.id === tempId);
      for (const attachment of temp?.attachments ?? []) {
        deleteAttachmentMutate({ requestNo, attachmentId: attachment.id });
        if (attachment.previewUrl && typeof URL !== 'undefined') {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
      updateMessagesCache(queryClient, requestNo, (current) => ({
        ...current,
        messages: current.messages.filter((message) => message.id !== tempId)
      }));
    },
    [deleteAttachmentMutate, queryClient, requestNo]
  );

  return { send, retry, discard, isPending: mutation.isPending };
}
