import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import {
  deleteSubscription,
  getSubscriptionDetail,
  updateSubscription
} from '@/features/subscriptions/api/service.server';
import { parseSubscriptionPayload } from '@/features/subscriptions/schemas/subscription';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  parsePositiveId,
  readJsonObject,
  requireAssetSession,
  subscriptionTargetLabel,
  truncateForLog
} from '../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string }> };

/** plan 103 — 구독 단건 + 보는 사람 기준 요청 목록 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const id = parsePositiveId((await params).id);
  if (!id) return assetReadError(404, ASSET_MESSAGES.notFound);

  try {
    const data = await getSubscriptionDetail(id, session.viewer);
    if (!data) return assetReadError(404, ASSET_MESSAGES.notFound);
    return assetJson(data);
  } catch (error) {
    console.error('[subscriptions] detail failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '구독 정보를 불러오지 못했습니다.');
  }
}

/** plan 103 — 구독 수정 (권한자 · 대상자 배열은 보내면 통째로 교체) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'subscription.update',
    targetType: 'subscription',
    method: 'PATCH',
    path: `/api/subscriptions/${rawId}`,
    targetLabel: subscriptionTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_MESSAGES.notFound);
  log.setMetadata({ subscription_id: id });

  const body = await readJsonObject(request);
  if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

  const parsed = parseSubscriptionPayload(body, 'update');
  if (!parsed.ok) {
    return log.fail(400, parsed.message, { field: parsed.field });
  }

  try {
    const result = await updateSubscription({
      id,
      fields: parsed.fields,
      assignees: parsed.assignees,
      viewer: session.viewer
    });
    if (!result) return log.fail(404, ASSET_MESSAGES.notFound);

    const { item } = result;
    log.setTarget(subscriptionTargetLabel({ id: item.id, name: item.name }));
    return log.success({ message: '구독을 저장했어요.', item }, 200, {
      name: truncateForLog(item.name),
      category: item.category,
      status: item.status,
      changed_fields: result.changedFields,
      assignee_count: result.assigneeCount
    });
  } catch (error) {
    return log.fromError(error, '구독 저장 중 오류가 발생했습니다.');
  }
}

/** plan 103 — 구독 삭제 (권한자 · 요청 0건일 때만 · 아니면 409) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const rawId = (await params).id;
  const log = new AssetRouteLog({
    action: 'subscription.delete',
    targetType: 'subscription',
    method: 'DELETE',
    path: `/api/subscriptions/${rawId}`,
    targetLabel: subscriptionTargetLabel({ id: rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const id = parsePositiveId(rawId);
  if (!id) return log.fail(404, ASSET_MESSAGES.notFound);
  log.setMetadata({ subscription_id: id });

  try {
    const deleted = await deleteSubscription(id);
    if (!deleted) return log.fail(404, ASSET_MESSAGES.notFound);
    log.setTarget(subscriptionTargetLabel({ id: deleted.id, name: deleted.name }));
    return log.success({ message: '삭제했어요.', id: deleted.id }, 200, {
      name: truncateForLog(deleted.name),
      category: deleted.category,
      status: deleted.status
    });
  } catch (error) {
    return log.fromError(error, '구독 삭제 중 오류가 발생했습니다.');
  }
}
