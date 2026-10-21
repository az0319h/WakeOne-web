import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  addWorkflowComment,
  getMemberName,
  getVisibleWorkflowDocumentHeader,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { WORKFLOW_COMMENT_MAX_LENGTH, WORKFLOW_MESSAGES } from '@/features/workflow/lib/required-rules';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 댓글 — 열람자 누구나(완료·반려·취소 문서 포함). 작성자·승인자 전원·참조자 전원(설정 무관)에게 알림 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.comment_create',
    targetType: 'workflow_document',
    method: 'POST',
    path: `/api/workflow/documents/${id}/comments`
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
    if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return log.fail(400, WORKFLOW_MESSAGES.commentRequired, { fieldKey: 'content' });
    if (content.length > WORKFLOW_COMMENT_MAX_LENGTH) {
      return log.fail(400, WORKFLOW_MESSAGES.commentTooLong, { fieldKey: 'content' });
    }

    const result = await addWorkflowComment(session.userId, id, content);

    const actorName = session.profile.full_name?.trim() || session.profile.email;
    await insertWorkflowNotifications({
      type: 'workflow.comment_created',
      recipientIds: result.notify?.comment_created,
      actorUserId: session.userId,
      actorName,
      document: {
        id: result.document_id,
        code: result.code,
        templateKey: result.template_key,
        templateName: result.template_name,
        writerName: await getMemberName(result.writer_id)
      }
    });

    return log.success({ message: '댓글을 등록했습니다.', event_id: result.event_id }, 201);
  } catch (error) {
    return log.fromError(error, '댓글을 등록하지 못했습니다.');
  }
}
