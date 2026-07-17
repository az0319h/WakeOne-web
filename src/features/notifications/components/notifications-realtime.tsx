'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { AuthProfile } from '@/features/auth/api/types';
import { notificationKeys } from '../api/keys';

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
          () => {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
