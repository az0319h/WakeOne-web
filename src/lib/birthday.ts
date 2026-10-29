import { z } from 'zod';

export const BIRTHDAY_MIN_YEAR = 1900;
const BIRTHDAY_MIN = '1900-01-01';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

export function isBirthdayInRange(value: string): boolean {
  return isValidCalendarDate(value) && value >= BIRTHDAY_MIN && value <= todayDateString();
}

export type BirthdayParts = {
  year: number;
  month: number;
  day: number;
};

/**
 * Coerce API/DB birthday strings (YYYY-MM-DD or ISO datetime) to YYYY-MM-DD.
 * Returns null when the date part is missing or not a real calendar date.
 */
export function normalizeBirthdayToDateString(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) {
    return null;
  }

  const datePart = value.trim().slice(0, 10);
  if (!isValidCalendarDate(datePart)) {
    return null;
  }

  return datePart;
}

export function parseBirthdayParts(value: string | null | undefined): BirthdayParts | null {
  const normalized = normalizeBirthdayToDateString(value);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  return { year, month, day };
}

export function composeBirthdayString(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) {
    return null;
  }

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidCalendarDate(iso) ? iso : null;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getBirthdayYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= BIRTHDAY_MIN_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
}

export function getBirthdayMonthOptions(year: number | null): number[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const maxMonth = year === currentYear ? currentMonth : 12;
  return Array.from({ length: maxMonth }, (_, i) => i + 1);
}

export function getBirthdayDayOptions(year: number | null, month: number | null): number[] {
  if (!year || !month) {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }

  const maxDay = getDaysInMonth(year, month);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();
  const limit =
    year === currentYear && month === currentMonth ? Math.min(maxDay, currentDay) : maxDay;

  return Array.from({ length: limit }, (_, i) => i + 1);
}

export function clampBirthdayParts(parts: BirthdayParts): BirthdayParts {
  const yearOptions = getBirthdayYearOptions();
  let year = parts.year;
  if (!yearOptions.includes(year)) {
    year = yearOptions[0] ?? BIRTHDAY_MIN_YEAR;
  }

  const monthOptions = getBirthdayMonthOptions(year);
  let month = parts.month;
  if (!monthOptions.includes(month)) {
    month = monthOptions[monthOptions.length - 1] ?? 1;
  }

  const dayOptions = getBirthdayDayOptions(year, month);
  let day = parts.day;
  if (!dayOptions.includes(day)) {
    day = dayOptions[dayOptions.length - 1] ?? 1;
  }

  return { year, month, day };
}

export const birthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export function refineBirthday(
  value: string | null | undefined,
  ctx: z.RefinementCtx,
  path: [string] = ['birthday']
): void {
  if (value == null) {
    return;
  }

  if (!isValidCalendarDate(value)) {
    ctx.addIssue({
      code: 'custom',
      message: '입력값이 올바르지 않습니다.',
      path
    });
    return;
  }

  if (value < BIRTHDAY_MIN || value > todayDateString()) {
    ctx.addIssue({
      code: 'custom',
      message: '입력값이 올바르지 않습니다.',
      path
    });
  }
}
