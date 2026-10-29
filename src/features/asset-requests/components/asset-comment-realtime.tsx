'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { assetRequestKeys } from '../api/keys';

type AssetCommentRealtimeProps = {
  requestId: number;
  enabled: boolean;
};

/**
 * 댓글 Realtime (plan D-19 · AC-35) — `asset_request_comments` INSERT/UPDATE · filter `request_id`.
 * RLS로 요청자·권한자만 받는다. payload에는 작성자 이름이 없어 받으면 댓글·요청 단건을 invalidate한다
 * (같은 행 이벤트가 여러 번 와도 invalidate는 멱등). Dialog가 요청 화면일 때만 구독 · unmount 시 해제.
 */
export function AssetCommentRealtime({ requestId, enabled }: AssetCommentRealtimeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    function refresh() {
      void queryClient.invalidateQueries({ queryKey: assetRequestKeys.comments(requestId) });
      void queryClient.invalidateQueries({
        queryKey: assetRequestKeys.detail(requestId),
        exact: true
      });
    }

    const setup = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`asset-request-comments-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'asset_request_comments',
            filter: `request_id=eq.${requestId}`
          },
          refresh
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'asset_request_comments',
            filter: `request_id=eq.${requestId}`
          },
          refresh
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, requestId]);

  return null;
}
