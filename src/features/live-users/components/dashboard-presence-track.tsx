'use client';

import type { AuthProfile } from '@/features/auth/api/types';
import { isDongbangAffiliation } from '@/features/users/constants/organization';
import { DashboardPresenceProvider } from '../hooks/use-dashboard-presence';

interface DashboardPresenceTrackProps {
  profile: AuthProfile;
  children: React.ReactNode;
}

/** plan 89 D-4 — 동방특송은 Live 접속자에 track하지 않는다 (채널 구독 자체를 생략) */
export function DashboardPresenceTrack({ profile, children }: DashboardPresenceTrackProps) {
  return (
    <DashboardPresenceProvider profile={profile} trackEnabled={!isDongbangAffiliation(profile.affiliation)}>
      {children}
    </DashboardPresenceProvider>
  );
}
