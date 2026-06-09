import { z } from 'zod';
import { OFFICE_SNACK_MAX_PRICE } from './types';

const OFFICE_SNACK_DATE_TIME_MESSAGE = '날짜/시간 형식이 올바르지 않습니다.';
const COUPANG_ALLOWED_HOSTS = ['coupang.com', 'www.coupang.com', 'm.coupang.com', 'link.coupang.com'] as const;

export function isCoupangAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (COUPANG_ALLOWED_HOSTS as readonly string[]).includes(normalized) || normalized.endsWith('.coupang.com');
}

function isValidCoupangUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return isCoupangAllowedHost(parsed.hostname);
  } catch {
    return false;
  }
}

const officeSnackSessionBaseSchema = z.object({
  title: z.string().trim().min(1, '회차 이름을 입력해 주세요.').max(100, '회차 이름은 100자 이내여야 합니다.'),
  description: z
    .string()
    .trim()
    .max(500, '회차 설명은 500자 이내여야 합니다.')
    .nullable()
    .optional(),
  registration_start_at: z.string().datetime({ message: OFFICE_SNACK_DATE_TIME_MESSAGE }),
  registration_end_at: z.string().datetime({ message: OFFICE_SNACK_DATE_TIME_MESSAGE }),
  voting_start_at: z.string().datetime({ message: OFFICE_SNACK_DATE_TIME_MESSAGE }),
  voting_end_at: z.string().datetime({ message: OFFICE_SNACK_DATE_TIME_MESSAGE })
});

function validateSessionWindow(
  value: Partial<z.infer<typeof officeSnackSessionBaseSchema>>,
  ctx: z.RefinementCtx
) {
  if (
    !value.registration_start_at ||
    !value.registration_end_at ||
    !value.voting_start_at ||
    !value.voting_end_at
  ) {
    return;
  }

  const registrationStart = new Date(value.registration_start_at);
  const registrationEnd = new Date(value.registration_end_at);
  const votingStart = new Date(value.voting_start_at);
  const votingEnd = new Date(value.voting_end_at);

  if (!(registrationStart < registrationEnd)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['registration_end_at'],
      message: '등록 종료 시각은 등록 시작 시각보다 늦어야 합니다.'
    });
  }

  if (!(registrationEnd < votingStart)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['voting_start_at'],
      message: '투표 시작 시각은 등록 종료 시각보다 늦어야 합니다.'
    });
  }

  if (!(votingStart < votingEnd)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['voting_end_at'],
      message: '투표 종료 시각은 투표 시작 시각보다 늦어야 합니다.'
    });
  }
}

export const officeSnackSessionCreateSchema = officeSnackSessionBaseSchema.superRefine((value, ctx) => {
  validateSessionWindow(value, ctx);
});

export const officeSnackSessionUpdateSchema = officeSnackSessionBaseSchema.partial().superRefine((value, ctx) => {
  validateSessionWindow(value, ctx);
});

export const officeSnackCandidateCreateSchema = z.object({
  name: z.string().trim().min(1, '간식 이름을 입력해 주세요.').max(200, '간식 이름은 200자 이내여야 합니다.'),
  product_url: z
    .string()
    .url('올바른 URL을 입력해 주세요.')
    .max(2048, 'URL 길이가 너무 깁니다.')
    .refine((value) => isValidCoupangUrl(value), '쿠팡 링크만 등록할 수 있습니다.'),
  image_url: z
    .string()
    .url('올바른 이미지 URL을 입력해 주세요.')
    .max(2048, '이미지 URL 길이가 너무 깁니다.')
    .nullable()
    .optional()
    .default(null),
  price: z
    .number('가격은 숫자여야 합니다.')
    .int('가격은 정수여야 합니다.')
    .positive('가격은 1원 이상이어야 합니다.')
    .max(OFFICE_SNACK_MAX_PRICE, `가격은 ${OFFICE_SNACK_MAX_PRICE.toLocaleString()}원 이하여야 합니다.`),
  source_type: z.enum(['parsed', 'manual']).optional().default('manual')
});

export const officeSnackCandidateUpdateSchema = officeSnackCandidateCreateSchema;

export const officeSnackVoteSubmitSchema = z
  .object({
    rank1_candidate_id: z.number().int().positive(),
    rank2_candidate_id: z.number().int().positive(),
    rank3_candidate_id: z.number().int().positive()
  })
  .superRefine((value, ctx) => {
    const uniq = new Set([
      value.rank1_candidate_id,
      value.rank2_candidate_id,
      value.rank3_candidate_id
    ]);

    if (uniq.size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rank1_candidate_id'],
        message: '1·2·3순위는 서로 다른 후보여야 합니다.'
      });
    }
  });

