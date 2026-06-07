export const PHONE_REGEX = /^\d{11}$/;

export function parsePhoneDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, 11);
}

export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const digits = parsePhoneDigits(phone);

  if (digits.length !== 11) {
    return phone;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
