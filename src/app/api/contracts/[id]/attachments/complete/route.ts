import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { completeContractAttachmentUpload } from '@/features/contracts/api/service.server';
import type { ContractAttachmentCompletePayload } from '@/features/contracts/api/types';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId,
  resolveContractAttachmentUploadHttpStatus
} from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

function parseCompletePayload(body: unknown): ContractAttachmentCompletePayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const storagePath = typeof record.storagePath === 'string' ? record.storagePath.trim() : null;
  const fileName = typeof record.fileName === 'string' ? record.fileName : null;
  const fileSize = typeof record.fileSize === 'number' ? record.fileSize : null;
  const contentType = typeof record.contentType === 'string' ? record.contentType : undefined;

  if (!storagePath || !fileName || fileSize == null || !Number.isInteger(fileSize) || fileSize <= 0) {
    return null;
  }

  return { storagePath, fileName, fileSize, contentType };
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}/attachments/complete`;

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

  let payload: ContractAttachmentCompletePayload | null;
  try {
    payload = parseCompletePayload(await request.json());
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
        metadata: buildErrorMetadata('validation', '업로드 완료 요청 본문이 올바르지 않습니다.')
      },
      { success: false, message: '업로드 완료 요청 본문이 올바르지 않습니다.' },
      400
    );
  }

  try {
    const result = await completeContractAttachmentUpload({
      contractId: parsedId,
      storagePath: payload.storagePath,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      contentType: payload.contentType,
      actorUserId: session.userId
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

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_upload',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({
          id: result.contract.id,
          documentNumber: result.contract.document_number,
          fileName: result.attachment.file_name
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          document_number: result.contract.document_number,
          file_name: result.attachment.file_name,
          status: result.attachment.status
        }
      },
      {
        success: true,
        message: '계약서 첨부파일이 업로드되었습니다.',
        contract: result.contract,
        attachment: result.attachment
      },
      201
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '계약서 첨부파일 업로드 완료 처리 중 오류가 발생했습니다.';
    const status = resolveContractAttachmentUploadHttpStatus(message, { contractNotFoundAs404: true });
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
        metadata: buildErrorMetadata(
          status === 400 ? 'validation' : status === 404 ? 'not_found' : 'internal_error',
          message,
          { file_name: payload.fileName.trim() }
        )
      },
      { success: false, message },
      status
    );
  }
}
