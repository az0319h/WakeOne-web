import type { QuickRequestGoodsSize, QuickRequestRouteSummary } from '../api/types';
import { QUICK_REQUEST_GOODS_VISUALS } from './quick-request-goods-visuals';

/** 표·카드 경로 문자열 — `서울 강남구 → 서울 용산구` */
export function formatQuickRouteLabel(route: QuickRequestRouteSummary): string {
  return `${route.from} → ${route.to}`;
}

/** 물품 크기 라벨 (`소형` · `기타`) */
export function formatQuickGoodsLabel(goodsSize: QuickRequestGoodsSize): string {
  return QUICK_REQUEST_GOODS_VISUALS[goodsSize]?.title ?? '기타';
}

type VehicleSource = {
  vehicleTypes: string[];
  vehicleOtherText: string | null;
  vehicleCount: number;
};

function formatVehicleType(type: string, otherText: string | null): string {
  const other = otherText?.trim();
  return type === '기타' && other ? `기타(${other})` : type;
}

/** 표·카드 2줄 — `오토바이 외 1종 · 2대` */
export function formatQuickVehicleSummary(source: VehicleSource): string {
  const [first, ...rest] = source.vehicleTypes;
  const vehicle = first
    ? `${formatVehicleType(first, source.vehicleOtherText)}${rest.length > 0 ? ` 외 ${rest.length}종` : ''}`
    : '—';
  return `${vehicle} · ${source.vehicleCount}대`;
}

/** 상세 — 차량 종류 전체 (`오토바이, 기타(크레인)`) */
export function formatQuickVehicleTypes(source: VehicleSource): string {
  if (source.vehicleTypes.length === 0) {
    return '—';
  }
  return source.vehicleTypes
    .map((type) => formatVehicleType(type, source.vehicleOtherText))
    .join(', ');
}

export function formatQuickFreightLabel(freightPayment: 'monthly' | 'collect'): string {
  return freightPayment === 'collect' ? '착불' : '월정산';
}
