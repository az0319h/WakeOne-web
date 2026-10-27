import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';
import {
  QUICK_REQUEST_GOODS_SIZES,
  QUICK_REQUEST_ITEM_DESCRIPTION_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_TYPES,
  type QuickRequestGoodsSize,
  type QuickRequestVehicleType
} from './quick-request-notify';
import { localDatetimeInputToIso } from '../lib/datetime-local';

const locationFieldsSchema = z.object({
  roadAddress: z.string().min(1, '주소를 입력하거나 검색해 주세요.'),
  detailAddress: z.string().min(1, '상세 주소를 입력해 주세요.'),
  contactName: z.string().min(1, '담당자 이름을 입력해 주세요.'),
  contactPhone: z
    .string()
    .min(1, '연락처를 입력해 주세요.')
    .regex(PHONE_REGEX, '연락처는 11자리 숫자만 입력할 수 있습니다.')
});

export const quickRequestOriginFormSchema = locationFieldsSchema.extend({
  scheduleMode: z.enum(['immediate', 'scheduled']),
  scheduledDatetime: z.string(),
  notes: z.array(z.string()),
  memo: z.string()
});

export const quickRequestDestinationFormSchema = locationFieldsSchema.extend({
  scheduleMode: z.enum(['asap', 'scheduled']),
  scheduledDatetime: z.string(),
  notes: z.array(z.string()),
  extraMemo: z.string()
});

/** superRefine 전 객체 — 수정 폼(plan 89)이 `extend`로 재사용한다 */
export const quickRequestFormObjectSchema = z.object({
  /** `''` = 선택 전 (폼 기본값) */
  goodsSize: z
    .enum(['', ...QUICK_REQUEST_GOODS_SIZES])
    .refine((value): boolean => value !== '', { message: '물품 크기를 선택해 주세요.' }),
  /** plan 87 r1 — 「기타」일 때만 필수 (superRefine). 다른 크기면 값이 남아 있어도 전송하지 않는다 */
  itemDescription: z.string(),
  vehicleTypes: z
    .array(z.enum(QUICK_REQUEST_VEHICLE_TYPES))
    .min(1, '차량을 1종 이상 선택해 주세요.'),
  vehicleOtherText: z.string(),
  vehicleCountMode: z.enum(['preset', 'custom']),
  vehicleCountPreset: z.number().int().min(1).max(5),
  vehicleCountCustom: z.number().int().positive().optional(),
  origin: quickRequestOriginFormSchema,
  stopovers: z.array(locationFieldsSchema),
  destination: quickRequestDestinationFormSchema,
  freightPayment: z.enum(['monthly', 'collect'], {
    message: '결제 방식을 선택해 주세요.'
  })
});

type QuickRequestFormObjectValues = z.infer<typeof quickRequestFormObjectSchema>;

/** 요청 폼 교차 검증 (기타 물품·기타 차량·직접 입력 대수·예약 일시) — 요청·수정 폼 공용 */
export function refineQuickRequestForm(data: QuickRequestFormObjectValues, ctx: z.RefinementCtx) {
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

  if (data.vehicleTypes.includes('기타')) {
    if (!data.vehicleOtherText.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: '기타 차량을 입력해 주세요.',
        path: ['vehicleOtherText']
      });
    }
  }

  if (data.vehicleCountMode === 'custom') {
    if (!data.vehicleCountCustom || data.vehicleCountCustom < 1) {
      ctx.addIssue({
        code: 'custom',
        message: '차량 대수를 입력해 주세요.',
        path: ['vehicleCountCustom']
      });
    }
  }

  if (data.origin.scheduleMode === 'scheduled') {
    const iso = localDatetimeInputToIso(data.origin.scheduledDatetime);
    if (!iso) {
      ctx.addIssue({
        code: 'custom',
        message: '픽업 일시를 선택해 주세요.',
        path: ['origin', 'scheduledDatetime']
      });
    }
  }

  if (data.destination.scheduleMode === 'scheduled') {
    const iso = localDatetimeInputToIso(data.destination.scheduledDatetime);
    if (!iso) {
      ctx.addIssue({
        code: 'custom',
        message: '도착 희망 일시를 선택해 주세요.',
        path: ['destination', 'scheduledDatetime']
      });
    }
  }
}

export const quickRequestFormSchema = quickRequestFormObjectSchema.superRefine(refineQuickRequestForm);

export type QuickRequestFormValues = z.infer<typeof quickRequestFormSchema>;

export function resolveVehicleCount(
  values: Pick<
    QuickRequestFormValues,
    'vehicleCountMode' | 'vehicleCountPreset' | 'vehicleCountCustom'
  >
): number {
  if (values.vehicleCountMode === 'custom') {
    return values.vehicleCountCustom ?? 0;
  }
  return values.vehicleCountPreset;
}

export function toggleVehicleType(
  current: QuickRequestVehicleType[],
  type: QuickRequestVehicleType
): QuickRequestVehicleType[] {
  if (current.includes(type)) {
    return current.filter((t) => t !== type);
  }
  return [...current, type];
}

export function isQuickRequestGoodsSize(value: string): value is QuickRequestGoodsSize {
  return (QUICK_REQUEST_GOODS_SIZES as readonly string[]).includes(value);
}

/** 칩 라벨 변경(PATCH) 성공 시 폼 선택값 치환 — 순서 유지 · 중복 제거 */
export function replaceNoteLabel(current: string[], previous: string, next: string): string[] {
  if (!current.includes(previous)) {
    return current;
  }
  const replaced = current.map((note) => (note === previous ? next : note));
  return replaced.filter((note, index) => replaced.indexOf(note) === index);
}

/** 칩 삭제(DELETE) 성공 시 폼 선택값 제거 */
export function removeNoteLabel(current: string[], label: string): string[] {
  return current.includes(label) ? current.filter((note) => note !== label) : current;
}

export function toggleNote(current: string[], note: string): string[] {
  if (current.includes(note)) {
    return current.filter((n) => n !== note);
  }
  return [...current, note];
}
