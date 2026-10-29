/**
 * 전화번호 공통 규칙 (plan 97 D-10 · 퀵·사용자·프로필·계약서 공용).
 * 숫자만 9~11자리 (02-XXX-XXXX · 02-XXXX-XXXX · 0XX-XXX-XXXX · 0XX-XXXX-XXXX). 국제전화·`+82`는 Out.
 */
export const PHONE_REGEX = /^\d{9,11}$/;

export const PHONE_MIN_DIGITS = 9;
export const PHONE_MAX_DIGITS = 11;

/** 숫자만 남기고 `PHONE_MAX_DIGITS`로 자른다 (하이픈·공백 입력 허용) */
export function parsePhoneDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

/**
 * 표시 형식 — 02는 2자리 지역번호(02-123-4567 / 02-1234-5678), 그 외 3자리(031-123-4567 / 010-1234-5678).
 * 9자리 비-02(국번 불명)·9~11자리 밖은 입력값을 그대로 돌려준다.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const digits = parsePhoneDigits(phone);
  if (!PHONE_REGEX.test(digits)) {
    return phone;
  }

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    if (digits.length === 10) {
      return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return phone;
}
