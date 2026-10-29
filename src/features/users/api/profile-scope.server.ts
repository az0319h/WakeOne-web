import 'server-only';

import { EXCLUDE_DONGBANG_OR_FILTER } from '@/features/users/constants/organization';

/**
 * plan 95 — `profiles` 목록·매칭 쿼리의 동방특송 노출 범위 단일 진입점 (D-1 서버 기본 거부).
 *
 * 기본값은 **제외**(`includeDongbang` 생략·false → `.or(EXCLUDE_DONGBANG_OR_FILTER)`).
 * 동방을 봐야 하는 호출부(사용자 관리 · 활동 로그 「사용자 선택」 · 알림 「타인 보기」 · D-2)만 `{ includeDongbang: true }`를 명시한다.
 *
 * `listUsersForAdmin`처럼 count·data 두 쿼리를 쓰는 곳은 **둘 다** 통과시킨다(page 클램프가 count 기준).
 * 새 profiles 목록·이름 매칭 호출부는 이 함수를 거친다 — plan 95 AC-01 감사표에 등재하지 않은 호출은 FAIL.
 */
export type DongbangScopeOptions = {
  /** true일 때만 동방특송 소속 행을 남긴다. 기본 false(제외) */
  includeDongbang?: boolean;
};

// 제약을 자기참조(`=> T`)로 두면 PostgrestFilterBuilder에서 TS2589(과도한 인스턴스화)가 나므로 반환은 unknown으로 받고 T로 되돌린다
export function applyDongbangScope<T extends { or: (filters: string) => unknown }>(
  query: T,
  options: DongbangScopeOptions = {}
): T {
  if (options.includeDongbang) {
    return query;
  }
  return query.or(EXCLUDE_DONGBANG_OR_FILTER) as T;
}
