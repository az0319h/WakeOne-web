/**
 * 생일 「M월 d일」 포맷 순수 구현 (plan 102 — `MM-DD` 입력 추가).
 * **호출부는 `@/lib/format-date`의 `formatBirthdayMonthDay`로 import한다** (date 포맷 단일 진입점 규칙).
 * 이 파일은 import가 없다 — `node --test`에서 직접 불러 쓰기 위함(AC-19 ⑩).
 */

const MONTH_DAY_REGEX = /^(\d{2})-(\d{2})$/;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
/** `MM-DD` 유효성 검사용 윤년 (02-29 허용) */
const LEAP_YEAR_FOR_VALIDATION = 2000;

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * 생일 월·일만 — 예: `7월 20일`.
 * 입력: `MM-DD` · `YYYY-MM-DD` · ISO datetime(앞 10자). 실제 달력 날짜가 아니면 null.
 */
export function formatBirthdayMonthDay(birthday: string | null | undefined): string | null {
  const trimmed = birthday?.trim();
  if (!trimmed) {
    return null;
  }

  const monthDay = MONTH_DAY_REGEX.exec(trimmed);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    return isRealDate(LEAP_YEAR_FOR_VALIDATION, month, day) ? `${month}월 ${day}일` : null;
  }

  const date = DATE_REGEX.exec(trimmed.slice(0, 10));
  if (!date) {
    return null;
  }

  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);

  return isRealDate(year, month, day) ? `${month}월 ${day}일` : null;
}
