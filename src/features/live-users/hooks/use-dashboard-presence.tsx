'use client';

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { useNavAccess } from '@/contexts/nav-access';
import type { AuthProfile } from '@/features/auth/api/types';
import { createClient } from '@/lib/supabase/client';
import type { LiveUserPresence, LiveUserTrackPayload } from '../api/types';
import { DASHBOARD_PRESENCE_CHANNEL } from '../lib/constants';
import { dedupeSortAndFilterVisible } from '../lib/dedupe-sort';

interface DashboardPresenceContextValue {
  users: LiveUserPresence[];
  isSynced: boolean;
}

const DashboardPresenceContext = createContext<DashboardPresenceContextValue | null>(null);

function parsePresenceState(state: RealtimePresenceState<LiveUserTrackPayload>): LiveUserPresence[] {
  const raw: LiveUserTrackPayload[] = [];

  for (const presences of Object.values(state)) {
    for (const presence of presences ?? []) {
      if (presence.user_id) {
        raw.push({
          ...presence,
          system_role: presence.system_role ?? 'user'
        });
      }
    }
  }

  return dedupeSortAndFilterVisible(raw);
}

function buildTrackPayload(profile: AuthProfile): LiveUserTrackPayload {
  return {
    user_id: profile.user_id,
    full_name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    system_role: profile.system_role
  };
}

interface DashboardPresenceProviderProps {
  profile: AuthProfile;
  children: ReactNode;
}

export function DashboardPresenceProvider({
  profile,
  children
}: DashboardPresenceProviderProps) {
  const liveProfile = useNavAccess();
  const effectiveProfile = liveProfile ?? profile;
  const [users, setUsers] = useState<LiveUserPresence[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const profileRef = useRef(effectiveProfile);
  const lastTrackedRef = useRef<Pick<LiveUserTrackPayload, 'full_name' | 'avatar_url'> | null>(
    null
  );

  useEffect(() => {
    profileRef.current = effectiveProfile;
  }, [effectiveProfile]);

  const syncPresenceState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) {
      return;
    }

    let parsed = parsePresenceState(channel.presenceState<LiveUserTrackPayload>());
    const tracked = lastTrackedRef.current;
    const currentProfile = profileRef.current;

    if (
      tracked &&
      currentProfile.user_id &&
      !parsed.some((user) => user.user_id === currentProfile.user_id)
    ) {
      parsed = dedupeSortAndFilterVisible([
        ...parsed,
        buildTrackPayload(currentProfile)
      ]);
    }

    setUsers(parsed);
    setIsSynced(true);
  }, []);

  useEffect(() => {
    if (profile.status === 'inactive') {
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let subscribed = false;

    const teardownChannel = () => {
      const channel = channelRef.current;
      channelRef.current = null;
      lastTrackedRef.current = null;
      setUsers([]);
      setIsSynced(false);
      subscribed = false;

      if (channel) {
        void (async () => {
          try {
            await channel.untrack();
            await channel.unsubscribe();
          } catch {
            // tab may already be closing
          }
          try {
            await supabase.removeChannel(channel);
          } catch {
            // ignore
          }
        })();
      }
    };

    const setupChannel = async (accessToken: string) => {
      if (cancelled || subscribed || channelRef.current) {
        return;
      }

      await supabase.realtime.setAuth(accessToken);

      if (cancelled) {
        return;
      }

      const channel = supabase.channel(DASHBOARD_PRESENCE_CHANNEL, {
        config: {
          private: true,
          presence: {
            key: profile.user_id
          }
        }
      });

      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, syncPresenceState)
        .on('presence', { event: 'join' }, syncPresenceState)
        .on('presence', { event: 'leave' }, syncPresenceState)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            const payload = buildTrackPayload(profileRef.current);
            const trackStatus = await channel.track(payload);

            if (trackStatus !== 'ok') {
              subscribed = false;
              teardownChannel();
              return;
            }

            lastTrackedRef.current = {
              full_name: payload.full_name,
              avatar_url: payload.avatar_url
            };
            syncPresenceState();
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            subscribed = false;
            teardownChannel();
            if (!cancelled) {
              window.setTimeout(() => {
                void setupChannel(accessToken);
              }, 2_000);
            }
          }
        });
    };

    void (async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (session?.access_token) {
          await setupChannel(session.access_token);
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    })();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session?.access_token) {
        return;
      }

      void setupChannel(session.access_token);
    });

    const handleLeave = () => {
      teardownChannel();
    };

    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      teardownChannel();
    };
  }, [profile.status, profile.user_id, syncPresenceState]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || profile.status === 'inactive') {
      return;
    }

    const payload = buildTrackPayload(effectiveProfile);
    const previous = lastTrackedRef.current;

    if (!previous) {
      return;
    }

    if (
      previous.full_name === payload.full_name &&
      previous.avatar_url === payload.avatar_url
    ) {
      return;
    }

    lastTrackedRef.current = {
      full_name: payload.full_name,
      avatar_url: payload.avatar_url
    };
    void channel.track(payload);
  }, [effectiveProfile.avatar_url, effectiveProfile.full_name, profile.status]);

  useEffect(() => {
    if (isSynced) {
      document.documentElement.dataset.presenceSynced = 'true';
    } else {
      delete document.documentElement.dataset.presenceSynced;
    }

    return () => {
      delete document.documentElement.dataset.presenceSynced;
    };
  }, [isSynced]);

  const value = useMemo(
    () => ({
      users,
      isSynced
    }),
    [isSynced, users]
  );

  return (
    <DashboardPresenceContext value={value}>{children}</DashboardPresenceContext>
  );
}

export function useDashboardPresence(): DashboardPresenceContextValue {
  const context = use(DashboardPresenceContext);

  if (!context) {
    throw new Error('useDashboardPresence must be used within DashboardPresenceProvider');
  }

  return context;
}
