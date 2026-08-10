import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  downloadAnnouncementAttachment,
  getAnnouncementAttachmentForDownload
} from '@/features/announcements/api/service.server';
import {
  attachmentContentDisposition,
  attachmentResponseContentType,
  isInlineOpenableAttachment
} from '@/app/api/contracts/_utils';
import { parseAnnouncementId, parseAttachmentId } from '../../../../_utils';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

function getRequestedDisposition(
  request: NextRequest,
  attachment: { content_type: string | null; file_name: string }
) {
  const disposition = request.nextUrl.searchParams.get('disposition')?.trim().toLowerCase();
  const inline = request.nextUrl.searchParams.get('inline');
  const wantsInline = disposition === 'inline' || inline === '1' || inline === 'true';

  if (!wantsInline) {
    return 'attachment' as const;
  }

  return isInlineOpenableAttachment(attachment.content_type, attachment.file_name)
    ? ('inline' as const)
    : ('attachment' as const);
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { id, attachmentId } = await params;
  const parsedId = parseAnnouncementId(id);
  const parsedAttachmentId = parseAttachmentId(attachmentId);
  if (!parsedId || !parsedAttachmentId) {
    return NextResponse.json(
      { success: false, message: '공지 또는 첨부파일 ID가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  try {
    const attachment = await getAnnouncementAttachmentForDownload(parsedId, parsedAttachmentId);
    if (!attachment) {
      return NextResponse.json({ success: false, message: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    const disposition = getRequestedDisposition(request, attachment);
    const blob = await downloadAnnouncementAttachment(attachment);
    return new Response(blob, {
      status: 200,
      headers: {
        'content-type': attachmentResponseContentType(attachment.content_type, attachment.file_name),
        'content-length': String(attachment.file_size),
        'content-disposition': attachmentContentDisposition(attachment.file_name, disposition)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 첨부파일 다운로드 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
