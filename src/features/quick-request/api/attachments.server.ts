import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  classifyQuickChatAttachment,
  QUICK_CHAT_ATTACHMENT_BUCKET,
  QUICK_CHAT_ATTACHMENT_MAX_BYTES,
  QUICK_CHAT_ATTACHMENT_MAX_COUNT,
  QUICK_CHAT_ATTACHMENT_MESSAGES,
  QUICK_CHAT_ATTACHMENT_PENDING_TTL_MS,
  QUICK_CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
  type QuickChatAttachmentKind
} from '../schemas/quick-request-attachment';
import type { QuickRequestMessageAttachment, QuickRequestMessageAttachmentPrepared } from './types';

/**
 * plan 98 — 퀵 대화 첨부 서버 데이터 접근 (service role · 비공개 버킷 `quick-chat-attachments`).
 * - prepare: 확장자 allowlist 1차 + MIME 보조 + 크기 → pending 행 insert(message_id null · expires_at +24h) → signed upload URL
 * - 전송(complete) 검증: pending 행 소유·건 일치 → Storage 객체 존재(`info`) → 크기·MIME 일치. 불일치는 행·객체 삭제 후 409
 * - 연결은 SQL 96 RPC `create_quick_request_message(p_attachment_ids)`가 한 트랜잭션으로 처리
 * - 보기·다운로드는 서명 URL 60초 (Route는 권한 재검사 후 호출)
 * 파일명·storage_path·서명 URL은 activity log·알림에 절대 넣지 않는다 (D-11).
 */

const TABLE = 'quick_request_message_attachments';
const COLUMNS =
  'id, quick_request_id, message_id, uploader_user_id, storage_path, file_name, file_size, mime_type, extension, kind, expires_at, linked_at, created_at';

export type QuickRequestMessageAttachmentRow = {
  id: number;
  quick_request_id: string;
  message_id: number | null;
  uploader_user_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  extension: string;
  kind: QuickChatAttachmentKind;
  expires_at: string | null;
  linked_at: string | null;
  created_at: string;
};

/** Route가 HTTP status·문구로 바로 옮기는 검증 오류 (`error_code`는 로그용) */
export class QuickChatAttachmentError extends Error {
  readonly status: 400 | 409;
  readonly errorCode: 'validation' | 'conflict';

  constructor(status: 400 | 409, message: string) {
    super(message);
    this.name = 'QuickChatAttachmentError';
    this.status = status;
    this.errorCode = status === 409 ? 'conflict' : 'validation';
  }
}

export function toQuickRequestMessageAttachment(
  row: Pick<QuickRequestMessageAttachmentRow, 'id' | 'kind' | 'file_name' | 'file_size' | 'extension' | 'mime_type'>
): QuickRequestMessageAttachment {
  return {
    id: Number(row.id),
    kind: row.kind,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    extension: row.extension,
    mimeType: row.mime_type
  };
}

function buildStoragePath(requestId: string, extension: string): string {
  return `quick-chat/${requestId}/${crypto.randomUUID()}.${extension}`;
}

function normalizeFileName(name: string): string {
  // 제어 문자·경로 구분자 제거 — 다운로드 파일명(`download=`)과 표시용. 확장자는 classify가 따로 검사
  const flat = name
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
  return (flat.split(/[\\/]/).pop() ?? '').trim();
}

// ---------------------------------------------------------------------------
// prepare
// ---------------------------------------------------------------------------

export type QuickChatPrepareFileInput = { name: string; size: number; mime?: string | null };

/**
 * D-4 ① — 파일 전부 검증(하나라도 실패하면 아무 행도 만들지 않는다) → pending 행 일괄 insert → 파일별 signed upload URL.
 * 응답 순서는 입력 `files` 순서와 동일. URL 발급이 하나라도 실패하면 만든 행을 모두 지우고 throw(500).
 */
export async function prepareQuickChatAttachments(input: {
  requestId: string;
  uploaderUserId: string;
  files: QuickChatPrepareFileInput[];
}): Promise<QuickRequestMessageAttachmentPrepared[]> {
  if (input.files.length === 0 || input.files.length > QUICK_CHAT_ATTACHMENT_MAX_COUNT) {
    throw new QuickChatAttachmentError(
      400,
      input.files.length === 0 ? QUICK_CHAT_ATTACHMENT_MESSAGES.invalidType : QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany
    );
  }

  const expiresAt = new Date(Date.now() + QUICK_CHAT_ATTACHMENT_PENDING_TTL_MS).toISOString();
  const inserts = input.files.map((file) => {
    const fileName = normalizeFileName(file.name);
    const classified = classifyQuickChatAttachment({ name: fileName, size: file.size, mime: file.mime });
    if (!classified.ok) {
      throw new QuickChatAttachmentError(400, classified.message);
    }
    return {
      quick_request_id: input.requestId,
      message_id: null,
      uploader_user_id: input.uploaderUserId,
      storage_path: buildStoragePath(input.requestId, classified.extension),
      file_name: fileName,
      file_size: file.size,
      mime_type: classified.mimeType,
      extension: classified.extension,
      kind: classified.kind,
      expires_at: expiresAt
    };
  });

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from(TABLE).insert(inserts).select('id, storage_path');
  if (error) {
    throw new Error(error.message);
  }

  const idByPath = new Map((data ?? []).map((row) => [row.storage_path as string, Number(row.id)] as const));
  const storage = supabase.storage.from(QUICK_CHAT_ATTACHMENT_BUCKET);
  const prepared: QuickRequestMessageAttachmentPrepared[] = [];

  try {
    for (const row of inserts) {
      const attachmentId = idByPath.get(row.storage_path);
      if (!attachmentId) {
        throw new Error('pending attachment row missing after insert');
      }
      const signed = await storage.createSignedUploadUrl(row.storage_path, { upsert: false });
      if (signed.error || !signed.data) {
        throw new Error(signed.error?.message ?? 'Signed upload URL 생성에 실패했습니다.');
      }
      prepared.push({
        attachmentId,
        uploadUrl: signed.data.signedUrl,
        token: signed.data.token,
        storagePath: row.storage_path
      });
    }
  } catch (error) {
    const ids = [...idByPath.values()];
    if (ids.length > 0) {
      await supabase.from(TABLE).delete().in('id', ids);
    }
    throw error;
  }

  return prepared;
}

// ---------------------------------------------------------------------------
// 전송 전 검증 (complete)
// ---------------------------------------------------------------------------

async function fetchRowsByIds(ids: number[]): Promise<QuickRequestMessageAttachmentRow[]> {
  if (ids.length === 0) return [];
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).in('id', ids);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as QuickRequestMessageAttachmentRow[];
}

async function removeRowAndObject(row: Pick<QuickRequestMessageAttachmentRow, 'id' | 'storage_path'>): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error: removeError } = await supabase.storage.from(QUICK_CHAT_ATTACHMENT_BUCKET).remove([row.storage_path]);
  if (removeError) {
    console.error('[quick-request/attachments] storage remove failed:', removeError.message);
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', row.id);
  if (error) {
    console.error('[quick-request/attachments] row delete failed:', error.message);
  }
}

/**
 * D-4 ③ — `attachmentIds`(중복 제거 후)가 전부 「본인이 이 건에 prepare한 pending 행」인지, Storage에 객체가 있는지, 크기·MIME이 맞는지.
 * - 소유·건·pending 불일치 또는 미존재 id → 400 `mismatch` (AC-07 dongbang 분기)
 * - 객체 없음 → 400 `notUploaded` (AC-06 · 행은 남긴다 — 재업로드 가능)
 * - 객체 크기/MIME 불일치 또는 10MB 초과 → 행·객체 삭제 후 409 `uploadMismatch`
 * 반환: 입력 순서대로 정렬한 행.
 */
export async function verifyPendingQuickChatAttachments(input: {
  requestId: string;
  uploaderUserId: string;
  attachmentIds: number[];
}): Promise<QuickRequestMessageAttachmentRow[]> {
  const ids = [...new Set(input.attachmentIds)];
  if (ids.length === 0) return [];

  const rows = await fetchRowsByIds(ids);
  const byId = new Map(rows.map((row) => [Number(row.id), row] as const));
  const ordered: QuickRequestMessageAttachmentRow[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (
      !row ||
      row.message_id !== null ||
      row.uploader_user_id !== input.uploaderUserId ||
      row.quick_request_id !== input.requestId
    ) {
      throw new QuickChatAttachmentError(400, QUICK_CHAT_ATTACHMENT_MESSAGES.mismatch);
    }
    ordered.push(row);
  }

  const storage = getServiceRoleClient().storage.from(QUICK_CHAT_ATTACHMENT_BUCKET);
  for (const row of ordered) {
    const { data, error } = await storage.info(row.storage_path);
    if (error || !data) {
      // 객체 없음(404) → 미업로드. 그 밖의 Storage 오류도 같은 문구 — 재첨부로 복구 가능
      throw new QuickChatAttachmentError(400, QUICK_CHAT_ATTACHMENT_MESSAGES.notUploaded);
    }

    const objectSize = typeof data.size === 'number' ? data.size : null;
    const objectType = (data.contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    const sizeMismatch = objectSize === null || objectSize !== Number(row.file_size) || objectSize > QUICK_CHAT_ATTACHMENT_MAX_BYTES;
    const typeMismatch = objectType !== '' && objectType !== row.mime_type.toLowerCase();
    if (sizeMismatch || typeMismatch) {
      await removeRowAndObject(row);
      throw new QuickChatAttachmentError(409, QUICK_CHAT_ATTACHMENT_MESSAGES.uploadMismatch);
    }
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// 조회 (연결된 첨부)
// ---------------------------------------------------------------------------

/** 메시지 id 목록 → 메시지별 첨부(id 오름차순 = prepare 순서). 없는 메시지는 Map에 없음 → 호출부가 `[]` */
export async function listQuickChatAttachmentsByMessageIds(
  messageIds: number[]
): Promise<Map<number, QuickRequestMessageAttachmentRow[]>> {
  const map = new Map<number, QuickRequestMessageAttachmentRow[]>();
  const unique = [...new Set(messageIds)];
  if (unique.length === 0) return map;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .in('message_id', unique)
    .order('id', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as QuickRequestMessageAttachmentRow[]) {
    if (row.message_id === null) continue;
    const key = Number(row.message_id);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/** 대화 목록·알림 요약용 — 메시지별 kind 배열 */
export async function listQuickChatAttachmentKindsByMessageIds(
  messageIds: number[]
): Promise<Map<number, QuickChatAttachmentKind[]>> {
  const rows = await listQuickChatAttachmentsByMessageIds(messageIds);
  const map = new Map<number, QuickChatAttachmentKind[]>();
  for (const [messageId, list] of rows) {
    map.set(
      messageId,
      list.map((row) => row.kind)
    );
  }
  return map;
}

/** 그 건에 속한 **연결된** 첨부 1건 (pending·타 건은 null → 404) */
export async function getLinkedQuickChatAttachment(
  requestId: string,
  attachmentId: number
): Promise<QuickRequestMessageAttachmentRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', attachmentId)
    .eq('quick_request_id', requestId)
    .not('message_id', 'is', null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as QuickRequestMessageAttachmentRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// 서명 URL (60초)
// ---------------------------------------------------------------------------

export type QuickChatSignedUrl = { url: string; expiresAt: string };

async function createSignedUrl(
  row: Pick<QuickRequestMessageAttachmentRow, 'storage_path' | 'file_name'>,
  options?: { download?: string }
): Promise<QuickChatSignedUrl> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(QUICK_CHAT_ATTACHMENT_BUCKET)
    .createSignedUrl(
      row.storage_path,
      QUICK_CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
      options?.download ? { download: options.download } : undefined
    );
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Signed URL 생성에 실패했습니다.');
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + QUICK_CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS * 1000).toISOString()
  };
}

/** 보기용(이미지 `<img>` · lightbox fetch) */
export function createQuickChatAttachmentViewUrl(
  row: Pick<QuickRequestMessageAttachmentRow, 'storage_path' | 'file_name'>
): Promise<QuickChatSignedUrl> {
  return createSignedUrl(row);
}

/** 다운로드용(`download={file_name}` → Content-Disposition attachment) */
export function createQuickChatAttachmentDownloadUrl(
  row: Pick<QuickRequestMessageAttachmentRow, 'storage_path' | 'file_name'>
): Promise<QuickChatSignedUrl> {
  return createSignedUrl(row, { download: row.file_name });
}

// ---------------------------------------------------------------------------
// pending 취소 (DELETE)
// ---------------------------------------------------------------------------

export type DeletePendingResult = 'deleted' | 'not_found' | 'linked';

/**
 * 업로더 본인의 pending 행만 삭제(Storage 객체가 있으면 함께). 이미 연결된 첨부는 `linked`(409) · 타인·타 건·미존재는 `not_found`(404).
 */
export async function deletePendingQuickChatAttachment(input: {
  requestId: string;
  uploaderUserId: string;
  attachmentId: number;
}): Promise<DeletePendingResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, message_id, storage_path, uploader_user_id')
    .eq('id', input.attachmentId)
    .eq('quick_request_id', input.requestId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  const row = data as Pick<QuickRequestMessageAttachmentRow, 'id' | 'message_id' | 'storage_path' | 'uploader_user_id'> | null;
  if (!row || row.uploader_user_id !== input.uploaderUserId) {
    return 'not_found';
  }
  if (row.message_id !== null) {
    return 'linked';
  }

  await removeRowAndObject(row);
  return 'deleted';
}

export function sumAttachmentBytes(rows: readonly Pick<QuickRequestMessageAttachmentRow, 'file_size'>[]): number {
  return rows.reduce((total, row) => total + Number(row.file_size), 0);
}
