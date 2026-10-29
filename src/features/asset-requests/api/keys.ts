import type { AssetRequestFilters } from './types';

export const assetRequestKeys = {
  all: ['asset-requests'] as const,
  lists: () => [...assetRequestKeys.all, 'list'] as const,
  list: (filters: AssetRequestFilters) => [...assetRequestKeys.lists(), filters] as const,
  details: () => [...assetRequestKeys.all, 'detail'] as const,
  detail: (id: number) => [...assetRequestKeys.details(), id] as const,
  comments: (id: number) => [...assetRequestKeys.detail(id), 'comments'] as const,
  /** 사이드바 배지 · 「목록 | 요청」 전환 배지 */
  summary: () => [...assetRequestKeys.all, 'summary'] as const
};
