import type { AuthProfile } from '@/features/auth/api/types';

export function canAccessAssetLedger(
  profile: Pick<AuthProfile, 'system_role' | 'affiliation'>
): boolean {
  return profile.system_role === 'admin' || profile.affiliation === 'wake';
}

export const ASSET_LEDGER_ACCESS_DENIED_MESSAGE =
  '비품 대장은 웨이크 소속 또는 관리자만 이용할 수 있습니다.';
