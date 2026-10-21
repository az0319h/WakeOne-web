/** 첨부 id — 계약·공지는 number, 워크플로우(plan 88)는 uuid string */
export type AttachmentId = number | string;

export type LightboxSource =
  | { kind: 'contract'; parentId: number }
  | { kind: 'my-contract'; parentId: number }
  | { kind: 'announcement'; parentId: number }
  | { kind: 'workflow'; parentId: string };

export type AttachmentLightboxItemStatus = 'active' | 'soft_deleted';

export type AttachmentLightboxItem = {
  id: AttachmentId;
  file_name: string;
  content_type: string | null;
  status?: AttachmentLightboxItemStatus;
};

export type OpenAttachmentLightboxParams = {
  source: LightboxSource;
  parentId: AttachmentId;
  attachments: AttachmentLightboxItem[];
  initialAttachmentId: AttachmentId;
};

export type AttachmentMediaType = 'pdf' | 'image';

const INLINE_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'apng',
  'bmp',
  'ico'
]);

const GENERIC_BINARY_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream'
]);

function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

export function isInlineOpenableAttachment(
  attachment: Pick<AttachmentLightboxItem, 'content_type' | 'file_name'>
): boolean {
  const contentType = attachment.content_type
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType === 'application/pdf' || contentType?.startsWith('image/')) {
    return true;
  }

  if (contentType && !GENERIC_BINARY_CONTENT_TYPES.has(contentType)) {
    return false;
  }

  return INLINE_ATTACHMENT_EXTENSIONS.has(getFileExtension(attachment.file_name));
}

export function getAttachmentMediaType(
  attachment: Pick<AttachmentLightboxItem, 'content_type' | 'file_name'>
): AttachmentMediaType {
  const contentType = attachment.content_type
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType === 'application/pdf') {
    return 'pdf';
  }
  if (contentType?.startsWith('image/')) {
    return 'image';
  }

  const extension = getFileExtension(attachment.file_name);
  if (extension === 'pdf') {
    return 'pdf';
  }

  return 'image';
}

export function isActiveLightboxAttachment(
  attachment: Pick<AttachmentLightboxItem, 'status'>
): boolean {
  return attachment.status !== 'soft_deleted';
}

export function filterInlineOpenableAttachments<T extends AttachmentLightboxItem>(
  attachments: T[]
): T[] {
  return attachments.filter(isInlineOpenableAttachment);
}

export function filterLightboxAttachments<T extends AttachmentLightboxItem>(
  attachments: T[]
): T[] {
  return attachments.filter(
    (item) => isActiveLightboxAttachment(item) && isInlineOpenableAttachment(item)
  );
}
