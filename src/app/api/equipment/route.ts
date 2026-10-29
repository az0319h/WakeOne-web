import type { NextRequest } from 'next/server';
import {
  parsePage,
  parsePerPage,
  parseQuery,
  parseScope,
  parseStatusParam,
  pickOne
} from '@/features/asset-ledger/api/filter-utils';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { createEquipment, listEquipment } from '@/features/equipment/api/service.server';
import { EQUIPMENT_KINDS, EQUIPMENT_SORTS, EQUIPMENT_STATUSES } from '@/features/equipment/api/types';
import { parseEquipmentPayload } from '@/features/equipment/schemas/equipment';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  equipmentTargetLabel,
  readJsonObject,
  requireAssetSession
} from '../asset-ledger/_utils';

/** plan 103 — 비품 목록 (로그인 · 비동방 · 역할별 칸 투영) */
export async function GET(request: NextRequest) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const { searchParams } = request.nextUrl;
  try {
    const data = await listEquipment(
      {
        kind: pickOne(searchParams.get('kind'), ['all', ...EQUIPMENT_KINDS] as const, 'all'),
        scope: parseScope(searchParams),
        status: parseStatusParam(searchParams, EQUIPMENT_STATUSES),
        q: parseQuery(searchParams),
        page: parsePage(searchParams),
        perPage: parsePerPage(searchParams),
        sort: pickOne(searchParams.get('sort'), EQUIPMENT_SORTS, 'default')
      },
      session.viewer
    );
    return assetJson(data);
  } catch (error) {
    console.error('[equipment] list failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '비품 목록을 불러오지 못했습니다.');
  }
}

/** plan 103 — 비품 추가 (권한자 · 자산번호 중복 409 · 접두사 불일치 400) */
export async function POST(request: NextRequest) {
  const log = new AssetRouteLog({
    action: 'equipment.create',
    targetType: 'equipment_item',
    method: 'POST',
    path: '/api/equipment',
    targetLabel: equipmentTargetLabel({})
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  const parsed = parseEquipmentPayload(body, 'create');
  if (!parsed.ok) {
    return log.fail(400, parsed.message, { field: parsed.field });
  }
  log.setMetadata({ asset_no: parsed.fields.asset_no, kind: parsed.fields.kind });

  try {
    const item = await createEquipment({
      fields: parsed.fields,
      assignee: parsed.assignee,
      viewer: session.viewer
    });
    log.setTarget(equipmentTargetLabel({ id: item.id, assetNo: item.asset_no }));
    return log.success({ message: '비품을 추가했어요.', item }, 201, {
      equipment_id: item.id,
      status: item.status
    });
  } catch (error) {
    return log.fromError(error, '비품 저장 중 오류가 발생했습니다.');
  }
}
