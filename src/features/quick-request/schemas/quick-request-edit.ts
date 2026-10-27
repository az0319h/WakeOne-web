import * as z from 'zod';
import { parseQuickAmountInput } from '../lib/format-quick-amount';
import {
  QUICK_REQUEST_DISPATCH_MESSAGES,
  quickRequestDriverNameInputSchema,
  quickRequestDriverPhoneInputSchema,
  quickRequestVehicleInfoInputSchema,
  requiredAmountInputSchema
} from './quick-request-dispatch';
import { quickRequestFormObjectSchema, refineQuickRequestForm } from './quick-request-form';
import { QUICK_REQUEST_AMOUNT_MAX, type QuickRequestStatus } from './quick-request-workflow';

/**
 * plan 89 — 수정 Sheet 폼 (요청 폼 값 + 배차 정보·최종금액 입력 문자열).
 * 위치 스키마와 교차 검증(`refineQuickRequestForm`)은 요청 폼과 공유한다.
 */
export const quickRequestEditFormObjectSchema = quickRequestFormObjectSchema.extend({
  estimatedAmount: z.string(),
  dispatchVehicleInfo: z.string(),
  driverName: z.string(),
  driverPhone: z.string(),
  finalAmount: z.string()
});

export type QuickRequestEditFormValues = z.infer<typeof quickRequestEditFormObjectSchema>;

export type QuickRequestEditSchemaContext = {
  status: QuickRequestStatus;
  /** 최종금액이 이미 입력된 건 — 비울 수 없다 */
  hasFinalAmount: boolean;
};

function addFieldIssue(
  ctx: z.RefinementCtx,
  path: keyof QuickRequestEditFormValues,
  result: z.ZodSafeParseResult<unknown>
) {
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: result.error.issues[0]?.message ?? QUICK_REQUEST_DISPATCH_MESSAGES.amountInvalid,
      path: [path]
    });
  }
}

/** 배차 정보·금액은 `dispatched`에서만 검증한다 (그 외 상태는 Sheet에 필드가 없다) */
export function buildQuickRequestEditFormSchema(context: QuickRequestEditSchemaContext) {
  return quickRequestEditFormObjectSchema.superRefine((data, ctx) => {
    refineQuickRequestForm(data, ctx);

    if (context.status !== 'dispatched') {
      return;
    }

    addFieldIssue(
      ctx,
      'estimatedAmount',
      requiredAmountInputSchema(QUICK_REQUEST_DISPATCH_MESSAGES.estimatedAmountRequired).safeParse(
        data.estimatedAmount
      )
    );
    addFieldIssue(
      ctx,
      'dispatchVehicleInfo',
      quickRequestVehicleInfoInputSchema.safeParse(data.dispatchVehicleInfo)
    );
    addFieldIssue(ctx, 'driverName', quickRequestDriverNameInputSchema.safeParse(data.driverName));
    addFieldIssue(ctx, 'driverPhone', quickRequestDriverPhoneInputSchema.safeParse(data.driverPhone));

    const finalAmount = parseQuickAmountInput(data.finalAmount);
    if (finalAmount == null) {
      if (context.hasFinalAmount) {
        ctx.addIssue({
          code: 'custom',
          message: QUICK_REQUEST_DISPATCH_MESSAGES.finalAmountRequired,
          path: ['finalAmount']
        });
      }
    } else if (finalAmount > QUICK_REQUEST_AMOUNT_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: QUICK_REQUEST_DISPATCH_MESSAGES.amountInvalid,
        path: ['finalAmount']
      });
    }
  });
}
