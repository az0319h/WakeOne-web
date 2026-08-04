import 'server-only';

import {
  BIRTHDAY_UPCOMING_WINDOW_DAYS,
  getDaysUntilBirthday,
  isBirthdayWithinUpcomingWindow
} from '@/lib/birthday';
import { getKstTodayDateString } from '@/lib/kst';
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

function toCelebrant(row: ProfileRow): BirthdayCelebrant {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    birthday: row.birthday!
  };
}

export async function getBirthdayCelebrantsServer(): Promise<BirthdayCelebrantsResponse> {
  const referenceDate = getKstTodayDateString();
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
    ?.filter(
      (row) =>
        row.birthday &&
        isBirthdayWithinUpcomingWindow(
          row.birthday,
          referenceDate,
          BIRTHDAY_UPCOMING_WINDOW_DAYS
        )
    )
    .map(toCelebrant)
    .toSorted((a, b) => {
      const daysUntilA = getDaysUntilBirthday(a.birthday, referenceDate) ?? Number.MAX_SAFE_INTEGER;
      const daysUntilB = getDaysUntilBirthday(b.birthday, referenceDate) ?? Number.MAX_SAFE_INTEGER;
      const daysDiff = daysUntilA - daysUntilB;

      if (daysDiff !== 0) {
        return daysDiff;
      }

      return a.full_name.localeCompare(b.full_name, 'ko');
    });

  return {
    referenceDate,
    windowDays: BIRTHDAY_UPCOMING_WINDOW_DAYS,
    celebrants: celebrants ?? []
  };
}
