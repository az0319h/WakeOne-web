import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { formatPhoneDisplay } from '@/lib/phone';
import { resolveVehicleCount, type QuickRequestFormValues } from '../schemas/quick-request-form';
import { localDatetimeInputToIso } from './datetime-local';
import {
  formatQuickRequestGoodsSizeLabel,
  resolveQuickRequestItemDescription
} from './quick-request-goods-visuals';

function formatLocationBlock(
  title: string,
  roadAddress: string,
  detailAddress: string,
  contactName: string,
  contactPhone: string
): string {
  const phone = formatPhoneDisplay(contactPhone) ?? contactPhone;
  return [
    title,
    `  주소: ${roadAddress}`,
    `  상세: ${detailAddress}`,
    `  담당: ${contactName} ${phone}`
  ].join('\n');
}

function formatOriginSchedule(origin: QuickRequestFormValues['origin']): string {
  if (origin.scheduleMode === 'immediate') {
    return '즉시 요청';
  }
  const iso = localDatetimeInputToIso(origin.scheduledDatetime);
  return iso ? formatAbsoluteDateTimeKo(iso) : origin.scheduledDatetime;
}

function formatDestinationSchedule(destination: QuickRequestFormValues['destination']): string {
  if (destination.scheduleMode === 'asap') {
    return '최대한 빠르게';
  }
  const iso = localDatetimeInputToIso(destination.scheduledDatetime);
  return iso ? formatAbsoluteDateTimeKo(iso) : destination.scheduledDatetime;
}

function freightPaymentLabel(payment: QuickRequestFormValues['freightPayment']): string {
  return payment === 'collect' ? '착불' : '월정산';
}

function formatVehicleLine(values: QuickRequestFormValues): string {
  const types = values.vehicleTypes.join(', ');
  const count = resolveVehicleCount(values);
  const other =
    values.vehicleTypes.includes('기타') && values.vehicleOtherText.trim()
      ? ` (${values.vehicleOtherText.trim()})`
      : '';
  return `차량: ${types}${other} · ${count}대`;
}

/** plan 92 D-9 — 등록 전 미리보기 Dialog 본문 전용 텍스트 (외부 발송 없음) */
export function formatQuickRequestPreviewText(
  values: QuickRequestFormValues,
  requesterName: string,
  requestedAt: Date
): string {
  const item = resolveQuickRequestItemDescription(values.goodsSize, values.itemDescription);
  const lines = [
    '🚚 새 퀵 요청',
    '',
    `요청자: ${requesterName}`,
    `요청 시각: ${formatAbsoluteDateTimeKo(requestedAt)}`,
    '',
    `크기: ${formatQuickRequestGoodsSizeLabel(values.goodsSize) ?? '—'}`,
    // plan 87 r1 — `물품:` 줄은 「기타」일 때만 `크기:` 다음 줄
    ...(item ? [`물품: ${item}`] : []),
    formatVehicleLine(values),
    '',
    formatLocationBlock(
      '출발',
      values.origin.roadAddress,
      values.origin.detailAddress,
      values.origin.contactName,
      values.origin.contactPhone
    ),
    `  픽업 일시: ${formatOriginSchedule(values.origin)}`
  ];

  if (values.origin.notes.length > 0) {
    lines.push(`  출발 특이: ${values.origin.notes.join(', ')}`);
  }

  const pickupMemo = values.origin.memo.trim();
  if (pickupMemo) {
    lines.push(`  픽업 메모: ${pickupMemo}`);
  }

  values.stopovers.forEach((stop, index) => {
    lines.push(
      '',
      formatLocationBlock(
        `경유 ${index + 1}`,
        stop.roadAddress,
        stop.detailAddress,
        stop.contactName,
        stop.contactPhone
      )
    );
  });

  lines.push(
    '',
    formatLocationBlock(
      '도착',
      values.destination.roadAddress,
      values.destination.detailAddress,
      values.destination.contactName,
      values.destination.contactPhone
    ),
    `  도착 희망: ${formatDestinationSchedule(values.destination)}`
  );

  if (values.destination.notes.length > 0) {
    lines.push(`  도착 특이: ${values.destination.notes.join(', ')}`);
  }

  const extraMemo = values.destination.extraMemo.trim();
  if (extraMemo) {
    lines.push(`  추가 메모: ${extraMemo}`);
  }

  lines.push(
    '',
    `배송비: ${freightPaymentLabel(values.freightPayment)}`,
    '💳 결제: 월정산',
    '',
    '동방특송 담당자님, 접수 및 배차 부탁드립니다.'
  );

  return lines.join('\n');
}
