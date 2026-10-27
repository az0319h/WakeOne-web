'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { quickRequestKeys } from '../api/keys';

/** INSERT·UPDATE가 몰려도 React Query invalidate는 300ms에 1회 (plan 92 리스크 MED) */
const QUICK_REQUEST_REALTIME_DEBOUNCE_MS = 300;

type QuickRequestRealtimeProps = {
  /** 상세에서만 전달 — 그 요청번호의 변경만 받고 `detail(no)`를 invalidate한다 */
  requestNo?: string;
};

/**
 * plan 92 D-7 — `quick_requests` Realtime 구독 → 목록·카드·상세 invalidate.
 * RLS가 그대로 적용돼 볼 권한이 없는 건의 변경은 오지 않는다(AC-21).
 * 시각 효과 없이 조용히 갱신한다(U-5) · `support-comment-realtime.tsx` 패턴(setAuth → subscribe → removeChannel).
 */
export function QuickRequestRealtime({ requestNo }: QuickRequestRealtimeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function invalidate() {
      timer = null;
      if (cancelled) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: quickRequestKeys.summary() });
      void queryClient.invalidateQueries({
        queryKey: requestNo ? quickRequestKeys.detail(requestNo) : quickRequestKeys.details()
      });
    }

    function scheduleInvalidate() {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(invalidate, QUICK_REQUEST_REALTIME_DEBOUNCE_MS);
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

      const filter = requestNo ? `request_no=eq.${requestNo}` : undefined;
      const channelName = requestNo ? `quick-requests-${requestNo}` : 'quick-requests';

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quick_requests', filter },
          scheduleInvalidate
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'quick_requests', filter },
          scheduleInvalidate
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [queryClient, requestNo]);

  return null;
}
