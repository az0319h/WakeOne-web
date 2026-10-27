'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { sendQuickRequestMessageMutation } from '../../api/mutations';
import type { QuickRequestChatViewer } from '../../api/types';
import { QUICK_CHAT_MESSAGES } from '../../schemas/quick-request-chat';
import { createTempMessageId, updateMessagesCache } from '../../lib/quick-chat-cache';

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
 */
export function useSendMessage({ requestNo, viewer, getDraft, setDraft }: UseSendMessageOptions) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...sendQuickRequestMessageMutation,
    onError: (...args) => {
      sendQuickRequestMessageMutation.onError?.(...args);
      const [error, variables] = args;
      notifyError(error instanceof Error && error.message ? error.message : QUICK_CHAT_MESSAGES.sendFailed);
      if (getDraft().trim().length === 0) {
        setDraft(variables.body);
      }
    },
    onSuccess: (...args) => {
      sendQuickRequestMessageMutation.onSuccess?.(...args);
      const [, variables] = args;
      if (getDraft() === variables.body) {
        setDraft('');
      }
    }
  });

  const send = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      mutation.mutate({ requestNo, tempId: createTempMessageId(), body: trimmed, viewer });
    },
    [mutation, requestNo, viewer]
  );

  const retry = useCallback(
    (tempId: string, body: string) => {
      mutation.mutate({ requestNo, tempId, body, viewer });
    },
    [mutation, requestNo, viewer]
  );

  const discard = useCallback(
    (tempId: string) => {
      updateMessagesCache(queryClient, requestNo, (current) => ({
        ...current,
        messages: current.messages.filter((message) => message.id !== tempId)
      }));
    },
    [queryClient, requestNo]
  );

  return { send, retry, discard, isPending: mutation.isPending };
}
