import { listAssigneeOptions } from '@/features/asset-ledger/api/assignees.server';
import { assetJson, assetReadError, forbiddenResponse, requireAssetSession } from '../_utils';

/**
 * plan 103 — 대상자·사용자 후보 + 요청 담당자 후보 (권한자 전용 · READ라 activity log Out).
 * people = active · 비동방(applyDongbangScope) · teams = RANK_BY_AFFILIATION(ORG 소속) · affiliations = ORG 3소속 ·
 * managers = active 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀 · AC-29 담당자 변경 후보 · designer C-15)
 */
export async function GET() {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;
  if (!session.viewer.isManager) return forbiddenResponse();

  try {
    return assetJson(await listAssigneeOptions());
  } catch (error) {
    console.error('[asset-ledger] assignee options failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '대상자 목록을 불러오지 못했습니다.');
  }
}
