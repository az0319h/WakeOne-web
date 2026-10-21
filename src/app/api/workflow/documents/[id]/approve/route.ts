import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  approveWorkflowDocument,
  getMemberName,
  getVisibleWorkflowDocumentHeader,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { readJsonBody, WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 승인 — 현재 ONGOING 단계의 WAITING actor 본인만 (RPC에서 재검사) */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.document_approve',
    targetType: 'workflow_document',
    method: 'POST',
    path: `/api/workflow/documents/${id}/approve`
  });
  log.setTarget(workflowTargetLabel({ id }));

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);

  const body = (await readJsonBody(request)) ?? {};
  const opinion = typeof body.opinion === 'string' ? body.opinion.trim() : '';
  if (opinion.length > 2000) return log.fail(400, '의견은 2000자 이내로 입력해 주세요.');

  try {
    const header = await getVisibleWorkflowDocumentHeader(id);
    if (!header) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);
    log.setTarget(workflowTargetLabel({ code: header.code, templateName: header.template_name }));
    log.setMetadata({ document_id: header.id, document_code: header.code, template_key: header.template_key });

    const result = await approveWorkflowDocument(session.userId, id, opinion || null);

    const actorName = session.profile.full_name?.trim() || session.profile.email;
    const notifyDoc = {
      id: result.document_id,
      code: result.code,
      templateKey: result.template_key,
      templateName: result.template_name,
      writerName: await getMemberName(result.writer_id)
    };
    await insertWorkflowNotifications({
      type: 'workflow.approval_requested',
      recipientIds: result.notify?.approval_requested,
      actorUserId: session.userId,
      actorName,
      document: notifyDoc
    });
    await insertWorkflowNotifications({
      type: 'workflow.completed',
      recipientIds: result.notify?.completed,
      actorUserId: session.userId,
      actorName,
      document: notifyDoc
    });

    return log.success(
      {
        message: '승인했습니다.',
        document: {
          id: result.document_id,
          code: result.code,
          status: result.status,
          current_step: result.current_step,
          total_steps: result.total_steps,
          template_key: result.template_key
        }
      },
      200,
      { step: result.step }
    );
  } catch (error) {
    return log.fromError(error, '승인하지 못했습니다.');
  }
}
