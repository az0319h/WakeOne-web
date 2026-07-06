import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { uploadContractAttachment } from '@/features/contracts/api/service.server';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}/attachments`;

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

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
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
          metadata: buildErrorMetadata('validation', '업로드할 파일이 필요합니다.')
        },
        { success: false, message: '업로드할 파일이 필요합니다.' },
        400
      );
    }

    const result = await uploadContractAttachment({
      contractId: parsedId,
      file,
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
          targetLabel: contractTargetLabel({ id: parsedId, fileName: file.name }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '계약서를 찾을 수 없습니다.', {
            file_name: file.name
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
    const message = error instanceof Error ? error.message : '계약서 첨부파일 업로드 중 오류가 발생했습니다.';
    const status = message.includes('동일한 파일명') || message.includes('1MB') || message.includes('파일명') ? 400 : 500;
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
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message)
      },
      { success: false, message },
      status
    );
  }
}
