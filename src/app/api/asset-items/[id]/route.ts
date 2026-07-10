import { NextRequest, NextResponse } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAssetLedgerSession } from '@/features/auth/api/session.server';
import {
  deleteAssetItem,
  getAssetItemById,
  getAssetItemDeleteOwnership,
  listAssetLedgerUsageLocations,
  updateAssetItem,
  validateUsageLocation
} from '@/features/asset-ledger/api/service.server';
import { assetItemUpdateSchema, normalizeAssetNumber } from '@/features/asset-ledger/api/validators';
import { assetTargetLabel, logAssetAuthFailure, newAssetRequestId } from '../_utils';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function resolveMutationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '비품 처리 중 오류가 발생했습니다.';
  }

  if (error.message.includes('asset_items_asset_number_key')) {
    return '이미 사용 중인 자산번호입니다.';
  }

  if (error.message.includes('asset_items_actual_user_id_fkey')) {
    return '실사용자를 찾을 수 없습니다.';
  }

  return error.message;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseId(id);
  if (!parsedId) {
    return NextResponse.json({ success: false, message: '비품 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const item = await getAssetItemById(parsedId);
    if (!item) {
      return NextResponse.json({ success: false, message: '비품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '비품 상세를 불러왔습니다.',
      item
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '비품 상세 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newAssetRequestId();
  const { id } = await params;
  const parsedId = parseId(id);
  const httpPath = `/api/asset-items/${id}`;

  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return logAssetAuthFailure({
      requestId,
      action: 'asset.update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: assetTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.update',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({ id }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '비품 ID가 올바르지 않습니다.')
      },
      { success: false, message: '비품 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = await request.json();
    const parsed = assetItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.update',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', message)
        },
        { success: false, message },
        400
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.update',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '수정할 항목이 없습니다.')
        },
        { success: false, message: '수정할 항목이 없습니다.' },
        400
      );
    }

    const payload = {
      ...parsed.data,
      ...(parsed.data.asset_number ? { asset_number: normalizeAssetNumber(parsed.data.asset_number) } : {})
    };

    if ('usage_location' in parsed.data) {
      const usageLocations = await listAssetLedgerUsageLocations();
      try {
        payload.usage_location = validateUsageLocation(parsed.data.usage_location, usageLocations);
      } catch (validationError) {
        const message =
          validationError instanceof Error ? validationError.message : '사용처 값이 올바르지 않습니다.';
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'asset.update',
            targetType: 'asset',
            targetUserId: session.userId,
            targetLabel: assetTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('validation', message)
          },
          { success: false, message },
          400
        );
      }
    }

    const updated = await updateAssetItem(parsedId, payload, session.userId);
    if (!updated) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.update',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '비품을 찾을 수 없습니다.')
        },
        { success: false, message: '비품을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.update',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({
          id: updated.id,
          assetNumber: updated.asset_number,
          assetName: updated.asset_name
        }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: {
          asset_number: updated.asset_number,
          asset_name: updated.asset_name,
          status: updated.status,
          category: updated.category ?? undefined,
          usage_location: updated.usage_location ?? undefined,
          changed_fields: Object.keys(payload)
        }
      },
      { success: true, message: '비품 정보가 수정되었습니다.', item: updated },
      200
    );
  } catch (error) {
    const message = resolveMutationErrorMessage(error);
    const status = message === '비품 처리 중 오류가 발생했습니다.' ? 500 : 400;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.update',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({ id: parsedId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(status === 500 ? 'internal_error' : 'validation', message)
      },
      { success: false, message },
      status
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newAssetRequestId();
  const { id } = await params;
  const parsedId = parseId(id);
  const httpPath = `/api/asset-items/${id}`;

  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return logAssetAuthFailure({
      requestId,
      action: 'asset.delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: assetTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.delete',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({ id }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '비품 ID가 올바르지 않습니다.')
      },
      { success: false, message: '비품 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const existing = await getAssetItemDeleteOwnership(parsedId);
    if (!existing) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.delete',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '비품을 찾을 수 없습니다.')
        },
        { success: false, message: '비품을 찾을 수 없습니다.' },
        404
      );
    }

    const isAdmin = session.profile.system_role === 'admin';
    const canDelete = isAdmin || existing.created_by_id === session.userId;
    if (!canDelete) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.delete',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({
            id: existing.id,
            assetNumber: existing.asset_number,
            assetName: existing.asset_name
          }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '등록한 사용자만 삭제할 수 있습니다.', {
            asset_number: existing.asset_number,
            asset_name: existing.asset_name
          })
        },
        { success: false, message: '등록한 사용자만 삭제할 수 있습니다.' },
        403
      );
    }

    const deleted = await deleteAssetItem(parsedId);
    if (!deleted) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'asset.delete',
          targetType: 'asset',
          targetUserId: session.userId,
          targetLabel: assetTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '비품을 찾을 수 없습니다.')
        },
        { success: false, message: '비품을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.delete',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({
          id: deleted.id,
          assetNumber: deleted.asset_number,
          assetName: deleted.asset_name
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {
          asset_number: deleted.asset_number,
          asset_name: deleted.asset_name
        }
      },
      { success: true, message: '비품이 삭제되었습니다.', item: deleted },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '비품 삭제 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'asset.delete',
        targetType: 'asset',
        targetUserId: session.userId,
        targetLabel: assetTargetLabel({ id: parsedId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
