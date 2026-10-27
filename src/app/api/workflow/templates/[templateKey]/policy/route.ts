import { NextRequest } from 'next/server';
import { requireWorkflowAdminSession } from '@/features/auth/api/session.server';
import {
  getWorkflowTemplateDefinition,
  setWorkflowTemplatePolicy
} from '@/features/workflow/api/service.server';
import { parseApprovalLineBody } from '@/features/workflow/api/validators';
import { validateApprovalLine } from '@/features/workflow/lib/approval-line-rules';
import { WORKFLOW_APPROVAL_LINE_ERROR_KEY } from '@/features/workflow/lib/required-rules';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog } from '../../../_utils';

type Params = { params: Promise<{ templateKey: string }> };

/** 양식 기본 결재선·참조자·「작성자가 결재선 변경 가능」 — 워크플로우 관리자. 승인 단계 0개 저장 허용 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { templateKey } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.template_policy_update',
    targetType: 'workflow_template',
    method: 'PUT',
    path: `/api/workflow/templates/${templateKey}/policy`
  });
  log.setTarget(`workflow_template:${templateKey}`);
  log.setMetadata({ template_key: templateKey.slice(0, 50) });

  const session = await requireWorkflowAdminSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  try {
    const template = await getWorkflowTemplateDefinition(templateKey, 'service');
    if (!template) return log.fail(404, '양식을 찾을 수 없습니다.');
    log.setTarget(`workflow_template:${template.template_key}:${template.name}`);

    const body = await readJsonBody(request);
    if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
    const line = parseApprovalLineBody(body);
    if (!line) {
      return log.fail(400, '결재선 형식이 올바르지 않습니다.', { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });
    }
    const lineError = validateApprovalLine(line, { allowEmpty: true });
    if (lineError) return log.fail(400, lineError, { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });

    const editEnabled = body.approval_step_edit_enabled;
    if (editEnabled !== undefined && typeof editEnabled !== 'boolean') {
      return log.fail(400, '결재선 변경 허용 값이 올바르지 않습니다.');
    }

    await setWorkflowTemplatePolicy({
      actorUserId: session.userId,
      templateId: template.id,
      steps: line.steps,
      referrers: line.referrers,
      approvalStepEditEnabled: typeof editEnabled === 'boolean' ? editEnabled : null
    });

    return log.success({ message: '기본 결재선이 저장되었습니다.', template_key: template.template_key }, 200);
  } catch (error) {
    return log.fromError(error, '기본 결재선을 저장하지 못했습니다.');
  }
}
