import { NextRequest, NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  fetchUserTargetLabel,
  finishWithActivityLog,
  jsonWithActivityLog,
  recordActivityLog,
  resolveLoggingActor,
  withRequestId
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import type { WalletBalanceEmailPreferencesPatch } from '@/features/wallet/api/balance-email.types';
import {
  getWalletBalanceEmailPreferences,
  isWalletBalanceEmailEligible,
  upsertWalletBalanceEmailPreferences
} from '@/features/wallet/api/balance-email.service.server';

const HTTP_PATH = '/api/wallet/balance-email/preferences';

function resolveTargetUserId(
  viewerUserId: string,
  isAdmin: boolean,
  requestedUser: string | null
): { ok: true; targetUserId: string } | { ok: false; status: 403 | 400; message: string } {
  if (!requestedUser || requestedUser === 'self') {
    return { ok: true, targetUserId: viewerUserId };
  }

  if (!isAdmin) {
    return { ok: false, status: 403, message: '다른 사용자의 알림 설정을 수정할 권한이 없습니다.' };
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(requestedUser)) {
    return { ok: false, status: 400, message: '유효하지 않은 사용자 ID입니다.' };
  }

  return { ok: true, targetUserId: requestedUser };
}

function parsePreferencesPatch(body: unknown):
  | { ok: true; patch: WalletBalanceEmailPreferencesPatch; changedFields: string[] }
  | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.' };
  }

  const record = body as Record<string, unknown>;
  const patch: WalletBalanceEmailPreferencesPatch = {};
  const changedFields: string[] = [];

  if ('enabled' in record) {
    if (typeof record.enabled !== 'boolean') {
      return { ok: false, message: 'enabled 값은 boolean 이어야 합니다.' };
    }
    patch.enabled = record.enabled;
    changedFields.push('enabled');
  }

  if ('hour' in record) {
    const hour = Number(record.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return { ok: false, message: 'hour 값은 0~23 정수여야 합니다.' };
    }
    patch.hour = hour;
    changedFields.push('hour');
  }

  if ('minute' in record) {
    const minute = Number(record.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      return { ok: false, message: 'minute 값은 0~59 정수여야 합니다.' };
    }
    patch.minute = minute;
    changedFields.push('minute');
  }

  if ('exclude_weekends' in record) {
    if (typeof record.exclude_weekends !== 'boolean') {
      return { ok: false, message: 'exclude_weekends 값은 boolean 이어야 합니다.' };
    }
    patch.exclude_weekends = record.exclude_weekends;
    changedFields.push('exclude_weekends');
  }

  if (changedFields.length === 0) {
    return { ok: false, message: '변경할 필드가 없습니다.' };
  }

  return { ok: true, patch, changedFields };
}

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const isAdmin = session.profile.system_role === 'admin';
  const requestedUser = request.nextUrl.searchParams.get('user');
  const resolved = resolveTargetUserId(session.userId, isAdmin, requestedUser);

  if (!resolved.ok) {
    return NextResponse.json({ success: false, message: resolved.message }, { status: resolved.status });
  }

  const eligible = await isWalletBalanceEmailEligible(resolved.targetUserId);
  if (!eligible) {
    return NextResponse.json(
      { success: false, message: '식대 잔액 업데이트 내역이 없어 알림 설정을 사용할 수 없습니다.' },
      { status: 404 }
    );
  }

  const preferences = await getWalletBalanceEmailPreferences(resolved.targetUserId);

  return NextResponse.json({
    success: true,
    data: { preferences, eligible: true }
  });
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();
  const session = await requireSession();

  if (!session.ok) {
    return finishWithActivityLogForPatchAuthFailure(requestId, session.response);
  }

  const actor = actorFromProfile(session.profile);
  const isAdmin = session.profile.system_role === 'admin';
  const requestedUser = request.nextUrl.searchParams.get('user');
  const resolved = resolveTargetUserId(session.userId, isAdmin, requestedUser);

  if (!resolved.ok) {
    const targetLabel = requestedUser && requestedUser !== 'self' ? requestedUser : session.userId;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_pref_update',
        targetType: 'wallet',
        targetUserId: resolved.status === 403 ? requestedUser ?? null : null,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata(resolved.status === 403 ? 'forbidden' : 'validation', resolved.message, {
          attempted_target: requestedUser ?? undefined
        })
      },
      { success: false, message: resolved.message },
      resolved.status
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_pref_update',
        targetType: 'wallet',
        targetUserId: resolved.targetUserId,
        targetLabel: await fetchUserTargetLabel(resolved.targetUserId),
        httpMethod: 'PATCH',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', '요청 JSON을 해석할 수 없습니다.')
      },
      { success: false, message: '요청 JSON을 해석할 수 없습니다.' },
      400
    );
  }

  const parsed = parsePreferencesPatch(body);
  if (!parsed.ok) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_pref_update',
        targetType: 'wallet',
        targetUserId: resolved.targetUserId,
        targetLabel: await fetchUserTargetLabel(resolved.targetUserId),
        httpMethod: 'PATCH',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', parsed.message)
      },
      { success: false, message: parsed.message },
      400
    );
  }

  const eligible = await isWalletBalanceEmailEligible(resolved.targetUserId);
  if (!eligible) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_pref_update',
        targetType: 'wallet',
        targetUserId: resolved.targetUserId,
        targetLabel: await fetchUserTargetLabel(resolved.targetUserId),
        httpMethod: 'PATCH',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata(
          'not_found',
          '식대 잔액 업데이트 내역이 없어 알림 설정을 사용할 수 없습니다.'
        )
      },
      {
        success: false,
        message: '식대 잔액 업데이트 내역이 없어 알림 설정을 사용할 수 없습니다.'
      },
      404
    );
  }

  try {
    const preferences = await upsertWalletBalanceEmailPreferences({
      userId: resolved.targetUserId,
      patch: parsed.patch,
      updatedByUserId: session.userId
    });

    const metadata: Record<string, unknown> = {
      changed_fields: parsed.changedFields,
      target_user_id: resolved.targetUserId
    };

    if (parsed.patch.enabled !== undefined) {
      metadata.enabled = parsed.patch.enabled;
    }
    if (parsed.patch.hour !== undefined) {
      metadata.hour = parsed.patch.hour;
    }
    if (parsed.patch.minute !== undefined) {
      metadata.minute = parsed.patch.minute;
    }
    if (parsed.patch.exclude_weekends !== undefined) {
      metadata.exclude_weekends = parsed.patch.exclude_weekends;
    }

    await recordActivityLog({
      requestId,
      ...actor,
      action: 'wallet.balance_email_pref_update',
      targetType: 'wallet',
      targetUserId: resolved.targetUserId,
      targetLabel: await fetchUserTargetLabel(resolved.targetUserId),
      httpMethod: 'PATCH',
      httpPath: HTTP_PATH,
      httpStatus: 200,
      metadata
    });

    return withRequestId(
      NextResponse.json({
        success: true,
        data: { preferences, eligible: true }
      }),
      requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '알림 설정 저장 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_pref_update',
        targetType: 'wallet',
        targetUserId: resolved.targetUserId,
        targetLabel: await fetchUserTargetLabel(resolved.targetUserId),
        httpMethod: 'PATCH',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}

async function finishWithActivityLogForPatchAuthFailure(
  requestId: string,
  response: NextResponse
): Promise<NextResponse> {
  const status = response.status;
  const actor = await resolveLoggingActor(status);

  return finishWithActivityLog(
    requestId,
    {
      ...actor,
      action: 'wallet.balance_email_pref_update',
      targetType: 'wallet',
      targetUserId: null,
      targetLabel: 'preferences',
      httpMethod: 'PATCH',
      httpPath: HTTP_PATH,
      metadata: buildErrorMetadata(status === 401 ? 'unauthenticated' : 'forbidden')
    },
    response
  );
}
