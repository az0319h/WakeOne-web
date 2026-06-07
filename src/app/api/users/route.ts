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
import { createClient } from '@/lib/supabase/server';
import { inviteUserWithTemporaryPassword } from '@/features/users/api/invite.server';
import type { User } from '@/features/users/api/types';

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const supabase = await createClient();

    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 10);
    const search = searchParams.get('search');
    const sortRaw = searchParams.get('sort');
    const systemRoles = parseCsvParam(searchParams.get('systemRoles'));

    let query = supabase.from('profiles').select(
      `
        user_id,
        email,
        first_name,
        last_name,
        phone,
        system_role,
        password_set_at,
        status,
        avatar_url,
        affiliation,
        department,
        rank,
        job_title,
        food_restrictions,
        deactivated_at,
        created_at,
        updated_at
      `,
      { count: 'exact' }
    );

    if (systemRoles.length > 0) {
      query = query.in('system_role', systemRoles);
    }

    if (search) {
      const escaped = search.replaceAll(',', ' ');
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
      );
    }

    let sortColumn = 'created_at';
    let sortDesc = true;
    if (sortRaw) {
      try {
        const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
        if (sortItems.length > 0) {
          const candidate = sortItems[0];
          const allowedColumns = [
            'first_name',
            'email',
            'system_role',
            'created_at',
            'password_set_at'
          ];
          if (allowedColumns.includes(candidate.id)) {
            sortColumn = candidate.id;
            sortDesc = candidate.desc;
          }
        }
      } catch {
        // ignore invalid sort payload
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order(sortColumn, { ascending: !sortDesc })
      .range(from, to);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const users: User[] =
      data?.map((row) => ({
        id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        system_role: row.system_role,
        invite_status: row.password_set_at ? 'accepted' : 'pending',
        status: row.status,
        avatar_url: row.avatar_url,
        affiliation: row.affiliation,
        department: row.department,
        rank: row.rank,
        job_title: row.job_title,
        food_restrictions: row.food_restrictions,
        created_at: row.created_at,
        updated_at: row.updated_at
      })) ?? [];

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      message: 'Users loaded successfully',
      total_users: count ?? 0,
      offset: from,
      limit,
      users
    });
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
        action: 'user.invite',
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
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    attemptedEmail = email || 'unknown';

    if (!email) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.invite',
          targetType: 'user',
          targetUserId: null,
          targetLabel: 'unknown',
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '이메일을 입력해 주세요.')
        },
        { success: false, message: '이메일을 입력해 주세요.' },
        400
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.invite',
          targetType: 'user',
          targetUserId: null,
          targetLabel: email,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '올바른 이메일 주소를 입력해 주세요.', {
            attempted_target: email
          })
        },
        { success: false, message: '올바른 이메일 주소를 입력해 주세요.' },
        400
      );
    }

    const { userId } = await inviteUserWithTemporaryPassword(email);

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.invite',
        targetType: 'user',
        targetUserId: userId,
        targetLabel: email,
        httpMethod: 'POST',
        httpPath,
        metadata: {}
      },
      {
        success: true,
        message: '초대 메일을 발송했습니다. 임시 비밀번호가 포함되어 있습니다.',
        user_id: userId
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const isClientError =
      message === '이미 등록된 이메일입니다.' ||
      message.includes('이미 등록') ||
      message.includes('duplicate');

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.invite',
        targetType: 'user',
        targetUserId: null,
        targetLabel: attemptedEmail,
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(
          isClientError ? 'duplicate_email' : 'internal_error',
          message,
          { attempted_target: attemptedEmail }
        )
      },
      { success: false, message },
      isClientError ? 400 : 500
    );
  }
}
