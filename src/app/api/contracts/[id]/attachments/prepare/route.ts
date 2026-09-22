import { NextRequest, NextResponse } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { prepareContractAttachmentUpload } from '@/features/contracts/api/service.server';
import type { ContractAttachmentPreparePayload } from '@/features/contracts/api/types';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId,
  resolveContractAttachmentUploadHttpStatus
} from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

function parsePreparePayload(body: unknown): ContractAttachmentPreparePayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const fileName = typeof record.fileName === 'string' ? record.fileName : null;
  const fileSize = typeof record.fileSize === 'number' ? record.fileSize : null;
  const contentType = typeof record.contentType === 'string' ? record.contentType : undefined;

  if (!fileName || fileSize == null || !Number.isInteger(fileSize) || fileSize <= 0) {
    return null;
  }

  return { fileName, fileSize, contentType };
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}/attachments/prepare`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.attachment_upload',
      httpMethod: 'POST',
      httpPath,
      targetLabel: contractTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_upload',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '계약서 ID가 올바르지 않습니다.')
      },
      { success: false, message: '계약서 ID가 올바르지 않습니다.' },
      400
    );
  }

  let payload: ContractAttachmentPreparePayload | null;
  try {
    payload = parsePreparePayload(await request.json());
  } catch {
    payload = null;
  }

  if (!payload) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_upload',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '업로드 요청 본문이 올바르지 않습니다.')
      },
      { success: false, message: '업로드 요청 본문이 올바르지 않습니다.' },
      400
    );
  }

  try {
    const result = await prepareContractAttachmentUpload({
      contractId: parsedId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      contentType: payload.contentType
    });

    if (!result) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.attachment_upload',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId, fileName: payload.fileName }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '계약서를 찾을 수 없습니다.', {
            file_name: payload.fileName.trim()
          })
        },
        { success: false, message: '계약서를 찾을 수 없습니다.' },
        404
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'x-request-id': requestId }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Signed upload URL 생성 중 오류가 발생했습니다.';
    const status = resolveContractAttachmentUploadHttpStatus(message);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_upload',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId, fileName: payload.fileName }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message, {
          file_name: payload.fileName.trim()
        })
      },
      { success: false, message },
      status
    );
  }
}
