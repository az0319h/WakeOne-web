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
  LEADER_ROLES,
  normalizeLeaderRole,
  resolveRankFromPositionLevel,
  SELECT_NONE_VALUE,
  validateOrganizationFields,
  validatePositionFields,
  type Affiliation
} from '@/features/users/constants/organization';
import { insertUserUpdateNotification } from '@/features/notifications/api/fan-out.server';
import { birthdaySchema, refineBirthday } from '@/lib/birthday';
import { PHONE_REGEX } from '@/lib/phone';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const DISALLOWED_PUT_FIELDS = ['food_restrictions', 'department', 'job_title'] as const;

const updateUserSchema = z
  .object({
    full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100).optional(),
    avatar_url: z.string().url().max(2048).nullable().optional(),
    affiliation: z.enum(AFFILIATIONS).nullable().optional(),
    rank: z.string().max(50).nullable().optional(),
    position_level: z.string().max(50).nullable().optional(),
    leader_role: z
      .union([z.enum(LEADER_ROLES), z.literal(SELECT_NONE_VALUE), z.null()])
      .optional(),
    system_role: z.enum(['admin', 'user']).optional(),
    birthday: birthdaySchema,
    phone: z
      .string()
      .min(1, '연락처를 입력해 주세요.')
      .regex(PHONE_REGEX, '연락처는 11자리 숫자만 입력할 수 있습니다.')
      .optional()
  })
  .superRefine((data, ctx) => {
    validateOrganizationFields(data, ctx);
    validatePositionFields(data, ctx);
    refineBirthday(data.birthday, ctx);
  });

const ADMIN_TARGET_ALLOWED_FIELDS = ['avatar_url', 'system_role'] as const;
const ADMIN_TARGET_IGNORED_ORG_FIELDS = [
  'affiliation',
  'rank',
  'phone',
  'birthday',
  'position_level',
  'leader_role'
] as const;

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

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status, affiliation, rank, system_role, position_level, leader_role')
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

    if (target.status !== 'active') {
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
          metadata: buildErrorMetadata('inactive_user', '활성화된 사용자만 수정할 수 있습니다.')
        },
        { success: false, message: '활성화된 사용자만 수정할 수 있습니다.' },
        400
      );
    }

    let updates: Record<string, unknown>;

    if (target.system_role === 'admin') {
      if ('full_name' in body) {
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
              '관리자 이름은 수정할 수 없습니다.',
              { attempted_target: id }
            )
          },
          { success: false, message: '관리자 이름은 수정할 수 없습니다.' },
          400
        );
      }

      updates = Object.fromEntries(
        Object.entries(body as Record<string, unknown>).filter(([key]) =>
          ADMIN_TARGET_ALLOWED_FIELDS.includes(key as (typeof ADMIN_TARGET_ALLOWED_FIELDS)[number])
        )
      );

      if (updates.avatar_url !== undefined && updates.avatar_url !== null) {
        const avatarResult = z.string().url().max(2048).safeParse(updates.avatar_url);
        if (!avatarResult.success) {
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
      }

      if (
        updates.system_role !== undefined &&
        updates.system_role !== 'admin' &&
        updates.system_role !== 'user'
      ) {
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
    } else {
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

      updates = Object.fromEntries(
        Object.entries(parsed.data).filter(([, value]) => value !== undefined)
      );

      if ('leader_role' in updates) {
        updates.leader_role = normalizeLeaderRole(
          updates.leader_role as string | null | undefined
        );
      }

      const effectivePositionLevel =
        (updates.position_level as string | null | undefined) ?? target.position_level;
      const autoRank = effectivePositionLevel
        ? resolveRankFromPositionLevel(effectivePositionLevel)
        : null;
      if (autoRank) {
        updates.rank = autoRank;
      }
    }

    if (Object.keys(updates).length === 0) {
      if (target.system_role === 'admin') {
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
            metadata: { changed_fields: [], admin_profile: true }
          },
          { success: true, message: 'User updated successfully' },
          200
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
          metadata: buildErrorMetadata('validation', '수정할 항목이 없습니다.')
        },
        { success: false, message: '수정할 항목이 없습니다.' },
        400
      );
    }

    if (target.system_role === 'user') {
      const effectiveAffiliation = (updates.affiliation ?? target.affiliation) as Affiliation | null;
      const effectiveRank = 'rank' in updates ? (updates.rank as string | null) : target.rank;
      const effectivePositionLevel =
        'position_level' in updates
          ? (updates.position_level as string | null)
          : target.position_level;
      const effectiveLeaderRole =
        'leader_role' in updates
          ? (updates.leader_role as string | null)
          : target.leader_role;

      const mergedOrgValidation = z
        .object({
          affiliation: z.enum(AFFILIATIONS).nullable(),
          rank: z.string().max(50).nullable(),
          position_level: z.string().max(50).nullable(),
          leader_role: z.string().nullable()
        })
        .superRefine((data, ctx) => {
          validateOrganizationFields(data, ctx);
          validatePositionFields(data, ctx);
        })
        .safeParse({
          affiliation: effectiveAffiliation,
          rank: effectiveRank,
          position_level: effectivePositionLevel,
          leader_role: effectiveLeaderRole
        });

      if (!mergedOrgValidation.success) {
        const orgMessage =
          mergedOrgValidation.error.issues[0]?.message ??
          '소속에 맞지 않는 조직 정보입니다.';
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
            metadata: buildErrorMetadata('validation', orgMessage)
          },
          { success: false, message: orgMessage },
          400
        );
      }
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

    try {
      await insertUserUpdateNotification({
        recipientUserId: id,
        changedFields: Object.keys(updates),
        actorUserId: adminCheck.profile.user_id
      });
    } catch (fanOutError) {
      const message =
        fanOutError instanceof Error ? fanOutError.message : 'Notification fan-out failed';
      console.error('[notifications] fan-out failed:', message);
    }

    const successTargetLabel = await fetchUserTargetLabel(id);
    const changedFields = Object.keys(updates).filter(
      (field) =>
        target.system_role === 'user' ||
        !ADMIN_TARGET_IGNORED_ORG_FIELDS.includes(
          field as (typeof ADMIN_TARGET_IGNORED_ORG_FIELDS)[number]
        )
    );

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.update',
        targetType: 'user',
        targetUserId: id,
        targetLabel: successTargetLabel,
        httpMethod: 'PUT',
        httpPath,
        metadata:
          target.system_role === 'admin'
            ? { changed_fields: changedFields, admin_profile: true }
            : { changed_fields: changedFields }
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

    if (target.status !== 'inactive') {
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
          metadata: buildErrorMetadata('validation', '비활성 사용자만 재활성화할 수 있습니다.')
        },
        { success: false, message: '비활성 사용자만 재활성화할 수 있습니다.' },
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

    if (target.status !== 'active') {
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
          metadata: buildErrorMetadata('inactive_user', '활성화된 사용자만 비활성화할 수 있습니다.')
        },
        { success: false, message: '활성화된 사용자만 비활성화할 수 있습니다.' },
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
