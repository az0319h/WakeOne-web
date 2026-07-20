import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/** 절대 시각 표준 패턴 — 예: `2026-07-20 (월) 18:00:14` */
const ABSOLUTE_DATETIME_PATTERN = 'yyyy-MM-dd (EEE) HH:mm:ss';

/**
 * 대시보드·로그·알림 등 시각(날짜+시간) 표시의 **유일한** 포맷터.
 * `@/lib/format-datetime` 외 feature별 datetime 포맷 함수 추가 금지.
 */
export function formatAbsoluteDateTimeKo(date: string | Date): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return typeof date === 'string' ? date : '';
  }

  return format(parsed, ABSOLUTE_DATETIME_PATTERN, { locale: ko });
}
