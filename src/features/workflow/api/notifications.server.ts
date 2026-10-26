import 'server-only';

import { insertNotifications } from '@/features/notifications/api/insert.server';

export type WorkflowNotificationType =
  | 'workflow.approval_requested'
  | 'workflow.referrer_requested'
  | 'workflow.completed'
  | 'workflow.declined'
  | 'workflow.canceled'
  | 'workflow.comment_created';

export type WorkflowNotificationDocument = {
  id: string;
  code: string;
  templateKey: string;
  templateName: string;
  writerName: string;
};

/** 받침 유무로 「이/가」 선택 */
function subjectParticle(word: string): string {
  const last = word.trim().charCodeAt(word.trim().length - 1);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return '가';
  return (last - 0xac00) % 28 === 0 ? '가' : '이';
}

function buildCopy(
  type: WorkflowNotificationType,
  doc: WorkflowNotificationDocument,
  actorName: string
): { title: string; body: string } {
  const name = doc.templateName;
  const subject = `${name}${subjectParticle(name)}`;
  switch (type) {
    case 'workflow.approval_requested':
      return {
        title: `${name} 승인 요청`,
        body: `${doc.writerName}님의 ${name}(${doc.code})를 승인해 주세요.`
      };
    case 'workflow.referrer_requested':
      return {
        title: `${name} 참조 요청`,
        body: `${doc.writerName}님의 ${name}(${doc.code})에 참조자로 지정되었어요.`
      };
    case 'workflow.completed':
      return {
        title: `${subject} 승인 완료되었어요`,
        body: `${doc.writerName}님의 ${name}(${doc.code}) 결재가 완료되었어요.`
      };
    case 'workflow.declined':
      return {
        title: `${subject} 반려되었어요`,
        body: `${actorName}님이 ${doc.writerName}님의 ${name}(${doc.code})를 반려했어요.`
      };
    case 'workflow.canceled':
      return {
        title: `${subject} 취소되었어요`,
        body: `${doc.writerName}님이 ${name}(${doc.code})를 취소했어요.`
      };
    case 'workflow.comment_created':
    default:
      return {
        title: `${name}에 새 댓글`,
        body: `${actorName}님이 ${name}(${doc.code})에 댓글을 남겼어요.`
      };
  }
}

/**
 * 워크플로우 인앱 알림 fan-out (plan 88). RPC가 돌려준 uid 목록을 받아 본인 제외·중복 제거 후 insert.
 * metadata는 workflow_document_id·document_code·template_key만 넣는다. 실패해도 mutation 응답은 바꾸지 않는다.
 */
export async function insertWorkflowNotifications(input: {
  type: WorkflowNotificationType;
  recipientIds: unknown;
  actorUserId: string;
  actorName: string;
  document: WorkflowNotificationDocument;
}): Promise<void> {
  const ids = Array.isArray(input.recipientIds)
    ? [...new Set(input.recipientIds.filter((id): id is string => typeof id === 'string'))].filter(
        (id) => id !== input.actorUserId
      )
    : [];
  if (ids.length === 0) return;

  const { title, body } = buildCopy(input.type, input.document, input.actorName);
  const rows = ids.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: input.type,
    title,
    body,
    metadata: {
      kind: input.type,
      workflow_document_id: input.document.id,
      document_code: input.document.code,
      template_key: input.document.templateKey
    }
  }));

  try {
    await insertNotifications(rows);
  } catch (error) {
    console.error(
      '[workflow] notification insert failed:',
      error instanceof Error ? error.message : 'unknown'
    );
  }
}
