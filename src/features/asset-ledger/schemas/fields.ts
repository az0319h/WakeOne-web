import * as z from 'zod';
import { containsSecretLike, SECRET_LIKE_MESSAGE } from '@/lib/secret-like-pattern';

/**
 * plan 103 — 구독·비품 폼/Route 공용 Zod 조각.
 * 폼 값은 빈 문자열('')을 쓰고, 서버 JSON은 null을 쓴다 → 둘 다 받아 null로 정규화한다.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const ASSET_FIELD_MESSAGES = {
  invalidDate: '날짜 형식이 올바르지 않아요.',
  invalidNumber: '금액은 0 이상 숫자로 적어 주세요.',
  invalidEmail: '주계정은 이메일 형식으로 적어 주세요.',
  memoTooLong: '관리 메모는 1000자까지 쓸 수 있어요.',
  nothingToUpdate: '바꿀 내용이 없어요.'
} as const;

export function emptyToNull(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function optionalText(max: number, tooLongMessage: string) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().max(max, tooLongMessage).nullable().optional()
  );
}

export const optionalDate = z.preprocess(
  emptyToNull,
  z
    .string({ error: ASSET_FIELD_MESSAGES.invalidDate })
    .refine(isRealDate, ASSET_FIELD_MESSAGES.invalidDate)
    .nullable()
    .optional()
);

function toNumberish(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replaceAll(',', '');
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

export function optionalAmount(options: { integer: boolean; message?: string }) {
  const message = options.message ?? ASSET_FIELD_MESSAGES.invalidNumber;
  let schema = z.number({ error: message }).min(0, message).max(999_999_999_999, message);
  if (options.integer) {
    schema = schema.int(message);
  }
  return z.preprocess(toNumberish, schema.nullable().optional());
}

export function optionalInt(min: number, max: number, message: string) {
  return z.preprocess(
    toNumberish,
    z.number({ error: message }).int(message).min(min, message).max(max, message).nullable().optional()
  );
}

export const optionalEmail = z.preprocess(
  emptyToNull,
  z
    .string({ error: ASSET_FIELD_MESSAGES.invalidEmail })
    .trim()
    .max(120, ASSET_FIELD_MESSAGES.invalidEmail)
    .regex(EMAIL_PATTERN, ASSET_FIELD_MESSAGES.invalidEmail)
    .nullable()
    .optional()
);

/** 관리 메모 — 1000자 · 비밀번호·로그인 패턴 금지(AC-21) */
export const managerMemoField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(1000, ASSET_FIELD_MESSAGES.memoTooLong)
    .refine((value) => !containsSecretLike(value), SECRET_LIKE_MESSAGE)
    .nullable()
    .optional()
);

export function optionalEnum<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.preprocess(emptyToNull, z.enum(values, { error: message }).nullable().optional());
}

export type FieldParseFailure = { ok: false; message: string; field: string | null };

/** Zod 실패 → 첫 이슈 문구 + 칸 이름 (폼은 field로 칸 아래 문구를 띄운다) */
export function firstIssue(error: z.ZodError): FieldParseFailure {
  const issue = error.issues[0];
  const field = issue && issue.path.length > 0 ? String(issue.path[0]) : null;
  return { ok: false, message: issue?.message ?? '입력값이 올바르지 않아요.', field };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
