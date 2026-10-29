import { getAssetRequestSummary } from '@/features/asset-requests/api/service.server';
import { assetJson, assetReadError, requireAssetSession } from '../../asset-ledger/_utils';

/**
 * plan 103 — 사이드바·「목록 | 요청」 전환 배지.
 * 권한자: `subscription_pending`·`equipment_pending`(접수대기 수) · 직원: 해당 키 null.
 * 모두: `*_my_open`(내 진행 중 요청 수).
 */
export async function GET() {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  try {
    return assetJson(await getAssetRequestSummary(session.viewer));
  } catch (error) {
    console.error('[asset-requests] summary failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '요청 요약을 불러오지 못했습니다.');
  }
}
