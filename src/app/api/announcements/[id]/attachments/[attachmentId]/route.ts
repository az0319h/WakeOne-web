import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { deleteAnnouncementAttachment } from '@/features/announcements/api/service.server';
import {
  announcementTargetLabel,
  logAnnouncementAuthFailure,
  newAnnouncementRequestId,
  parseAnnouncementId,
  parseAttachmentId
} from '../../../_utils';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newAnnouncementRequestId();
  const { id, attachmentId } = await params;
  const parsedId = parseAnnouncementId(id);
  const parsedAttachmentId = parseAttachmentId(attachmentId);
  const httpPath = `/api/announcements/${id}/attachments/${attachmentId}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logAnnouncementAuthFailure({
      requestId,
      action: 'announcement.attachment_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: announcementTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId || !parsedAttachmentId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '공지 또는 첨부파일 ID가 올바르지 않습니다.')
      },
      { success: false, message: '공지 또는 첨부파일 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const result = await deleteAnnouncementAttachment(parsedId, parsedAttachmentId);
    if (!result) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.attachment_delete',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '첨부파일을 찾을 수 없습니다.', {
            announcement_id: parsedId
          })
        },
        { success: false, message: '첨부파일을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({
          id: result.announcement.id,
          title: result.announcement.title,
          fileName: result.attachment.file_name
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {
          announcement_id: result.announcement.id,
          file_name: result.attachment.file_name
        }
      },
      {
        success: true,
        message: '공지 첨부파일이 삭제되었습니다.',
        announcement: result.announcement,
        attachment: result.attachment
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 첨부파일 삭제 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: parsedId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message, { announcement_id: parsedId })
      },
      { success: false, message },
      500
    );
  }
}
