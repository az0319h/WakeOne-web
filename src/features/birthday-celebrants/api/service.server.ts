import 'server-only';

import { applyDongbangScope } from '@/features/users/api/profile-scope.server';
import { isOrgAffiliation } from '@/features/users/constants/organization';
import { getKstTodayDateString } from '@/lib/kst';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  getBirthdayDaysOffset,
  sortCelebrants,
  toBirthdayMonthDay
} from '../lib/birthday-order';
import type { BirthdayCelebrant, BirthdayCelebrantsResponse } from './types';

/** `birthday`(연도 포함)는 `month_day`·`days_offset` 계산에만 쓰고 응답에는 넣지 않는다 (plan 102 D-10) */
const CELEBRANT_COLUMNS = 'user_id, full_name, avatar_url, affiliation, birthday';

type ProfileRow = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  affiliation: string | null;
  birthday: string | null;
};

function toCelebrant(row: ProfileRow, referenceDate: string): BirthdayCelebrant | null {
  // 방어: scope 밖 소속(동방 등)은 「소속 없음」으로 섞지 않고 뺀다
  if (row.affiliation !== null && !isOrgAffiliation(row.affiliation)) {
    return null;
  }

  const monthDay = toBirthdayMonthDay(row.birthday);
  if (!monthDay) {
    return null;
  }

  const daysOffset = getBirthdayDaysOffset(monthDay, referenceDate);
  if (daysOffset === null) {
    return null;
  }

  return {
    user_id: row.user_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    affiliation: row.affiliation,
    month_day: monthDay,
    days_offset: daysOffset
  };
}

/**
 * plan 102 — overview 생일 휠 목록 (회사 전체).
 * 대상: active · 동방특송 아님(`applyDongbangScope` · plan 95) · `birthday` 있음.
 * 기준일은 KST 오늘. 정렬은 D-3(`days_offset` → 가나다).
 */
export async function getBirthdayCelebrantsServer(): Promise<BirthdayCelebrantsResponse> {
  const referenceDate = getKstTodayDateString();
  const supabase = getServiceRoleClient();

  const { data, error } = await applyDongbangScope(
    supabase
      .from('profiles')
      .select(CELEBRANT_COLUMNS)
      .eq('status', 'active')
      .not('birthday', 'is', null)
  );

  if (error) {
    throw error;
  }

  const celebrants = ((data as ProfileRow[] | null) ?? []).flatMap((row) => {
    const celebrant = toCelebrant(row, referenceDate);
    return celebrant ? [celebrant] : [];
  });

  return {
    referenceDate,
    celebrants: sortCelebrants(celebrants)
  };
}
