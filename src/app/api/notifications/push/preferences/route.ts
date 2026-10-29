import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequestId } from '@/features/activity-logs/api/log.server';
import { isDongbang } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  failWithLog,
  finishSessionFailure,
  internalErrorWithLog,
  PUSH_INVALID_GROUP_MESSAGE,
  readJsonBody,
  respondWithLog,
  type PushRouteContext
} from '@/features/notifications/api/push-route.server';
import { isPushConfigured } from '@/features/notifications/api/push-sender.server';
import {
  getDisabledPushGroups,
  listPushSubscriptions,
  toDeviceView,
  upsertDisabledPushGroups
} from '@/features/notifications/api/push-subscriptions.server';
import {
  isPushGroupKey,
  isPushGroupVisibleForDongbang,
  listPushGroupsForRole,
  type PushGroupKey
} from '@/features/notifications/lib/push-groups';

const HTTP_PATH = '/api/notifications/push/preferences';

const updateSchema = z.object({
  disabled_groups: z
    .array(z.string().trim().max(50))
    .max(50)
    .refine((groups) => groups.every(isPushGroupKey), 'unknown group')
});

/** 설정 + 기기 목록 + 그룹 카탈로그(역할 필터 · plan 95 동방특송 2그룹) + configured — READ (activity log Out) */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const [disabledGroups, subscriptions] = await Promise.all([
      getDisabledPushGroups(session.userId),
      listPushSubscriptions(session.userId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        configured: isPushConfigured(),
        disabled_groups: disabledGroups,
        device_count: subscriptions.length,
        devices: subscriptions.map(toDeviceView),
        groups: listPushGroupsForRole(session.profile.system_role === 'admin' ? 'admin' : 'user', {
          dongbang: isDongbang(session.profile)
        })
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/** 끈 그룹 저장 — upsert (중복 제거) */
export async function PUT(request: NextRequest) {
  const ctx: PushRouteContext = {
    requestId: createRequestId(),
    action: 'push_preference.update',
    httpMethod: 'PUT',
    httpPath: HTTP_PATH
  };

  const session = await requireSession();
  if (!session.ok) {
    return finishSessionFailure(ctx, session.response);
  }

  try {
    const parsed = updateSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_GROUP_MESSAGE, 'validation');
    }

    const disabledGroups = parsed.data.disabled_groups as PushGroupKey[];

    // plan 95 D-5 — 동방특송은 `dongbang_visible` 그룹(profile·quick_request)만 저장할 수 있다. 그 밖은 400(기존 문구)
    if (
      isDongbang(session.profile) &&
      disabledGroups.some((group) => !isPushGroupVisibleForDongbang(group))
    ) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_GROUP_MESSAGE, 'validation');
    }

    const saved = await upsertDisabledPushGroups(session.userId, disabledGroups);

    return respondWithLog(
      ctx,
      session,
      { success: true, data: { disabled_groups: saved } },
      200,
      { disabled_groups: saved }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error);
  }
}
