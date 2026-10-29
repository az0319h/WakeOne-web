'use client';

import { useQuery } from '@tanstack/react-query';
import { useNavAccessFlags } from '@/contexts/nav-access';
import { assetRequestSummaryQueryOptions } from '../api/queries';
import type { AssetTargetType } from '../api/types';

/**
 * plan 103 AC-34 — 사이드바 「구독 관리」/「비품 관리」 처리 대기 수.
 * 권한자가 아니면 조회하지 않고 0(배지 없음). summary는 요청 mutation `onSettled` · 창 포커스 · 알림 Realtime에서 갱신.
 */
export function useAssetPendingCount(targetType: AssetTargetType): number {
  const { isAssetManager } = useNavAccessFlags();
  const { data } = useQuery({ ...assetRequestSummaryQueryOptions(), enabled: isAssetManager });
  if (!isAssetManager || !data) return 0;
  const count = targetType === 'subscription' ? data.subscription_pending : data.equipment_pending;
  return count ?? 0;
}
