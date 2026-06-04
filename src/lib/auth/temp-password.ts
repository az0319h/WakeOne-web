import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

function pickChar(chars: string): string {
  return chars[randomInt(chars.length)]!;
}

function shuffle(chars: string[]): string[] {
  const copy = [...chars];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** 8자: 대문자·소문자·숫자 각 1자 이상 (Supabase 기본 정책 통과용). */
export function generateTemporaryPassword(length = 8): string {
  if (length < 8) {
    throw new Error('Temporary password length must be at least 8');
  }

  const required = [pickChar(UPPER), pickChar(LOWER), pickChar(DIGITS)];
  const rest = Array.from({ length: length - required.length }, () => pickChar(ALL));
  return shuffle([...required, ...rest]).join('');
}
