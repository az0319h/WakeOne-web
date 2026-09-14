import type { SystemRole } from '@/features/auth/api/types';

export type LiveUserTrackPayload = {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  system_role: SystemRole;
};

export type LiveUserPresence = LiveUserTrackPayload;
