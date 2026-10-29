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
import { parseSubscriptionPayload } from '@/features/subscriptions/schemas/subscription';
import { createSubscription, listSubscriptions } from '@/features/subscriptions/api/service.server';
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_SORTS,
  SUBSCRIPTION_STATUSES
} from '@/features/subscriptions/api/types';
import {
  AssetRouteLog,
  assetJson,
  assetReadError,
  forbiddenResponse,
  readJsonObject,
  requireAssetSession,
  subscriptionTargetLabel,
  truncateForLog
} from '../asset-ledger/_utils';

/** plan 103 — 구독 목록 (로그인 · 비동방 · 역할별 칸 투영) */
export async function GET(request: NextRequest) {
  const session = await requireAssetSession();
  if (!session.ok) return session.response;

  const { searchParams } = request.nextUrl;
  const card = searchParams.get('card')?.trim() || undefined;
  if (card && !session.viewer.isManager) {
    return forbiddenResponse();
  }
  if (card && !/^\d{4}$/.test(card)) {
    return assetReadError(400, '카드 끝 4자리가 올바르지 않아요.');
  }

  try {
    const data = await listSubscriptions(
      {
        category: pickOne(searchParams.get('category'), ['all', ...SUBSCRIPTION_CATEGORIES] as const, 'all'),
        scope: parseScope(searchParams),
        status: parseStatusParam(searchParams, SUBSCRIPTION_STATUSES),
        card,
        q: parseQuery(searchParams),
        page: parsePage(searchParams),
        perPage: parsePerPage(searchParams),
        sort: pickOne(searchParams.get('sort'), SUBSCRIPTION_SORTS, 'default')
      },
      session.viewer
    );
    return assetJson(data);
  } catch (error) {
    console.error('[subscriptions] list failed:', error instanceof Error ? error.message : error);
    return assetReadError(500, '구독 목록을 불러오지 못했습니다.');
  }
}

/** plan 103 — 구독 추가 (권한자 · activity log subscription.create 전 분기) */
export async function POST(request: NextRequest) {
  const log = new AssetRouteLog({
    action: 'subscription.create',
    targetType: 'subscription',
    method: 'POST',
    path: '/api/subscriptions',
    targetLabel: subscriptionTargetLabel({})
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!session.viewer.isManager) {
    return log.fail(403, ASSET_MESSAGES.forbidden);
  }

  const body = await readJsonObject(request);
  if (!body) {
    return log.fail(400, ASSET_MESSAGES.invalidBody);
  }

  const parsed = parseSubscriptionPayload(body, 'create');
  if (!parsed.ok) {
    return log.fail(400, parsed.message, { field: parsed.field });
  }

  try {
    const item = await createSubscription({
      fields: parsed.fields,
      assignees: parsed.assignees ?? [],
      viewer: session.viewer
    });
    log.setTarget(subscriptionTargetLabel({ id: item.id, name: item.name }));
    return log.success({ message: '구독을 추가했어요.', item }, 201, {
      subscription_id: item.id,
      name: truncateForLog(item.name),
      category: item.category,
      status: item.status,
      assignee_count: item.assignees.length
    });
  } catch (error) {
    return log.fromError(error, '구독 저장 중 오류가 발생했습니다.');
  }
}
