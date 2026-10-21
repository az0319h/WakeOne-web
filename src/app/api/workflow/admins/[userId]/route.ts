import { NextRequest } from 'next/server';
import { fetchUserTargetLabel } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { revokeWorkflowAdmin } from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { WorkflowRouteLog } from '../../_utils';

type Params = { params: Promise<{ userId: string }> };

/** 워크플로우 관리자 해제 — 시스템 관리자 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { userId } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.admin_revoke',
    targetType: 'workflow_admin',
    method: 'DELETE',
    path: `/api/workflow/admins/${userId}`
  });
  log.setTarget(`workflow_admin:${userId}`, isUuid(userId) ? userId : null);

  const session = await requireAdminSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(userId)) return log.fail(404, '워크플로우 관리자를 찾을 수 없습니다.');
  log.setTarget(`workflow_admin:${await fetchUserTargetLabel(userId)}`, userId);

  try {
    await revokeWorkflowAdmin(session.userId, userId);
    return log.success({ message: '워크플로우 관리자를 해제했습니다.', user_id: userId }, 200);
  } catch (error) {
    return log.fromError(error, '워크플로우 관리자를 해제하지 못했습니다.');
  }
}
