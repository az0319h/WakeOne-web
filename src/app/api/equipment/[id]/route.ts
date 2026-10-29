import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import {
  deleteEquipment,
  getEquipmentDetail,
  updateEquipment
} from '@/features/equipment/api/service.server';
import { parseEquipmentPayload } from '@/features/equipment/schemas/equipment';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  equipmentTargetLabel,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 비품 단건 + 보는 사람 기준 요청 목록 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const id = parsePositiveId((await params).id);
  if (!id) return assetReadError(404, ASSET_MESSAGES.notFound);

  try {
    const data = await getEquipmentDetail(id, session.viewer);
    if (!data) return assetReadError(404, ASSET_MESSAGES.notFound);
    return assetJson(data);
  } catch (error) {
    console.error('[equipment] detail failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '비품 정보를 불러오지 못했습니다.');
  }
}

/** plan 103 — 비품 수정 (권한자) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'equipment.update',
    targetType: 'equipment_item',
    method: 'PATCH',
    path: `/api/equipment/${rawId}`,
    targetLabel: equipmentTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_MESSAGES.notFound);
  log.setMetadata({ equipment_id: id });

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  const parsed = parseEquipmentPayload(body, 'update');
  if (!parsed.ok) {
    return log.fail(400, parsed.message, { field: parsed.field });
  }

  try {
    const result = await updateEquipment({
      id,
      fields: parsed.fields,
      assignee: parsed.assignee,
      viewer: session.viewer
    });
    if (!result) return log.fail(404, ASSET_MESSAGES.notFound);
    const { item } = result;
    log.setTarget(equipmentTargetLabel({ id: item.id, assetNo: item.asset_no }));
    return log.success({ message: '비품을 저장했어요.', item }, 200, {
      asset_no: item.asset_no,
      kind: item.kind,
      status: item.status,
      changed_fields: result.changedFields
    });
  } catch (error) {
    return log.fromError(error, '비품 저장 중 오류가 발생했습니다.');
  }
}

/** plan 103 — 비품 삭제 (권한자 · 요청 0건일 때만 · 아니면 409) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'equipment.delete',
    targetType: 'equipment_item',
    method: 'DELETE',
    path: `/api/equipment/${rawId}`,
    targetLabel: equipmentTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_MESSAGES.notFound);
  log.setMetadata({ equipment_id: id });

  try {
    const deleted = await deleteEquipment(id);
    if (!deleted) return log.fail(404, ASSET_MESSAGES.notFound);
    log.setTarget(equipmentTargetLabel({ id: deleted.id, assetNo: deleted.asset_no }));
    return log.success({ message: '삭제했어요.', id: deleted.id }, 200, {
      asset_no: deleted.asset_no,
      kind: deleted.kind,
      status: deleted.status
    });
  } catch (error) {
    return log.fromError(error, '비품 삭제 중 오류가 발생했습니다.');
  }
}
