import { z } from 'zod';

const wonAmount = z
  .number({ message: '금액은 숫자여야 합니다.' })
  .int('금액은 정수(원)여야 합니다.')
  .nonnegative('금액은 0 이상이어야 합니다.')
  .max(99_999_999_999, '금액이 너무 큽니다.');

export const walletSyncItemSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100, '이름은 100자 이내여야 합니다.'),
  monthly_limit: wonAmount,
  monthly_remaining: wonAmount
});

export const walletSyncSchema = z.object({
  synced_at: z
    .string()
    .trim()
    .refine((value) => value !== '' && !Number.isNaN(Date.parse(value)), {
      message: 'synced_at 형식이 올바르지 않습니다.'
    }),
  items: z
    .array(walletSyncItemSchema)
    .min(1, 'items가 비어 있습니다.')
    .max(200, 'items가 너무 많습니다.')
});
