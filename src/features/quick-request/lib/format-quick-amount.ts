import { QUICK_REQUEST_AMOUNT_MAX } from '../schemas/quick-request-workflow';

/** plan 89 K12 — 퀵 금액 표기 `20,000원`(공백 없음) · 없으면 「—」 */
const amountFormatter = new Intl.NumberFormat('ko-KR');

export function formatQuickAmountWon(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) {
    return '—';
  }
  return `${amountFormatter.format(amount)}원`;
}

/** 입력 중 천 단위 콤마 — 숫자 이외 문자는 버린다 (`20000` → `20,000`) */
export function formatQuickAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) {
    return '';
  }
  const capped = digits.slice(0, String(QUICK_REQUEST_AMOUNT_MAX).length);
  return amountFormatter.format(Number(capped));
}

/** 입력 문자열 → 원 단위 정수 · 비어 있으면 null */
export function parseQuickAmountInput(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return Number(digits);
}
