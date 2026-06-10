import { z } from 'zod';
import { ASSET_ITEM_STATUSES } from './types';

const ASSET_NUMBER_REGEX = /^[A-Z0-9]{1,10}-\d{3}$/;

const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${maxLength}자 이내로 입력해 주세요.`)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

const statusSchema = z.enum(ASSET_ITEM_STATUSES);

const purchaseAmountSchema = z
  .number({ message: '구입금액은 숫자여야 합니다.' })
  .int('구입금액은 정수여야 합니다.')
  .nonnegative('구입금액은 0 이상이어야 합니다.')
  .max(999999999999, '구입금액이 너무 큽니다.')
  .nullable()
  .optional();

const purchaseDateSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
    message: '구입날짜 형식이 올바르지 않습니다.'
  })
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

const actualUserIdSchema = z
  .string()
  .uuid('실사용자 값이 올바르지 않습니다.')
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

export const assetItemCreateSchema = z.object({
  asset_number: z
    .string()
    .trim()
    .min(1, '자산번호를 입력해 주세요.')
    .max(20, '자산번호는 20자 이내여야 합니다.')
    .regex(ASSET_NUMBER_REGEX, '자산번호 형식은 PREFIX-001 형태여야 합니다.'),
  asset_name: z.string().trim().min(1, '자산명을 입력해 주세요.').max(200, '자산명은 200자 이내여야 합니다.'),
  status: statusSchema,
  model_number: nullableText(200),
  actual_user_id: actualUserIdSchema,
  usage_location: nullableText(200),
  category: nullableText(200),
  accounting_ledger: nullableText(200),
  ledger_code: nullableText(100),
  purchase_amount: purchaseAmountSchema,
  purchase_date: purchaseDateSchema,
  purchase_vendor: nullableText(200),
  notes: nullableText(2000)
});

export const assetItemUpdateSchema = assetItemCreateSchema.partial();

export const assetSuggestNumberSchema = z.object({
  asset_name: z.string().trim().min(1, '자산명을 입력해 주세요.').max(200, '자산명은 200자 이내여야 합니다.')
});

export function normalizeAssetNumber(value: string): string {
  return value.trim().toUpperCase();
}
