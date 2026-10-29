import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';
import { PHONE_INPUT_ERROR } from '@/lib/phone-messages';

/** plan 87/97 — 최근 주소 (출발/도착 분리 · 상한 없음 · 커서 10개씩 · DB check와 같은 길이 상한) */
export const QUICK_REQUEST_RECENT_ADDRESS_DIRECTIONS = ['origin', 'destination'] as const;
export type QuickRequestRecentAddressDirection = (typeof QUICK_REQUEST_RECENT_ADDRESS_DIRECTIONS)[number];
export const QUICK_REQUEST_RECENT_ADDRESSES_PAGE_SIZE = 10;
export const QUICK_REQUEST_RECENT_ADDRESSES_MAX_LIMIT = 50;
export const QUICK_REQUEST_RECENT_ADDRESS_MAX_LOCATIONS = 50;

export function isQuickRequestRecentAddressDirection(
  value: string | null | undefined
): value is QuickRequestRecentAddressDirection {
  return Boolean(value && (QUICK_REQUEST_RECENT_ADDRESS_DIRECTIONS as readonly string[]).includes(value));
}

export const QUICK_REQUEST_RECENT_ADDRESS_MESSAGES = {
  invalid: '필수 항목을 확인해 주세요.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  internalError: '처리 중 오류가 발생했습니다.'
} as const;

/** item.direction 필수 — 출발 칸 `origin` · 경유·도착 칸 `destination` (plan 97 D-8) */
export const quickRequestRecentAddressLocationSchema = z.object({
  direction: z.enum(QUICK_REQUEST_RECENT_ADDRESS_DIRECTIONS),
  roadAddress: z.string().trim().min(1).max(300),
  detailAddress: z.string().trim().min(1).max(300),
  contactName: z.string().trim().min(1).max(100),
  contactPhone: z.string().trim().regex(PHONE_REGEX, PHONE_INPUT_ERROR)
});

export const quickRequestRecentAddressBodySchema = z.object({
  locations: z
    .array(quickRequestRecentAddressLocationSchema)
    .min(1)
    .max(QUICK_REQUEST_RECENT_ADDRESS_MAX_LOCATIONS)
});

export type QuickRequestRecentAddressBody = z.infer<typeof quickRequestRecentAddressBodySchema>;
