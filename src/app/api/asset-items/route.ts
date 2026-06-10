import { NextRequest, NextResponse } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAssetLedgerSession } from '@/features/auth/api/session.server';
import {
  createAssetItem,
  listAssetItems,
  listAssetLedgerDepartments,
  validateUsageLocation
} from '@/features/asset-ledger/api/service.server';
import { ASSET_ITEM_STATUSES, ASSET_CATEGORY_NONE_SENTINEL } from '@/features/asset-ledger/api/types';
import type { AssetItemsFilters } from '@/features/asset-ledger/api/types';
import { normalizeAssetNumber, assetItemCreateSchema } from '@/features/asset-ledger/api/validators';
import { assetTargetLabel, logAssetAuthFailure, newAssetRequestId } from './_utils';

function getSingleSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
  const values = searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
  return values.at(-1);
}

function getAssetStatusFilter(searchParams: URLSearchParams): AssetItemsFilters['status'] {
  const status = getSingleSearchParam(searchParams, 'status');
  if (!status) {
    return undefined;
  }

  if (status === 'all') {
    return 'all';
  }

  return ASSET_ITEM_STATUSES.includes(status as (typeof ASSET_ITEM_STATUSES)[number])
    ? (status as (typeof ASSET_ITEM_STATUSES)[number])
    : undefined;
}

function getAssetCategoryFilter(searchParams: URLSearchParams) {
  const category = getSingleSearchParam(searchParams, 'category');
  if (!category) {
    return undefined;
  }

  return category === ASSET_CATEGORY_NONE_SENTINEL ? ASSET_CATEGORY_NONE_SENTINEL : category;
}

function resolveValidationMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '비품 등록 중 오류가 발생했습니다.';
  }

  if (error.message.includes('asset_items_asset_number_key')) {
    return '이미 사용 중인 자산번호입니다.';
  }

  if (error.message.includes('asset_items_actual_user_id_fkey')) {
    return '실사용자를 찾을 수 없습니다.';
  }

  return error.message;
}

export async function GET(request: NextRequest) {
  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const result = await listAssetItems({
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 10),
      search: searchParams.get('search') ?? undefined,
      status: getAssetStatusFilter(searchParams),
      category: getAssetCategoryFilter(searchParams),
      sort: searchParams.get('sort') ?? undefined
    });

    return NextResponse.json({
      success: true,
      message: '비품 목록을 불러왔습니다.',
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '비품 목록 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = newAssetRequestId();
  const httpPath = '/api/asset-items';

  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return logAssetAuthFailure({
      requestId,
      action: 'asset.create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: assetTargetLabel({}),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  try {
    const body = await request.json();
    const parsed = assetItemCreateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.create',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({}),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', message)
        },
        { success: false, message },
        400
      );
    }

    const payload = {
      ...parsed.data,
      asset_number: normalizeAssetNumber(parsed.data.asset_number)
    };

    const departments = await listAssetLedgerDepartments();
    try {
      payload.usage_location = validateUsageLocation(parsed.data.usage_location, departments);
    } catch (validationError) {
      const message =
        validationError instanceof Error ? validationError.message : '사용처 값이 올바르지 않습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.create',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({}),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', message)
        },
        { success: false, message },
        400
      );
    }

    const created = await createAssetItem(payload, session.userId);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.create',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({
          id: created.id,
          assetNumber: created.asset_number,
          assetName: created.asset_name
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          asset_number: created.asset_number,
          asset_name: created.asset_name,
          status: created.status,
          category: created.category ?? undefined,
          usage_location: created.usage_location ?? undefined
        }
      },
      { success: true, message: '비품이 등록되었습니다.', item: created },
      201
    );
  } catch (error) {
    const message = resolveValidationMessage(error);
    const status = message === '비품 등록 중 오류가 발생했습니다.' ? 500 : 400;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.create',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({}),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 500 ? 'internal_error' : 'validation', message)
      },
      { success: false, message },
      status
    );
  }
}
