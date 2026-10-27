import { NextRequest } from 'next/server';
import { fetchUserTargetLabel } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { grantWorkflowAdmin, listWorkflowAdmins } from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import {
  INVALID_BODY_MESSAGE,
  readJsonBody,
  workflowJson,
  workflowReadError,
  WorkflowRouteLog
} from '../_utils';

/** 워크플로우 관리자 목록 — 시스템 관리자 */
export async function GET() {
  const session = await requireAdminSession();
  if (!session.ok) return session.response;

  try {
    const admins = await listWorkflowAdmins();
    return workflowJson({ admins });
  } catch (error) {
    const message = error instanceof Error ? error.message : '워크플로우 관리자를 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}

/** 워크플로우 관리자 지정 — 시스템 관리자. body { user_id } */
export async function POST(request: NextRequest) {
  const log = new WorkflowRouteLog({
    action: 'workflow.admin_grant',
    targetType: 'workflow_admin',
    method: 'POST',
    path: '/api/workflow/admins'
  });
  log.setTarget('workflow_admin:unknown');

  const session = await requireAdminSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
  if (!isUuid(body.user_id)) return log.fail(400, '사용자를 선택해 주세요.');
  const userId = body.user_id;
  log.setTarget(`workflow_admin:${await fetchUserTargetLabel(userId)}`, userId);

  try {
    await grantWorkflowAdmin(session.userId, userId);
    return log.success({ message: '워크플로우 관리자를 지정했습니다.', user_id: userId }, 201);
  } catch (error) {
    return log.fromError(error, '워크플로우 관리자를 지정하지 못했습니다.');
  }
}
