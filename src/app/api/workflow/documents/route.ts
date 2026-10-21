import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { isWorkflowAdmin } from '@/features/auth/api/workflow-access.server';
import {
  buildWorkflowSearchText,
  prepareWorkflowContent,
  toInputItems
} from '@/features/workflow/api/document-input.server';
import { insertWorkflowNotifications } from '@/features/workflow/api/notifications.server';
import {
  getWorkflowTemplateDefinition,
  listWorkflowDocuments,
  removeWorkflowStorageObjects,
  submitWorkflowDocument
} from '@/features/workflow/api/service.server';
import { isUuid, parseApprovalLineBody, parseUuidArray } from '@/features/workflow/api/validators';
import { validateApprovalLine } from '@/features/workflow/lib/approval-line-rules';
import { collectReferenceIds, normalizeWorkflowValues } from '@/features/workflow/lib/inputs';
import {
  validateWorkflowInputs,
  WORKFLOW_APPROVAL_LINE_ERROR_KEY,
  WORKFLOW_MESSAGES
} from '@/features/workflow/lib/required-rules';
import {
  INVALID_BODY_MESSAGE,
  parseWorkflowListQuery,
  readJsonBody,
  workflowJson,
  workflowReadError,
  WorkflowRouteLog,
  workflowTargetLabel
} from '../_utils';

/** 문서함 목록 — 사용자 세션(RLS)으로 읽는다. scope=company는 워크플로우 관리자만 */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const admin = await isWorkflowAdmin(session.profile);
    const parsed = parseWorkflowListQuery(request.nextUrl.searchParams, { isWorkflowAdmin: admin });
    if (!parsed.ok) return workflowReadError(parsed.status, parsed.message);

    const result = await listWorkflowDocuments(parsed.params);
    return workflowJson({ rows: result.rows, total: result.total, next_cursor: result.nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : '문서함을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}

/** 문서 제출 — 조건부 필수(공유 required-rules, DB 필드 정의) · 결재선 · 참조문서 · staged 첨부 소유를 검증한다 */
export async function POST(request: NextRequest) {
  const log = new WorkflowRouteLog({
    action: 'workflow.document_create',
    targetType: 'workflow_document',
    method: 'POST',
    path: '/api/workflow/documents'
  });

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);

  const templateKey = typeof body.template_key === 'string' ? body.template_key.trim() : '';
  if (!templateKey) return log.fail(400, '양식을 선택해 주세요.');

  try {
    const template = await getWorkflowTemplateDefinition(templateKey, 'session');
    if (!template) {
      log.setTarget(workflowTargetLabel({ templateName: templateKey }));
      return log.fail(400, '양식을 찾을 수 없습니다.');
    }
    log.setTarget(workflowTargetLabel({ templateName: template.name }));
    log.setMetadata({ template_key: template.template_key });

    // 서버는 DB 필드 정의만 신뢰한다 (body.fields 등 클라이언트 규칙은 무시)
    const values = normalizeWorkflowValues(template.fields, body.values);

    const attachmentIds = parseUuidArray(body.attachment_ids);
    if (!attachmentIds) return log.fail(400, '첨부파일 형식이 올바르지 않습니다.');

    const errors = validateWorkflowInputs({
      fields: template.fields,
      values,
      attachmentRule: template,
      attachmentCount: attachmentIds.length
    });
    if (errors.length > 0) {
      return log.fail(400, errors[0].message, { fieldKey: errors[0].field_key, errors });
    }

    const line = parseApprovalLineBody(body);
    if (!line) {
      return log.fail(400, '결재선 형식이 올바르지 않습니다.', { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });
    }
    const lineError = validateApprovalLine(line, { writerId: session.userId });
    if (lineError) return log.fail(400, lineError, { fieldKey: WORKFLOW_APPROVAL_LINE_ERROR_KEY });

    const referenceIds = collectReferenceIds(template.fields, values);
    if (referenceIds.some((id) => !isUuid(id))) {
      return log.fail(400, WORKFLOW_MESSAGES.referenceInvalid, { fieldKey: 'reference_documents' });
    }

    const content = prepareWorkflowContent(body.content_html, template.content_default);
    if (!content.ok) return log.fail(400, content.message);

    const draftId = body.draft_id === undefined || body.draft_id === null ? null : body.draft_id;
    if (draftId !== null && !isUuid(draftId)) return log.fail(400, '임시저장 형식이 올바르지 않습니다.');

    const writerName = session.profile.full_name?.trim() || session.profile.email;
    const result = await submitWorkflowDocument({
      actorUserId: session.userId,
      templateId: template.id,
      inputs: toInputItems(template.fields, values),
      contentHtml: content.html,
      searchText: buildWorkflowSearchText({
        templateName: template.name,
        writerName,
        fields: template.fields,
        values,
        contentHtml: content.html
      }),
      steps: line.steps,
      referrers: line.referrers,
      referenceIds,
      attachmentIds,
      draftId
    });

    log.setTarget(workflowTargetLabel({ code: result.code, templateName: template.name }));

    await removeWorkflowStorageObjects(result.removed_storage_paths);
    const notifyDoc = {
      id: result.document_id,
      code: result.code,
      templateKey: template.template_key,
      templateName: template.name,
      writerName
    };
    await insertWorkflowNotifications({
      type: 'workflow.approval_requested',
      recipientIds: result.notify?.approval_requested,
      actorUserId: session.userId,
      actorName: writerName,
      document: notifyDoc
    });
    await insertWorkflowNotifications({
      type: 'workflow.referrer_requested',
      recipientIds: result.notify?.referrer_requested,
      actorUserId: session.userId,
      actorName: writerName,
      document: notifyDoc
    });

    return log.success(
      {
        message: '문서를 보냈습니다.',
        document: {
          id: result.document_id,
          code: result.code,
          status: result.status,
          current_step: result.current_step,
          total_steps: result.total_steps,
          template_key: result.template_key
        }
      },
      201,
      {
        document_id: result.document_id,
        document_code: result.code,
        attachment_count: attachmentIds.length
      }
    );
  } catch (error) {
    return log.fromError(error, '문서를 보내지 못했습니다.');
  }
}
