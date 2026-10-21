import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  declineWorkflowDocument,
  getMemberName,
  getVisibleWorkflowDocumentHeader,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { readJsonBody, WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 반려 — 현재 ONGOING 단계의 WAITING actor 본인만. 한 명이라도 반려하면 문서는 즉시 DECLINED */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.document_decline',
    targetType: 'workflow_document',
    method: 'POST',
    path: `/api/workflow/documents/${id}/decline`
  });
  log.setTarget(workflowTargetLabel({ id }));

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);

  const body = (await readJsonBody(request)) ?? {};
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > 2000) return log.fail(400, '반려 사유는 2000자 이내로 입력해 주세요.');

  try {
    const header = await getVisibleWorkflowDocumentHeader(id);
    if (!header) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);
    log.setTarget(workflowTargetLabel({ code: header.code, templateName: header.template_name }));
    log.setMetadata({ document_id: header.id, document_code: header.code, template_key: header.template_key });

    const result = await declineWorkflowDocument(session.userId, id, reason || null);

    const actorName = session.profile.full_name?.trim() || session.profile.email;
    const notifyDoc = {
      id: result.document_id,
      code: result.code,
      templateKey: result.template_key,
      templateName: result.template_name,
      writerName: await getMemberName(result.writer_id)
    };
    await insertWorkflowNotifications({
      type: 'workflow.declined',
      recipientIds: result.notify?.declined,
      actorUserId: session.userId,
      actorName,
      document: notifyDoc
    });

    return log.success(
      {
        message: '반려했습니다.',
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
    return log.fromError(error, '반려하지 못했습니다.');
  }
}
