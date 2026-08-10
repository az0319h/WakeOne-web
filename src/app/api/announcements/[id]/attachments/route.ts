import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { uploadAnnouncementAttachment } from '@/features/announcements/api/service.server';
import {
  announcementTargetLabel,
  isValidationErrorMessage,
  logAnnouncementAuthFailure,
  newAnnouncementRequestId,
  parseAnnouncementId
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newAnnouncementRequestId();
  const { id } = await params;
  const parsedId = parseAnnouncementId(id);
  const httpPath = `/api/announcements/${id}/attachments`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logAnnouncementAuthFailure({
      requestId,
      action: 'announcement.attachment_upload',
      httpMethod: 'POST',
      httpPath,
      targetLabel: announcementTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_upload',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '공지 ID가 올바르지 않습니다.')
      },
      { success: false, message: '공지 ID가 올바르지 않습니다.' },
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
          action: 'announcement.attachment_upload',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '업로드할 파일이 필요합니다.')
        },
        { success: false, message: '업로드할 파일이 필요합니다.' },
        400
      );
    }

    const result = await uploadAnnouncementAttachment({
      announcementId: parsedId,
      file,
      actorUserId: session.userId
    });

    if (!result) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.attachment_upload',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId, fileName: file.name }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '공지를 찾을 수 없습니다.', {
            announcement_id: parsedId,
            file_name: file.name
          })
        },
        { success: false, message: '공지를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_upload',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({
          id: result.announcement.id,
          title: result.announcement.title,
          fileName: result.attachment.file_name
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          announcement_id: result.announcement.id,
          file_name: result.attachment.file_name
        }
      },
      {
        success: true,
        message: '공지 첨부파일이 업로드되었습니다.',
        announcement: result.announcement,
        attachment: result.attachment
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 첨부파일 업로드 중 오류가 발생했습니다.';
    const status = isValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.attachment_upload',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: parsedId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message, {
          announcement_id: parsedId
        })
      },
      { success: false, message },
      status
    );
  }
}
