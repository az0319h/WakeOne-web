'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { AuthProfile } from '@/features/auth/api/types';
import { notificationKeys } from '../api/keys';
import { assetRequestKeys } from '@/features/asset-requests/api/keys';

interface NotificationsRealtimeProps {
  profile: AuthProfile;
}

export function NotificationsRealtime({ profile }: NotificationsRealtimeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile.status === 'inactive') {
      return;
    }

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

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

      channel = supabase
        .channel(`notifications-${profile.user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${profile.user_id}`
          },
          (payload: { new?: { type?: unknown } }) => {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            // plan 103 — 구독·비품 요청 알림이 오면 사이드바·전환 배지(summary)도 갱신
            if (typeof payload.new?.type === 'string' && payload.new.type.startsWith('asset_request.')) {
              void queryClient.invalidateQueries({ queryKey: assetRequestKeys.summary() });
            }
          }
        )
        .subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [profile.status, profile.user_id, queryClient]);

  return null;
}
