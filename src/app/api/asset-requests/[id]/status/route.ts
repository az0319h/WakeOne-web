import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  changeAssetRequestStatus,
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

const SUCCESS_MESSAGE: Record<string, string> = {
  in_progress: '처리를 시작했어요.',
  completed: '완료 처리했어요.',
  rejected: '반려했어요.'
};

/**
 * plan 103 — 권한자 상태 변경 `{status:'in_progress'|'completed'|'rejected', reject_reason?}`.
 * 전이 규칙 서버 강제(§요청 상태 전이) · 처리 시작 시 담당자 비어 있으면 행위자 · 반려는 담당자를 바꾸지 않는다.
 * 요청이 끝나도 대장 행은 자동으로 바뀌지 않는다(D-16).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'asset_request.status_update',
    targetType: 'asset_request',
    method: 'POST',
    path: `/api/asset-requests/${rawId}/status`,
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
  if (typeof body.status === 'string') {
    log.setMetadata({ new_status: body.status.slice(0, 20) });
  }

  try {
    const { before, after } = await changeAssetRequestStatus({
      id,
      viewer: session.viewer,
      status: body.status,
      rejectReason: body.reject_reason
    });
    log.setTarget(
      assetRequestTargetLabel({ id, targetType: after.target_type, targetId: targetIdOf(after) }),
      after.requester_user_id
    );

    await notifyAssetRequestEvent({
      event: 'status_changed',
      request: after,
      actorUserId: session.userId,
      previousStatus: before.status,
      newStatus: after.status
    });

    const detail = await toRequestDetail(after);
    return log.success({ message: SUCCESS_MESSAGE[after.status] ?? '상태를 바꿨어요.', request: detail }, 200, {
      target_type: after.target_type,
      target_id: targetIdOf(after),
      request_type: after.request_type,
      previous_status: before.status,
      new_status: after.status,
      ...(after.assignee_user_id ? { assignee_user_id: after.assignee_user_id } : {})
    });
  } catch (error) {
    return log.fromError(error, '상태 변경 중 오류가 발생했습니다.');
  }
}
