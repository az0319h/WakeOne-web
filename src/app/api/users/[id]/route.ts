import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  fetchUserTargetLabel,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction } from '@/features/activity-logs/api/types';
import { adminBanUser, adminSignOutGlobal, adminUnbanUser } from '@/lib/auth/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  AFFILIATIONS,
  validateOrganizationFields,
  type Affiliation
} from '@/features/users/constants/organization';
import { birthdaySchema, refineBirthday } from '@/lib/birthday';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const DISALLOWED_PUT_FIELDS = ['phone', 'food_restrictions'] as const;

const updateUserSchema = z
  .object({
    full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100).optional(),
    avatar_url: z.string().url().max(2048).nullable().optional(),
    affiliation: z.enum(AFFILIATIONS).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    rank: z.string().max(50).nullable().optional(),
    job_title: z.string().max(50).nullable().optional(),
    system_role: z.enum(['admin', 'user']).optional(),
    birthday: birthdaySchema
  })
  .superRefine((data, ctx) => {
    validateOrganizationFields(data, ctx);
    refineBirthday(data.birthday, ctx);
  });

const patchUserSchema = z.object({
  action: z.literal('reactivate')
});

async function logAdminAuthFailure(
  requestId: string,
  action: ActivityAction,
  httpMethod: string,
  httpPath: string,
  targetUserId: string | null,
  targetLabel: string,
  response: NextResponse
) {
  const status = response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    requestId,
    {
      ...actor,
      action,
      targetType: 'user',
      targetUserId,
      targetLabel,
      httpMethod,
      httpPath,
      metadata: buildErrorMetadata(
        status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
      )
    },
    response
  );
}

export async function PUT(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id } = await params;
  const httpPath = `/api/users/${id}`;

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const targetLabel = await fetchUserTargetLabel(id);
    return logAdminAuthFailure(
      requestId,
      'user.update',
      'PUT',
      httpPath,
      id,
      targetLabel,
      adminCheck.response
    );
  }

  const actor = actorFromProfile(adminCheck.profile);
  const targetLabel = await fetchUserTargetLabel(id);

  try {
    const body = await request.json();

    const disallowedFields = DISALLOWED_PUT_FIELDS.filter((field) => field in body);
    if (disallowedFields.length > 0) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata(
            'forbidden_field',
            '해당 필드는 관리자가 수정할 수 없습니다.',
            { attempted_target: id }
          )
        },
        { success: false, message: '해당 필드는 관리자가 수정할 수 없습니다.' },
        400
      );
    }

    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.')
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', '수정할 항목이 없습니다.')
        },
        { success: false, message: '수정할 항목이 없습니다.' },
        400
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status, affiliation, department, rank, job_title')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', fetchError.message)
        },
        { success: false, message: fetchError.message },
        400
      );
    }

    if (!target) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel: id,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('not_found', '사용자를 찾을 수 없습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        404
      );
    }

    if (target.status === 'inactive') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('inactive_user', '비활성화된 사용자는 수정할 수 없습니다.')
        },
        { success: false, message: '비활성화된 사용자는 수정할 수 없습니다.' },
        400
      );
    }

    const effectiveAffiliation = (updates.affiliation ?? target.affiliation) as Affiliation | null;
    const effectiveDepartment =
      'department' in updates ? (updates.department as string | null) : target.department;
    const effectiveRank = 'rank' in updates ? (updates.rank as string | null) : target.rank;
    const effectiveJobTitle =
      'job_title' in updates ? (updates.job_title as string | null) : target.job_title;

    const mergedValidation = updateUserSchema.safeParse({
      affiliation: effectiveAffiliation,
      department: effectiveDepartment,
      rank: effectiveRank,
      job_title: effectiveJobTitle
    });

    if (!mergedValidation.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', '소속에 맞지 않는 조직 정보입니다.')
        },
        { success: false, message: '소속에 맞지 않는 조직 정보입니다.' },
        400
      );
    }

    const { error: profileError } = await supabase.from('profiles').update(updates).eq('user_id', id);

    if (profileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.update',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', profileError.message)
        },
        { success: false, message: profileError.message },
        400
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.update',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'PUT',
        httpPath,
        metadata: { changed_fields: Object.keys(updates) }
      },
      { success: true, message: 'User updated successfully' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.update',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'PUT',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id } = await params;
  const httpPath = `/api/users/${id}`;

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const targetLabel = await fetchUserTargetLabel(id);
    return logAdminAuthFailure(
      requestId,
      'user.reactivate',
      'PATCH',
      httpPath,
      id,
      targetLabel,
      adminCheck.response
    );
  }

  const actor = actorFromProfile(adminCheck.profile);
  const targetLabel = await fetchUserTargetLabel(id);

  try {
    const body = await request.json();
    const parsed = patchUserSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.')
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', fetchError.message)
        },
        { success: false, message: fetchError.message },
        400
      );
    }

    if (!target) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel: id,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '사용자를 찾을 수 없습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        404
      );
    }

    if (target.status === 'active') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '이미 활성화된 사용자입니다.')
        },
        { success: false, message: '이미 활성화된 사용자입니다.' },
        400
      );
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        deactivated_at: null
      })
      .eq('user_id', id);

    if (profileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', profileError.message)
        },
        { success: false, message: profileError.message },
        400
      );
    }

    try {
      await adminUnbanUser(id);
    } catch (unbanError) {
      await supabase
        .from('profiles')
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString()
        })
        .eq('user_id', id);

      const message =
        unbanError instanceof Error ? unbanError.message : '계정 활성화에 실패했습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message },
        500
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.reactivate',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: {}
      },
      { success: true, message: '사용자가 활성화되었습니다.' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.reactivate',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id } = await params;
  const httpPath = `/api/users/${id}`;

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const targetLabel = await fetchUserTargetLabel(id);
    return logAdminAuthFailure(
      requestId,
      'user.deactivate',
      'DELETE',
      httpPath,
      id,
      targetLabel,
      adminCheck.response
    );
  }

  const actor = actorFromProfile(adminCheck.profile);
  const targetLabel = await fetchUserTargetLabel(id);

  try {
    if (id === adminCheck.userId) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.deactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('validation', '본인 계정은 비활성화할 수 없습니다.')
        },
        { success: false, message: '본인 계정은 비활성화할 수 없습니다.' },
        400
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.deactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('validation', fetchError.message)
        },
        { success: false, message: fetchError.message },
        400
      );
    }

    if (!target) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.deactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel: id,
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '사용자를 찾을 수 없습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        404
      );
    }

    if (target.status === 'inactive') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.deactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('inactive_user', '이미 비활성화된 사용자입니다.')
        },
        { success: false, message: '이미 비활성화된 사용자입니다.' },
        400
      );
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'inactive',
        deactivated_at: new Date().toISOString()
      })
      .eq('user_id', id);

    if (profileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.deactivate',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('validation', profileError.message)
        },
        { success: false, message: profileError.message },
        400
      );
    }

    await adminSignOutGlobal(id);
    await adminBanUser(id);

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.deactivate',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'DELETE',
        httpPath,
        metadata: {}
      },
      { success: true, message: '사용자가 비활성화되었습니다.' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.deactivate',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
