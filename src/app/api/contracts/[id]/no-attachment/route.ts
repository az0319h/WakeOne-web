import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { setContractNoAttachment } from '@/features/contracts/api/service.server';
import { noAttachmentSchema } from '@/features/contracts/api/validators';
import {
  contractTargetLabel,
  logContractAuthFailure,
  newContractRequestId,
  parseContractId
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };
const ACTIVE_ATTACHMENT_NO_ATTACHMENT_MESSAGE =
  '활성 첨부파일이 있는 계약서는 첨부파일 없음으로 지정할 수 없습니다.';

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newContractRequestId();
  const { id } = await params;
  const parsedId = parseContractId(id);
  const httpPath = `/api/contracts/${id}/no-attachment`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.no_attachment_set',
      httpMethod: 'PATCH',
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
        action: 'contract.no_attachment_set',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '계약서 ID가 올바르지 않습니다.')
      },
      { success: false, message: '계약서 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = await request.json();
    const parsed = noAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'contract.no_attachment_set',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', message)
        },
        { success: false, message },
        400
      );
    }

    const action = parsed.data.no_attachment_required
      ? 'contract.no_attachment_set'
      : 'contract.no_attachment_unset';
    const updated = await setContractNoAttachment({
      contractId: parsedId,
      required: parsed.data.no_attachment_required,
      reason: parsed.data.no_attachment_reason,
      actorUserId: session.userId
    });

    if (!updated) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action,
          targetType: 'contract',
          targetUserId: null,
          targetLabel: contractTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '계약서를 찾을 수 없습니다.')
        },
        { success: false, message: '계약서를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action,
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({
          id: updated.id,
          documentNumber: updated.document_number
        }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: {
          document_number: updated.document_number,
          status: updated.attachment_status
        }
      },
      {
        success: true,
        message: parsed.data.no_attachment_required
          ? '첨부파일 없음으로 지정되었습니다.'
          : '첨부파일 없음 지정이 해제되었습니다.',
        contract: updated
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부파일 없음 상태 변경 중 오류가 발생했습니다.';
    const status = message === ACTIVE_ATTACHMENT_NO_ATTACHMENT_MESSAGE ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'contract.no_attachment_set',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: parsedId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message)
      },
      { success: false, message },
      status
    );
  }
}
