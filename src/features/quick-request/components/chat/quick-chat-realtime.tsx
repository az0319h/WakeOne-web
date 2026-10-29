'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { quickRequestKeys } from '../../api/keys';
import { quickRequestTopic } from '../../lib/quick-realtime-topics';
import {
  useQuickRealtimeChannel,
  type QuickRealtimeMessage,
  type QuickRealtimeStatus
} from '../../lib/use-quick-realtime-channel';
import { QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';

export type QuickChatTypingPayload = {
  userId: string;
  name: string;
  state: 'start' | 'stop';
};

/** 클라이언트 broadcast event 이름 — DB 트리거의 `INSERT`/`UPDATE`와 겹치지 않는다 */
export const QUICK_CHAT_TYPING_EVENT = 'typing';

function isTypingPayload(value: unknown): value is QuickChatTypingPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<QuickChatTypingPayload>;
  return (
    typeof payload.userId === 'string' &&
    typeof payload.name === 'string' &&
    (payload.state === 'start' || payload.state === 'stop')
  );
}

type UseQuickChatRealtimeOptions = {
  requestNo: string;
  /** `request.id` (uuid) — `quick-request:{id}` private 채널 (DB 변경 + 「입력 중…」 통합 · plan 94 D-5) */
  requestId: string;
  myUserId: string;
  onTyping?: (payload: QuickChatTypingPayload) => void;
};

/**
 * plan 94 D-3·D-5 — 대화 1건 Broadcast. DB 변경(messages INSERT · reads · quick_requests UPDATE)은 본문이 없으니
 * 300ms debounce로 `messages(no)`를 다시 읽는다 — refetch는 `quickRequestMessagesQueryOptions`의 `structuralSharing`이
 * optimistic 임시 행을 보존·dedupe한다(`lib/quick-chat-cache.ts`). `typing`은 같은 채널의 클라이언트 broadcast.
 */
export function useQuickChatRealtime({ requestNo, requestId, myUserId, onTyping }: UseQuickChatRealtimeOptions) {
  const queryClient = useQueryClient();
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollingQueryKeys = useMemo(() => [quickRequestKeys.messages(requestNo)], [requestNo]);

  const onEvent = useCallback(
    (message: QuickRealtimeMessage) => {
      if (message.event === QUICK_CHAT_TYPING_EVENT) {
        if (isTypingPayload(message.payload) && message.payload.userId !== myUserId) {
          onTypingRef.current?.(message.payload);
        }
        return;
      }
      if (refetchTimerRef.current !== null) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void queryClient.invalidateQueries({ queryKey: quickRequestKeys.messages(requestNo) });
      }, QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS);
    },
    [myUserId, queryClient, requestNo]
  );

  useEffect(
    () => () => {
      if (refetchTimerRef.current !== null) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    },
    []
  );

  const { status, send } = useQuickRealtimeChannel({
    topic: quickRequestTopic(requestId),
    onEvent,
    pollingQueryKeys
  });

  const sendTyping = useCallback(
    (payload: QuickChatTypingPayload) => {
      send(QUICK_CHAT_TYPING_EVENT, payload);
    },
    [send]
  );

  return { status, sendTyping } satisfies { status: QuickRealtimeStatus; sendTyping: typeof sendTyping };
}
