/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function getKstTodayDateString(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const date = formatter.format(now);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Failed to resolve KST today date');
  }

  return date;
}

export function getKstYearMonth(now = new Date()): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric'
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  if (!year || !month) {
    throw new Error('Failed to resolve KST year and month');
  }

  return { year, month };
}

/** ISO 시각을 KST 기준 `YYYY-MM`으로 변환 */
export function getKstYearMonthString(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const { year, month } = getKstYearMonth(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** `YYYY-MM` 문자열 비교 (a가 b보다 이전이면 음수) */
export function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}
