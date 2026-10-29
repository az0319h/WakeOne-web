'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { quickRequestKeys } from '../api/keys';
import { useQuickRealtimeChannel } from '../lib/use-quick-realtime-channel';

/** INSERT·UPDATE가 몰려도 React Query invalidate는 300ms에 1회 (plan 92 리스크 MED · plan 94 D-3 유지) */
const QUICK_REQUEST_REALTIME_DEBOUNCE_MS = 300;

type QuickRequestRealtimeProps = {
  /**
   * 대시보드: `quick-requests:all`(viewer-all) 또는 `quick-user:{uid}` — 서버 page가 권한 판정 후 넘긴다.
   * 상세: `quick-request:{id}` — detail 조회 뒤 `id`로 만든다.
   */
  topic: string | null;
  /** 상세에서만 전달 — `detail(no)`를 invalidate한다 (없으면 `details()` 전체) */
  requestNo?: string;
};

/**
 * plan 94 D-3 — 퀵 private Broadcast 구독 → 목록·카드·상세 invalidate (payload 본문 없음 · 신호로만).
 * 구독 실패 시 공용 훅이 5초 polling으로 같은 query를 돌린다(D-4). 시각 효과 없이 조용히 갱신한다(plan 92 U-5).
 */
export function QuickRequestRealtime({ topic, requestNo }: QuickRequestRealtimeProps) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollingQueryKeys = useMemo(
    () => [
      quickRequestKeys.lists(),
      quickRequestKeys.summaries(),
      requestNo ? quickRequestKeys.detail(requestNo) : quickRequestKeys.details()
    ],
    [requestNo]
  );

  const invalidate = useCallback(() => {
    timerRef.current = null;
    for (const queryKey of pollingQueryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [pollingQueryKeys, queryClient]);

  const onEvent = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(invalidate, QUICK_REQUEST_REALTIME_DEBOUNCE_MS);
  }, [invalidate]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  useQuickRealtimeChannel({ topic, onEvent, pollingQueryKeys });

  return null;
}
