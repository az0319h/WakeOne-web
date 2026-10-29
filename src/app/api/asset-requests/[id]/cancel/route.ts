import type { NextRequest } from 'next/server';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  cancelAssetRequest,
  targetIdOf,
  toRequestDetail
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetRequestTargetLabel,
  parsePositiveId,
  requireAssetSession
} from '../../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 요청 취소 (요청자 · 접수대기만 → canceled · 되돌릴 수 없음) */
export async function POST(_request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'asset_request.cancel',
    targetType: 'asset_request',
    method: 'POST',
    path: `/api/asset-requests/${rawId}/cancel`,
    targetLabel: assetRequestTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  log.setMetadata({ asset_request_id: id });

  try {
    const { before, after } = await cancelAssetRequest({ id, viewer: session.viewer });
    log.setTarget(
      assetRequestTargetLabel({ id, targetType: after.target_type, targetId: targetIdOf(after) }),
      after.requester_user_id
    );

    await notifyAssetRequestEvent({ event: 'canceled', request: after, actorUserId: session.userId });

    const detail = await toRequestDetail(after);
    return log.success({ message: '요청을 취소했어요.', request: detail }, 200, {
      target_type: after.target_type,
      target_id: targetIdOf(after),
      request_type: after.request_type,
      previous_status: before.status,
      new_status: after.status
    });
  } catch (error) {
    return log.fromError(error, '요청 취소 중 오류가 발생했습니다.');
  }
}
