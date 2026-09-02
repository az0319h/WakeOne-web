import type { Metadata } from 'next';
import { isInlineOpenableAttachment } from '@/app/api/contracts/_utils';
import { parseAnnouncementId, parseAttachmentId } from '@/app/api/announcements/_utils';
import { AttachmentViewerError } from '@/features/attachments/components/attachment-viewer-error';
import { AttachmentViewerFrame } from '@/features/attachments/components/attachment-viewer-frame';
import { getSessionProfile, requireDashboardSession } from '@/features/auth/api/session.server';
import { getAnnouncementAttachmentForDownload } from '@/features/announcements/api/service.server';

type PageProps = {
  params: Promise<{ announcementId: string; attachmentId: string }>;
};

async function loadAttachment(announcementIdRaw: string, attachmentIdRaw: string) {
  const parsedAnnouncementId = parseAnnouncementId(announcementIdRaw);
  const parsedAttachmentId = parseAttachmentId(attachmentIdRaw);

  if (!parsedAnnouncementId || !parsedAttachmentId) {
    return null;
  }

  return getAnnouncementAttachmentForDownload(parsedAnnouncementId, parsedAttachmentId);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const profile = await getSessionProfile();

  if (!profile || profile.status === 'inactive') {
    return { title: { absolute: '첨부파일' } };
  }

  const { announcementId, attachmentId } = await params;
  const attachment = await loadAttachment(announcementId, attachmentId);

  if (!attachment) {
    return { title: { absolute: '첨부파일' } };
  }

  return { title: { absolute: attachment.file_name } };
}

export default async function AnnouncementAttachmentViewerPage({ params }: PageProps) {
  await requireDashboardSession();

  const { announcementId, attachmentId } = await params;
  const parsedAnnouncementId = parseAnnouncementId(announcementId);
  const parsedAttachmentId = parseAttachmentId(attachmentId);

  if (!parsedAnnouncementId || !parsedAttachmentId) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const attachment = await getAnnouncementAttachmentForDownload(
    parsedAnnouncementId,
    parsedAttachmentId
  );

  if (!attachment) {
    return <AttachmentViewerError message='첨부파일을 찾을 수 없습니다.' />;
  }

  if (!isInlineOpenableAttachment(attachment.content_type, attachment.file_name)) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const downloadUrl = `/api/announcements/${parsedAnnouncementId}/attachments/${parsedAttachmentId}/download?disposition=inline`;

  return <AttachmentViewerFrame src={downloadUrl} fileName={attachment.file_name} />;
}
