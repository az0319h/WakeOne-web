import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { softDeleteContractAttachment } from '@/features/contracts/api/service.server';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId
} from '../../../_utils';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

function parseAttachmentId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id, attachmentId } = await params;
  const parsedId = parseContractId(id);
  const parsedAttachmentId = parseAttachmentId(attachmentId);
  const httpPath = `/api/contracts/${id}/attachments/${attachmentId}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.attachment_soft_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: contractTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId || !parsedAttachmentId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '계약서 또는 첨부파일 ID가 올바르지 않습니다.')
      },
      { success: false, message: '계약서 또는 첨부파일 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const result = await softDeleteContractAttachment(parsedId, parsedAttachmentId, session.userId);
    if (!result) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.attachment_soft_delete',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '첨부파일을 찾을 수 없습니다.')
        },
        { success: false, message: '첨부파일을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({
          id: result.contract.id,
          documentNumber: result.contract.document_number,
          fileName: result.attachment.file_name
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {
          document_number: result.contract.document_number,
          file_name: result.attachment.file_name,
          status: result.attachment.status
        }
      },
      {
        success: true,
        message: '계약서 첨부파일이 삭제 처리되었습니다.',
        contract: result.contract,
        attachment: result.attachment
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 첨부파일 삭제 처리 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.attachment_soft_delete',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
