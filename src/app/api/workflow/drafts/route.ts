import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  getWorkflowTemplateDefinition,
  listWorkflowDrafts,
  removeWorkflowStorageObjects,
  saveWorkflowDraft
} from '@/features/workflow/api/service.server';
import {
  INVALID_BODY_MESSAGE,
  readJsonBody,
  workflowJson,
  workflowReadError,
  WorkflowRouteLog
} from '../_utils';
import { parseDraftBody } from './_draft-utils';

/** 내 임시저장 목록 (RLS: 본인만) */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const drafts = await listWorkflowDrafts();
    return workflowJson({ drafts });
  } catch (error) {
    const message = error instanceof Error ? error.message : '임시저장을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}

/** 임시저장 새로 만들기 — 문서번호를 소모하지 않는다 */
export async function POST(request: NextRequest) {
  const log = new WorkflowRouteLog({
    action: 'workflow.draft_save',
    targetType: 'workflow_draft',
    method: 'POST',
    path: '/api/workflow/drafts'
  });
  log.setTarget('workflow_draft:new');

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);
  const templateKey = typeof body.template_key === 'string' ? body.template_key.trim() : '';
  if (!templateKey) return log.fail(400, '양식을 선택해 주세요.');

  try {
    const template = await getWorkflowTemplateDefinition(templateKey, 'session');
    if (!template) return log.fail(404, '양식을 찾을 수 없습니다.');
    log.setMetadata({ template_key: template.template_key });

    const parsed = parseDraftBody(body, template);
    if (!parsed.ok) return log.fail(400, parsed.message);

    const result = await saveWorkflowDraft({
      actorUserId: session.userId,
      draftId: null,
      templateId: template.id,
      payload: parsed.payload,
      attachmentIds: parsed.attachmentIds
    });
    log.setTarget(`workflow_draft:${result.draft_id}:${template.name}`);
    await removeWorkflowStorageObjects(result.removed_storage_paths);

    return log.success(
      { message: '임시저장했습니다.', draft: { id: result.draft_id } },
      201,
      { attachment_count: result.attachment_count }
    );
  } catch (error) {
    return log.fromError(error, '임시저장하지 못했습니다.');
  }
}
