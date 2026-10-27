'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QUICK_CHAT_TYPING_THROTTLE_MS, QUICK_CHAT_TYPING_TTL_MS } from './quick-chat-constants';
import type { QuickChatTypingPayload } from './quick-chat-realtime';

type UseTypingBroadcastOptions = {
  /** `canWrite=false`면 송신하지 않는다 (AC-36 구매물류팀) */
  enabled: boolean;
  userId: string;
  name: string;
  send: (payload: QuickChatTypingPayload) => void;
};

/** 송신 — 입력 시작 1회 + 3초 throttle · blur/전송 시 `stop` (C-20) */
export function useTypingBroadcast({ enabled, userId, name, send }: UseTypingBroadcastOptions) {
  const lastSentAtRef = useRef(0);
  const activeRef = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;

  const onInput = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (!activeRef.current || now - lastSentAtRef.current >= QUICK_CHAT_TYPING_THROTTLE_MS) {
      activeRef.current = true;
      lastSentAtRef.current = now;
      sendRef.current({ userId, name, state: 'start' });
    }
  }, [enabled, name, userId]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    lastSentAtRef.current = 0;
    sendRef.current({ userId, name, state: 'stop' });
  }, [name, userId]);

  useEffect(() => () => {
    activeRef.current = false;
  }, []);

  return { onInput, stop };
}

type TypingEntry = { name: string; timer: ReturnType<typeof setTimeout>; startedAt: number };

/** 수신 — userId별 4초 타이머 · 입력 시작 순 이름 목록 (C-23) · 본인은 Realtime 훅이 이미 뺐다 */
export function useTypingReceiver() {
  const entriesRef = useRef(new Map<string, TypingEntry>());
  const [names, setNames] = useState<string[]>([]);

  const publish = useCallback(() => {
    const sorted = [...entriesRef.current.values()].sort((a, b) => a.startedAt - b.startedAt);
    setNames(sorted.map((entry) => entry.name));
  }, []);

  const remove = useCallback(
    (userId: string) => {
      const entry = entriesRef.current.get(userId);
      if (!entry) return;
      clearTimeout(entry.timer);
      entriesRef.current.delete(userId);
      publish();
    },
    [publish]
  );

  const onTyping = useCallback(
    (payload: QuickChatTypingPayload) => {
      if (payload.state === 'stop') {
        remove(payload.userId);
        return;
      }
      const existing = entriesRef.current.get(payload.userId);
      if (existing) clearTimeout(existing.timer);
      entriesRef.current.set(payload.userId, {
        name: payload.name,
        startedAt: existing?.startedAt ?? Date.now(),
        timer: setTimeout(() => remove(payload.userId), QUICK_CHAT_TYPING_TTL_MS)
      });
      publish();
    },
    [publish, remove]
  );

  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) clearTimeout(entry.timer);
      entries.clear();
    };
  }, []);

  return { names, onTyping };
}
