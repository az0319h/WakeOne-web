import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import {
  AFFILIATIONS,
  validateOrganizationFields
} from '@/features/users/constants/organization';
import { refineBirthday } from '@/lib/birthday';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { User } from '@/features/users/api/types';

const INITIAL_USER_PASSWORD = '12341234a';
const DUPLICATE_EMAIL_MESSAGE = '이미 등록된 이메일입니다.';

const createUserSchema = z
  .object({
    email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
    affiliation: z.enum(AFFILIATIONS, {
      message: '소속을 선택해 주세요.'
    }),
    department: z.string().trim().min(1, '부서를 선택해 주세요.').max(100),
    rank: z.string().trim().min(1, '직급을 선택해 주세요.').max(50),
    job_title: z.string().trim().min(1, '직책을 선택해 주세요.').max(50),
    system_role: z.enum(['admin', 'user'], {
      message: '시스템 역할을 선택해 주세요.'
    }),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
  .superRefine((data, ctx) => {
    validateOrganizationFields(data, ctx);
    refineBirthday(data.birthday, ctx);
  });

function flattenValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function mapCreateUserErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('registered') || lower.includes('duplicate')) {
    return DUPLICATE_EMAIL_MESSAGE;
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return '올바른 이메일 주소를 입력해 주세요.';
  }
  return message;
}

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
        birthday,
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
        birthday: row.birthday,
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.create',
          targetType: 'user',
          targetUserId: null,
          targetLabel: 'unknown',
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '요청 본문이 올바르지 않습니다.')
        },
        { success: false, message: '요청 본문이 올바르지 않습니다.' },
        400
      );
    }

    attemptedEmail =
      typeof body === 'object' &&
      body !== null &&
      'email' in body &&
      typeof body.email === 'string'
        ? normalizeEmail(body.email)
        : 'unknown';

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
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
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.', {
            validation_errors: flattenValidationErrors(parsed.error),
            attempted_target: attemptedEmail
          })
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const payload = {
      ...parsed.data,
      email: normalizeEmail(parsed.data.email)
    };
    attemptedEmail = payload.email;

    const adminClient = getServiceRoleClient();
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('user_id')
      .ilike('email', payload.email)
      .maybeSingle();

    if (existingProfileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.create',
          targetType: 'user',
          targetUserId: null,
          targetLabel: payload.email,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('internal_error', existingProfileError.message, {
            attempted_target: payload.email
          })
        },
        { success: false, message: existingProfileError.message },
        500
      );
    }

    if (existingProfile) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.create',
          targetType: 'user',
          targetUserId: existingProfile.user_id,
          targetLabel: payload.email,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('duplicate_email', DUPLICATE_EMAIL_MESSAGE, {
            attempted_target: payload.email
          })
        },
        { success: false, message: DUPLICATE_EMAIL_MESSAGE },
        400
      );
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: INITIAL_USER_PASSWORD,
      email_confirm: true
    });

    if (error || !data.user) {
      const message = mapCreateUserErrorMessage(error?.message ?? '사용자 생성에 실패했습니다.');
      const isDuplicate = message === DUPLICATE_EMAIL_MESSAGE;
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.create',
          targetType: 'user',
          targetUserId: null,
          targetLabel: payload.email,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata(isDuplicate ? 'duplicate_email' : 'internal_error', message, {
            attempted_target: payload.email
          })
        },
        { success: false, message },
        isDuplicate ? 400 : 500
      );
    }

    const userId = data.user.id;
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        email: payload.email,
        affiliation: payload.affiliation,
        department: payload.department,
        rank: payload.rank,
        job_title: payload.job_title,
        system_role: payload.system_role,
        birthday: payload.birthday,
        status: 'active',
        deactivated_at: null,
        password_set_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.create',
          targetType: 'user',
          targetUserId: userId,
          targetLabel: payload.email,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('internal_error', profileError.message, {
            attempted_target: payload.email
          })
        },
        { success: false, message: profileError.message },
        500
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.create',
        targetType: 'user',
        targetUserId: userId,
        targetLabel: payload.email,
        httpMethod: 'POST',
        httpPath,
        metadata: {}
      },
      {
        success: true,
        message: '사용자가 추가되었습니다.',
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
        action: 'user.create',
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
