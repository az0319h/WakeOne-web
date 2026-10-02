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
import { getServiceRoleClient } from '@/lib/supabase/service-role';

type Params = { params: Promise<{ id: string }> };

const rejectUserSchema = z.object({
  rejection_reason: z.string().trim().max(500).nullable().optional()
});

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id } = await params;
  const httpPath = `/api/users/${id}/approval/reject`;

  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    const status = adminCheck.response.status;
    const actor = await resolveLoggingActor(status);
    const targetLabel = await fetchUserTargetLabel(id);
    return finishWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.reject',
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
        action: 'user.reject',
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
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = rejectUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reject',
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
          action: 'user.reject',
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
          action: 'user.reject',
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
          action: 'user.reject',
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

    const rejectionReason = parsed.data.rejection_reason?.trim() || null;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: adminCheck.userId,
        rejection_reason: rejectionReason
      })
      .eq('user_id', id);

    if (updateError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'user.reject',
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

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.reject',
        targetType: 'user',
        targetUserId: id,
        targetLabel,
        httpMethod: 'POST',
        httpPath,
        metadata: {
          previous_status: target.status,
          new_status: 'rejected',
          ...(rejectionReason ? { rejection_reason: rejectionReason } : {})
        }
      },
      { success: true, message: '사용자를 거절했습니다.' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'user.reject',
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
