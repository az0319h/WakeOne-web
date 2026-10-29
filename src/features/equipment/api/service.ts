import { toSearchParams } from '@/features/asset-ledger/api/filter-utils';
import { apiClientWithMessage } from '@/lib/api-client';
import type {
  EquipmentDeleteResponse,
  EquipmentDetailApiResponse,
  EquipmentDetailResponse,
  EquipmentFilters,
  EquipmentListApiResponse,
  EquipmentListResponse,
  EquipmentMutationResponse,
  EquipmentNextNumberResponse,
  EquipmentPayload,
  EquipmentPrefix
} from './types';

/** plan 103 — 비품 API 클라이언트 */

export function serializeEquipmentFilters(filters: EquipmentFilters): URLSearchParams {
  return toSearchParams({
    kind: filters.kind && filters.kind !== 'all' ? filters.kind : undefined,
    scope: filters.scope && filters.scope !== 'all' ? filters.scope : undefined,
    status: filters.status,
    q: filters.q?.trim(),
    page: filters.page && filters.page > 1 ? filters.page : undefined,
    perPage: filters.perPage,
    sort: filters.sort && filters.sort !== 'default' ? filters.sort : undefined
  });
}

export async function fetchEquipment(filters: EquipmentFilters = {}): Promise<EquipmentListResponse> {
  const query = serializeEquipmentFilters(filters).toString();
  const response = await apiClientWithMessage<EquipmentListApiResponse>(`/equipment${query ? `?${query}` : ''}`);
  return response.data;
}

export async function fetchEquipmentDetail(id: number): Promise<EquipmentDetailResponse> {
  const response = await apiClientWithMessage<EquipmentDetailApiResponse>(`/equipment/${id}`);
  return response.data;
}

/** 권한자 전용 — 자산번호 자동 제안 */
export async function fetchNextAssetNo(prefix: EquipmentPrefix): Promise<string> {
  const response = await apiClientWithMessage<EquipmentNextNumberResponse>(
    `/equipment/next-number?prefix=${encodeURIComponent(prefix)}`
  );
  return response.data.suggested;
}

export function createEquipment(payload: EquipmentPayload) {
  return apiClientWithMessage<EquipmentMutationResponse>('/equipment', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateEquipment(id: number, payload: Partial<EquipmentPayload>) {
  return apiClientWithMessage<EquipmentMutationResponse>(`/equipment/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteEquipment(id: number) {
  return apiClientWithMessage<EquipmentDeleteResponse>(`/equipment/${id}`, { method: 'DELETE' });
}
