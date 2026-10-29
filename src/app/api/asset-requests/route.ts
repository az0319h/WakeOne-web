import type { NextRequest } from 'next/server';
import { parsePage, parsePerPage, pickOne } from '@/features/asset-ledger/api/filter-utils';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  createAssetRequest,
  listAssetRequests,
  toRequestDetail
} from '@/features/asset-requests/api/service.server';
import {
  ASSET_REQUEST_STATUS_FILTERS,
  ASSET_TARGET_TYPES,
  type AssetTargetType
} from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  assetRequestTargetLabel,
  forbiddenResponse,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../asset-ledger/_utils';

function isTargetType(value: unknown): value is AssetTargetType {
  return typeof value === 'string' && (ASSET_TARGET_TYPES as readonly string[]).includes(value);
}

/**
 * plan 103 — 요청 목록. `target_type` 필수 · `status` open(기본)|done|all · `mine_assigned=1`(권한자 전용 · 직원 403).
 * 직원은 본인 요청만 · 권한자는 전부.
 */
export async function GET(request: NextRequest) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const { searchParams } = request.nextUrl;
  const targetType = searchParams.get('target_type');
  if (!isTargetType(targetType)) {
    return assetReadError(400, '요청 종류(target_type)가 필요합니다.');
  }
  const mineAssigned = searchParams.get('mine_assigned') === '1' || searchParams.get('mine_assigned') === 'true';
  if (mineAssigned && !session.viewer.isManager) {
    return forbiddenResponse();
  }

  try {
    const data = await listAssetRequests(
      {
        target_type: targetType,
        status: pickOne(searchParams.get('status'), ASSET_REQUEST_STATUS_FILTERS, 'open'),
        mine_assigned: mineAssigned,
        page: parsePage(searchParams),
        perPage: parsePerPage(searchParams)
      },
      session.viewer
    );
    return assetJson(data);
  } catch (error) {
    console.error('[asset-requests] list failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '요청 목록을 불러오지 못했습니다.');
  }
}

/** plan 103 — 요청 만들기 (로그인 · 비동방 누구나 · 같은 사람·같은 줄 진행 중 중복 409) */
export async function POST(request: NextRequest) {
  const log = new AssetRouteLog({
    action: 'asset_request.create',
    targetType: 'asset_request',
    method: 'POST',
    path: '/api/asset-requests',
    targetLabel: assetRequestTargetLabel({})
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  if (!isTargetType(body.target_type)) {
    return log.fail(400, '요청 대상 종류가 올바르지 않아요.', { field: 'target_type' });
  }
  const targetType = body.target_type;
  const targetId =
    typeof body.target_id === 'number'
      ? body.target_id
      : typeof body.target_id === 'string'
        ? parsePositiveId(body.target_id)
        : null;
  if (!targetId || !Number.isSafeInteger(targetId) || targetId <= 0) {
    return log.fail(400, '요청 대상이 올바르지 않아요.', { field: 'target_id' });
  }
  log.setTarget(assetRequestTargetLabel({ targetType, targetId }));
  log.setMetadata({
    target_type: targetType,
    target_id: targetId,
    ...(typeof body.request_type === 'string' ? { request_type: body.request_type.slice(0, 20) } : {})
  });

  try {
    const row = await createAssetRequest({
      viewer: session.viewer,
      targetType,
      targetId,
      requestType: body.request_type,
      body: body.body
    });
    log.setTarget(assetRequestTargetLabel({ id: row.id, targetType, targetId }), session.userId);

    await notifyAssetRequestEvent({ event: 'created', request: row, actorUserId: session.userId });

    const detail = await toRequestDetail(row);
    return log.success({ message: '요청을 보냈어요.', request: detail }, 201, {
      asset_request_id: row.id,
      request_type: row.request_type,
      new_status: row.status,
      body_length: row.body.length
    });
  } catch (error) {
    return log.fromError(error, '요청 등록 중 오류가 발생했습니다.');
  }
}
