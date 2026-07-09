import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  formatActorDisplayName,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { birthdaySchema, refineBirthday } from '@/lib/birthday';
import { createClient } from '@/lib/supabase/server';

const PROFILE_SELECT_COLUMNS =
  'user_id, email, full_name, phone, birthday, system_role, password_set_at, status, avatar_url, affiliation, department, rank, job_title, food_restrictions';

const PROFILE_PATCH_FIELDS = ['phone', 'food_restrictions', 'birthday'] as const;

const ADMIN_ONLY_PATCH_FIELDS = [
  'full_name',
  'avatar_url',
  'affiliation',
  'department',
  'rank',
  'job_title',
  'system_role'
] as const;

const patchProfileSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\d{11}$/, '연락처는 11자리 숫자만 입력할 수 있습니다.')
      .nullable()
      .optional(),
    food_restrictions: z.string().max(200).nullable().optional(),
    birthday: birthdaySchema
  })
  .superRefine((data, ctx) => {
    refineBirthday(data.birthday, ctx);
  });

function profileTargetLabel(profile: {
  email: string;
  full_name: string;
}): string {
  const name = formatActorDisplayName(profile);
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();
  const httpPath = '/api/profile';

  try {
    const session = await requireSession();
    if (!session.ok) {
      const status = session.response.status;
      const actor = await resolveLoggingActor(status);
      return finishWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.update',
          targetType: 'profile',
          targetUserId: actor.actorUserId,
          targetLabel: actor.actorEmail,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata(
            status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
          )
        },
        session.response
      );
    }

    const actor = actorFromProfile(session.profile);
    const targetLabel = profileTargetLabel(session.profile);

    const body = await request.json();

    const forbiddenFields = ADMIN_ONLY_PATCH_FIELDS.filter((field) => field in body);
    if (forbiddenFields.length > 0) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.update',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('forbidden_field', '해당 필드는 수정할 수 없습니다.', {
            changed_fields: forbiddenFields
          })
        },
        { success: false, message: '해당 필드는 수정할 수 없습니다.' },
        403
      );
    }

    const parsed = patchProfileSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.update',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.')
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const { phone, food_restrictions, birthday } = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .update({
        phone: phone ?? null,
        food_restrictions: food_restrictions ?? null,
        ...(birthday !== undefined ? { birthday: birthday ?? null } : {})
      })
      .eq('user_id', session.userId)
      .select(PROFILE_SELECT_COLUMNS)
      .single();

    if (error) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.update',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', error.message)
        },
        { success: false, message: error.message },
        400
      );
    }

    const changedFields = PROFILE_PATCH_FIELDS.filter((field) => field in body);

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.update',
        targetType: 'profile',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: changedFields.length > 0 ? { changed_fields: changedFields } : {}
      },
      {
        success: true,
        message: '프로필이 저장되었습니다.',
        profile: data
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const actor = await resolveLoggingActor(500);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.update',
        targetType: 'profile',
        targetUserId: actor.actorUserId,
        targetLabel: actor.actorEmail,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
