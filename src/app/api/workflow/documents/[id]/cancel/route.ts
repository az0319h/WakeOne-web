import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  cancelWorkflowDocument,
  getVisibleWorkflowDocumentHeader,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 문서 취소 — 진행중 + 작성자만. 진행 중 단계의 대기 승인자에게 취소 알림 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.document_cancel',
    targetType: 'workflow_document',
    method: 'POST',
    path: `/api/workflow/documents/${id}/cancel`
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

    const result = await cancelWorkflowDocument(session.userId, id);

    const actorName = session.profile.full_name?.trim() || session.profile.email;
    await insertWorkflowNotifications({
      type: 'workflow.canceled',
      recipientIds: result.notify?.canceled,
      actorUserId: session.userId,
      actorName,
      document: {
        id: result.document_id,
        code: result.code,
        templateKey: result.template_key,
        templateName: result.template_name,
        writerName: actorName
      }
    });

    return log.success(
      {
        message: '문서를 취소했습니다.',
        document: {
          id: result.document_id,
          code: result.code,
          status: result.status,
          current_step: result.current_step,
          total_steps: result.total_steps,
          template_key: result.template_key
        }
      },
      200
    );
  } catch (error) {
    return log.fromError(error, '문서를 취소하지 못했습니다.');
  }
}
