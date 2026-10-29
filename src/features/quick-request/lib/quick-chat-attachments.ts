import type { AttachmentLightboxItem } from '@/features/attachments/api/types';
import { formatBytes } from '@/lib/utils';
import type { QuickRequestMessageAttachment } from '../api/types';
import {
  QUICK_CHAT_ATTACHMENT_MAX_COUNT,
  classifyQuickChatAttachment,
  type QuickChatAttachmentClassification
} from '../schemas/quick-request-attachment';

/**
 * plan 98 — 퀵 대화 첨부 FE 공용 순수 함수 (검사·분할·표시 문구·lightbox 변환).
 * 검사 규칙(allowlist·10MB·30개)과 문구는 BE 소유 `schemas/quick-request-attachment.ts`를 그대로 쓴다.
 */

/** 말풍선 격자에 보이는 최대 장수 — 그 이상은 4번째 타일에 「+N」 (U-3) */
export const QUICK_CHAT_IMAGE_GRID_MAX = 4;

export { QUICK_CHAT_ATTACHMENT_MAX_COUNT };

/** 브라우저 `File` → 분류 (확장자 1차 · MIME 보조 · 크기). 실패면 `reason: 'type' | 'size'` + 서버와 같은 문구 */
export function classifyFile(file: File): QuickChatAttachmentClassification {
  return classifyQuickChatAttachment({ name: file.name, size: file.size, mime: file.type });
}

/** 이미지 격자 / 파일 카드 분리 (순서 유지) */
export function splitAttachments<T extends Pick<QuickRequestMessageAttachment, 'kind'>>(
  attachments: readonly T[]
): { images: T[]; files: T[] } {
  const images: T[] = [];
  const files: T[] = [];
  for (const attachment of attachments) {
    if (attachment.kind === 'image') images.push(attachment);
    else files.push(attachment);
  }
  return { images, files };
}

/** 카드 보조 줄 — `DOCX · 1.2 MB` (D-6 · 확장자 대문자는 CSS `uppercase`가 아닌 값으로 고정해 복사해도 같게) */
export function formatAttachmentMeta(extension: string, fileSize: number): string {
  // 1KB 미만은 소수 없음 (`303 Bytes`) · 그 외 소수 1자리 (`1.2 MB`)
  return `${extension.toUpperCase()} · ${formatBytes(fileSize, { decimals: fileSize < 1024 ? 0 : 1 })}`;
}

export function isPdfAttachment(attachment: Pick<QuickRequestMessageAttachment, 'extension' | 'mimeType'>): boolean {
  return attachment.extension === 'pdf' || attachment.mimeType === 'application/pdf';
}

/** lightbox(72) 입력 형태 — 같은 메시지의 이미지·PDF만 carousel에 남는다(`filterLightboxAttachments`가 제외) */
export function toLightboxItems(
  attachments: readonly Pick<QuickRequestMessageAttachment, 'id' | 'fileName' | 'mimeType'>[]
): AttachmentLightboxItem[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    file_name: attachment.fileName,
    content_type: attachment.mimeType
  }));
}

/** 업로드 큐 동시 실행 수 (plan 98 리스크 「30개 × 10MB 동시 업로드」 완화) */
export const QUICK_CHAT_UPLOAD_CONCURRENCY = 3;
