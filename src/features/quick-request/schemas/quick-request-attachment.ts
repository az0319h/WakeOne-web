import * as z from 'zod';

/**
 * plan 98 — 퀵 대화 파일 첨부 공유 상수·스키마·순수 함수 (Route Handler · attachments.server · FE 공용).
 * - D-1 확장자 allowlist 1차 + MIME 보조 (브라우저가 hwp 등을 `application/octet-stream`으로 보내므로 MIME만으로 거부하지 않는다)
 * - D-2 파일당 10MB · 메시지당 30개 · 본문 없이 첨부만 허용
 * - D-9 알림·대화 목록 요약 `사진 N장·파일 N개` (파일명은 어디에도 넣지 않는다)
 * 이 파일은 `@/` alias·server 모듈을 import하지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export const QUICK_CHAT_ATTACHMENT_MAX_COUNT = 30;
export const QUICK_CHAT_ATTACHMENT_MAX_MB = 10;
export const QUICK_CHAT_ATTACHMENT_MAX_BYTES = QUICK_CHAT_ATTACHMENT_MAX_MB * 1024 * 1024;
export const QUICK_CHAT_ATTACHMENT_FILE_NAME_MAX_LENGTH = 255;
/** pending 행(prepare만 하고 전송하지 않은 첨부) 만료 — 정리 cron은 후속 [TBD] */
export const QUICK_CHAT_ATTACHMENT_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
/** 서명 URL(보기·다운로드) 유효 시간(초) — 계약서 첨부와 동일 */
export const QUICK_CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60;
export const QUICK_CHAT_ATTACHMENT_BUCKET = 'quick-chat-attachments';

export const QUICK_CHAT_ATTACHMENT_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif'
] as const;

export const QUICK_CHAT_ATTACHMENT_FILE_EXTENSIONS = [
  'pdf',
  'hwp',
  'hwpx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip'
] as const;

export const QUICK_CHAT_ATTACHMENT_EXTENSIONS = [
  ...QUICK_CHAT_ATTACHMENT_IMAGE_EXTENSIONS,
  ...QUICK_CHAT_ATTACHMENT_FILE_EXTENSIONS
] as const;

export type QuickChatAttachmentExtension = (typeof QUICK_CHAT_ATTACHMENT_EXTENSIONS)[number];
export type QuickChatAttachmentKind = 'image' | 'file';

/**
 * 버킷 `allowed_mime_types`와 동일 목록 (SQL 96). `application/octet-stream`은 hwp·zip 등을 브라우저가 못 맞추는 경우용 —
 * 서버는 확장자를 1차로 검사하므로 octet-stream 자체가 실행 파일을 통과시키지 않는다.
 */
export const QUICK_CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
] as const;

/** 확장자별 기대 MIME (보조 검사 · 여기 없는 조합은 확장자가 allowlist면 통과) */
const EXTENSION_MIME_HINTS: Record<QuickChatAttachmentExtension, readonly string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'],
  heif: ['image/heif', 'image/heic'],
  pdf: ['application/pdf'],
  hwp: ['application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp'],
  hwpx: ['application/vnd.hancom.hwpx', 'application/zip'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  zip: ['application/zip', 'application/x-zip-compressed']
};

/** `<input type=file accept>` 문자열 (확장자 + 대표 MIME) */
export const QUICK_CHAT_ATTACHMENT_ACCEPT = [
  ...QUICK_CHAT_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`),
  'image/*',
  'application/pdf'
].join(',');

/** 서버 응답 문구 (FE는 `message`를 그대로 `notifyError` · AC-04·05·06·07·09·11) */
export const QUICK_CHAT_ATTACHMENT_MESSAGES = {
  fileTooLarge: `파일당 용량은 ${QUICK_CHAT_ATTACHMENT_MAX_MB}MB 이하여야 합니다.`,
  invalidType: '허용되지 않는 파일 형식입니다.',
  tooMany: `파일은 메시지당 ${QUICK_CHAT_ATTACHMENT_MAX_COUNT}개까지 첨부할 수 있습니다.`,
  notUploaded: '업로드되지 않은 파일이 있습니다. 다시 첨부해 주세요.',
  mismatch: '첨부 정보가 올바르지 않습니다.',
  /** complete 검증 — Storage 객체 크기·MIME이 prepare 정보와 다름 (409 · 행·객체 삭제) */
  uploadMismatch: '업로드된 파일이 첨부 정보와 다릅니다. 다시 첨부해 주세요.',
  bodyOrAttachmentRequired: '메시지를 입력하거나 파일을 첨부해 주세요.',
  linkedCannotDelete: '전송된 첨부는 삭제할 수 없습니다.',
  attachmentNotFound: '첨부를 찾을 수 없습니다.',
  prepareFailed: '파일 업로드를 준비하지 못했습니다. 다시 시도해 주세요.'
} as const;

// ---------------------------------------------------------------------------
// 분류·검사 (FE 선택 즉시 검사 · 서버 prepare 검사 공용)
// ---------------------------------------------------------------------------

export type QuickChatAttachmentClassification =
  | { ok: true; kind: QuickChatAttachmentKind; extension: QuickChatAttachmentExtension; mimeType: string }
  | { ok: false; reason: 'type' | 'size'; message: string };

/** 파일명 → 소문자 확장자 (경로 구분자 제거 · 점이 없거나 끝이면 '') */
export function getQuickChatAttachmentExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? '';
  const dotIndex = baseName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return '';
  }
  return baseName.slice(dotIndex + 1).toLowerCase();
}

export function isQuickChatAttachmentExtension(value: string): value is QuickChatAttachmentExtension {
  return (QUICK_CHAT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(value);
}

export function isQuickChatImageExtension(value: string): boolean {
  return (QUICK_CHAT_ATTACHMENT_IMAGE_EXTENSIONS as readonly string[]).includes(value);
}

function normalizeMime(mime: string | null | undefined): string {
  const value = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return value || 'application/octet-stream';
}

/** MIME 보조 검사 — allowlist 밖 MIME이면 거부. 확장자별 힌트와 다르더라도 octet-stream·zip 계열은 통과(hwp·docx 등) */
export function isQuickChatAttachmentMimeAllowed(
  extension: QuickChatAttachmentExtension,
  mime: string | null | undefined
): boolean {
  const normalized = normalizeMime(mime);
  if (!(QUICK_CHAT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(normalized)) {
    return false;
  }
  if (normalized === 'application/octet-stream') {
    return true;
  }
  const hints = EXTENSION_MIME_HINTS[extension];
  if (hints.includes(normalized)) {
    return true;
  }
  // 브라우저·OS별 편차(예: csv를 application/vnd.ms-excel, hwpx를 application/zip) — 같은 계열(image/·application/)이면 보조 검사 통과
  const family = normalized.split('/')[0];
  return hints.some((hint) => hint.split('/')[0] === family);
}

/**
 * 확장자 allowlist(1차) → MIME 보조 → 크기. 실행 파일(exe·js·sh·bat·apk 등)은 확장자에서 걸린다.
 * `size`가 0 이하(빈 파일)는 `size` 사유로 거부한다.
 */
export function classifyQuickChatAttachment(input: {
  name: string;
  size: number;
  mime?: string | null;
}): QuickChatAttachmentClassification {
  const extension = getQuickChatAttachmentExtension(input.name);
  if (!isQuickChatAttachmentExtension(extension)) {
    return { ok: false, reason: 'type', message: QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType };
  }
  if (!isQuickChatAttachmentMimeAllowed(extension, input.mime)) {
    return { ok: false, reason: 'type', message: QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > QUICK_CHAT_ATTACHMENT_MAX_BYTES) {
    return { ok: false, reason: 'size', message: QUICK_CHAT_ATTACHMENT_MESSAGES.fileTooLarge };
  }
  return {
    ok: true,
    kind: isQuickChatImageExtension(extension) ? 'image' : 'file',
    extension,
    mimeType: normalizeMime(input.mime)
  };
}

// ---------------------------------------------------------------------------
// 요약 (D-9 · 알림 본문 · 대화 목록 미리보기 · 파일명 없음)
// ---------------------------------------------------------------------------

/** `['image','image','file']` → `사진 2장·파일 1개` · 없으면 '' */
export function summarizeAttachments(kinds: readonly QuickChatAttachmentKind[]): string {
  let images = 0;
  let files = 0;
  for (const kind of kinds) {
    if (kind === 'image') images += 1;
    else files += 1;
  }
  const parts: string[] = [];
  if (images > 0) parts.push(`사진 ${images}장`);
  if (files > 0) parts.push(`파일 ${files}개`);
  return parts.join('·');
}

/**
 * 본문 + 첨부 요약 합성. 본문(이미 클립된 값)이 있으면 `{본문} (사진 2장·파일 1개)`, 없으면 요약만.
 * 첨부가 없으면 본문 그대로.
 */
export function buildChatBodyWithAttachmentSummary(
  body: string,
  kinds: readonly QuickChatAttachmentKind[]
): string {
  const summary = summarizeAttachments(kinds);
  const trimmed = body.trim();
  if (!summary) return trimmed;
  if (!trimmed) return summary;
  return `${trimmed} (${summary})`;
}

// ---------------------------------------------------------------------------
// zod (Route 입력)
// ---------------------------------------------------------------------------

const INVALID = '요청 형식이 올바르지 않습니다.';

/** POST …/messages/attachments/prepare — `{ files: [{ name, size, mime? }] }` 1~30 */
export const quickChatAttachmentsPrepareSchema = z.object({
  files: z
    .array(
      z.object({
        name: z
          .string({ error: INVALID })
          .trim()
          .min(1, INVALID)
          .max(QUICK_CHAT_ATTACHMENT_FILE_NAME_MAX_LENGTH, INVALID),
        size: z.number({ error: INVALID }).int(INVALID).nonnegative(INVALID),
        mime: z.string({ error: INVALID }).max(255, INVALID).optional().nullable()
      }),
      { error: INVALID }
    )
    .min(1, INVALID)
    .max(QUICK_CHAT_ATTACHMENT_MAX_COUNT, QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany)
});

export type QuickChatAttachmentsPrepareBody = z.infer<typeof quickChatAttachmentsPrepareSchema>;

/** POST …/messages `attachmentIds` — 양의 정수 · 최대 30 · 중복 허용 안 함(서버가 dedupe 후 검증) */
export const quickChatAttachmentIdsSchema = z
  .array(z.number({ error: INVALID }).int(INVALID).positive(INVALID), { error: INVALID })
  .max(QUICK_CHAT_ATTACHMENT_MAX_COUNT, QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany);

/** 첨부 id path segment → 양의 정수 (아니면 null → 404) */
export function parseQuickChatAttachmentId(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
