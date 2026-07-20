import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { normalizeBirthdayToDateString } from '@/lib/birthday';

/** 절대 날짜 표준 패턴 — 예: `2026-07-20` */
const ABSOLUTE_DATE_PATTERN = 'yyyy-MM-dd';

/**
 * 대시보드·계약·필터 등 **날짜만** 표시의 **유일한** 일반 포맷터.
 * `@/lib/format-date` 외 feature별 date 포맷 함수·`toLocaleDateString` 직접 호출 금지.
 */
export function formatAbsoluteDateKo(date: string | Date): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return typeof date === 'string' ? date : '';
  }

  return format(parsed, ABSOLUTE_DATE_PATTERN, { locale: ko });
}

export function formatAbsoluteDateKoOrPlaceholder(
  value: string | Date | null | undefined,
  placeholder = '-'
): string {
  if (value === null || value === undefined || value === '') {
    return placeholder;
  }

  const formatted = formatAbsoluteDateKo(value);
  return formatted || placeholder;
}

/**
 * 생일 전체 표시 — 예: `1990년 7월 20일`
 */
export function formatBirthdayDisplay(
  birthday: string | null | undefined
): string | null {
  const normalized = normalizeBirthdayToDateString(birthday);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 생일 월·일만 — 예: `7월 20일`
 */
export function formatBirthdayMonthDay(
  birthday: string | null | undefined
): string | null {
  const normalized = normalizeBirthdayToDateString(birthday);
  if (!normalized) {
    return null;
  }

  const [, monthStr, dayStr] = normalized.split('-');
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!month || !day) {
    return null;
  }

  return `${month}월 ${day}일`;
}
