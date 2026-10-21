import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  getWorkflowStorageObjectSize,
  registerWorkflowAttachment,
  removeWorkflowStorageObjects
} from '@/features/workflow/api/service.server';
import { WORKFLOW_ATTACHMENT_MAX_BYTES, WORKFLOW_MESSAGES } from '@/features/workflow/lib/required-rules';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog } from '../../_utils';

/** 첨부 업로드 2단계 — Storage 객체 크기 확인 후 staged 행 등록 (RPC) */
export async function POST(request: NextRequest) {
  const log = new WorkflowRouteLog({
    action: 'workflow.attachment_upload',
    targetType: 'workflow_attachment',
    method: 'POST',
    path: '/api/workflow/attachments/complete'
  });
  log.setTarget('workflow_attachment:complete');

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);

  const storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim() : '';
  const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
  const fileSize = typeof body.file_size === 'number' ? body.file_size : NaN;
  const contentType = typeof body.content_type === 'string' ? body.content_type.trim().slice(0, 255) : null;

  if (!storagePath.startsWith(`staged/${session.userId}/`) || storagePath.includes('..')) {
    return log.fail(400, '저장 경로가 올바르지 않습니다.');
  }
  if (!fileName || fileName.length > 255) return log.fail(400, '파일명이 올바르지 않습니다.');
  if (!Number.isInteger(fileSize) || fileSize <= 0) return log.fail(400, '파일 크기가 올바르지 않습니다.');
  if (fileSize > WORKFLOW_ATTACHMENT_MAX_BYTES) return log.fail(400, WORKFLOW_MESSAGES.attachmentTooLarge);

  try {
    const objectSize = await getWorkflowStorageObjectSize(storagePath);
    if (objectSize === null) return log.fail(404, '업로드된 파일을 찾을 수 없습니다.');
    if (objectSize !== fileSize) {
      await removeWorkflowStorageObjects([storagePath]);
      return log.fail(400, '업로드된 파일 크기가 일치하지 않습니다.');
    }

    let attachment;
    try {
      attachment = await registerWorkflowAttachment({
        actorUserId: session.userId,
        storagePath,
        fileName,
        mimeType: contentType,
        sizeBytes: fileSize
      });
    } catch (error) {
      await removeWorkflowStorageObjects([storagePath]);
      throw error;
    }

    log.setTarget(`workflow_attachment:${attachment.id}`);
    return log.success(
      {
        message: '첨부파일을 올렸습니다.',
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          created_at: attachment.created_at
        }
      },
      201
    );
  } catch (error) {
    return log.fromError(error, '첨부파일을 등록하지 못했습니다.');
  }
}
