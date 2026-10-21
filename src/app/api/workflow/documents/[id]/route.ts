import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  buildWorkflowSearchText,
  prepareWorkflowContent,
  toInputItems
} from '@/features/workflow/api/document-input.server';
import {
  getMemberName,
  getVisibleWorkflowDocumentHeader,
  getWorkflowDocumentDetail,
  getWorkflowDocumentEditContext,
  removeWorkflowStorageObjects,
  updateWorkflowDocument,
  WORKFLOW_NOT_FOUND_MESSAGE
} from '@/features/workflow/api/service.server';
import {
  WORKFLOW_CHANGED_ATTACHMENTS_KEY,
  WORKFLOW_CHANGED_CONTENT_KEY
} from '@/features/workflow/api/types';
import { isUuid, parseUuidArray } from '@/features/workflow/api/validators';
import {
  collectReferenceIds,
  diffChangedFieldKeys,
  inputItemsToValues,
  normalizeWorkflowValues
} from '@/features/workflow/lib/inputs';
import { computeWorkflowPermissions } from '@/features/workflow/lib/permissions';
import { validateWorkflowInputs, WORKFLOW_MESSAGES } from '@/features/workflow/lib/required-rules';
import {
  INVALID_BODY_MESSAGE,
  readJsonBody,
  workflowJson,
  workflowReadError,
  WorkflowRouteLog,
  workflowTargetLabel
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

/** 문서 상세 — 사용자 세션(RLS). 열람 불가·없음은 404 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!isUuid(id)) return workflowReadError(404, WORKFLOW_NOT_FOUND_MESSAGE);

  try {
    const document = await getWorkflowDocumentDetail(id, session.userId);
    if (!document) return workflowReadError(404, WORKFLOW_NOT_FOUND_MESSAGE);
    return workflowJson({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : '문서를 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}

/** 문서 수정 — 진행중 + (작성자 OR 결재선 actor). 조건부 필수를 다시 적용한다(AC-27) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.document_update',
    targetType: 'workflow_document',
    method: 'PATCH',
    path: `/api/workflow/documents/${id}`
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

    const ctx = await getWorkflowDocumentEditContext(id);
    if (!ctx) return log.fail(404, WORKFLOW_NOT_FOUND_MESSAGE);
    if (ctx.status !== 'IN_PROGRESS') return log.fail(409, '진행중인 문서만 처리할 수 있습니다.');

    const permissions = computeWorkflowPermissions({
      viewerId: session.userId,
      writerId: ctx.writer_id,
      status: ctx.status,
      currentStep: ctx.current_step,
      editPolicy: ctx.edit_policy,
      approvalStepEditEnabled: ctx.approval_step_edit_enabled,
      actors: ctx.actors
    });
    if (!permissions.can_edit) return log.fail(403, '문서를 수정할 권한이 없습니다.');

    const body = await readJsonBody(request);
    if (!body) return log.fail(400, INVALID_BODY_MESSAGE);

    const snapshot = ctx.template_snapshot;
    const fields = snapshot.fields ?? [];
    const beforeValues = normalizeWorkflowValues(fields, inputItemsToValues(ctx.inputs));
    const values = normalizeWorkflowValues(fields, body.values, beforeValues);

    const addIds = parseUuidArray(body.add_attachment_ids);
    const removeIds = parseUuidArray(body.remove_attachment_ids);
    if (!addIds || !removeIds) return log.fail(400, '첨부파일 형식이 올바르지 않습니다.');
    const removeValid = removeIds.filter((attachmentId) => ctx.bound_attachment_ids.includes(attachmentId));
    const attachmentCount = ctx.bound_attachment_ids.length - removeValid.length + addIds.length;

    const errors = validateWorkflowInputs({
      fields,
      values,
      attachmentRule: snapshot,
      attachmentCount
    });
    if (errors.length > 0) {
      return log.fail(400, errors[0].message, { fieldKey: errors[0].field_key, errors });
    }

    const referenceIds = collectReferenceIds(fields, values);
    if (referenceIds.some((refId) => !isUuid(refId) || refId === id)) {
      return log.fail(400, WORKFLOW_MESSAGES.referenceInvalid, { fieldKey: 'reference_documents' });
    }

    const content = prepareWorkflowContent(body.content_html, ctx.content_html);
    if (!content.ok) return log.fail(400, content.message);

    const changedFieldKeys = diffChangedFieldKeys(fields, beforeValues, values);
    if (content.html !== (ctx.content_html ?? '')) changedFieldKeys.push(WORKFLOW_CHANGED_CONTENT_KEY);
    if (addIds.length > 0 || removeIds.length > 0) changedFieldKeys.push(WORKFLOW_CHANGED_ATTACHMENTS_KEY);

    const writerName = await getMemberName(ctx.writer_id);
    const result = await updateWorkflowDocument({
      actorUserId: session.userId,
      documentId: id,
      inputs: toInputItems(fields, values),
      contentHtml: content.html,
      searchText: buildWorkflowSearchText({
        templateName: snapshot.name,
        writerName,
        fields,
        values,
        contentHtml: content.html
      }),
      referenceIds,
      addAttachmentIds: addIds,
      removeAttachmentIds: removeIds,
      changedFieldKeys
    });

    await removeWorkflowStorageObjects(result.removed_storage_paths);

    return log.success(
      {
        message: '문서를 수정했습니다.',
        document: {
          id: result.document_id,
          code: result.code,
          status: result.status,
          current_step: result.current_step,
          total_steps: result.total_steps,
          template_key: result.template_key
        },
        changed_field_keys: changedFieldKeys
      },
      200,
      { changed_field_keys: changedFieldKeys, attachment_count: result.attachment_count ?? attachmentCount }
    );
  } catch (error) {
    return log.fromError(error, '문서를 수정하지 못했습니다.');
  }
}
