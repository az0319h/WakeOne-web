import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  getAssetRequestDetail,
  targetIdOf,
  toRequestDetail,
  updateAssetRequestContent
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  assetRequestTargetLabel,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 요청 1건 (요청자·권한자 · 그 외 404) + 보는 사람 기준 버튼 플래그 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const id = parsePositiveId((await params).id);
  if (!id) return assetReadError(404, ASSET_REQUEST_MESSAGES.notFound);

  try {
    const data = await getAssetRequestDetail(id, session.viewer);
    if (!data) return assetReadError(404, ASSET_REQUEST_MESSAGES.notFound);
    return assetJson(data);
  } catch (error) {
    console.error('[asset-requests] detail failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '요청을 불러오지 못했습니다.');
  }
}

/** plan 103 — 요청 수정 (요청자 · 접수대기만 · 처리중이면 403 「접수대기일 때만 수정·취소할 수 있어요.」) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'asset_request.update',
    targetType: 'asset_request',
    method: 'PATCH',
    path: `/api/asset-requests/${rawId}`,
    targetLabel: assetRequestTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  log.setMetadata({ asset_request_id: id });

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  try {
    const result = await updateAssetRequestContent({
      id,
      viewer: session.viewer,
      requestType: body.request_type,
      body: body.body
    });
    const { after } = result;
    log.setTarget(
      assetRequestTargetLabel({ id, targetType: after.target_type, targetId: targetIdOf(after) }),
      after.requester_user_id
    );

    if (result.changedFields.length > 0) {
      await notifyAssetRequestEvent({ event: 'updated', request: after, actorUserId: session.userId });
    }

    const detail = await toRequestDetail(after);
    return log.success({ message: '요청을 수정했어요.', request: detail }, 200, {
      target_type: after.target_type,
      target_id: targetIdOf(after),
      request_type: after.request_type,
      changed_fields: result.changedFields,
      body_length: after.body.length
    });
  } catch (error) {
    return log.fromError(error, '요청 수정 중 오류가 발생했습니다.');
  }
}
