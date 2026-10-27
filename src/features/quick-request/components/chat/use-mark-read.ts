'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { markQuickRequestMessagesReadMutation } from '../../api/mutations';
import { QUICK_CHAT_MARK_READ_DEBOUNCE_MS } from './quick-chat-constants';

type UseMarkReadOptions = {
  requestNo: string;
  /** 서버가 아는 내 읽음 위치 — 이보다 작거나 같은 id는 호출하지 않는다 */
  myLastReadMessageId: number;
};

/**
 * plan 93 C-11 — 읽음 위치 갱신. 마지막 메시지가 보이면(호출자: IntersectionObserver + visibilityState)
 * 500ms debounce로 `PUT …/read`. 같은 id 재호출 금지 · 뒤로 가지 않음.
 */
export function useMarkRead({ requestNo, myLastReadMessageId }: UseMarkReadOptions) {
  const mutation = useMutation({ ...markQuickRequestMessagesReadMutation });
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const sentIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(
    (lastMessageId: number) => {
      const floor = Math.max(sentIdRef.current, myLastReadMessageId);
      if (lastMessageId <= floor) return;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (lastMessageId <= Math.max(sentIdRef.current, myLastReadMessageId)) return;
        sentIdRef.current = lastMessageId;
        mutateRef.current({ requestNo, lastMessageId });
      }, QUICK_CHAT_MARK_READ_DEBOUNCE_MS);
    },
    [myLastReadMessageId, requestNo]
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  return markRead;
}
