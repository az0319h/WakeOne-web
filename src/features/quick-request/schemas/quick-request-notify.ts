import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';

export const QUICK_REQUEST_VEHICLE_TYPES = [
  '오토바이',
  '다마스',
  '라보',
  '1톤 탑차(윙바디)',
  '1톤 오픈형',
  '1톤 냉장(냉동)',
  '2.5톤',
  '5톤',
  '기타'
] as const;

export type QuickRequestVehicleType = (typeof QUICK_REQUEST_VEHICLE_TYPES)[number];

/** plan 87 — 물품 크기 (대형 제외). 라벨은 FE `lib/quick-request-goods-visuals.ts` */
export const QUICK_REQUEST_GOODS_SIZES = ['xs', 's', 'm', 'other'] as const;

export type QuickRequestGoodsSize = (typeof QUICK_REQUEST_GOODS_SIZES)[number];

/** plan 87 r1 — 「물품 내용」 최대 길이 (trim 후). FE `maxLength`와 동일 */
export const QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH = 500;

export const quickRequestLocationSchema = z.object({
  roadAddress: z.string().min(1),
  detailAddress: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().regex(PHONE_REGEX)
});

export const quickRequestOriginScheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('immediate') }),
  z.object({
    mode: z.literal('scheduled'),
    datetimeIso: z.string().datetime()
  })
]);

export const quickRequestDestinationScheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('asap') }),
  z.object({
    mode: z.literal('scheduled'),
    datetimeIso: z.string().datetime()
  })
]);

export const quickRequestOriginSchema = quickRequestLocationSchema.extend({
  schedule: quickRequestOriginScheduleSchema,
  notes: z.array(z.string()),
  memo: z.string().optional()
});

export const quickRequestDestinationSchema = quickRequestLocationSchema.extend({
  schedule: quickRequestDestinationScheduleSchema,
  notes: z.array(z.string()),
  memo: z.string().optional()
});

/** plan 89 — 등록·수정 공용 본문 필드 (요청자·요청 시각은 서버가 결정) */
export const quickRequestPayloadFields = {
  /** plan 87 r1 — `goodsSize === 'other'`일 때만 1자 이상 필수, 그 외 `''` */
  itemDescription: z.string(),
  goodsSize: z.enum(QUICK_REQUEST_GOODS_SIZES),
  vehicleTypes: z.array(z.enum(QUICK_REQUEST_VEHICLE_TYPES)).min(1),
  vehicleOtherText: z.string().optional(),
  vehicleCount: z.number().int().positive().max(999),
  origin: quickRequestOriginSchema,
  stopovers: z.array(quickRequestLocationSchema),
  destination: quickRequestDestinationSchema,
  freightPayment: z.enum(['monthly', 'collect'])
};

type QuickRequestCrossFieldValues = {
  itemDescription: string;
  goodsSize: QuickRequestGoodsSize;
  vehicleTypes: readonly string[];
  vehicleOtherText?: string | null;
};

/** 기타 차량 · 기타 물품 교차 검증 (등록 본문 · PATCH 병합값 공용) */
export function refineQuickRequestCrossFields(
  data: QuickRequestCrossFieldValues,
  ctx: z.RefinementCtx
): void {
  if (data.vehicleTypes.includes('기타')) {
    const other = data.vehicleOtherText?.trim() ?? '';
    if (!other) {
      ctx.addIssue({
        code: 'custom',
        message: '기타 차량을 입력해 주세요.',
        path: ['vehicleOtherText']
      });
    }
  }

  if (data.goodsSize === 'other') {
    const item = data.itemDescription.trim();
    if (!item) {
      ctx.addIssue({
        code: 'custom',
        message: '물품 내용을 입력해 주세요.',
        path: ['itemDescription']
      });
    } else if (item.length > QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `${QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH}자 이내로 입력해 주세요.`,
        path: ['itemDescription']
      });
    }
  }
}

/** FE 폼 → payload 매핑 결과 (미리보기 메시지용 `requesterName`·`requestedAtIso` 포함) */
export const quickRequestNotifyBodySchema = z
  .object({
    ...quickRequestPayloadFields,
    requestedAtIso: z.string().datetime(),
    requesterName: z.string().min(1)
  })
  .superRefine(refineQuickRequestCrossFields);

export type QuickRequestNotifyBody = z.infer<typeof quickRequestNotifyBodySchema>;
