'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { quickRequestKeys } from '../../api/keys';
import { QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';
import type { QuickChatRealtimeStatus } from './quick-chat-realtime';

type QuickChatListRealtimeProps = {
  onStatusChange: (status: QuickChatRealtimeStatus) => void;
};

/**
 * plan 93 — 「퀵 대화」 목록 Realtime (`quick-chat-list` · messages INSERT + reads INSERT/UPDATE · 필터 없음, RLS가 범위 제한).
 * 300ms debounce로 conversations·lists·unreadTotal invalidate. 구독 상태는 「실시간」/「연결 중…」 배지로.
 */
export function QuickChatListRealtime({ onStatusChange }: QuickChatListRealtimeProps) {
  const queryClient = useQueryClient();
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function invalidate() {
      timer = null;
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.conversationsAll() });
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.unreadTotal() });
    }

    function scheduleInvalidate() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(invalidate, QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS);
    }

    const setup = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (cancelled || !session?.access_token) {
        onStatusChangeRef.current('error');
        return;
      }

      await supabase.realtime.setAuth(session.access_token);

      if (cancelled) return;

      channel = supabase
        .channel('quick-chat-list')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_messages' },
          scheduleInvalidate
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_message_reads' },
          scheduleInvalidate
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'quick_request_message_reads' },
          scheduleInvalidate
        )
        .subscribe((status) => {
          if (cancelled) return;
          onStatusChangeRef.current(
            status === 'SUBSCRIBED'
              ? 'subscribed'
              : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
                ? 'error'
                : 'connecting'
          );
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  return null;
}
