import type { AuthProfile } from '@/features/auth/api/types';

export type BenefitsAccessProfile = Pick<
  AuthProfile,
  'system_role' | 'affiliation' | 'rank'
>;

export function isWakeHrBenefitsManager(profile: BenefitsAccessProfile): boolean {
  return (
    profile.system_role === 'user' &&
    profile.affiliation === 'wake' &&
    profile.rank === '인사팀'
  );
}

export function canAccessBenefitsAdmin(profile: BenefitsAccessProfile): boolean {
  return profile.system_role === 'admin' || isWakeHrBenefitsManager(profile);
}
