import { formatAbsoluteDateKo } from '@/lib/format-date';

/**
 * plan 103 · designer §14-13·14 — 금액·결제일·D-N 표시 (순수 함수).
 * 날짜 문자열은 `formatAbsoluteDateKo`만 쓰고, D-N은 **KST 오늘** 기준(서버·클라이언트 결과가 같게).
 */

const KRW_FORMAT = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0
});

const USD_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** ₩86,000 · $45.00 — 금액 없으면 null */
export function formatLedgerMoney(
  amount: number | null | undefined,
  currency: 'KRW' | 'USD' | null | undefined
): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  return currency === 'USD' ? USD_FORMAT.format(amount) : KRW_FORMAT.format(amount);
}

/** 구독 표 「결제」 칸 1줄 — 「₩86,000 / 월」 · 「매월 다름」 · 「—」 */
export function formatPaymentLine(item: {
  amount: number | null;
  currency: 'KRW' | 'USD' | null;
  amount_varies: boolean;
  billing_cycle: 'monthly' | 'yearly' | null;
}): string {
  if (item.amount_varies) return '매월 다름';
  const money = formatLedgerMoney(item.amount, item.currency);
  if (!money) return '—';
  if (item.billing_cycle === 'monthly') return `${money} / 월`;
  if (item.billing_cycle === 'yearly') return `${money} / 연`;
  return money;
}

/** 결제일 — 월이면 「매월 24일」, 연이면 날짜 */
export function formatBillingDay(
  cycle: 'monthly' | 'yearly' | null,
  day: number | null,
  date: string | null
): string {
  if (cycle === 'yearly' && date) return formatAbsoluteDateKo(date);
  if (day !== null && day !== undefined) return `매월 ${day}일`;
  if (date) return formatAbsoluteDateKo(date);
  return '—';
}

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** KST 오늘 `yyyy-MM-dd` */
export function kstTodayString(now: Date = new Date()): string {
  return KST_DATE_FORMAT.format(now);
}

function toUtcDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** 날짜까지 남은 일수(KST 오늘 기준) — 지난 날짜는 음수 · 형식 오류 null */
export function daysFromKstToday(date: string, now: Date = new Date()): number | null {
  const target = toUtcDay(date);
  const today = toUtcDay(kstTodayString(now));
  if (target === null || today === null) return null;
  return Math.round((target - today) / 86_400_000);
}

/** 만료·갱신일이 30일 이내(0~30)면 「D-N」 */
export const ASSET_DDAY_WINDOW_DAYS = 30;

export function formatDdayLabel(date: string | null | undefined, now: Date = new Date()): string | null {
  if (!date) return null;
  const days = daysFromKstToday(date, now);
  if (days === null || days < 0 || days > ASSET_DDAY_WINDOW_DAYS) return null;
  return `D-${days}`;
}
