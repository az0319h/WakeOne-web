'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNavAccess, useNavProfilePatch } from '@/contexts/nav-access';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/features/auth/api/service';
import { notifyError } from '@/lib/notify';
import type { AuthProfile } from '@/features/auth/api/types';

interface ProfileStatusRealtimeProps {
  profile: AuthProfile;
}

export function ProfileStatusRealtime({ profile }: ProfileStatusRealtimeProps) {
  const router = useRouter();
  const liveProfile = useNavAccess();
  const patchProfile = useNavProfilePatch();
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = liveProfile ?? profile;
  }, [liveProfile, profile]);

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
            const next = payload.new as {
              status?: string;
              full_name?: string | null;
              avatar_url?: string | null;
            };
            const current = profileRef.current;

            if (next.status === 'inactive') {
              void (async () => {
                notifyError('비활성화된 계정입니다.');
                await signOut();
                router.replace('/auth/sign-in?accountDisabled=1');
                router.refresh();
              })();
              return;
            }

            const fullNameChanged =
              next.full_name !== undefined &&
              (next.full_name ?? null) !== (current.full_name ?? null);
            const avatarChanged =
              next.avatar_url !== undefined &&
              (next.avatar_url ?? null) !== (current.avatar_url ?? null);

            if (fullNameChanged || avatarChanged) {
              patchProfile({
                ...(fullNameChanged ? { full_name: next.full_name ?? '' } : {}),
                ...(avatarChanged ? { avatar_url: next.avatar_url ?? null } : {})
              });
              router.refresh();
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
  }, [patchProfile, profile.status, profile.user_id, router]);

  return null;
}
