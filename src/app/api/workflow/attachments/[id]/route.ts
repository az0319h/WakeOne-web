import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  deleteWorkflowStagedAttachment,
  removeWorkflowStorageObjects
} from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { WorkflowRouteLog } from '../../_utils';

type Params = { params: Promise<{ id: string }> };

/** staged 첨부 삭제 — 소유자만 (문서에 붙은 첨부 제거는 PATCH remove_attachment_ids) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const log = new WorkflowRouteLog({
    action: 'workflow.attachment_delete',
    targetType: 'workflow_attachment',
    method: 'DELETE',
    path: `/api/workflow/attachments/${id}`
  });
  log.setTarget(`workflow_attachment:${id}`);

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  if (!isUuid(id)) return log.fail(404, '첨부파일을 찾을 수 없습니다.');

  try {
    const result = await deleteWorkflowStagedAttachment(session.userId, id);
    await removeWorkflowStorageObjects([result.storage_path]);
    return log.success({ message: '첨부파일을 삭제했습니다.', attachment_id: id }, 200);
  } catch (error) {
    return log.fromError(error, '첨부파일을 삭제하지 못했습니다.');
  }
}
