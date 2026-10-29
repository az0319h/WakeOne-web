import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import { signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import { CHAT_TEXT, dbMessages, postMessageAs } from '../quick-chat/helpers';
import {
  anonKey,
  createAs,
  dbChatNotifications,
  dbQuickRequest,
  findActivityLog,
  fixtureUser,
  readAccountMeta,
  readJson,
  serviceClient,
  uniqueTag,
  withApi,
  type ActivityLogItem
} from '../quick-workflow/helpers';
import {
  ACTION,
  ATTACH_TEXT,
  MAX_BYTES,
  MIME,
  QUICK_CHAT_BUCKET,
  dbAttachment,
  dbAttachmentsByMessage,
  dbStorageObjectExists,
  deleteAttachmentAs,
  ensureFixtures,
  expectSignedDownloadLocation,
  fileFromFixture,
  getAttachmentUrlAs,
  getDownloadAs,
  metadataText,
  postMessageWithAttachmentsAs,
  prepareAs,
  prepareFilesAs,
  sendWithAttachmentsAs,
  uploadFilesAs,
  uploadToSignedUrlAs,
  type FixturePaths,
  type PreparedAttachment
} from './98-helpers';

/**
 * plan 98 §A·B·C API·DB — docs/plans/98_quick-chat-attachments-plan.md
 * AC-05 · AC-06 · AC-07 · AC-08 · AC-09 · AC-11 · AC-13 · AC-14 · AC-15(버킷·RLS · supabase-js) · AC-18 · AC-19
 * 계정: user(요청자) · user2(타인) · dongbang · logistics · admin(로그)
 */
test.describe('plan 98 A·B·C. 첨부 API · 권한 · 알림 · 활동 로그', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let fixtures: FixturePaths;
  let user: { userId: string; fullName: string };
  let requestNo = '';
  let requestId = '';
  /** AC-05 유효 prepare(업로드 안 함) — AC-06·07·11에서 재사용 */
  let pendingPrepared: PreparedAttachment;
  /** AC-11 — 전송 완료된 첨부 id (409) */
  let linkedAttachmentId = 0;
  let linkedMessageId = 0;
  const requestIds: Record<string, string> = {};

  test.beforeAll(async () => {
    fixtures = ensureFixtures();
    user = await fixtureUser('user');
    const created = await createAs('user', uniqueTag('E2E98API'));
    requestNo = created.requestNo;
    requestId = (await dbQuickRequest(requestNo)).id;
  });

  test('AC-05: prepare — a.exe 400 형식 · 31개 400 「30개까지」 · 11MB 400 용량 · 유효 1개 201 {attachmentId, uploadUrl, token, storagePath} + pending 행(message_id null · expires_at ≈ +24h) · 모든 응답 x-request-id', async () => {
    const exe = await prepareAs('user', requestNo, {
      files: [{ name: 'a.exe', size: 10, mime: 'application/octet-stream' }]
    });
    expect(exe.status).toBe(400);
    expect(exe.body.message).toBe(ATTACH_TEXT.invalidType);
    expect(exe.headers['x-request-id']).toBeTruthy();
    requestIds.prepare400 = exe.headers['x-request-id']!;

    const many = await prepareAs('user', requestNo, {
      files: Array.from({ length: 31 }, (_, index) => ({ name: `m-${index}.png`, size: 10, mime: MIME.png }))
    });
    expect(many.status).toBe(400);
    expect(many.body.message).toBe(ATTACH_TEXT.tooMany);
    expect(many.headers['x-request-id']).toBeTruthy();

    const big = await prepareAs('user', requestNo, {
      files: [{ name: 'a.png', size: 11 * 1024 * 1024, mime: MIME.png }]
    });
    expect(big.status).toBe(400);
    expect(big.body.message).toBe(ATTACH_TEXT.fileTooLarge);
    expect(big.headers['x-request-id']).toBeTruthy();

    const before = Date.now();
    const valid = await prepareAs('user', requestNo, {
      files: [{ name: 'sample.png', size: 1234, mime: MIME.png }]
    });
    expect(valid.status, JSON.stringify(valid.body)).toBe(201);
    expect(valid.headers['x-request-id']).toBeTruthy();
    requestIds.prepare201 = valid.headers['x-request-id']!;
    const attachments = (valid.body.data as { attachments: PreparedAttachment[] }).attachments;
    expect(attachments).toHaveLength(1);
    pendingPrepared = attachments[0]!;
    expect(pendingPrepared.attachmentId).toBeGreaterThan(0);
    expect(pendingPrepared.uploadUrl).toContain('/storage/v1/object/upload/sign/');
    expect(pendingPrepared.token).toBeTruthy();
    expect(pendingPrepared.storagePath).toMatch(new RegExp(`^quick-chat/${requestId}/[0-9a-f-]+\\.png$`));

    const row = await dbAttachment(pendingPrepared.attachmentId);
    expect(row, 'pending row').not.toBeNull();
    expect(row!.message_id).toBeNull();
    expect(row!.uploader_user_id).toBe(user.userId);
    expect(row!.quick_request_id).toBe(requestId);
    expect(row!.file_size).toBe(1234);
    expect(row!.kind).toBe('image');
    const expiresIn = new Date(row!.expires_at!).getTime() - before;
    expect(expiresIn, 'expires_at ≈ +24h').toBeGreaterThan(23.5 * 60 * 60 * 1000);
    expect(expiresIn).toBeLessThan(24.5 * 60 * 60 * 1000);
  });

  test('AC-06: prepare 후 업로드 안 함 → POST messages {body:"", attachmentIds:[id]} 400 「업로드되지 않은 파일이 있습니다…」 · 메시지 미생성', async () => {
    const countBefore = (await dbMessages(requestId)).length;
    const result = await postMessageWithAttachmentsAs('user', requestNo, '', [pendingPrepared.attachmentId]);
    expect(result.status).toBe(400);
    expect(result.body.message).toBe(ATTACH_TEXT.notUploaded);
    expect(result.headers['x-request-id']).toBeTruthy();
    expect((await dbMessages(requestId)).length, '메시지 미생성').toBe(countBefore);
    // 행은 남는다 (재업로드 가능)
    expect((await dbAttachment(pendingPrepared.attachmentId))?.message_id).toBeNull();
  });

  test('AC-07: user가 prepare한 id — user2 POST 404 · dongbang POST 400 「첨부 정보가 올바르지 않습니다.」(소유자 불일치)', async () => {
    const other = await postMessageWithAttachmentsAs('user2', requestNo, '남의 첨부', [pendingPrepared.attachmentId]);
    expect(other.status).toBe(404);
    expect(other.body.message).toBe(CHAT_TEXT.requestNotFound);

    const vendor = await postMessageWithAttachmentsAs('dongbang', requestNo, '남의 첨부', [pendingPrepared.attachmentId]);
    expect(vendor.status).toBe(400);
    expect(vendor.body.message).toBe(ATTACH_TEXT.mismatch);
    expect((await dbAttachment(pendingPrepared.attachmentId))?.message_id, '연결되지 않음').toBeNull();
  });

  test('AC-08: logistics — prepare 403 · POST messages 403 「구매물류팀은 대화를 볼 수만 있습니다.」', async () => {
    const prepare = await prepareAs('logistics', requestNo, {
      files: [{ name: 'sample.png', size: 100, mime: MIME.png }]
    });
    expect(prepare.status).toBe(403);
    expect(prepare.body.message).toBe(ATTACH_TEXT.logisticsReadOnly);
    expect(prepare.headers['x-request-id']).toBeTruthy();

    const post = await postMessageAs('logistics', requestNo, { body: '읽기 전용', attachmentIds: [] });
    expect(post.status).toBe(403);
    expect(post.body.message).toBe(ATTACH_TEXT.logisticsReadOnly);
  });

  test('AC-09: POST messages {body:"   ", attachmentIds:[]} → 400 「메시지를 입력하거나 파일을 첨부해 주세요.」', async () => {
    const result = await postMessageAs('user', requestNo, { body: '   ', attachmentIds: [] });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe(ATTACH_TEXT.bodyOrAttachmentRequired);
    expect(result.headers['x-request-id']).toBeTruthy();

    // 93 AC-08 호환 — attachmentIds 생략도 같은 문구
    const legacy = await postMessageAs('user', requestNo, { body: '   ' });
    expect(legacy.status).toBe(400);
    expect(legacy.body.message).toBe(ATTACH_TEXT.bodyOrAttachmentRequired);
  });

  test('AC-11: DELETE pending 200 → 같은 id 404 → 전송 완료 첨부 409 「전송된 첨부는 삭제할 수 없습니다.」 · 로그 message_attachment_delete 200·404·409', async () => {
    // 전송 완료 첨부 (409 대상) — png 1개 업로드 + 본문 전송
    const sent = await sendWithAttachmentsAs('user', requestNo, 'AC-11 연결 첨부', [
      fileFromFixture(fixtures.png, MIME.png)
    ]);
    linkedMessageId = sent.id;
    linkedAttachmentId = sent.attachments[0]!.id;

    // pending (AC-05에서 prepare만 한 행) 삭제 — 객체는 없고 행만
    const first = await deleteAttachmentAs('user', requestNo, pendingPrepared.attachmentId);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect((first.body.data as { id: number }).id).toBe(pendingPrepared.attachmentId);
    expect(first.headers['x-request-id']).toBeTruthy();
    expect(await dbAttachment(pendingPrepared.attachmentId), '행 삭제').toBeNull();

    // 업로드까지 된 pending 삭제 → Storage 객체도 함께
    const [uploadedPending] = await prepareFilesAs('user', requestNo, [fileFromFixture(fixtures.zip, MIME.zip)]);
    await uploadToSignedUrlAs('user', uploadedPending!, fileFromFixture(fixtures.zip, MIME.zip));
    expect(await dbStorageObjectExists(uploadedPending!.storagePath), '업로드 객체 존재').toBe(true);
    const second = await deleteAttachmentAs('user', requestNo, uploadedPending!.attachmentId);
    expect(second.status).toBe(200);
    await expect
      .poll(() => dbStorageObjectExists(uploadedPending!.storagePath), { message: 'Storage 객체 삭제' })
      .toBe(false);

    const again = await deleteAttachmentAs('user', requestNo, pendingPrepared.attachmentId);
    expect(again.status).toBe(404);
    expect(again.body.message).toBe(ATTACH_TEXT.attachmentNotFound);

    const linked = await deleteAttachmentAs('user', requestNo, linkedAttachmentId);
    expect(linked.status).toBe(409);
    expect(linked.body.message).toBe(ATTACH_TEXT.linkedCannotDelete);
    expect((await dbAttachment(linkedAttachmentId))?.message_id).toBe(linkedMessageId);

    // 타인(user2)은 404 · 형식 오류 404
    expect((await deleteAttachmentAs('user2', requestNo, linkedAttachmentId)).status).toBe(404);
    expect((await deleteAttachmentAs('user', requestNo, 'abc')).status).toBe(404);

    for (const [status, attachmentId] of [
      [200, pendingPrepared.attachmentId],
      [404, pendingPrepared.attachmentId],
      [409, linkedAttachmentId]
    ] as const) {
      const log = await findActivityLog(
        ACTION.delete,
        (item) =>
          item.target_label === requestNo && item.http_status === status && item.metadata?.attachment_id === attachmentId,
        `log ${ACTION.delete} ${status} attachment_id=${attachmentId}`
      );
      expect(metadataText(log.metadata)).not.toContain('quick-chat/');
      expect(metadataText(log.metadata)).not.toContain('sample');
      expect(log.request_id).toBeTruthy();
    }
  });

  test('AC-13: user2 — GET url · download 404', async () => {
    const url = await getAttachmentUrlAs('user2', requestNo, linkedAttachmentId);
    expect(url.status).toBe(404);
    const download = await getDownloadAs('user2', requestNo, linkedAttachmentId);
    expect(download.status).toBe(404);
  });

  test('AC-14: logistics — GET url 200 {url, expiresAt} · download 302 Location 서명 URL(download=)', async () => {
    const url = await getAttachmentUrlAs('logistics', requestNo, linkedAttachmentId);
    expect(url.status, JSON.stringify(url.body)).toBe(200);
    const data = url.body.data as { url: string; expiresAt: string };
    expect(data.url).toContain('/storage/v1/object/sign/');
    expect(new Date(data.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(61_000);
    expect(url.headers['cache-control']).toContain('no-store');

    const download = await getDownloadAs('logistics', requestNo, linkedAttachmentId);
    expect(download.status).toBe(302);
    expectSignedDownloadLocation(download.location);

    // user(요청자) 본인도 동일 · pending·미존재 id는 404
    expect((await getDownloadAs('user', requestNo, linkedAttachmentId)).status).toBe(302);
    expect((await getAttachmentUrlAs('user', requestNo, 999_999_999)).status).toBe(404);
  });

  test('AC-15: 버킷 quick-chat-attachments public=false · file_size_limit=10485760 · allowed_mime_types(D-1) · authenticated 쓰기 불가 · pending 행 RLS 비노출', async () => {
    const { data: bucket, error } = await serviceClient().storage.getBucket(QUICK_CHAT_BUCKET);
    expect(error, 'getBucket').toBeNull();
    expect(bucket!.public).toBe(false);
    expect(bucket!.file_size_limit).toBe(MAX_BYTES);
    const mimes = bucket!.allowed_mime_types ?? [];
    for (const mime of [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
      'application/x-hwp',
      'application/vnd.hancom.hwpx',
      'application/msword',
      MIME.docx,
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream'
    ]) {
      expect(mimes, `allowed_mime_types has ${mime}`).toContain(mime);
    }
    expect(mimes).not.toContain('application/x-msdownload');

    // authenticated(user JWT) — INSERT 거부 · 본인이 prepare한 pending 행도 SELECT 0 (message_id null)
    const { session } = await signInWithSupabasePassword(
      process.env.E2E_USER_EMAIL!,
      resolveE2EPassword(process.env.E2E_USER_PASSWORD)
    );
    const authed = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } }
    });
    const [pending] = await prepareFilesAs('user', requestNo, [{ name: 'rls.png', buffer: Buffer.alloc(10), mime: MIME.png }]);
    const { data: visible, error: selectError } = await authed
      .from('quick_request_message_attachments')
      .select('id')
      .eq('id', pending!.attachmentId);
    expect(selectError).toBeNull();
    expect(visible ?? [], 'pending 행 RLS 비노출').toHaveLength(0);
    const { data: linkedVisible } = await authed
      .from('quick_request_message_attachments')
      .select('id')
      .eq('id', linkedAttachmentId);
    expect((linkedVisible ?? []).map((row) => Number(row.id)), '연결된 행은 조회 가능(can_view)').toEqual([linkedAttachmentId]);
    const { error: insertError } = await authed.from('quick_request_message_attachments').insert({
      quick_request_id: requestId,
      message_id: null,
      uploader_user_id: user.userId,
      storage_path: `quick-chat/${requestId}/rls-denied.png`,
      file_name: 'rls-denied.png',
      file_size: 10,
      mime_type: MIME.png,
      extension: 'png',
      kind: 'image'
    });
    expect(insertError, 'authenticated INSERT 거부').not.toBeNull();
    const { error: updateError, data: updated } = await authed
      .from('quick_request_message_attachments')
      .update({ file_name: 'hacked.png' })
      .eq('id', linkedAttachmentId)
      .select('id');
    expect(updateError !== null || (updated ?? []).length === 0, 'authenticated UPDATE 거부').toBe(true);
    expect((await dbAttachment(linkedAttachmentId))?.file_name).toBe('sample.png');
    await deleteAttachmentAs('user', requestNo, pending!.attachmentId);
  });

  test('AC-18: 요청자 「확인 부탁」 + 사진 2 + 파일 1 → 알림 본문 「확인 부탁 (사진 2장·파일 1개)」 · 파일명 0 · 수신자 93 규칙(동방)', async () => {
    const dongbang = readAccountMeta('dongbang');
    const message = await sendWithAttachmentsAs('user', requestNo, '확인 부탁', [
      fileFromFixture(fixtures.images[0]!, MIME.png, 'img-1.png'),
      fileFromFixture(fixtures.images[1]!, MIME.png, 'img-2.png'),
      fileFromFixture(fixtures.docx, MIME.docx)
    ]);
    let rows: Awaited<ReturnType<typeof dbChatNotifications>> = [];
    await expect
      .poll(
        async () => {
          rows = await dbChatNotifications(requestNo, message.id);
          return rows.length;
        },
        { timeout: 15_000, message: 'chat notifications' }
      )
      .toBeGreaterThanOrEqual(1);
    expect(rows.map((row) => row.recipient_user_id)).toContain(dongbang.userId);
    expect(rows.map((row) => row.recipient_user_id)).not.toContain(user.userId);
    for (const row of rows) {
      expect(row.body).toBe('확인 부탁 (사진 2장·파일 1개)');
      expect(row.body).not.toContain('img-');
      expect(row.body).not.toContain('docx');
      expect(JSON.stringify(row.metadata)).not.toContain('quick-chat/');
      expect(JSON.stringify(row.metadata)).not.toContain('img-1');
    }

    // 본문 없음 → 요약만
    const only = await sendWithAttachmentsAs('user', requestNo, '', [fileFromFixture(fixtures.pdf, MIME.pdf)]);
    let onlyRows: Awaited<ReturnType<typeof dbChatNotifications>> = [];
    await expect
      .poll(
        async () => {
          onlyRows = await dbChatNotifications(requestNo, only.id);
          return onlyRows.length;
        },
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(1);
    for (const row of onlyRows) expect(row.body).toBe('파일 1개');
  });

  test('AC-19: 활동 로그 — message_create metadata attachment_count=2·total_bytes · message_attachment_prepare 201·400 · 파일명·storage_path 0 · x-request-id · /dashboard/logs 라벨', async ({ browser }) => {
    const files = [fileFromFixture(fixtures.png, MIME.png), fileFromFixture(fixtures.docx, MIME.docx)];
    const ids = await uploadFilesAs('user', requestNo, files);
    const post = await postMessageWithAttachmentsAs('user', requestNo, 'AC-19 로그', ids);
    expect(post.status).toBe(201);
    const postRequestId = post.headers['x-request-id'];
    expect(postRequestId).toBeTruthy();
    const messageId = (post.body.data as { message: { id: number } }).message.id;
    const totalBytes = files.reduce((sum, file) => sum + file.buffer.length, 0);
    expect((await dbAttachmentsByMessage(messageId)).map((row) => row.id)).toEqual(ids);

    const createLog = await findActivityLog(
      ACTION.create,
      (item) => item.target_label === requestNo && item.metadata?.message_id === messageId,
      `log ${ACTION.create} ${messageId}`
    );
    expect(createLog.http_status).toBe(201);
    expect(createLog.request_id).toBe(postRequestId);
    expect(createLog.metadata?.attachment_count).toBe(2);
    expect(createLog.metadata?.total_bytes).toBe(totalBytes);

    const assertNoFileInfo = (log: ActivityLogItem) => {
      const text = metadataText(log.metadata);
      expect(text).not.toContain('sample');
      expect(text).not.toContain('.png');
      expect(text).not.toContain('.docx');
      expect(text).not.toContain('quick-chat/');
      expect(text).not.toContain('storage_path');
      expect(text).not.toContain('token=');
    };
    assertNoFileInfo(createLog);

    const prepare201 = await findActivityLog(
      ACTION.prepare,
      (item) => item.target_label === requestNo && item.http_status === 201 && item.request_id === requestIds.prepare201,
      `log ${ACTION.prepare} 201`
    );
    expect(prepare201.metadata?.attachment_count).toBe(1);
    expect(prepare201.metadata?.total_bytes).toBe(1234);
    assertNoFileInfo(prepare201);

    const prepare400 = await findActivityLog(
      ACTION.prepare,
      (item) => item.target_label === requestNo && item.http_status === 400 && item.request_id === requestIds.prepare400,
      `log ${ACTION.prepare} 400`
    );
    expect(prepare400.metadata?.error_code).toBe('validation');
    assertNoFileInfo(prepare400);

    // GET url·download는 Read → 로그 없음 (AC-13·14 호출분)
    await withAdminLogs(async (logs) => {
      expect(
        logs.filter((item) => typeof item.action === 'string' && /attachment_(url|download)/.test(item.action))
      ).toHaveLength(0);
    });

    // /dashboard/logs — 라벨 「퀵 대화 첨부 준비」
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      const page = await context.newPage();
      await page.goto(`/dashboard/logs?action=${encodeURIComponent(ACTION.prepare)}&log_user=all`, {
        waitUntil: 'domcontentloaded'
      });
      await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      const rows = page.getByTestId('activity-log-row');
      await expect(rows.first()).toContainText(ATTACH_TEXT.prepareLabel, { timeout: 20_000 });
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText('sample.png');
    } finally {
      await context.close();
    }
  });
});

async function withAdminLogs(fn: (logs: ActivityLogItem[]) => void) {
  await withApi('admin', async (admin) => {
    const response = await admin.get('/api/activity-logs?limit=100&log_user=all');
    expect(response.status()).toBe(200);
    const body = await readJson<{ data?: { logs?: ActivityLogItem[] } }>(response);
    fn(body.data?.logs ?? []);
  });
}
