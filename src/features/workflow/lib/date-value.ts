/**
 * DATE 입력값(`yyyy-MM-dd`) ↔ Calendar `Date` 변환. 표시는 `@/lib/format-date`만 쓴다.
 */
import { formatAbsoluteDateKo } from '@/lib/format-date';

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `yyyy-MM-dd` → 로컬 자정 Date (형식이 틀리면 undefined) */
export function parseWorkflowDateValue(value: string | null | undefined): Date | undefined {
  const match = value ? YMD_PATTERN.exec(value.trim()) : null;
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Calendar Date(로컬) → `yyyy-MM-dd` */
export function toWorkflowDateValue(date: Date): string {
  return formatAbsoluteDateKo(date);
}

/** 화면 표시용 `yyyy-MM-dd` (값이 날짜가 아니면 원문) */
export function formatWorkflowDateValue(value: string): string {
  const date = parseWorkflowDateValue(value);
  return date ? formatAbsoluteDateKo(date) : value;
}
