import type { AuthProfile } from '@/features/auth/api/types';

export function getProfileDisplayName(
  profile: Pick<AuthProfile, 'email' | 'full_name'>
) {
  const fullName = profile.full_name?.trim() ?? '';
  return fullName.length > 0 ? fullName : profile.email;
}
