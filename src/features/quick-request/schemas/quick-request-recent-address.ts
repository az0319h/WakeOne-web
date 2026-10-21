import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';

/** plan 87 — 최근 주소 (사용자별 최근 10개 · DB check와 같은 길이 상한) */
export const QUICK_REQUEST_RECENT_ADDRESSES_MAX_COUNT = 10;
export const QUICK_REQUEST_RECENT_ADDRESS_MAX_LOCATIONS = 50;

export const QUICK_REQUEST_RECENT_ADDRESS_MESSAGES = {
  invalid: '필수 항목을 확인해 주세요.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  internalError: '처리 중 오류가 발생했습니다.'
} as const;

export const quickRequestRecentAddressLocationSchema = z.object({
  roadAddress: z.string().trim().min(1).max(300),
  detailAddress: z.string().trim().min(1).max(300),
  contactName: z.string().trim().min(1).max(100),
  contactPhone: z.string().trim().regex(PHONE_REGEX)
});

export const quickRequestRecentAddressBodySchema = z.object({
  locations: z
    .array(quickRequestRecentAddressLocationSchema)
    .min(1)
    .max(QUICK_REQUEST_RECENT_ADDRESS_MAX_LOCATIONS)
});

export type QuickRequestRecentAddressBody = z.infer<typeof quickRequestRecentAddressBodySchema>;
