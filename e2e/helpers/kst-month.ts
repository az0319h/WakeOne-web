export function currentKstMonthForE2e(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit'
  })
    .format(new Date())
    .slice(0, 7);
}

export function kstMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${year}년 ${Number(monthNumber)}월`;
}

/** nuqs default month omits query param — treat absent as KST 당월 */
export function effectiveMonthSearchParam(
  page: import('@playwright/test').Page,
  defaultMonth = currentKstMonthForE2e()
): string {
  return new URL(page.url()).searchParams.get('month') ?? defaultMonth;
}
