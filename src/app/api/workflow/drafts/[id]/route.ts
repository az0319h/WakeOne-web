import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  deleteWorkflowDraft,
  getWorkflowDraft,
  getWorkflowTemplateDefinition,
  removeWorkflowStorageObjects,
  saveWorkflowDraft
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import {
  INVALID_BODY_MESSAGE,
  readJsonBody,
  workflowJson,
  workflowReadError,
  WorkflowRouteLog
} from '../../_utils';
import { parseDraftBody } from '../_draft-utils';

type Params = { params: Promise<{ id: string }> };

const DRAFT_NOT_FOUND = '임시저장을 찾을 수 없습니다.';

/** 임시저장 불러오기 (본인만) — payload + staged 첨부 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  if (!isUuid(id)) return workflowReadError(404, DRAFT_NOT_FOUND);

  try {
    const draft = await getWorkflowDraft(id);
    if (!draft) return workflowReadError(404, DRAFT_NOT_FOUND);
    return workflowJson({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : '임시저장을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}

/** 임시저장 덮어쓰기 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.draft_save',
    targetType: 'workflow_draft',
    method: 'PUT',
    path: `/api/workflow/drafts/${id}`
  });
  log.setTarget(`workflow_draft:${id}`);

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, DRAFT_NOT_FOUND);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
  const templateKey = typeof body.template_key === 'string' ? body.template_key.trim() : '';
  if (!templateKey) return log.fail(400, '양식을 선택해 주세요.');

  try {
    const template = await getWorkflowTemplateDefinition(templateKey, 'session');
    if (!template) return log.fail(404, '양식을 찾을 수 없습니다.');
    log.setTarget(`workflow_draft:${id}:${template.name}`);
    log.setMetadata({ template_key: template.template_key });

    const parsed = parseDraftBody(body, template);
    if (!parsed.ok) return log.fail(400, parsed.message);

    const result = await saveWorkflowDraft({
      actorUserId: session.userId,
      draftId: id,
      templateId: template.id,
      payload: parsed.payload,
      attachmentIds: parsed.attachmentIds
    });
    await removeWorkflowStorageObjects(result.removed_storage_paths);

    return log.success(
      { message: '임시저장했습니다.', draft: { id: result.draft_id } },
      200,
      { attachment_count: result.attachment_count }
    );
  } catch (error) {
    return log.fromError(error, '임시저장하지 못했습니다.');
  }
}

/** 임시저장 삭제 — 첨부 Storage 객체까지 지운다 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.draft_delete',
    targetType: 'workflow_draft',
    method: 'DELETE',
    path: `/api/workflow/drafts/${id}`
  });
  log.setTarget(`workflow_draft:${id}`);

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, DRAFT_NOT_FOUND);

  try {
    const result = await deleteWorkflowDraft(session.userId, id);
    log.setMetadata({ template_key: result.template_key });
    await removeWorkflowStorageObjects(result.removed_storage_paths);
    return log.success({ message: '임시저장을 삭제했습니다.', draft_id: id }, 200);
  } catch (error) {
    return log.fromError(error, '임시저장을 삭제하지 못했습니다.');
  }
}
