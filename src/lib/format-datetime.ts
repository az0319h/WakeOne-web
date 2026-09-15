import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/** WakeOne 대시보드·이메일 등 표시 기준 IANA 타임존 */
const DISPLAY_TIME_ZONE = 'Asia/Seoul';

/** 절대 시각 표준 패턴 — 예: `2026-07-20 (월) 18:00:14` */
const ABSOLUTE_DATETIME_PATTERN = 'yyyy-MM-dd (EEE) HH:mm:ss';

/**
 * 대시보드·로그·알림·이메일 등 시각(날짜+시간) 표시의 **유일한** 포맷터.
 * 실행 환경(브라우저/Vercel UTC)과 무관하게 **Asia/Seoul(KST)** 기준으로 포맷한다.
 * `@/lib/format-datetime` 외 feature별 datetime 포맷 함수 추가 금지.
 */
export function formatAbsoluteDateTimeKo(date: string | Date): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return typeof date === 'string' ? date : '';
  }

  const kstDate = new TZDate(parsed, DISPLAY_TIME_ZONE);

  return format(kstDate, ABSOLUTE_DATETIME_PATTERN, { locale: ko });
}
