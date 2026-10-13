import {
  ANONYMOUS_ACTOR,
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction, ActivityLogMetadata } from '@/features/activity-logs/api/types';
import type { SessionResult } from '@/features/auth/api/session.server';

export function parseBenefitDocumentId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function benefitDocumentTargetLabel(input: {
  id: number | string;
  documentNumber?: string | null;
}) {
  const number = input.documentNumber?.trim();
  return number ? `복지비 ${number}` : `복지비 문서 #${input.id}`;
}

export function logBenefitDocumentAuthFailure(input: {
  requestId: string;
  action: ActivityAction;
  httpPath: string;
  documentId: string;
  session: SessionResult;
}) {
  if (input.session.ok) {
    throw new Error('logBenefitDocumentAuthFailure called with ok session');
  }

  return jsonWithActivityLog(
    input.requestId,
    {
      ...ANONYMOUS_ACTOR,
      action: input.action,
      targetType: 'benefit',
      targetUserId: null,
      targetLabel: benefitDocumentTargetLabel({ id: input.documentId }),
      httpMethod: 'PATCH',
      httpPath: input.httpPath,
      metadata: buildErrorMetadata('forbidden', '복지비 관리 권한이 필요합니다.')
    },
    { success: false, message: '복지비 관리 권한이 필요합니다.' },
    403
  );
}

export function logBenefitDocumentMutation(input: {
  requestId: string;
  action: ActivityAction;
  httpPath: string;
  session: Extract<SessionResult, { ok: true }>;
  documentId: number;
  documentNumber: string;
  targetUserId: string;
  status: number;
  body: Record<string, unknown>;
  metadata?: ActivityLogMetadata;
}) {
  return jsonWithActivityLog(
    input.requestId,
    {
      ...actorFromProfile(input.session.profile),
      action: input.action,
      targetType: 'benefit',
      targetUserId: input.targetUserId,
      targetLabel: benefitDocumentTargetLabel({
        id: input.documentId,
        documentNumber: input.documentNumber
      }),
      httpMethod: 'PATCH',
      httpPath: input.httpPath,
      metadata: input.metadata
    },
    input.body,
    input.status
  );
}
