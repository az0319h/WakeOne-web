import type { QuickRequestDetail, QuickRequestPatchPayload } from '../api/types';
import { QUICK_REQUEST_VEHICLE_COUNT_PRESETS } from './quick-request-constants';
import type { QuickRequestEditFormValues } from '../schemas/quick-request-edit';
import type { QuickRequestVehicleType } from '../schemas/quick-request-notify';
import { resolveVehicleCount } from '../schemas/quick-request-form';
import { QUICK_REQUEST_PATCH_KEYS, type QuickRequestPatchKey } from '../schemas/quick-request-workflow';
import { isoToLocalDatetimeInput, localDatetimeInputToIso } from './datetime-local';
import { formatQuickAmountInput, parseQuickAmountInput } from './format-quick-amount';
import { resolveQuickRequestItemDescription } from './quick-request-goods-visuals';

function amountToInput(amount: number | null): string {
  return amount == null ? '' : formatQuickAmountInput(String(amount));
}

function isPresetCount(count: number): count is (typeof QUICK_REQUEST_VEHICLE_COUNT_PRESETS)[number] {
  return (QUICK_REQUEST_VEHICLE_COUNT_PRESETS as readonly number[]).includes(count);
}

/** 상세 응답 → 수정 폼 기본값 (`mapFormValuesToNotifyPayload`의 역함수) */
export function mapQuickRequestDetailToForm(detail: QuickRequestDetail): QuickRequestEditFormValues {
  const presetCount = isPresetCount(detail.vehicleCount);

  return {
    goodsSize: detail.goodsSize,
    itemDescription: detail.itemDescription,
    vehicleTypes: detail.vehicleTypes as QuickRequestVehicleType[],
    vehicleOtherText: detail.vehicleOtherText ?? '',
    vehicleCountMode: presetCount ? 'preset' : 'custom',
    vehicleCountPreset: presetCount ? detail.vehicleCount : 1,
    vehicleCountCustom: presetCount ? undefined : detail.vehicleCount,
    origin: {
      roadAddress: detail.origin.roadAddress,
      detailAddress: detail.origin.detailAddress,
      contactName: detail.origin.contactName,
      contactPhone: detail.origin.contactPhone,
      scheduleMode: detail.origin.schedule.mode,
      scheduledDatetime:
        detail.origin.schedule.mode === 'scheduled'
          ? isoToLocalDatetimeInput(detail.origin.schedule.datetimeIso)
          : '',
      notes: [...detail.origin.notes],
      memo: detail.origin.memo ?? ''
    },
    stopovers: detail.stopovers.map((stop) => ({
      roadAddress: stop.roadAddress,
      detailAddress: stop.detailAddress,
      contactName: stop.contactName,
      contactPhone: stop.contactPhone
    })),
    destination: {
      roadAddress: detail.destination.roadAddress,
      detailAddress: detail.destination.detailAddress,
      contactName: detail.destination.contactName,
      contactPhone: detail.destination.contactPhone,
      scheduleMode: detail.destination.schedule.mode,
      scheduledDatetime:
        detail.destination.schedule.mode === 'scheduled'
          ? isoToLocalDatetimeInput(detail.destination.schedule.datetimeIso)
          : '',
      notes: [...detail.destination.notes],
      extraMemo: detail.destination.memo ?? ''
    },
    freightPayment: detail.freightPayment,
    estimatedAmount: amountToInput(detail.dispatch.estimatedAmount),
    dispatchVehicleInfo: detail.dispatch.vehicleInfo ?? '',
    driverName: detail.dispatch.driverName ?? '',
    driverPhone: detail.dispatch.driverPhone ?? '',
    finalAmount: amountToInput(detail.finalAmount)
  };
}

function scheduledIso(value: string): string {
  return localDatetimeInputToIso(value) ?? new Date().toISOString();
}

/**
 * 수정 폼 값 → PATCH 후보 본문 (모든 키). 비교와 전송이 같은 정규화를 거치도록
 * 초기값·제출값 모두 이 함수를 통과시킨 뒤 `diffQuickRequestPatch`로 바뀐 키만 고른다.
 */
export function buildQuickRequestPatchCandidate(
  values: QuickRequestEditFormValues,
  options: { includeDispatch: boolean }
): QuickRequestPatchPayload {
  const goodsSize = values.goodsSize === '' ? 'other' : values.goodsSize;
  const isOtherVehicle = values.vehicleTypes.includes('기타');

  const payload: QuickRequestPatchPayload = {
    itemDescription: resolveQuickRequestItemDescription(goodsSize, values.itemDescription),
    goodsSize,
    vehicleTypes: values.vehicleTypes,
    vehicleOtherText: isOtherVehicle ? values.vehicleOtherText.trim() : null,
    vehicleCount: resolveVehicleCount(values),
    freightPayment: values.freightPayment,
    origin: {
      roadAddress: values.origin.roadAddress.trim(),
      detailAddress: values.origin.detailAddress.trim(),
      contactName: values.origin.contactName.trim(),
      contactPhone: values.origin.contactPhone.trim(),
      schedule:
        values.origin.scheduleMode === 'scheduled'
          ? { mode: 'scheduled', datetimeIso: scheduledIso(values.origin.scheduledDatetime) }
          : { mode: 'immediate' },
      notes: values.origin.notes,
      memo: values.origin.memo.trim() || undefined
    },
    stopovers: values.stopovers.map((stop) => ({
      roadAddress: stop.roadAddress.trim(),
      detailAddress: stop.detailAddress.trim(),
      contactName: stop.contactName.trim(),
      contactPhone: stop.contactPhone.trim()
    })),
    destination: {
      roadAddress: values.destination.roadAddress.trim(),
      detailAddress: values.destination.detailAddress.trim(),
      contactName: values.destination.contactName.trim(),
      contactPhone: values.destination.contactPhone.trim(),
      schedule:
        values.destination.scheduleMode === 'scheduled'
          ? { mode: 'scheduled', datetimeIso: scheduledIso(values.destination.scheduledDatetime) }
          : { mode: 'asap' },
      notes: values.destination.notes,
      memo: values.destination.extraMemo.trim() || undefined
    }
  };

  if (options.includeDispatch) {
    const estimatedAmount = parseQuickAmountInput(values.estimatedAmount);
    const finalAmount = parseQuickAmountInput(values.finalAmount);
    if (estimatedAmount != null) payload.estimatedAmount = estimatedAmount;
    payload.dispatchVehicleInfo = values.dispatchVehicleInfo.trim();
    payload.driverName = values.driverName.trim();
    payload.driverPhone = values.driverPhone.trim();
    if (finalAmount != null) payload.finalAmount = finalAmount;
  }

  return payload;
}

/** 최상위 키 단위 깊은 비교 — 바뀐 키만 남긴다 (`origin`·`destination`·`stopovers`는 통째로) */
export function diffQuickRequestPatch(
  initial: QuickRequestPatchPayload,
  next: QuickRequestPatchPayload
): QuickRequestPatchPayload {
  const changed: Record<string, unknown> = {};
  for (const key of QUICK_REQUEST_PATCH_KEYS) {
    const nextValue = next[key as QuickRequestPatchKey];
    if (nextValue === undefined) continue;
    if (JSON.stringify(initial[key]) !== JSON.stringify(nextValue)) {
      changed[key] = nextValue;
    }
  }
  return changed as QuickRequestPatchPayload;
}
