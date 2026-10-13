import { buildErrorMetadata } from '@/features/activity-logs/api/log.server';
import { restoreBenefitDocument } from '@/features/benefits/api/service.server';
import { requireBenefitsAdminSession } from '@/features/auth/api/session.server';
import { newBenefitRequestId } from '@/app/api/benefits/_utils';
import {
  logBenefitDocumentAuthFailure,
  logBenefitDocumentMutation,
  parseBenefitDocumentId
} from '../_utils';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  const requestId = newBenefitRequestId();
  const { id: rawId } = await params;
  const httpPath = `/api/benefits/documents/${rawId}/restore`;
  const documentId = parseBenefitDocumentId(rawId);

  const session = await requireBenefitsAdminSession();
  if (!session.ok) {
    if (session.response.status === 403) {
      return logBenefitDocumentAuthFailure({
        requestId,
        action: 'benefit.document_restore',
        httpPath,
        documentId: rawId,
        session
      });
    }
    return session.response;
  }

  if (!documentId) {
    return logBenefitDocumentMutation({
      requestId,
      action: 'benefit.document_restore',
      httpPath,
      session,
      documentId: 0,
      documentNumber: '',
      targetUserId: session.userId,
      status: 400,
      body: { success: false, message: '문서 ID가 올바르지 않습니다.' },
      metadata: buildErrorMetadata('validation', '문서 ID가 올바르지 않습니다.')
    });
  }

  try {
    const document = await restoreBenefitDocument(documentId);
    return logBenefitDocumentMutation({
      requestId,
      action: 'benefit.document_restore',
      httpPath,
      session,
      documentId: document.id,
      documentNumber: document.document_number,
      targetUserId: document.applicant_user_id ?? session.userId,
      status: 200,
      body: { success: true, data: document },
      metadata: {
        document_number: document.document_number
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '복지비 문서를 복구하지 못했습니다.';
    const isConflict = message.includes('취소되지 않은');
    const isNotFound = message.includes('찾을 수 없습니다');
    const status = isNotFound ? 404 : isConflict ? 409 : 400;

    return logBenefitDocumentMutation({
      requestId,
      action: 'benefit.document_restore',
      httpPath,
      session,
      documentId,
      documentNumber: '',
      targetUserId: session.userId,
      status,
      body: { success: false, message },
      metadata: buildErrorMetadata(isNotFound ? 'not_found' : 'validation', message)
    });
  }
}
