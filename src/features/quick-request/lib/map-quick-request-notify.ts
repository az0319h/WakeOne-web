import type { QuickRequestNotifyPayload } from '../api/types';
import {
  isQuickRequestGoodsSize,
  quickRequestFormSchema,
  resolveVehicleCount,
  type QuickRequestFormValues
} from '../schemas/quick-request-form';
import { localDatetimeInputToIso } from './datetime-local';
import { resolveQuickRequestItemDescription } from './quick-request-goods-visuals';

function mapOriginSchedule(origin: QuickRequestFormValues['origin']) {
  if (origin.scheduleMode === 'immediate') {
    return { mode: 'immediate' as const };
  }
  const iso = localDatetimeInputToIso(origin.scheduledDatetime);
  return {
    mode: 'scheduled' as const,
    datetimeIso: iso ?? new Date().toISOString()
  };
}

function mapDestinationSchedule(destination: QuickRequestFormValues['destination']) {
  if (destination.scheduleMode === 'asap') {
    return { mode: 'asap' as const };
  }
  const iso = localDatetimeInputToIso(destination.scheduledDatetime);
  return {
    mode: 'scheduled' as const,
    datetimeIso: iso ?? new Date().toISOString()
  };
}

export function mapFormValuesToNotifyPayload(
  values: QuickRequestFormValues,
  requesterName: string,
  requestedAtIso: string
): QuickRequestNotifyPayload {
  const parsed = quickRequestFormSchema.parse(values);
  const vehicleCount = resolveVehicleCount(parsed);
  const { goodsSize } = parsed;
  if (!isQuickRequestGoodsSize(goodsSize)) {
    throw new Error('물품 크기를 선택해 주세요.');
  }

  return {
    itemDescription: resolveQuickRequestItemDescription(goodsSize, parsed.itemDescription),
    goodsSize,
    vehicleTypes: parsed.vehicleTypes,
    vehicleOtherText: parsed.vehicleTypes.includes('기타')
      ? parsed.vehicleOtherText.trim()
      : undefined,
    vehicleCount,
    origin: {
      roadAddress: parsed.origin.roadAddress.trim(),
      detailAddress: parsed.origin.detailAddress.trim(),
      contactName: parsed.origin.contactName.trim(),
      contactPhone: parsed.origin.contactPhone.trim(),
      schedule: mapOriginSchedule(parsed.origin),
      notes: parsed.origin.notes,
      memo: parsed.origin.memo.trim() || undefined
    },
    stopovers: parsed.stopovers.map((stop) => ({
      roadAddress: stop.roadAddress.trim(),
      detailAddress: stop.detailAddress.trim(),
      contactName: stop.contactName.trim(),
      contactPhone: stop.contactPhone.trim()
    })),
    destination: {
      roadAddress: parsed.destination.roadAddress.trim(),
      detailAddress: parsed.destination.detailAddress.trim(),
      contactName: parsed.destination.contactName.trim(),
      contactPhone: parsed.destination.contactPhone.trim(),
      schedule: mapDestinationSchedule(parsed.destination),
      notes: parsed.destination.notes,
      memo: parsed.destination.extraMemo.trim() || undefined
    },
    freightPayment: parsed.freightPayment,
    requestedAtIso,
    requesterName
  };
}
