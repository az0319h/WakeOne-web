import type { AuthProfile } from '@/features/auth/api/types';

/**
 * plan 89 — 퀵 업무 권한 판별 (순수 함수 · proxy/Route/Server Component 공용).
 * DB 판정 함수 `private.can_view_all_quick_requests`와 같은 규칙이다.
 * `server-only`를 붙이지 않는다 — proxy(edge)·benefits-access.server.ts 선례와 같다.
 * 권한을 바꾸면 `src/features/quick-request/info-content.ts`(plan 90 ⓘ 안내 문구)도 같이 고칠 것.
 */

export type QuickAccessProfile = Pick<AuthProfile, 'system_role' | 'affiliation' | 'rank'> & {
  status?: AuthProfile['status'];
};

export function isDongbang(profile: Pick<AuthProfile, 'affiliation'> | null | undefined): boolean {
  return profile?.affiliation === 'dongbang';
}

export function isQuickAdmin(profile: Pick<AuthProfile, 'system_role'>): boolean {
  return profile.system_role === 'admin';
}

/** 웨이크 구매물류팀 — 전체 조회만 (D-11) */
export function isLogisticsViewer(profile: QuickAccessProfile): boolean {
  return (
    profile.system_role === 'user' &&
    profile.affiliation === 'wake' &&
    profile.rank === '구매물류팀'
  );
}

/** 전체 조회(viewer-all): admin · 동방특송 · 구매물류팀 */
export function canViewAllQuickRequests(profile: QuickAccessProfile): boolean {
  return isQuickAdmin(profile) || isDongbang(profile) || isLogisticsViewer(profile);
}

/** 운영(접수·배차·수정·최종금액·취소·다시 보내기): admin · 동방특송 (D-10) */
export function canOperateQuickRequests(profile: QuickAccessProfile): boolean {
  return isQuickAdmin(profile) || isDongbang(profile);
}

/** 등록: active 직원·admin. 동방특송 불가 (D-6) */
export function canCreateQuickRequest(profile: QuickAccessProfile): boolean {
  return !isDongbang(profile);
}
