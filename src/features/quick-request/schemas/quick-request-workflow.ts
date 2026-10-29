import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';
import { PHONE_INPUT_ERROR } from '@/lib/phone-messages';
import { quickRequestVehiclePlateSchema } from '../lib/quick-request-vehicle-plate';
import {
  quickRequestDestinationSchema,
  quickRequestLocationSchema,
  quickRequestOriginSchema,
  quickRequestPayloadFields,
  QUICK_REQUEST_GOODS_SIZES,
  QUICK_REQUEST_VEHICLE_TYPES,
  refineQuickRequestCrossFields
} from './quick-request-notify';

/**
 * plan 89 — 퀵 업무 흐름 공유 상수·스키마 (Route Handler · FE Dialog/Sheet 공용).
 * FE 라벨·색은 `lib/quick-request-status.ts`(frontend-dev)가 맡는다.
 */

export const QUICK_REQUEST_STATUSES = [
  'requested',
  'dispatching',
  'dispatched',
  'approved',
  'cancelled'
] as const;
export type QuickRequestStatus = (typeof QUICK_REQUEST_STATUSES)[number];

/** 수정·취소 가능한 상태 (approved·cancelled 이후 잠금) */
export const QUICK_REQUEST_EDITABLE_STATUSES = ['requested', 'dispatching', 'dispatched'] as const;

/** `YYYY-NN` (최소 2자리, 100 이상은 3자리 이상) */
export const QUICK_REQUEST_NO_PATTERN = /^\d{4}-\d{2,}$/;

export function isQuickRequestNo(value: string): boolean {
  return QUICK_REQUEST_NO_PATTERN.test(value);
}

export function isQuickRequestStatus(value: string | null | undefined): value is QuickRequestStatus {
  return Boolean(value && (QUICK_REQUEST_STATUSES as readonly string[]).includes(value));
}

/** plan 97 D-2 — 페이지 크기 (기본 20 · 10/20/50 · 서버는 50으로 클램프). 조회 기간은 `lib/quick-request-range.ts` */
export const QUICK_REQUEST_LIST_PAGE_SIZES = [10, 20, 50] as const;
export const QUICK_REQUEST_LIST_DEFAULT_LIMIT = 20;
export const QUICK_REQUEST_LIST_MAX_LIMIT = 50;

export const QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH = 200;
export const QUICK_REQUEST_AMOUNT_MAX = 99_999_999;

/** 서버 응답 문구 (FE는 `message`를 그대로 토스트) */
export const QUICK_REQUEST_MESSAGES = {
  invalid: '입력값을 확인해 주세요.',
  noChanges: '변경된 내용이 없습니다.',
  forbidden: '접근 권한이 없습니다.',
  requesterCannotEdit: '요청자는 등록 후 내용을 수정할 수 없습니다.',
  requesterCannotCancel: '접수된 요청은 취소할 수 없습니다. 동방특송 담당자에게 연락해 주세요.',
  notFound: '퀵 요청을 찾을 수 없습니다.',
  stale: '이미 다른 사용자가 처리한 요청입니다. 새로고침해 주세요.',
  locked: '완료되었거나 취소된 요청은 변경할 수 없습니다.',
  finalAmountRequired: '최종금액이 입력되면 승인할 수 있습니다.',
  finalAmountOnlyDispatched: '최종금액은 배차완료 후에 입력할 수 있습니다.',
  internalError: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  created: '퀵 요청이 등록되었습니다.'
} as const;

const amountSchema = (requiredMessage: string) =>
  z
    .number({ message: requiredMessage })
    .int('금액은 원 단위 정수로 입력해 주세요.')
    .min(0, '금액은 0원 이상이어야 합니다.')
    .max(QUICK_REQUEST_AMOUNT_MAX, '금액을 확인해 주세요.');

const driverPhoneSchema = z
  .string({ message: '기사 연락처를 입력해 주세요.' })
  .trim()
  .min(1, '기사 연락처를 입력해 주세요.')
  .regex(PHONE_REGEX, PHONE_INPUT_ERROR);

/** plan 94 D-9 — 자동차등록번호 (정규화 + 번호판 3패턴 · 20자). 컬럼 `dispatch_vehicle_info`·필드명은 유지 */
const vehicleInfoSchema = quickRequestVehiclePlateSchema;

const driverNameSchema = z
  .string({ message: '기사 이름을 입력해 주세요.' })
  .trim()
  .min(1, '기사 이름을 입력해 주세요.')
  .max(50, '기사 이름은 50자 이내로 입력해 주세요.');

/** POST /api/quick-request — `requesterName`·`requestedAtIso`는 받더라도 무시(서버 결정) */
export const quickRequestCreateBodySchema = z
  .object({
    ...quickRequestPayloadFields,
    requestedAtIso: z.string().optional(),
    requesterName: z.string().optional()
  })
  .superRefine(refineQuickRequestCrossFields);

export type QuickRequestCreateBody = z.infer<typeof quickRequestCreateBodySchema>;

/** POST …/dispatch — 4필드 필수 (89 AC-17) · `vehicleInfo`는 자동차등록번호 형식 (94 AC-17) */
export const quickRequestDispatchBodySchema = z.object({
  estimatedAmount: amountSchema('예상금액을 입력해 주세요.'),
  vehicleInfo: vehicleInfoSchema,
  driverName: driverNameSchema,
  driverPhone: driverPhoneSchema
});

export type QuickRequestDispatchBody = z.infer<typeof quickRequestDispatchBodySchema>;

/** POST …/cancel */
export const quickRequestCancelBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .max(
      QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH,
      `취소 사유는 ${QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH}자 이내로 입력해 주세요.`
    )
    .optional()
});

export type QuickRequestCancelBody = z.infer<typeof quickRequestCancelBodySchema>;

/**
 * PATCH /api/quick-request/[requestNo] — 바뀐 키만 온다. `origin`·`destination`·`stopovers`는 통째로 교체.
 * 알 수 없는 키는 400. 교차 검증(기타 차량·기타 물품)은 Route가 현재 값과 병합한 뒤 수행한다.
 */
export const quickRequestPatchBodySchema = z
  .object({
    itemDescription: z.string(),
    goodsSize: z.enum(QUICK_REQUEST_GOODS_SIZES),
    vehicleTypes: z.array(z.enum(QUICK_REQUEST_VEHICLE_TYPES)).min(1),
    vehicleOtherText: z.string().nullable(),
    vehicleCount: z.number().int().positive().max(999),
    freightPayment: z.enum(['monthly', 'collect']),
    origin: quickRequestOriginSchema,
    stopovers: z.array(quickRequestLocationSchema),
    destination: quickRequestDestinationSchema,
    estimatedAmount: amountSchema('예상금액을 입력해 주세요.'),
    dispatchVehicleInfo: vehicleInfoSchema,
    driverName: driverNameSchema,
    driverPhone: driverPhoneSchema,
    /** dispatched에서만 · null 불가 (한 번 입력되면 비울 수 없음) */
    finalAmount: amountSchema('최종금액을 입력해 주세요.')
  })
  .partial()
  .strict();

export type QuickRequestPatchBody = z.infer<typeof quickRequestPatchBodySchema>;

export const QUICK_REQUEST_PATCH_KEYS = [
  'itemDescription',
  'goodsSize',
  'vehicleTypes',
  'vehicleOtherText',
  'vehicleCount',
  'freightPayment',
  'origin',
  'stopovers',
  'destination',
  'estimatedAmount',
  'dispatchVehicleInfo',
  'driverName',
  'driverPhone',
  'finalAmount'
] as const satisfies readonly (keyof QuickRequestPatchBody)[];

export type QuickRequestPatchKey = (typeof QUICK_REQUEST_PATCH_KEYS)[number];
