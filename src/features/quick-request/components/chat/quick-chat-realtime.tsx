'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { quickRequestKeys } from '../../api/keys';
import type { QuickRequestMessage } from '../../api/types';
import { QUICK_CHAT_AUTHOR_ROLES, type QuickChatAuthorRole } from '../../schemas/quick-request-chat';
import { mergeServerMessage, updateMessagesCache } from '../../lib/quick-chat-cache';
import { QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS } from './quick-chat-constants';

export type QuickChatRealtimeStatus = 'connecting' | 'subscribed' | 'error';

export type QuickChatTypingPayload = {
  userId: string;
  name: string;
  state: 'start' | 'stop';
};

type MessageRow = {
  id: number | string;
  quick_request_id: string;
  author_user_id: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
};

type ReadRow = {
  user_id: string;
  quick_request_id: string;
  last_read_message_id: number | string;
  last_read_at: string;
};

function isAuthorRole(value: string): value is QuickChatAuthorRole {
  return (QUICK_CHAT_AUTHOR_ROLES as readonly string[]).includes(value);
}

function toMessage(row: unknown): QuickRequestMessage | null {
  if (!row || typeof row !== 'object') return null;
  const candidate = row as Partial<MessageRow>;
  const id = Number(candidate.id);
  if (
    !Number.isFinite(id) ||
    typeof candidate.author_user_id !== 'string' ||
    typeof candidate.author_name !== 'string' ||
    typeof candidate.author_role !== 'string' ||
    !isAuthorRole(candidate.author_role) ||
    typeof candidate.body !== 'string' ||
    typeof candidate.created_at !== 'string'
  ) {
    return null;
  }
  return {
    id,
    authorUserId: candidate.author_user_id,
    authorName: candidate.author_name,
    authorRole: candidate.author_role,
    body: candidate.body,
    createdAt: candidate.created_at
  };
}

function toRead(row: unknown): { userId: string; lastReadMessageId: number; lastReadAt: string } | null {
  if (!row || typeof row !== 'object') return null;
  const candidate = row as Partial<ReadRow>;
  const lastReadMessageId = Number(candidate.last_read_message_id);
  if (
    typeof candidate.user_id !== 'string' ||
    !Number.isFinite(lastReadMessageId) ||
    typeof candidate.last_read_at !== 'string'
  ) {
    return null;
  }
  return { userId: candidate.user_id, lastReadMessageId, lastReadAt: candidate.last_read_at };
}

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
  /** `request.id` (uuid) — `quick-chat-{id}` 채널 · `quick_request_id=eq.{id}` 필터 */
  requestId: string;
  myUserId: string;
  onTyping?: (payload: QuickChatTypingPayload) => void;
};

/**
 * plan 93 C-16 — 대화 1건 Realtime (messages INSERT · reads INSERT/UPDATE · broadcast `typing`).
 * 메시지는 `setQueryData` merge(서버 id dedupe · 내 pending 임시 행 교체), 읽음은 캐시의 `reads`를 갱신하고
 * 모르는 사용자면 300ms debounce로 `messages(no)`를 다시 읽는다. 패턴: `quick-request-realtime.tsx`(setAuth → subscribe → removeChannel).
 */
export function useQuickChatRealtime({ requestNo, requestId, myUserId, onTyping }: UseQuickChatRealtimeOptions) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QuickChatRealtimeStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefetch() {
      if (refetchTimer !== null) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: quickRequestKeys.messages(requestNo) });
      }, QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS);
    }

    function handleMessageInsert(payload: { new: unknown }) {
      const message = toMessage(payload.new);
      if (!message) {
        scheduleRefetch();
        return;
      }
      updateMessagesCache(queryClient, requestNo, (current) => ({
        ...current,
        messages: mergeServerMessage(current.messages, message, { myUserId })
      }));
    }

    function handleReadChange(payload: { new: unknown }) {
      const read = toRead(payload.new);
      if (!read) {
        scheduleRefetch();
        return;
      }
      let known = false;
      updateMessagesCache(queryClient, requestNo, (current) => {
        known = current.reads.some((item) => item.userId === read.userId);
        if (!known) return current;
        return {
          ...current,
          myLastReadMessageId:
            read.userId === current.viewer.userId
              ? Math.max(current.myLastReadMessageId, read.lastReadMessageId)
              : current.myLastReadMessageId,
          reads: current.reads.map((item) =>
            item.userId === read.userId
              ? {
                  ...item,
                  lastReadMessageId: Math.max(item.lastReadMessageId, read.lastReadMessageId),
                  lastReadAt: read.lastReadAt
                }
              : item
          )
        };
      });
      if (!known) {
        scheduleRefetch();
      }
    }

    const setup = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (cancelled || !session?.access_token) {
        return;
      }

      await supabase.realtime.setAuth(session.access_token);

      if (cancelled) {
        return;
      }

      const filter = `quick_request_id=eq.${requestId}`;
      channel = supabase
        .channel(`quick-chat-${requestId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_messages', filter },
          handleMessageInsert
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_request_message_reads', filter },
          handleReadChange
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'quick_request_message_reads', filter },
          handleReadChange
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (isTypingPayload(payload) && payload.userId !== myUserId) {
            onTypingRef.current?.(payload);
          }
        })
        .subscribe((nextStatus) => {
          if (cancelled) return;
          setStatus(nextStatus === 'SUBSCRIBED' ? 'subscribed' : nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' ? 'error' : 'connecting');
        });
      channelRef.current = channel;
    };

    void setup();

    return () => {
      cancelled = true;
      if (refetchTimer !== null) clearTimeout(refetchTimer);
      channelRef.current = null;
      setStatus('connecting');
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [myUserId, queryClient, requestId, requestNo]);

  const sendTyping = useCallback(
    (payload: QuickChatTypingPayload) => {
      const channel = channelRef.current;
      if (!channel || status !== 'subscribed') return;
      void channel.send({ type: 'broadcast', event: 'typing', payload });
    },
    [status]
  );

  return { status, sendTyping };
}
