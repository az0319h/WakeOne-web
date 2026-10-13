import { compareYearMonth, getKstYearMonthString } from '@/lib/kst';

function isBenefitsAdminRosterProfile(profile: {
  system_role: string;
  position_level: string | null;
  rank: string | null;
}): boolean {
  if (profile.system_role !== 'user') return false;
  if (!profile.position_level) return false;
  if (
    profile.rank === '경영진' &&
    profile.position_level !== 'CEO' &&
    profile.position_level !== 'COO'
  ) {
    return false;
  }
  return true;
}

function isInactiveBenefitsAdminMonth(deactivatedAt: string | null, viewMonth: string): boolean {
  if (!deactivatedAt) return false;
  const deactivatedMonth = getKstYearMonthString(deactivatedAt);
  return compareYearMonth(viewMonth, deactivatedMonth) <= 0;
}

/** plan 79 — 조회 월 M에 명단 포함 여부 (org eligibility는 호출 전 필터) */
export function isBenefitsAdminRosterForViewMonth(
  row: {
    status: string;
    system_role: string;
    position_level: string | null;
    rank: string | null;
    created_at: string;
    deactivated_at: string | null;
  },
  viewMonth: string,
  isActiveOrgEligible: boolean,
): boolean {
  const startMonth = getKstYearMonthString(row.created_at);
  if (compareYearMonth(viewMonth, startMonth) < 0) {
    return false;
  }
  if (row.status === 'active' && isActiveOrgEligible) {
    return true;
  }
  if (
    row.status === 'inactive' &&
    isBenefitsAdminRosterProfile(row) &&
    isInactiveBenefitsAdminMonth(row.deactivated_at, viewMonth)
  ) {
    return true;
  }
  return false;
}
