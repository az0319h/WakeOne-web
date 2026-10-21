import { downloadAnnouncementAttachment } from '@/features/announcements/api/service';
import {
  downloadContractAttachment,
  downloadMyContractAttachment
} from '@/features/contracts/api/service';
import { downloadWorkflowAttachmentBlob } from '@/features/workflow/api/service';
import type { AttachmentId, LightboxSource } from './types';

const blobPromiseCache = new Map<string, Promise<Blob>>();

function cacheKey(source: LightboxSource, attachmentId: AttachmentId): string {
  return `${source.kind}:${source.parentId}:${attachmentId}`;
}

async function fetchAttachmentBlobOnce(
  source: LightboxSource,
  attachmentId: AttachmentId
): Promise<Blob> {
  switch (source.kind) {
    case 'contract':
      return downloadContractAttachment(source.parentId, Number(attachmentId));
    case 'my-contract':
      return downloadMyContractAttachment(source.parentId, Number(attachmentId));
    case 'announcement':
      return downloadAnnouncementAttachment(source.parentId, Number(attachmentId));
    case 'workflow':
      return downloadWorkflowAttachmentBlob(source.parentId, String(attachmentId));
    default: {
      const _exhaustive: never = source;
      throw new Error(`Unsupported lightbox source: ${String(_exhaustive)}`);
    }
  }
}

export async function fetchAttachmentBlob(
  source: LightboxSource,
  attachmentId: AttachmentId
): Promise<Blob> {
  const key = cacheKey(source, attachmentId);
  const cached = blobPromiseCache.get(key);
  if (cached) {
    return cached;
  }

  const promise = fetchAttachmentBlobOnce(source, attachmentId).finally(() => {
    blobPromiseCache.delete(key);
  });
  blobPromiseCache.set(key, promise);
  return promise;
}
