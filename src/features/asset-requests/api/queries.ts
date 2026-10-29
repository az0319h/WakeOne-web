import { queryOptions } from '@tanstack/react-query';
import { assetRequestKeys } from './keys';
import {
  fetchAssetRequestComments,
  fetchAssetRequestDetail,
  fetchAssetRequests,
  fetchAssetRequestSummary
} from './service';
import type { AssetRequestFilters } from './types';

export { assetRequestKeys };

export function assetRequestListQueryOptions(filters: AssetRequestFilters) {
  return queryOptions({
    queryKey: assetRequestKeys.list(filters),
    queryFn: () => fetchAssetRequests(filters)
  });
}

export function assetRequestDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: assetRequestKeys.detail(id),
    queryFn: () => fetchAssetRequestDetail(id)
  });
}

export function assetRequestCommentsQueryOptions(id: number) {
  return queryOptions({
    queryKey: assetRequestKeys.comments(id),
    queryFn: () => fetchAssetRequestComments(id)
  });
}

/** 사이드바 배지 — 창 포커스·알림 Realtime 수신 시 invalidate */
export function assetRequestSummaryQueryOptions() {
  return queryOptions({
    queryKey: assetRequestKeys.summary(),
    queryFn: fetchAssetRequestSummary,
    staleTime: 30_000
  });
}
