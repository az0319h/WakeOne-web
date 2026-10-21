import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { createWorkflowSignedUpload } from '@/features/workflow/api/service.server';
import {
  WORKFLOW_ATTACHMENT_MAX_BYTES,
  WORKFLOW_ATTACHMENT_MAX_COUNT,
  WORKFLOW_MESSAGES
} from '@/features/workflow/lib/required-rules';
import { INVALID_BODY_MESSAGE, readJsonBody, WorkflowRouteLog } from '../../_utils';

const SAFE_EXTENSION_PATTERN = /^[a-z0-9]{1,16}$/;

function safeExtension(fileName: string): string {
  const base = fileName.normalize('NFKC').split(/[\\/]/).pop()?.trim() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  const ext = base.slice(dot + 1).toLowerCase();
  return SAFE_EXTENSION_PATTERN.test(ext) ? `.${ext}` : '';
}

/**
 * 첨부 업로드 1단계 — signed upload URL 발급 (plan 53 패턴).
 * 경로 `staged/{user_id}/{uuid}/file{.ext}`. 20MB · 개수(existing_count, 최종 검증은 제출 시) 사전 차단.
 */
export async function POST(request: NextRequest) {
  const log = new WorkflowRouteLog({
    action: 'workflow.attachment_upload',
    targetType: 'workflow_attachment',
    method: 'POST',
    path: '/api/workflow/attachments/prepare'
  });
  log.setTarget('workflow_attachment:prepare');

  const session = await requireSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const body = await readJsonBody(request);
  if (!body) return log.fail(400, INVALID_BODY_MESSAGE);

  const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : '';
  const fileSize = typeof body.file_size === 'number' ? body.file_size : NaN;
  const existingCount = typeof body.existing_count === 'number' ? body.existing_count : 0;

  if (!fileName || fileName.length > 255) return log.fail(400, '파일명이 올바르지 않습니다.');
  if (!Number.isInteger(fileSize) || fileSize <= 0) return log.fail(400, '파일 크기가 올바르지 않습니다.');
  if (fileSize > WORKFLOW_ATTACHMENT_MAX_BYTES) return log.fail(400, WORKFLOW_MESSAGES.attachmentTooLarge);
  if (Number.isFinite(existingCount) && existingCount >= WORKFLOW_ATTACHMENT_MAX_COUNT) {
    return log.fail(400, WORKFLOW_MESSAGES.attachmentTooMany);
  }

  try {
    const storagePath = `staged/${session.userId}/${crypto.randomUUID()}/file${safeExtension(fileName)}`;
    const signed = await createWorkflowSignedUpload(storagePath);
    return log.success(
      { signed_url: signed.signedUrl, token: signed.token, storage_path: storagePath },
      200
    );
  } catch (error) {
    return log.fromError(error, '업로드 URL을 만들지 못했습니다.');
  }
}
