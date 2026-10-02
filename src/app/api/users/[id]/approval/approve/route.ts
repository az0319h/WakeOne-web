import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  fetchUserTargetLabel,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import { approveUserSchema } from '@/features/users/schemas/user';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id } = await params;
  const httpPath = `/api/users/${id}/approval/approve`;

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const status = adminCheck.response.status;
    const actor = await resolveLoggingActor(status);
    const targetLabel = await fetchUserTargetLabel(id);
    return finishWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.approve',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 401 ? 'unauthenticated' : 'forbidden')
      },
      adminCheck.response
    );
  }

  const actor = actorFromProfile(adminCheck.profile);
  const targetLabel = await fetchUserTargetLabel(id);
  const idCheck = z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.approve',
        targetType: 'user',
        targetUserId: null,
        targetLabel: id,
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '사용자 ID가 올바르지 않습니다.', {
          attempted_target: id
        })
      },
      { success: false, message: '사용자 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '요청 본문이 올바르지 않습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '요청 본문이 올바르지 않습니다.' },
        400
      );
    }

    const parsed = approveUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const supabase = getServiceRoleClient();
    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, status, google_email')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('internal_error', fetchError.message, {
            attempted_target: id
          })
        },
        { success: false, message: fetchError.message },
        500
      );
    }

    if (!target) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel: id,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '사용자를 찾을 수 없습니다.', {
            attempted_target: id
          })
        },
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        404
      );
    }

    if (target.status !== 'pending_approval') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_pending', '승인 대기 사용자가 아닙니다.', {
            attempted_target: id,
            previous_status: target.status
          })
        },
        { success: false, message: '승인 대기 사용자가 아닙니다.' },
        409
      );
    }

    const payload = {
      ...parsed.data,
      email: normalizeEmail(parsed.data.email)
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        email: payload.email,
        full_name: payload.full_name,
        affiliation: payload.affiliation,
        rank: payload.rank,
        system_role: payload.system_role,
        birthday: payload.birthday,
        phone: payload.phone,
        status: 'active',
        deactivated_at: null,
        approved_at: new Date().toISOString(),
        approved_by: adminCheck.userId,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null
      })
      .eq('user_id', id);

    if (updateError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.approve',
          targetType: 'user',
          targetUserId: id,
          targetLabel,
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('internal_error', updateError.message, {
            attempted_target: id,
            previous_status: target.status
          })
        },
        { success: false, message: updateError.message },
        500
      );
    }

    const successTargetLabel = await fetchUserTargetLabel(id);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.approve',
        targetType: 'user',
        targetUserId: id,
        targetLabel: successTargetLabel,
        httpMethod: 'POST',
        httpPath,
        metadata: {
          previous_status: target.status,
          new_status: 'active',
          birthday_set: payload.birthday != null,
          changed_fields: [
            'email',
            'full_name',
            'affiliation',
            'rank',
            'system_role',
            'birthday',
            'phone',
            'status'
          ],
          approval_source: 'admin'
        }
      },
      { success: true, message: '사용자를 승인했습니다.' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.approve',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message, {
          attempted_target: id
        })
      },
      { success: false, message },
      500
    );
  }
}
