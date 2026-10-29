import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { expect, type Locator, type Page } from '@playwright/test';
import { buildMinimalPngBuffer, buildSinglePagePdfBuffer } from '../helpers/attachment-fixtures';
import { callAs, serviceClient, withApi, type AccountKey, type ApiResult } from '../quick-workflow/helpers';

/**
 * plan 98 — 퀵 채팅 파일 첨부 e2e 공용 (docs/plans/98_quick-chat-attachments-plan.md)
 * - fixtures는 repo에 커밋하지 않고 **테스트 시작 시 생성**한다 (`e2e/fixtures/` · .gitignore)
 * - API 업로드 = prepare → signed URL PUT → `POST messages {body, attachmentIds}` (FE 훅과 같은 프로토콜)
 * - DB 확인은 service role (`quick_request_message_attachments`)
 */

export const FIXTURES_DIR = path.resolve(process.cwd(), 'e2e', 'fixtures');

export const ATTACH_TEXT = {
  fileTooLarge: '파일당 용량은 10MB 이하여야 합니다.',
  invalidType: '허용되지 않는 파일 형식입니다.',
  tooMany: '파일은 메시지당 30개까지 첨부할 수 있습니다.',
  notUploaded: '업로드되지 않은 파일이 있습니다. 다시 첨부해 주세요.',
  mismatch: '첨부 정보가 올바르지 않습니다.',
  bodyOrAttachmentRequired: '메시지를 입력하거나 파일을 첨부해 주세요.',
  linkedCannotDelete: '전송된 첨부는 삭제할 수 없습니다.',
  attachmentNotFound: '첨부를 찾을 수 없습니다.',
  logisticsReadOnly: '구매물류팀은 대화를 볼 수만 있습니다.',
  dropHint: '파일을 여기에 놓으세요',
  sendFailed: '전송 실패 ·',
  retry: '다시 보내기',
  prepareLabel: '퀵 대화 첨부 준비',
  deleteLabel: '퀵 대화 첨부 취소'
} as const;

export const MIME = {
  png: 'image/png',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip'
} as const;

export const ACTION = {
  prepare: 'quick_request.message_attachment_prepare',
  delete: 'quick_request.message_attachment_delete',
  create: 'quick_request.message_create'
} as const;

export const QUICK_CHAT_BUCKET = 'quick-chat-attachments';
export const MAX_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// fixtures (생성)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** 유효한 RGBA 노이즈 PNG (압축이 안 돼 width×height×4 ≈ 용량 · 50KB 목표) */
export function buildNoisePngBuffer(width = 112, height = 112, seed = 7): Buffer {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state >>> 24;
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width * 4; x += 1) {
      raw[offset] = next();
      offset += 1;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 0 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/** zip 시그니처(`PK\x03\x04`) + 랜덤/0 바이트 — docx·zip fixture */
export function buildZipLikeBuffer(size: number, random = true): Buffer {
  const body = random ? Buffer.from(Array.from({ length: size - 4 }, () => Math.floor(Math.random() * 256))) : Buffer.alloc(size - 4);
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), body]);
}

export type FixturePaths = {
  png: string;
  pdf: string;
  docx: string;
  zip: string;
  big: string;
  exe: string;
  images: string[];
  many: string[];
};

/** fixtures 디렉터리 생성 + 파일 작성 (존재하면 재사용) → 경로 */
export function ensureFixtures(): FixturePaths {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const write = (name: string, build: () => Buffer) => {
    const full = path.join(FIXTURES_DIR, name);
    if (!fs.existsSync(full)) fs.writeFileSync(full, build());
    return full;
  };
  const png = write('sample.png', () => buildNoisePngBuffer());
  const pdf = write('sample.pdf', () => buildSinglePagePdfBuffer());
  const docx = write('sample.docx', () => buildZipLikeBuffer(2048));
  const zip = write('sample.zip', () => buildZipLikeBuffer(1024));
  // AC-04 — 확장자 검사가 용량보다 먼저라 허용 확장자(zip)로 11MiB (frontend §6 · plan 수정 이력 verifier 메모)
  const big = write('big-11mb.zip', () => buildZipLikeBuffer(11 * 1024 * 1024, false));
  const exe = write('evil.exe', () => Buffer.alloc(0));
  const images = [1, 2, 3, 4, 5].map((index) => write(`img-${index}.png`, () => buildNoisePngBuffer(64, 64, index)));
  const many = Array.from({ length: 31 }, (_, index) =>
    write(`many-${String(index + 1).padStart(2, '0')}.png`, () => buildMinimalPngBuffer())
  );
  return { png, pdf, docx, zip, big, exe, images, many };
}

export function fixtureSize(file: string): number {
  return fs.statSync(file).size;
}

// ---------------------------------------------------------------------------
// API — prepare · upload · send
// ---------------------------------------------------------------------------

export type PreparedAttachment = { attachmentId: number; uploadUrl: string; token: string; storagePath: string };

export type FileSpec = { name: string; buffer: Buffer; mime: string };

export function fileFromFixture(file: string, mime: string, name = path.basename(file)): FileSpec {
  return { name, buffer: fs.readFileSync(file), mime };
}

export function prepareAs(account: AccountKey, requestNo: string, body: unknown): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.post(`/api/quick-request/${requestNo}/messages/attachments/prepare`, {
      data: body as Record<string, unknown>
    })
  );
}

/** prepare 201 보장 → prepared 목록 */
export async function prepareFilesAs(account: AccountKey, requestNo: string, files: FileSpec[]): Promise<PreparedAttachment[]> {
  const result = await prepareAs(account, requestNo, {
    files: files.map((file) => ({ name: file.name, size: file.buffer.length, mime: file.mime }))
  });
  expect(result.status, `prepare ${requestNo} ${JSON.stringify(result.body)}`).toBe(201);
  expect(result.headers['x-request-id'], 'prepare x-request-id').toBeTruthy();
  const data = result.body.data as { attachments: PreparedAttachment[] };
  expect(data.attachments).toHaveLength(files.length);
  return data.attachments;
}

/** signed upload URL에 PUT (FE XHR과 같은 헤더) */
export async function uploadToSignedUrlAs(account: AccountKey, prepared: PreparedAttachment, file: FileSpec): Promise<void> {
  await withApi(account, async (api) => {
    const response = await api.put(prepared.uploadUrl, {
      headers: { 'Content-Type': file.mime },
      data: file.buffer
    });
    expect(response.status(), `storage PUT ${file.name} ${await response.text()}`).toBeLessThan(300);
  });
}

/** prepare → 전부 업로드 → attachmentIds */
export async function uploadFilesAs(account: AccountKey, requestNo: string, files: FileSpec[]): Promise<number[]> {
  const prepared = await prepareFilesAs(account, requestNo, files);
  for (let index = 0; index < prepared.length; index += 1) {
    await uploadToSignedUrlAs(account, prepared[index]!, files[index]!);
  }
  return prepared.map((item) => item.attachmentId);
}

export type ChatAttachment = {
  id: number;
  kind: 'image' | 'file';
  fileName: string;
  fileSize: number;
  extension: string;
  mimeType: string;
};

export type ChatMessageWithAttachments = {
  id: number;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  attachments: ChatAttachment[];
};

export function postMessageWithAttachmentsAs(
  account: AccountKey,
  requestNo: string,
  body: string,
  attachmentIds: number[]
): Promise<ApiResult> {
  return callAs(account, (api) =>
    api.post(`/api/quick-request/${requestNo}/messages`, { data: { body, attachmentIds } })
  );
}

/** 업로드 + 전송 201 → 메시지 */
export async function sendWithAttachmentsAs(
  account: AccountKey,
  requestNo: string,
  body: string,
  files: FileSpec[]
): Promise<ChatMessageWithAttachments> {
  const ids = await uploadFilesAs(account, requestNo, files);
  const result = await postMessageWithAttachmentsAs(account, requestNo, body, ids);
  expect(result.status, `POST messages ${requestNo} ${JSON.stringify(result.body)}`).toBe(201);
  const message = (result.body.data as { message: ChatMessageWithAttachments }).message;
  expect(message.attachments).toHaveLength(files.length);
  return message;
}

export function deleteAttachmentAs(account: AccountKey, requestNo: string, attachmentId: number | string): Promise<ApiResult> {
  return callAs(account, (api) => api.delete(`/api/quick-request/${requestNo}/messages/attachments/${attachmentId}`));
}

export function getAttachmentUrlAs(account: AccountKey, requestNo: string, attachmentId: number): Promise<ApiResult> {
  return callAs(account, (api) => api.get(`/api/quick-request/${requestNo}/messages/attachments/${attachmentId}/url`));
}

/** download는 302를 따라가지 않고 Location만 읽는다 */
export async function getDownloadAs(
  account: AccountKey,
  requestNo: string,
  attachmentId: number
): Promise<{ status: number; location: string | undefined; body: string }> {
  return withApi(account, async (api) => {
    const response = await api.get(`/api/quick-request/${requestNo}/messages/attachments/${attachmentId}/download`, {
      maxRedirects: 0
    });
    return { status: response.status(), location: response.headers()['location'], body: await response.text() };
  });
}

export function downloadHref(requestNo: string, attachmentId: number): string {
  return `/api/quick-request/${requestNo}/messages/attachments/${attachmentId}/download`;
}

export function expectSignedDownloadLocation(location: string | undefined) {
  expect(location, 'Location 헤더').toBeTruthy();
  expect(location!).toContain('/storage/v1/object/sign/');
  expect(location!).toContain(`${QUICK_CHAT_BUCKET}/quick-chat/`);
  expect(location!).toContain('download=');
}

// ---------------------------------------------------------------------------
// DB (service role)
// ---------------------------------------------------------------------------

export type AttachmentRow = {
  id: number;
  quick_request_id: string;
  message_id: number | null;
  uploader_user_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  extension: string;
  kind: 'image' | 'file';
  expires_at: string | null;
  linked_at: string | null;
  created_at: string;
};

const ATTACHMENT_COLUMNS =
  'id, quick_request_id, message_id, uploader_user_id, storage_path, file_name, file_size, mime_type, extension, kind, expires_at, linked_at, created_at';

export async function dbAttachmentsByMessage(messageId: number): Promise<AttachmentRow[]> {
  const { data, error } = await serviceClient()
    .from('quick_request_message_attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('message_id', messageId)
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttachmentRow[];
}

export async function dbAttachment(id: number): Promise<AttachmentRow | null> {
  const { data, error } = await serviceClient()
    .from('quick_request_message_attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttachmentRow | null) ?? null;
}

export async function dbAttachmentCountByRequest(requestId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from('quick_request_message_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('quick_request_id', requestId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function dbStorageObjectExists(storagePath: string): Promise<boolean> {
  const folder = storagePath.split('/').slice(0, -1).join('/');
  const name = storagePath.split('/').pop()!;
  const { data, error } = await serviceClient().storage.from(QUICK_CHAT_BUCKET).list(folder, { search: name });
  if (error) throw new Error(error.message);
  return (data ?? []).some((item) => item.name === name && item.id);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export function attachInput(page: Page) {
  return page.getByTestId('quick-chat-attach-input');
}

export function attachButton(page: Page) {
  return page.getByTestId('quick-chat-attach');
}

export function tray(page: Page) {
  return page.getByTestId('quick-chat-attachment-tray');
}

export function chips(page: Page) {
  return page.locator('[data-testid^="quick-chat-attachment-chip-"]');
}

export function uploadedChips(page: Page) {
  return page.locator('[data-testid^="quick-chat-attachment-chip-"][data-state="uploaded"]');
}

export async function waitUploaded(page: Page, count: number, timeout = 30_000) {
  await expect(uploadedChips(page)).toHaveCount(count, { timeout });
}

export function attachmentsBlock(page: Page, messageId: number | string) {
  return page.getByTestId(`quick-chat-attachments-${messageId}`);
}

export function imageTile(page: Page, attachmentId: number): Locator {
  return page.getByTestId(`quick-chat-attachment-image-${attachmentId}`);
}

export function fileCard(page: Page, attachmentId: number): Locator {
  return page.getByTestId(`quick-chat-attachment-file-${attachmentId}`);
}

export function downloadLink(page: Page, attachmentId: number): Locator {
  return page.getByTestId(`quick-chat-attachment-download-${attachmentId}`);
}

export function lightbox(page: Page): Locator {
  return page.getByRole('dialog');
}

/** 전송 → POST 201 대기 → 메시지(첨부 포함) */
export async function clickSendAndWait(page: Page): Promise<ChatMessageWithAttachments> {
  const responsePromise = page.waitForResponse(
    (response) => response.url().split('?')[0]!.endsWith('/messages') && response.request().method() === 'POST'
  );
  await page.getByTestId('quick-chat-send').click();
  const response = await responsePromise;
  expect(response.status(), 'POST messages').toBe(201);
  const json = (await response.json()) as { data: { message: ChatMessageWithAttachments } };
  return json.data.message;
}

/** storage signed upload PUT 횟수 카운터 (AC-10) */
export function countStoragePuts(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/storage/v1/object/upload/sign/')) count += 1;
  });
  return () => count;
}

export function countMessagePosts(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().split('?')[0]!.endsWith('/messages')) count += 1;
  });
  return () => count;
}

/** `DataTransfer`(Files) 핸들 — AC-03 drop 디스패치 */
export async function createFileDataTransfer(page: Page, name: string, mime: string, bytes: number[]) {
  return page.evaluateHandle(
    ({ name: fileName, mime: fileMime, bytes: content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(content)], fileName, { type: fileMime }));
      return dt;
    },
    { name, mime, bytes }
  );
}

export function metadataText(metadata: Record<string, unknown> | undefined): string {
  return JSON.stringify(metadata ?? {});
}
