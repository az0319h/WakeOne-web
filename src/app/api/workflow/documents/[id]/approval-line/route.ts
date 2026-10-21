import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  changeWorkflowApprovalLine,
  getMemberName,
  getVisibleWorkflowDocumentHeader,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import { isUuid, parseApprovalLineBody } from '@/features/workflow/api/validators';
import { validateApprovalLine } from '@/features/workflow/lib/approval-line-rules';
import { WORKFLOW_APPROVAL_LINE_ERROR_KEY } from '@/features/workflow/lib/required-rules';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog, workflowTargetLabel } from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

/**
 * 결재선·참조자 변경 — 작성자 + 양식 허용 시. 완료 단계 불변 · 승인한 사람 제거 금지(409) · diff 타임라인.
 * 순서: 404 → 409(상태) → 403(작성자·허용) → 400(형식·구조) → RPC(비활성·완료 단계 등)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.approval_line_update',
    targetType: 'workflow_document',
    method: 'PUT',
    path: `/api/workflow/documents/${id}/approval-line`
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

    if (header.status !== 'IN_PROGRESS') return log.fail(409, '진행중인 문서만 처리할 수 있습니다.');
    if (header.writer_id !== session.userId) return log.fail(403, '작성자만 승인·참조자를 변경할 수 있습니다.');
    if (!header.approval_step_edit_enabled) return log.fail(403, '이 문서는 결재선을 변경할 수 없습니다.');

    const body = await readJsonBody(request);
    if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
    const line = parseApprovalLineBody(body);
    if (!line) {
      return log.fail(400, '결재선 형식이 올바르지 않습니다.', { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });
    }
    const lineError = validateApprovalLine(line, { writerId: header.writer_id });
    if (lineError) return log.fail(400, lineError, { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });

    const result = await changeWorkflowApprovalLine({
      actorUserId: session.userId,
      documentId: id,
      steps: line.steps,
      referrers: line.referrers
    });

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
        message: '승인·참조자를 변경했습니다.',
        document: {
          id: result.document_id,
          code: result.code,
          status: result.status,
          current_step: result.current_step,
          total_steps: result.total_steps,
          template_key: result.template_key
        },
        changed: Boolean(result.changed),
        diff_lines: result.diff_lines ?? []
      },
      200
    );
  } catch (error) {
    return log.fromError(error, '승인·참조자를 변경하지 못했습니다.');
  }
}
