import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isInlineOpenableAttachment, parseContractId } from '@/app/api/contracts/_utils';
import { parseMyContractAttachmentId } from '@/app/api/my-contracts/_utils';
import { AttachmentViewerError } from '@/features/attachments/components/attachment-viewer-error';
import { AttachmentViewerFrame } from '@/features/attachments/components/attachment-viewer-frame';
import { getSessionProfile, requireDashboardSession } from '@/features/auth/api/session.server';
import {
  assertMyContractAccess,
  getContractAttachmentForDownload
} from '@/features/contracts/api/service.server';

type PageProps = {
  params: Promise<{ contractId: string; attachmentId: string }>;
};

async function loadAttachment(contractIdRaw: string, attachmentIdRaw: string) {
  const parsedContractId = parseContractId(contractIdRaw);
  const parsedAttachmentId = parseMyContractAttachmentId(attachmentIdRaw);

  if (!parsedContractId || !parsedAttachmentId) {
    return null;
  }

  return getContractAttachmentForDownload(parsedContractId, parsedAttachmentId);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const profile = await getSessionProfile();

  if (!profile || profile.system_role !== 'user' || profile.status === 'inactive') {
    return { title: { absolute: '첨부파일' } };
  }

  const { contractId, attachmentId } = await params;
  const parsedContractId = parseContractId(contractId);

  if (!parsedContractId) {
    return { title: { absolute: '첨부파일' } };
  }

  const access = await assertMyContractAccess(parsedContractId, profile.full_name ?? '');

  if (!access.ok) {
    return { title: { absolute: '첨부파일' } };
  }

  const attachment = await loadAttachment(contractId, attachmentId);

  if (!attachment) {
    return { title: { absolute: '첨부파일' } };
  }

  return { title: { absolute: attachment.file_name } };
}

export default async function MyContractAttachmentViewerPage({ params }: PageProps) {
  const profile = await requireDashboardSession();

  if (profile.system_role !== 'user') {
    redirect('/dashboard/overview');
  }

  const { contractId, attachmentId } = await params;
  const parsedContractId = parseContractId(contractId);
  const parsedAttachmentId = parseMyContractAttachmentId(attachmentId);

  if (!parsedContractId || !parsedAttachmentId) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const access = await assertMyContractAccess(parsedContractId, profile.full_name ?? '');

  if (!access.ok) {
    if (access.reason === 'not_found') {
      return <AttachmentViewerError message='첨부파일을 찾을 수 없습니다.' />;
    }

    return <AttachmentViewerError message='본인 작성 계약서만 조회할 수 있습니다.' />;
  }

  const attachment = await getContractAttachmentForDownload(parsedContractId, parsedAttachmentId);

  if (!attachment) {
    return <AttachmentViewerError message='첨부파일을 찾을 수 없습니다.' />;
  }

  if (!isInlineOpenableAttachment(attachment.content_type, attachment.file_name)) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const downloadUrl = `/api/my-contracts/${parsedContractId}/attachments/${parsedAttachmentId}/download?disposition=inline`;

  return <AttachmentViewerFrame src={downloadUrl} fileName={attachment.file_name} />;
}
