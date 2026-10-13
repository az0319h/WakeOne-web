import { buildErrorMetadata } from '@/features/activity-logs/api/log.server';
import { cancelBenefitDocument } from '@/features/benefits/api/service.server';
import { requireBenefitsAdminSession } from '@/features/auth/api/session.server';
import { insertBenefitDocumentCancelNotifications } from '@/features/notifications/api/fan-out.server';
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
  const httpPath = `/api/benefits/documents/${rawId}/cancel`;
  const documentId = parseBenefitDocumentId(rawId);

  const session = await requireBenefitsAdminSession();
  if (!session.ok) {
    if (session.response.status === 403) {
      return logBenefitDocumentAuthFailure({
        requestId,
        action: 'benefit.document_cancel',
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
      action: 'benefit.document_cancel',
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
    const document = await cancelBenefitDocument(documentId, session.userId);

    if (document.applicant_user_id) {
      try {
        await insertBenefitDocumentCancelNotifications({
          benefitDocumentId: document.id,
          documentNumber: document.document_number,
          benefitType: document.benefit_type,
          applicantUserId: document.applicant_user_id,
          applicantName: document.applicant_name,
          actorUserId: session.userId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[benefits/documents/cancel] notification fan-out failed', message);
      }
    }

    return logBenefitDocumentMutation({
      requestId,
      action: 'benefit.document_cancel',
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
    const message = error instanceof Error ? error.message : '복지비 문서를 취소하지 못했습니다.';
    const isConflict = message.includes('이미 취소');
    const isNotFound = message.includes('찾을 수 없습니다');
    const status = isNotFound ? 404 : isConflict ? 409 : 400;

    return logBenefitDocumentMutation({
      requestId,
      action: 'benefit.document_cancel',
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
