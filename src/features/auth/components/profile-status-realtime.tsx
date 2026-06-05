'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/features/auth/api/service';
import { notifyError } from '@/lib/notify';
import type { AuthProfile } from '@/features/auth/api/types';

interface ProfileStatusRealtimeProps {
  profile: AuthProfile;
}

export function ProfileStatusRealtime({ profile }: ProfileStatusRealtimeProps) {
  const router = useRouter();

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
        .channel(`profile-status-${profile.user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${profile.user_id}`
          },
          (payload) => {
            const next = payload.new as { status?: string };
            if (next.status !== 'inactive') {
              return;
            }

            void (async () => {
              notifyError('비활성화된 계정입니다.');
              await signOut();
              router.replace('/auth/sign-in?accountDisabled=1');
              router.refresh();
            })();
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
  }, [profile.status, profile.user_id, router]);

  return null;
}
