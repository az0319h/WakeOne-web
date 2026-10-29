import { queryOptions } from '@tanstack/react-query';
import { equipmentKeys } from './keys';
import { fetchEquipment, fetchEquipmentDetail, fetchNextAssetNo } from './service';
import type { EquipmentFilters, EquipmentPrefix } from './types';

export { equipmentKeys };

export function equipmentListQueryOptions(filters: EquipmentFilters = {}) {
  return queryOptions({
    queryKey: equipmentKeys.list(filters),
    queryFn: () => fetchEquipment(filters)
  });
}

export function equipmentDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: equipmentKeys.detail(id),
    queryFn: () => fetchEquipmentDetail(id)
  });
}

/** 권한자 전용 — 매번 최신 최대값을 보도록 staleTime 0 */
export function nextAssetNoQueryOptions(prefix: EquipmentPrefix) {
  return queryOptions({
    queryKey: equipmentKeys.nextNumber(prefix),
    queryFn: () => fetchNextAssetNo(prefix),
    staleTime: 0
  });
}
