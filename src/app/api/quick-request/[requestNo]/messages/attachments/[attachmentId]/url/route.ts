import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  createQuickChatAttachmentViewUrl,
  getLinkedQuickChatAttachment
} from '@/features/quick-request/api/attachments.server';
import { getQuickRequestByNo, resolveQuickRequestAccess } from '@/features/quick-request/api/workflow.server';
import {
  parseQuickChatAttachmentId,
  QUICK_CHAT_ATTACHMENT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-attachment';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import { parseQuickRequestNoParam, quickErrorBody } from '../../../../../_utils';

type Params = { params: Promise<{ requestNo: string; attachmentId: string }> };

/**
 * plan 98 D-5 — 보기용 서명 URL(60초 · 이미지 썸네일 `<img>` · lightbox fetch). Read → activity log Out.
 * 권한 = 조회 권한(`resolveQuickRequestAccess` · 구매물류팀·초대 참여자 포함). 미존재·pending·타 건·권한 없음은 같은 404.
 * 응답 `Cache-Control: no-store` — 서명 URL을 공유 캐시에 남기지 않는다.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo, attachmentId: rawAttachmentId } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  const attachmentId = parseQuickChatAttachmentId(rawAttachmentId);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
  }
  if (!attachmentId) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.attachmentNotFound), { status: 404 });
  }

  try {
    const row = await getQuickRequestByNo(requestNo);
    // plan 101 — 활성 초대 참여자도 조회 가능 (SQL 97 can_view_quick_request와 같은 규칙)
    if (!row || !(await resolveQuickRequestAccess(session.profile, row)).canView) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    const attachment = await getLinkedQuickChatAttachment(row.id, attachmentId);
    if (!attachment) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.attachmentNotFound), { status: 404 });
    }

    const signed = await createQuickChatAttachmentViewUrl(attachment);
    return NextResponse.json(
      { success: true, data: signed },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[quick-request/messages/attachments/url] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
