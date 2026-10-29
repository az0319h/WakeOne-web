import * as z from 'zod';
import { PHONE_REGEX } from '@/lib/phone';
import { PHONE_INPUT_ERROR } from '@/lib/phone-messages';
import { parseQuickAmountInput } from '../lib/format-quick-amount';
import {
  QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE,
  quickRequestVehiclePlateSchema
} from '../lib/quick-request-vehicle-plate';
import { QUICK_REQUEST_AMOUNT_MAX } from './quick-request-workflow';

/**
 * plan 89 — 배차완료 Dialog 폼 검증 (입력 문자열 기준).
 * 서버 본문 스키마는 `quickRequestDispatchBodySchema`(quick-request-workflow.ts)와 같은 규칙이다.
 */
export {
  quickRequestDispatchBodySchema,
  type QuickRequestDispatchBody
} from './quick-request-workflow';

export const QUICK_REQUEST_DISPATCH_MESSAGES = {
  estimatedAmountRequired: '예상금액을 입력해 주세요.',
  vehicleInfoRequired: QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE,
  driverNameRequired: '기사 이름을 입력해 주세요.',
  driverPhoneRequired: '기사 연락처를 입력해 주세요.',
  driverPhoneInvalid: PHONE_INPUT_ERROR,
  finalAmountRequired: '최종금액을 입력해 주세요.',
  amountInvalid: '금액을 확인해 주세요.'
} as const;

/** plan 94 D-9 — 자동차등록번호 최대 20자 (`QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH` 재노출 · 필드명 `vehicleInfo` 유지) */
export const QUICK_REQUEST_VEHICLE_INFO_MAX_LENGTH = QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH;
export {
  QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE,
  QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_PLATE_PLACEHOLDER
} from '../lib/quick-request-vehicle-plate';
export const QUICK_REQUEST_DRIVER_NAME_MAX_LENGTH = 50;

/** 금액 입력 문자열 (콤마 허용) — 필수 */
export function requiredAmountInputSchema(requiredMessage: string) {
  return z.string().superRefine((value, ctx) => {
    const amount = parseQuickAmountInput(value);
    if (amount == null) {
      ctx.addIssue({ code: 'custom', message: requiredMessage });
      return;
    }
    if (amount > QUICK_REQUEST_AMOUNT_MAX) {
      ctx.addIssue({ code: 'custom', message: QUICK_REQUEST_DISPATCH_MESSAGES.amountInvalid });
    }
  });
}

/** plan 94 D-9 — 자동차등록번호 형식 검사 (서버 본문 스키마와 같은 lib · 문구 「자동차등록번호 형식을 확인해 주세요. 예: 21마 6543」) */
export const quickRequestVehicleInfoInputSchema = quickRequestVehiclePlateSchema;

export const quickRequestDriverNameInputSchema = z
  .string()
  .trim()
  .min(1, QUICK_REQUEST_DISPATCH_MESSAGES.driverNameRequired)
  .max(QUICK_REQUEST_DRIVER_NAME_MAX_LENGTH, '기사 이름은 50자 이내로 입력해 주세요.');

export const quickRequestDriverPhoneInputSchema = z
  .string()
  .trim()
  .min(1, QUICK_REQUEST_DISPATCH_MESSAGES.driverPhoneRequired)
  .regex(PHONE_REGEX, QUICK_REQUEST_DISPATCH_MESSAGES.driverPhoneInvalid);

export const quickRequestDispatchFormSchema = z.object({
  estimatedAmount: requiredAmountInputSchema(QUICK_REQUEST_DISPATCH_MESSAGES.estimatedAmountRequired),
  vehicleInfo: quickRequestVehicleInfoInputSchema,
  driverName: quickRequestDriverNameInputSchema,
  driverPhone: quickRequestDriverPhoneInputSchema
});

export type QuickRequestDispatchFormValues = z.infer<typeof quickRequestDispatchFormSchema>;

export const QUICK_REQUEST_DISPATCH_FORM_DEFAULTS: QuickRequestDispatchFormValues = {
  estimatedAmount: '',
  vehicleInfo: '',
  driverName: '',
  driverPhone: ''
};

export const quickRequestFinalAmountFormSchema = z.object({
  finalAmount: requiredAmountInputSchema(QUICK_REQUEST_DISPATCH_MESSAGES.finalAmountRequired)
});

export type QuickRequestFinalAmountFormValues = z.infer<typeof quickRequestFinalAmountFormSchema>;
