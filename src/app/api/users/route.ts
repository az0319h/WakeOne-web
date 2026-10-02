import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/server';
import { listUsersForAdmin } from '@/features/users/api/service.server';
import type { UserFilters } from '@/features/users/api/types';

const USER_CREATE_REMOVED_MESSAGE =
  '사용자 직접 추가 기능은 종료되었습니다. Google 로그인 후 관리자 승인을 이용해 주세요.';

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const supabase = await createClient();

    const filters: UserFilters = {
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 10),
      ...(searchParams.get('search') && { search: searchParams.get('search')! }),
      ...(searchParams.get('sort') && { sort: searchParams.get('sort')! }),
      ...(searchParams.get('systemRoles') && {
        systemRoles: searchParams.get('systemRoles')!
      }),
      ...(searchParams.get('statuses') && {
        statuses: searchParams.get('statuses')!
      }),
      ...(searchParams.get('userId') && { userId: searchParams.get('userId')! })
    };

    const result = await listUsersForAdmin(supabase, filters);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const httpPath = '/api/users';

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const status = adminCheck.response.status;
    const actor = await resolveLoggingActor(status);
    return finishWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.create',
        targetType: 'user',
        targetUserId: null,
        targetLabel: 'unknown',
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(
          status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
        )
      },
      adminCheck.response
    );
  }

  const actor = actorFromProfile(adminCheck.profile);
  let attemptedEmail = 'unknown';

  try {
    const body = (await request.json()) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'email' in body &&
      typeof body.email === 'string'
    ) {
      attemptedEmail = normalizeEmail(body.email);
    }
  } catch {
    // empty or invalid JSON — 410 still returns with attempted_target unknown
  }

  return jsonWithActivityLog(
    requestId,
    {
      ...actor,
      action: 'user.create',
      targetType: 'user',
      targetUserId: null,
      targetLabel: attemptedEmail,
      httpMethod: 'POST',
      httpPath,
      metadata: buildErrorMetadata('gone', USER_CREATE_REMOVED_MESSAGE, {
        attempted_target: attemptedEmail
      })
    },
    { success: false, message: USER_CREATE_REMOVED_MESSAGE },
    410
  );
}
