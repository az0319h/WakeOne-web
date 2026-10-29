import type { AuthProfile } from '@/features/auth/api/types';

/**
 * plan 103 — 구독·비품 관리 권한자 판정 (순수 함수 · Route/Server Component/layout 공용).
 * SQL `private.is_asset_manager(uid)`(supabase/sql/99)와 **같은 규칙**이다:
 *   status = active AND (system_role = admin OR (system_role = user AND affiliation = wake AND rank ∈ {인사팀, 회계팀}))
 * `server-only`를 붙이지 않는다 — quick-access.server.ts · benefits-access.server.ts 선례와 같다.
 * 부서가 바뀌면 다음 요청부터 반영된다(plan 76 방식 · 세션 프로필을 매번 다시 읽음).
 */

export const ASSET_MANAGER_RANKS = ['인사팀', '회계팀'] as const;

export type AssetAccessProfile = Pick<AuthProfile, 'system_role' | 'affiliation' | 'rank'> & {
  status?: AuthProfile['status'] | string | null;
};

export function isAssetManager(profile: AssetAccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.status !== undefined && profile.status !== 'active') return false;
  if (profile.system_role === 'admin') return true;
  return (
    profile.system_role === 'user' &&
    profile.affiliation === 'wake' &&
    typeof profile.rank === 'string' &&
    (ASSET_MANAGER_RANKS as readonly string[]).includes(profile.rank)
  );
}

/** 권한 없음 응답 문구 (AC-05) */
export const ASSET_MANAGER_REQUIRED_MESSAGE = '권한이 없습니다.';
