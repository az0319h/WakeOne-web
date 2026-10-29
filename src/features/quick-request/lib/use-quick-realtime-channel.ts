'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * plan 94 D-3·D-4 — 퀵 private Broadcast 채널 공용 훅.
 *
 * - topic 1개당 브라우저 채널 1개를 공유한다(모듈 registry · 참조 카운트). supabase-js `channel(topic)`은 같은 topic이면
 *   기존 채널 객체를 돌려주므로, 상세+대화(`quick-request:{id}`)·레이아웃 배지+대시보드(`quick-requests:all`)처럼 한 화면에서
 *   같은 topic을 두 번 쓰면 구독/해제가 서로를 끊는다 → registry가 유일한 소유자다.
 * - `supabase.realtime.setAuth(token)` → `channel(topic, { config: { private: true } })` → `.on('broadcast', { event: '*' })`.
 * - 구독 후 5초 안에 `SUBSCRIBED`가 아니거나 `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`가 되면 `polling`:
 *   5초마다 `pollingQueryKeys`를 invalidate(활성 query만 refetch — `refetchInterval` 5s와 같은 효과). 다시 `SUBSCRIBED`면 `live`.
 * - payload의 `record`/본문은 없다(SQL 93 최소 payload) — `onEvent`는 invalidate 신호로만 쓴다.
 */

export type QuickRealtimeStatus = 'connecting' | 'live' | 'polling';

/** DB 트리거(`INSERT`/`UPDATE` · payload `{ id, table, op, request_id }`) 또는 클라이언트 broadcast(`typing` 등) */
export type QuickRealtimeMessage = {
  event: string;
  payload: unknown;
};

export type QuickRealtimeDbPayload = {
  id: string;
  table: 'quick_requests' | 'quick_request_messages' | 'quick_request_message_reads';
  op: 'INSERT' | 'UPDATE';
  request_id: string;
};

export function isQuickRealtimeDbPayload(value: unknown): value is QuickRealtimeDbPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuickRealtimeDbPayload>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.table === 'string' &&
    (candidate.op === 'INSERT' || candidate.op === 'UPDATE') &&
    typeof candidate.request_id === 'string'
  );
}

/** 구독 후 이 시간 안에 `SUBSCRIBED`가 아니면 polling (D-4) */
export const QUICK_REALTIME_SUBSCRIBE_GRACE_MS = 5000;
/** polling 간격 (D-4) */
export const QUICK_REALTIME_POLLING_INTERVAL_MS = 5000;
/** 마지막 구독자가 빠진 뒤 채널을 정리하기까지의 유예 — StrictMode 재마운트·화면 전환 시 재구독 churn 방지 */
const CHANNEL_TEARDOWN_DELAY_MS = 150;

type Listener = {
  onEvent: ((message: QuickRealtimeMessage) => void) | undefined;
  onStatus: (status: QuickRealtimeStatus) => void;
  pollingQueryKeys: readonly QueryKey[];
  queryClient: QueryClient;
};

type ChannelEntry = {
  topic: string;
  channel: RealtimeChannel | null;
  status: QuickRealtimeStatus;
  listeners: Set<Listener>;
  disposed: boolean;
  graceTimer: ReturnType<typeof setTimeout> | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
};

const registry = new Map<string, ChannelEntry>();

function setEntryStatus(entry: ChannelEntry, status: QuickRealtimeStatus) {
  if (entry.status === status) return;
  entry.status = status;
  for (const listener of entry.listeners) {
    listener.onStatus(status);
  }
  syncPolling(entry);
}

function pollOnce(entry: ChannelEntry) {
  const seen = new Set<string>();
  for (const listener of entry.listeners) {
    for (const queryKey of listener.pollingQueryKeys) {
      const hash = JSON.stringify(queryKey);
      if (seen.has(hash)) continue;
      seen.add(hash);
      void listener.queryClient.invalidateQueries({ queryKey });
    }
  }
}

function syncPolling(entry: ChannelEntry) {
  const shouldPoll = entry.status === 'polling' && !entry.disposed && entry.listeners.size > 0;
  if (shouldPoll && entry.pollTimer === null) {
    entry.pollTimer = setInterval(() => pollOnce(entry), QUICK_REALTIME_POLLING_INTERVAL_MS);
  } else if (!shouldPoll && entry.pollTimer !== null) {
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }
}

function clearGrace(entry: ChannelEntry) {
  if (entry.graceTimer !== null) {
    clearTimeout(entry.graceTimer);
    entry.graceTimer = null;
  }
}

async function setupEntry(entry: ChannelEntry) {
  const supabase = createClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (entry.disposed) return;

  if (!session?.access_token) {
    // 세션 없이는 private 채널을 열 수 없다 → 바로 polling
    setEntryStatus(entry, 'polling');
    return;
  }

  await supabase.realtime.setAuth(session.access_token);
  if (entry.disposed) return;

  // 같은 topic의 잔여 채널(직전 teardown이 아직 leave 중)이 있으면 먼저 치운다 — `channel()`이 그 객체를 재사용하지 않도록
  const realtimeTopic = `realtime:${entry.topic}`;
  const stale = supabase.getChannels().find((channel) => channel.topic === realtimeTopic);
  if (stale) {
    await supabase.removeChannel(stale);
    if (entry.disposed) return;
  }

  const channel = supabase
    .channel(entry.topic, { config: { private: true } })
    .on('broadcast', { event: '*' }, (message) => {
      if (entry.disposed) return;
      const next: QuickRealtimeMessage = { event: message.event, payload: message.payload };
      for (const listener of entry.listeners) {
        listener.onEvent?.(next);
      }
    });

  entry.channel = channel;
  entry.graceTimer = setTimeout(() => {
    entry.graceTimer = null;
    if (entry.disposed || entry.status === 'live') return;
    setEntryStatus(entry, 'polling');
  }, QUICK_REALTIME_SUBSCRIBE_GRACE_MS);

  channel.subscribe((status) => {
    if (entry.disposed) return;
    if (status === 'SUBSCRIBED') {
      clearGrace(entry);
      setEntryStatus(entry, 'live');
      return;
    }
    // CHANNEL_ERROR(권한 없음 포함) · TIMED_OUT · CLOSED — supabase-js가 재시도하며, 다시 SUBSCRIBED면 live로 돌아온다
    clearGrace(entry);
    setEntryStatus(entry, 'polling');
  });
}

function disposeEntry(entry: ChannelEntry) {
  entry.disposed = true;
  clearGrace(entry);
  if (entry.pollTimer !== null) {
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }
  if (registry.get(entry.topic) === entry) {
    registry.delete(entry.topic);
  }
  const channel = entry.channel;
  entry.channel = null;
  if (channel) {
    void createClient().removeChannel(channel);
  }
}

function acquireChannel(topic: string, listener: Listener): () => void {
  let entry = registry.get(topic);
  if (!entry) {
    entry = {
      topic,
      channel: null,
      status: 'connecting',
      listeners: new Set(),
      disposed: false,
      graceTimer: null,
      pollTimer: null,
      teardownTimer: null
    };
    registry.set(topic, entry);
    void setupEntry(entry);
  }
  if (entry.teardownTimer !== null) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }
  entry.listeners.add(listener);
  listener.onStatus(entry.status);
  syncPolling(entry);

  const current = entry;
  return () => {
    current.listeners.delete(listener);
    syncPolling(current);
    if (current.listeners.size > 0 || current.disposed) return;
    current.teardownTimer = setTimeout(() => {
      current.teardownTimer = null;
      if (current.listeners.size === 0) {
        disposeEntry(current);
      }
    }, CHANNEL_TEARDOWN_DELAY_MS);
  };
}

export type UseQuickRealtimeChannelOptions = {
  /** `quick-request:{id}` · `quick-user:{uid}` · `quick-requests:all` — null이면 구독하지 않는다 */
  topic: string | null;
  enabled?: boolean;
  /** 모든 broadcast(DB 트리거 `INSERT`/`UPDATE` + 클라이언트 `typing` 등). 본문은 없으니 invalidate 신호로만 */
  onEvent?: (message: QuickRealtimeMessage) => void;
  /** polling 중 5초마다 invalidate할 query key (활성 query만 refetch) */
  pollingQueryKeys: readonly QueryKey[];
};

export type UseQuickRealtimeChannelResult = {
  status: QuickRealtimeStatus;
  /** 같은 private 채널로 클라이언트 broadcast 송신 (`live`일 때만 · 예: 「입력 중…」) */
  send: (event: string, payload: Record<string, unknown>) => void;
};

export function useQuickRealtimeChannel({
  topic,
  enabled = true,
  onEvent,
  pollingQueryKeys
}: UseQuickRealtimeChannelOptions): UseQuickRealtimeChannelResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QuickRealtimeStatus>('connecting');
  const active = enabled && topic !== null;
  const activeTopic = active ? topic : null;

  const listenerRef = useRef<Listener>({
    onEvent,
    onStatus: setStatus,
    pollingQueryKeys,
    queryClient
  });
  listenerRef.current.onEvent = onEvent;
  listenerRef.current.pollingQueryKeys = pollingQueryKeys;
  listenerRef.current.queryClient = queryClient;

  useEffect(() => {
    if (activeTopic === null) {
      return;
    }
    const listener = listenerRef.current;
    const release = acquireChannel(activeTopic, listener);
    return () => {
      release();
      setStatus('connecting');
    };
  }, [activeTopic]);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (activeTopic === null) return;
      const entry = registry.get(activeTopic);
      if (!entry || entry.status !== 'live' || !entry.channel) return;
      void entry.channel.send({ type: 'broadcast', event, payload });
    },
    [activeTopic]
  );

  return { status, send };
}
