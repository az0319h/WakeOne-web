/** 금액 표기 (plan 88) — 상세·인쇄 `194,840 원`, 목록 요약 `₩194,840` */
const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');

function toAmountNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'number' ? String(value) : value.replace(/[,\s원₩]/g, '');
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** `194,840 원` (값이 없으면 빈 문자열) */
export function formatAmountWon(value: string | number | null | undefined): string {
  const amount = toAmountNumber(value);
  return amount === null ? '' : `${KRW_FORMATTER.format(amount)} 원`;
}

/** `₩194,840` (값이 없으면 빈 문자열) */
export function formatAmountWonPrefix(value: string | number | null | undefined): string {
  const amount = toAmountNumber(value);
  return amount === null ? '' : `₩${KRW_FORMATTER.format(amount)}`;
}

/** 입력 중 표시용 천 단위 콤마 (`194840` → `194,840`) */
export function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? KRW_FORMATTER.format(amount) : digits;
}
