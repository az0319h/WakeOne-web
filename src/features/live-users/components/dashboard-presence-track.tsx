'use client';

import type { AuthProfile } from '@/features/auth/api/types';
import { DashboardPresenceProvider } from '../hooks/use-dashboard-presence';

interface DashboardPresenceTrackProps {
  profile: AuthProfile;
  children: React.ReactNode;
}

export function DashboardPresenceTrack({ profile, children }: DashboardPresenceTrackProps) {
  return <DashboardPresenceProvider profile={profile}>{children}</DashboardPresenceProvider>;
}
