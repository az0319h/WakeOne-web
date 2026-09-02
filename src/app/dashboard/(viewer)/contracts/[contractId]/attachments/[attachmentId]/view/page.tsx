import type { Metadata } from 'next';
import { isInlineOpenableAttachment, parseContractId } from '@/app/api/contracts/_utils';
import { AttachmentViewerError } from '@/features/attachments/components/attachment-viewer-error';
import { AttachmentViewerFrame } from '@/features/attachments/components/attachment-viewer-frame';
import { getSessionProfile, requireAdminPage } from '@/features/auth/api/session.server';
import { getContractAttachmentForDownload } from '@/features/contracts/api/service.server';

type PageProps = {
  params: Promise<{ contractId: string; attachmentId: string }>;
};

function parseAttachmentId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadAttachment(contractIdRaw: string, attachmentIdRaw: string) {
  const parsedContractId = parseContractId(contractIdRaw);
  const parsedAttachmentId = parseAttachmentId(attachmentIdRaw);

  if (!parsedContractId || !parsedAttachmentId) {
    return null;
  }

  return getContractAttachmentForDownload(parsedContractId, parsedAttachmentId);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const profile = await getSessionProfile();

  if (!profile || profile.system_role !== 'admin' || profile.status === 'inactive') {
    return { title: { absolute: '첨부파일' } };
  }

  const { contractId, attachmentId } = await params;
  const attachment = await loadAttachment(contractId, attachmentId);

  if (!attachment) {
    return { title: { absolute: '첨부파일' } };
  }

  return { title: { absolute: attachment.file_name } };
}

export default async function ContractAttachmentViewerPage({ params }: PageProps) {
  await requireAdminPage();

  const { contractId, attachmentId } = await params;
  const parsedContractId = parseContractId(contractId);
  const parsedAttachmentId = parseAttachmentId(attachmentId);

  if (!parsedContractId || !parsedAttachmentId) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const attachment = await getContractAttachmentForDownload(parsedContractId, parsedAttachmentId);

  if (!attachment) {
    return <AttachmentViewerError message='첨부파일을 찾을 수 없습니다.' />;
  }

  if (!isInlineOpenableAttachment(attachment.content_type, attachment.file_name)) {
    return <AttachmentViewerError message='첨부파일을 열 수 없습니다.' />;
  }

  const downloadUrl = `/api/contracts/${parsedContractId}/attachments/${parsedAttachmentId}/download?disposition=inline`;

  return <AttachmentViewerFrame src={downloadUrl} fileName={attachment.file_name} />;
}
