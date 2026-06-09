import { z } from 'zod';
import { OFFICE_SNACK_MAX_PRICE } from '../api/types';

export const officeSnackSessionSchema = z
  .object({
    title: z.string().trim().min(1, '회차 이름을 입력해 주세요.').max(100, '회차 이름은 100자 이내여야 합니다.'),
    description: z.string().trim().max(500, '회차 설명은 500자 이내여야 합니다.').optional(),
    registration_start_at: z.string().min(1, '등록 시작 시각을 입력해 주세요.'),
    registration_end_at: z.string().min(1, '등록 종료 시각을 입력해 주세요.'),
    voting_start_at: z.string().min(1, '투표 시작 시각을 입력해 주세요.'),
    voting_end_at: z.string().min(1, '투표 종료 시각을 입력해 주세요.')
  })
  .superRefine((value, ctx) => {
    const registrationStart = new Date(value.registration_start_at);
    const registrationEnd = new Date(value.registration_end_at);
    const votingStart = new Date(value.voting_start_at);
    const votingEnd = new Date(value.voting_end_at);

    if (!(registrationStart < registrationEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['registration_end_at'],
        message: '등록 종료는 등록 시작보다 늦어야 합니다.'
      });
    }

    if (!(registrationEnd < votingStart)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voting_start_at'],
        message: '투표 시작은 등록 종료보다 늦어야 합니다.'
      });
    }

    if (!(votingStart < votingEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voting_end_at'],
        message: '투표 종료는 투표 시작보다 늦어야 합니다.'
      });
    }
  });

export type OfficeSnackSessionFormValues = z.infer<typeof officeSnackSessionSchema>;

export const officeSnackCandidateSchema = z.object({
  product_url: z
    .string()
    .url('올바른 URL을 입력해 주세요.')
    .max(2048, 'URL 길이가 너무 깁니다.')
    .refine((value) => {
      try {
        const parsed = new URL(value);
        const hostname = parsed.hostname.toLowerCase();
        return (
          hostname === 'coupang.com' ||
          hostname === 'www.coupang.com' ||
          hostname === 'm.coupang.com' ||
          hostname === 'link.coupang.com' ||
          hostname.endsWith('.coupang.com')
        );
      } catch {
        return false;
      }
    }, '쿠팡 링크만 등록할 수 있습니다.'),
  name: z.string().trim().min(1, '간식 이름을 입력해 주세요.').max(200, '간식 이름은 200자 이내여야 합니다.'),
  price: z
    .number({ message: '가격을 입력해 주세요.' })
    .int('가격은 정수여야 합니다.')
    .positive('가격은 1원 이상이어야 합니다.')
    .max(OFFICE_SNACK_MAX_PRICE, `가격은 ${OFFICE_SNACK_MAX_PRICE.toLocaleString()}원 이하여야 합니다.`),
  image_url: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^https?:\/\//i.test(value), {
      message: '올바른 이미지 URL을 입력해 주세요.'
    })
    .refine((value) => value.length <= 2048, {
      message: '이미지 URL 길이가 너무 깁니다.'
    })
});

export type OfficeSnackCandidateFormValues = z.infer<typeof officeSnackCandidateSchema>;
