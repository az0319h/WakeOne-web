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
