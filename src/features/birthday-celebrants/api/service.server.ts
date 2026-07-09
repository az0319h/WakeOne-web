import 'server-only';

import { getKstYearMonth } from '@/lib/kst';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { BirthdayCelebrant, BirthdayCelebrantsResponse } from './types';

const CELEBRANT_COLUMNS =
  'user_id, full_name, avatar_url, birthday, status';

type ProfileRow = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  birthday: string | null;
  status: string;
};

function getBirthdayMonth(birthday: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) {
    return null;
  }

  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month : null;
}

function getBirthdayDay(birthday: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  return match ? Number(match[3]) : 0;
}

function toCelebrant(row: ProfileRow): BirthdayCelebrant {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    birthday: row.birthday!
  };
}

export async function getBirthdayCelebrantsServer(): Promise<BirthdayCelebrantsResponse> {
  const { year, month } = getKstYearMonth();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(CELEBRANT_COLUMNS)
    .eq('status', 'active')
    .not('birthday', 'is', null);

  if (error) {
    throw error;
  }

  const celebrants = (data as ProfileRow[] | null)
    ?.filter((row) => row.birthday && getBirthdayMonth(row.birthday) === month)
    .map(toCelebrant)
    .toSorted((a, b) => {
      const dayDiff = getBirthdayDay(a.birthday) - getBirthdayDay(b.birthday);
      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.full_name.localeCompare(b.full_name, 'ko');
    });

  return {
    month,
    year,
    celebrants: celebrants ?? []
  };
}
