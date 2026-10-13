import { compareYearMonth } from '@/lib/kst';
import { currentKstMonth, isValidBenefitsMonth } from './kst-month';

export const BENEFITS_EARLIEST_MONTH = '2026-10';

export function resolveBenefitsViewMonth(raw: string | null | undefined): string {
  const current = currentKstMonth();
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return current;
  }
  if (!isValidBenefitsMonth(trimmed)) {
    return current;
  }
  if (compareYearMonth(trimmed, BENEFITS_EARLIEST_MONTH) < 0) {
    return current;
  }
  if (compareYearMonth(trimmed, current) > 0) {
    return current;
  }
  return trimmed;
}

export function isBenefitsMonthAtEarliest(month: string): boolean {
  return compareYearMonth(month, BENEFITS_EARLIEST_MONTH) <= 0;
}

export function isBenefitsMonthAtLatest(month: string): boolean {
  return compareYearMonth(month, currentKstMonth()) >= 0;
}

export function normalizeBenefitsMonth(value: string | null | undefined): string {
  return resolveBenefitsViewMonth(value);
}
