import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  getVisibleWorkflowDocumentHeader,
  setWorkflowStar,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 중요(★) — 본인에게만 적용. body { starred: boolean } */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.document_star',
    targetType: 'workflow_document',
    method: 'PUT',
    path: `/api/workflow/documents/${id}/star`
  });
  log.setTarget(workflowTargetLabel({ id }));

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);

  try {
    const header = await getVisibleWorkflowDocumentHeader(id);
    if (!header) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);
    log.setTarget(workflowTargetLabel({ code: header.code, templateName: header.template_name }));
    log.setMetadata({ document_id: header.id, document_code: header.code, template_key: header.template_key });

    const body = await readJsonBody(request);
    if (!body || typeof body.starred !== 'boolean') {
      return log.fail(400, body ? '중요 표시 값이 올바르지 않습니다.' : INVALID_BODY_MESSAGE);
    }

    const result = await setWorkflowStar(session.userId, id, body.starred);
    return log.success(
      {
        message: body.starred ? '중요 문서로 표시했습니다.' : '중요 표시를 해제했습니다.',
        starred: Boolean(result.starred)
      },
      200,
      { starred: body.starred }
    );
  } catch (error) {
    return log.fromError(error, '중요 표시를 바꾸지 못했습니다.');
  }
}
