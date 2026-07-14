import { normalizeBirthdayToDateString } from '@/lib/birthday';

export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch {
    return '';
  }
}

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

