import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  changeAssetRequestAssignee,
  targetIdOf,
  toRequestDetail
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetRequestTargetLabel,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 담당자 변경 `{assignee_user_id}` (권한자 · 처리중만 · 후보 = active 권한자) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'asset_request.assignee_update',
    targetType: 'asset_request',
    method: 'PATCH',
    path: `/api/asset-requests/${rawId}/assignee`,
    targetLabel: assetRequestTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  log.setMetadata({ asset_request_id: id });

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  try {
    const { after, changed } = await changeAssetRequestAssignee({
      id,
      viewer: session.viewer,
      assigneeUserId: body.assignee_user_id
    });
    log.setTarget(
      assetRequestTargetLabel({ id, targetType: after.target_type, targetId: targetIdOf(after) }),
      after.assignee_user_id
    );

    if (changed) {
      await notifyAssetRequestEvent({ event: 'assigned', request: after, actorUserId: session.userId });
    }

    const detail = await toRequestDetail(after);
    return log.success({ message: '담당자를 바꿨어요.', request: detail }, 200, {
      target_type: after.target_type,
      target_id: targetIdOf(after),
      ...(after.assignee_user_id ? { assignee_user_id: after.assignee_user_id } : {}),
      changed_fields: changed ? ['assignee_user_id'] : []
    });
  } catch (error) {
    return log.fromError(error, '담당자 변경 중 오류가 발생했습니다.');
  }
}
