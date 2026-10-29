'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthProfile } from '@/features/auth/api/types';
import { quickRequestKeys } from '../../api/keys';
import { useQuickRealtimeChannel } from '../../lib/use-quick-realtime-channel';
import { QUICK_CHAT_UNREAD_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';

type QuickChatUnreadRealtimeProps = {
  profile: AuthProfile;
  /** `quick-requests:all`(viewer-all) 또는 `quick-user:{uid}` — dashboard layout(서버)이 권한 판정 후 넘긴다 */
  topic: string;
};

/**
 * plan 93 C-22 · plan 94 D-3 — 사이드바 「퀵 대화」 배지 전역 Broadcast (dashboard layout).
 * 같은 topic을 쓰는 대시보드·목록과 채널을 공유한다(공용 훅 registry). 1초 debounce로 unreadTotal·conversations·lists invalidate.
 */
export function QuickChatUnreadRealtime({ profile, topic }: QuickChatUnreadRealtimeProps) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollingQueryKeys = useMemo(
    () => [quickRequestKeys.unreadTotal(), quickRequestKeys.conversationsAll(), quickRequestKeys.lists()],
    []
  );

  const onEvent = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      for (const queryKey of pollingQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }, QUICK_CHAT_UNREAD_REALTIME_DEBOUNCE_MS);
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

  useQuickRealtimeChannel({
    topic,
    enabled: profile.status !== 'inactive',
    onEvent,
    pollingQueryKeys
  });

  return null;
}
