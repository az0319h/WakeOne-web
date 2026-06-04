import type { AuthProfile } from '@/features/auth/api/types';

export function getProfileDisplayName(profile: Pick<AuthProfile, 'email' | 'first_name' | 'last_name'>) {
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  return fullName.length > 0 ? fullName : profile.email;
}
