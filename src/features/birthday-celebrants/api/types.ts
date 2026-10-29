import type { OrgAffiliation } from '@/features/users/constants/organization';

/**
 * plan 102 — overview 생일 휠 목록 1줄.
 * 개인정보 최소화: 생일 연도·email·phone 미포함(D-10).
 */
export type BirthdayCelebrant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  /** 동방특송은 서버에서 제외(plan 95) · null = 소속 없음(「전체」 탭에만) */
  affiliation: OrgAffiliation | null;
  /** `MM-DD` — 연도 없음 */
  month_day: string;
  /** 기준일(KST) 대비 앞뒤 반년 순환 · 0 = 오늘 · 양수 = 남은 날 · 음수 = 지난 날 (D-3) */
  days_offset: number;
};

export type BirthdayCelebrantsResponse = {
  /** KST 오늘 `YYYY-MM-DD` */
  referenceDate: string;
  /** `days_offset` 오름차순 → `full_name` 가나다 */
  celebrants: BirthdayCelebrant[];
};
