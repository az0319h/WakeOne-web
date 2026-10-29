'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { quickRequestKeys } from '../../api/keys';
import { useQuickRealtimeChannel, type QuickRealtimeStatus } from '../../lib/use-quick-realtime-channel';
import { QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';

type QuickChatListRealtimeProps = {
  /** `quick-requests:all`(viewer-all) 또는 `quick-user:{uid}` — 서버 page가 넘긴다 */
  topic: string;
  onStatusChange: (status: QuickRealtimeStatus) => void;
};

/**
 * plan 94 D-3 — 「퀵 대화」 목록 private Broadcast (messages INSERT · reads · quick_requests 변경 모두 같은 topic).
 * 300ms debounce로 conversations·lists·unreadTotal invalidate. 구독 상태는 「실시간」/「연결 중…」/「폴링」 배지로(D-4 · U-1).
 */
export function QuickChatListRealtime({ topic, onStatusChange }: QuickChatListRealtimeProps) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollingQueryKeys = useMemo(
    () => [quickRequestKeys.conversationsAll(), quickRequestKeys.lists(), quickRequestKeys.unreadTotal()],
    []
  );

  const onEvent = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      for (const queryKey of pollingQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }, QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS);
  }, [pollingQueryKeys, queryClient]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  const { status } = useQuickRealtimeChannel({ topic, onEvent, pollingQueryKeys });

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  useEffect(() => {
    onStatusChangeRef.current(status);
  }, [status]);

  return null;
}
