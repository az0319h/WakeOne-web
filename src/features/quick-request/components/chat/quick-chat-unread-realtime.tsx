'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { AuthProfile } from '@/features/auth/api/types';
import { quickRequestKeys } from '../../api/keys';
import { QUICK_CHAT_UNREAD_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';

type QuickChatUnreadRealtimeProps = {
  profile: AuthProfile;
};

/**
 * plan 93 C-22 — 사이드바 「퀵 대화」 배지 전역 Realtime (`quick-chat-unread` · dashboard layout).
 * messages INSERT(필터 없음 · RLS) + 내 reads INSERT/UPDATE(`user_id=eq.{me}`) → 1초 debounce로
 * unreadTotal·conversations·lists invalidate. 92 `quick-requests*`·목록 `quick-chat-list`와 채널명이 다르다.
 */
export function QuickChatUnreadRealtime({ profile }: QuickChatUnreadRealtimeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile.status === 'inactive') {
      return;
    }

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function invalidate() {
      timer = null;
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.unreadTotal() });
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.conversationsAll() });
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
    }

    function scheduleInvalidate() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(invalidate, QUICK_CHAT_UNREAD_REALTIME_DEBOUNCE_MS);
    }

    const setup = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (cancelled || !session?.access_token) {
        return;
      }

      await supabase.realtime.setAuth(session.access_token);

      if (cancelled) return;

      const readFilter = `user_id=eq.${profile.user_id}`;
      channel = supabase
        .channel('quick-chat-unread')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_messages' },
          scheduleInvalidate
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_message_reads', filter: readFilter },
          scheduleInvalidate
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'quick_request_message_reads', filter: readFilter },
          scheduleInvalidate
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [profile.status, profile.user_id, queryClient]);

  return null;
}
