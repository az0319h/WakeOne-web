import type { NextRequest } from 'next/server';
import { suggestNextAssetNo } from '@/features/equipment/api/service.server';
import { EQUIPMENT_PREFIXES, type EquipmentPrefix } from '@/features/equipment/api/types';
import { EQUIPMENT_FIELD_MESSAGES } from '@/features/equipment/schemas/equipment';
import {
  assetJson,
  assetReadError,
  forbiddenResponse,
  requireAssetSession
} from '../../asset-ledger/_utils';

/**
 * plan 103 — 자산번호 자동 제안 (권한자 · READ라 activity log Out).
 * `?prefix=N` → `{ success, data: { prefix:'N', suggested:'N-030' } }` (같은 접두사 최대 번호 +1 · 3자리 zero-pad)
 */
export async function GET(request: NextRequest) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;
  if (!session.viewer.isManager) return forbiddenResponse();

  const prefix = request.nextUrl.searchParams.get('prefix')?.trim().toUpperCase() ?? '';
  if (!(EQUIPMENT_PREFIXES as readonly string[]).includes(prefix)) {
    return assetReadError(400, EQUIPMENT_FIELD_MESSAGES.invalidPrefix);
  }

  try {
    const suggested = await suggestNextAssetNo(prefix as EquipmentPrefix);
    return assetJson({ prefix, suggested });
  } catch (error) {
    console.error('[equipment] next-number failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '자산번호를 계산하지 못했습니다.');
  }
}
