import { NextResponse } from 'next/server';
import * as z from 'zod';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canOperateQuickRequests } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  insertQuickRequestRequesterNotification,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import {
  buildQuickRequestDetail,
  canViewQuickRequest,
  getQuickRequestByNo,
  isQuickRequestLocked,
  updateQuickRequestIfStatus,
  type QuickRequestRow
} from '@/features/quick-request/api/workflow.server';
import { refineQuickRequestCrossFields } from '@/features/quick-request/schemas/quick-request-notify';
import {
  QUICK_REQUEST_MESSAGES,
  QUICK_REQUEST_PATCH_KEYS,
  quickRequestPatchBodySchema,
  type QuickRequestPatchBody,
  type QuickRequestPatchKey
} from '@/features/quick-request/schemas/quick-request-workflow';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  parseQuickRequestNoParam,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody,
  resolveTransitionConflictMessage,
  zodIssuesToValidationErrors
} from '../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const UPDATE_ACTION = 'quick_request.update' as const;
const FINAL_AMOUNT_ACTION = 'quick_request.final_amount_set' as const;

/** Read — 상세 + permissions + (동방·admin) 발송 기록. 권한 없음·미존재는 같은 404 */
export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.notFound), { status: 404 });
  }

  try {
    const row = await getQuickRequestByNo(requestNo);
    if (!row || !canViewQuickRequest(session.profile, row)) {
      return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.notFound), { status: 404 });
    }

    const data = await buildQuickRequestDetail(session.profile, row);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request] detail failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), {
      status: 500
    });
  }
}

/** key 순서와 무관한 비교 (jsonb는 key 순서를 바꿔 돌려준다) */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const PATCH_COLUMN: Record<QuickRequestPatchKey, keyof QuickRequestRow> = {
  itemDescription: 'item_description',
  goodsSize: 'goods_size',
  vehicleTypes: 'vehicle_types',
  vehicleOtherText: 'vehicle_other_text',
  vehicleCount: 'vehicle_count',
  freightPayment: 'freight_payment',
  origin: 'origin',
  stopovers: 'stopovers',
  destination: 'destination',
  estimatedAmount: 'estimated_amount',
  dispatchVehicleInfo: 'dispatch_vehicle_info',
  driverName: 'driver_name',
  driverPhone: 'driver_phone',
  finalAmount: 'final_amount'
};

function normalizePatchValue(key: QuickRequestPatchKey, value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return key === 'vehicleOtherText' ? trimmed || null : trimmed;
  }
  return value ?? null;
}

const mergedCrossFieldSchema = z
  .object({
    itemDescription: z.string(),
    goodsSize: z.enum(['xs', 's', 'm', 'other']),
    vehicleTypes: z.array(z.string()),
    vehicleOtherText: z.string().nullable()
  })
  .superRefine(refineQuickRequestCrossFields);

type PatchPlan =
  | { ok: true; updates: Record<string, unknown>; changedFields: QuickRequestPatchKey[] }
  | { ok: false; validationErrors: Record<string, string> };

function buildPatchPlan(row: QuickRequestRow, body: QuickRequestPatchBody): PatchPlan {
  const updates: Record<string, unknown> = {};
  const changedFields: QuickRequestPatchKey[] = [];

  for (const key of QUICK_REQUEST_PATCH_KEYS) {
    if (!(key in body) || body[key] === undefined) continue;
    const next = normalizePatchValue(key, body[key]);
    const column = PATCH_COLUMN[key];
    if (stableStringify(next) === stableStringify(row[column])) continue;
    updates[column] = next;
    changedFields.push(key);
  }

  // 병합값 교차 검증 (기타 차량 · 기타 물품)
  const merged = {
    itemDescription: (updates.item_description ?? row.item_description ?? '') as string,
    goodsSize: (updates.goods_size ?? row.goods_size) as QuickRequestRow['goods_size'],
    vehicleTypes: (updates.vehicle_types ?? row.vehicle_types ?? []) as string[],
    vehicleOtherText: ('vehicle_other_text' in updates
      ? updates.vehicle_other_text
      : row.vehicle_other_text) as string | null
  };
  const crossCheck = mergedCrossFieldSchema.safeParse(merged);
  if (!crossCheck.success) {
    return { ok: false, validationErrors: zodIssuesToValidationErrors(crossCheck.error) };
  }

  // 등록과 같은 정규화: 기타가 아니면 물품 내용 '', 기타 차량이 없으면 기타 텍스트 null
  if (merged.goodsSize !== 'other' && merged.itemDescription !== '') {
    updates.item_description = '';
  }
  if (!merged.vehicleTypes.includes('기타') && merged.vehicleOtherText) {
    updates.vehicle_other_text = null;
  }

  return { ok: true, updates, changedFields };
}

/** 동방·admin 부분 수정. 요청자 403(AC-22) · approved/cancelled 409(AC-27) · finalAmount는 dispatched만 */
export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}`;
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: UPDATE_ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: rawRequestNo,
      httpMethod: 'PATCH',
      httpPath,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: UPDATE_ACTION,
    httpMethod: 'PATCH',
    httpPath,
    profile,
    defaultTargetLabel: rawRequestNo
  });

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo } = loaded;

  if (!canOperateQuickRequests(profile)) {
    const isRequester = row.requester_user_id === profile.user_id;
    const message = isRequester
      ? QUICK_REQUEST_MESSAGES.requesterCannotEdit
      : QUICK_REQUEST_MESSAGES.forbidden;
    return logger.respond(quickErrorBody(message), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', message))
    });
  }

  if (isQuickRequestLocked(row.status)) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.locked), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickRequestPatchBodySchema.safeParse(json.body);
  if (!parsed.success) {
    const validationErrors = zodIssuesToValidationErrors(parsed.error);
    return logger.respond(
      { ...quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), errors: validationErrors },
      400,
      {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('validation', undefined, { validation_errors: validationErrors })
        )
      }
    );
  }

  const body = parsed.data;
  if (Object.values(body).every((value) => value === undefined)) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.noChanges), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', QUICK_REQUEST_MESSAGES.noChanges))
    });
  }

  if (body.finalAmount !== undefined && row.status !== 'dispatched') {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.finalAmountOnlyDispatched), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  const plan = buildPatchPlan(row, body);
  if (!plan.ok) {
    return logger.respond(
      { ...quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), errors: plan.validationErrors },
      400,
      {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('validation', undefined, { validation_errors: plan.validationErrors })
        )
      }
    );
  }

  if (plan.changedFields.length === 0) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.noChanges), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', QUICK_REQUEST_MESSAGES.noChanges))
    });
  }

  const finalAmountChanged = plan.changedFields.includes('finalAmount');
  const action =
    plan.changedFields.length === 1 && finalAmountChanged ? FINAL_AMOUNT_ACTION : UPDATE_ACTION;
  const updates = { ...plan.updates };
  if (finalAmountChanged) {
    updates.final_amount_set_at = new Date().toISOString();
    updates.final_amount_set_by = profile.user_id;
  }

  let updated: QuickRequestRow | null;
  try {
    updated = await updateQuickRequestIfStatus(row.id, row.status, updates);
  } catch (error) {
    console.error('[quick-request] patch failed:', error);
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), 500, {
      action,
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error'))
    });
  }

  if (!updated) {
    const message = await resolveTransitionConflictMessage(requestNo);
    return logger.respond(quickErrorBody(message), 409, {
      action,
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', message))
    });
  }

  if (finalAmountChanged) {
    const actorName = profile.full_name?.trim() || profile.email;
    const latest = updated;
    await safeNotify('requester final_amount_set', () =>
      insertQuickRequestRequesterNotification({
        row: latest,
        event: 'final_amount_set',
        actorUserId: profile.user_id,
        actorName
      })
    );
  }

  return logger.respond(
    { success: true, data: { requestNo, status: updated.status } },
    200,
    {
      action,
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, { changedFields: plan.changedFields })
    }
  );
}
