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

/** plan 106 D-14 — 퀵 대화 말풍선·대화 안 시스템 줄 (`16:03`) */
const CHAT_BUBBLE_TIME_PATTERN = 'HH:mm';
/** plan 106 D-14 — 퀵 대화 목록: KST 오늘 `HH:mm` / 같은 해 `MM-dd` / 이전 해 `yyyy-MM-dd` */
const CHAT_LIST_SAME_YEAR_PATTERN = 'MM-dd';
const CHAT_LIST_OTHER_YEAR_PATTERN = 'yyyy-MM-dd';
const KST_DAY_KEY_PATTERN = 'yyyy-MM-dd';

function toValidDate(date: string | Date | number): Date | null {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * **퀵 대화 전용 예외 (plan 106 D-14 · core-conventions 「퀵 대화 예외」)** — 말풍선·대화 안 시스템 줄 시각 `HH:mm` (KST).
 * 날짜는 위 날짜 구분선(`yyyy-MM-dd`)이 알려 준다. 상대 표현(「분 전」「방금」「어제」)은 쓰지 않는다.
 * 잘못된 입력은 `''`. 퀵 대화 밖(상세·이력·알림·내역 카드)은 `formatAbsoluteDateTimeKo`를 쓴다.
 */
export function formatChatBubbleTimeKo(date: string | Date): string {
  const parsed = toValidDate(date);
  if (!parsed) {
    return '';
  }

  return format(new TZDate(parsed, DISPLAY_TIME_ZONE), CHAT_BUBBLE_TIME_PATTERN, { locale: ko });
}

/**
 * **퀵 대화 전용 예외 (plan 106 D-14)** — 대화 목록 항목 시각. KST 날짜 기준으로
 * 오늘 `HH:mm` · 같은 해 `MM-dd` · 이전 해(또는 미래 해) `yyyy-MM-dd`. 상대 표현 없음.
 * `now`는 테스트·고정 기준용(기본 지금). 잘못된 `date`는 `''`, 잘못된 `now`는 지금으로 대체.
 */
export function formatChatListTimeKo(date: string | Date, now: Date = new Date()): string {
  const parsed = toValidDate(date);
  if (!parsed) {
    return '';
  }

  const kstDate = new TZDate(parsed, DISPLAY_TIME_ZONE);
  const kstNow = new TZDate(toValidDate(now) ?? new Date(), DISPLAY_TIME_ZONE);

  if (format(kstDate, KST_DAY_KEY_PATTERN) === format(kstNow, KST_DAY_KEY_PATTERN)) {
    return format(kstDate, CHAT_BUBBLE_TIME_PATTERN, { locale: ko });
  }

  if (kstDate.getFullYear() === kstNow.getFullYear()) {
    return format(kstDate, CHAT_LIST_SAME_YEAR_PATTERN, { locale: ko });
  }

  return format(kstDate, CHAT_LIST_OTHER_YEAR_PATTERN, { locale: ko });
}
