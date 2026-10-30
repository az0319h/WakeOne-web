import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { CHAT_TEXT, composerInput, dbMessages, gotoChat, messageBubble, sendButton } from '../quick-chat/helpers';
import { createAs, dbChatNotifications, dbQuickRequest, fixtureUser, toast, uniqueTag } from '../quick-workflow/helpers';
import {
  ATTACH_TEXT,
  attachButton,
  attachInput,
  attachmentsBlock,
  chips,
  clickSendAndWait,
  countMessagePosts,
  countStoragePuts,
  createFileDataTransfer,
  dbAttachmentsByMessage,
  ensureFixtures,
  fileCard,
  fixtureSize,
  imageTile,
  lightbox,
  tray,
  uploadedChips,
  waitUploaded,
  type FixturePaths
} from './98-helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 98 §A 업로드·전송 UI — docs/plans/98_quick-chat-attachments-plan.md
 * AC-01 · AC-02 · AC-03 · AC-04 · AC-10 (user.json · 본인 건 「퀵 대화」 1280)
 */
test.describe('plan 98 A. 클립 · 드래그앤드롭 · 제한 · 재시도 (UI)', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let fixtures: FixturePaths;
  let user: { userId: string; fullName: string };
  let requestNo = '';
  let requestId = '';

  test.beforeAll(async () => {
    fixtures = ensureFixtures();
    user = await fixtureUser('user');
    requestNo = (await createAs('user', uniqueTag('E2E98UI'))).requestNo;
    requestId = (await dbQuickRequest(requestNo)).id;
  });

  test('AC-01: 클립 → sample.png·sample.docx → 「첨부합니다」 전송 → 대기 줄 2개(썸네일·아이콘·이름·용량·✕) · 201 · 말풍선 본문+이미지 1+카드 1 · 입력창·대기 줄 비움 · DB 2행 message_id', async ({
    page
  }) => {
    await gotoChat(page, requestNo);
    await expect(attachButton(page)).toBeVisible({ timeout: 20_000 });
    await expect(attachButton(page)).toHaveAttribute('aria-label', '파일 첨부');
    await expect(tray(page)).toHaveCount(0);

    await attachInput(page).setInputFiles([fixtures.png, fixtures.docx]);
    await expect(tray(page)).toBeVisible();
    await expect(chips(page)).toHaveCount(2);
    const pngChip = chips(page).nth(0);
    const docxChip = chips(page).nth(1);
    await expect(pngChip.getByRole('img', { name: 'sample.png' })).toBeVisible();
    await expect(docxChip).toContainText('sample.docx');
    await expect(docxChip).toContainText(/DOCX · [\d.]+ KB/);
    await expect(pngChip.getByRole('button', { name: 'sample.png 제거' })).toBeVisible();
    await expect(docxChip.getByRole('button', { name: 'sample.docx 제거' })).toBeVisible();
    await waitUploaded(page, 2);
    await expect(page.getByTestId('quick-chat-attachment-count')).toHaveText('2/30');
    await expect(sendButton(page), '본문 없이도 첨부가 있으면 전송 활성').toBeEnabled();

    await composerInput(page).fill('첨부합니다');
    const message = await clickSendAndWait(page);
    expect(message.body).toBe('첨부합니다');
    expect(message.attachments.map((item) => item.kind)).toEqual(['image', 'file']);
    const [image, file] = message.attachments;

    const bubble = messageBubble(page, message.id);
    await expect(bubble).toBeVisible({ timeout: 10_000 });
    await expect(bubble).toContainText('첨부합니다');
    const block = attachmentsBlock(page, message.id);
    await expect(block).toBeVisible();
    await expect(imageTile(page, image!.id)).toBeVisible();
    await expect(imageTile(page, image!.id).getByRole('img', { name: 'sample.png' })).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() =>
        imageTile(page, image!.id)
          .getByRole('img')
          .evaluate((node) => (node as HTMLImageElement).naturalWidth)
      , { message: '서명 URL 썸네일 로드' })
      .toBeGreaterThan(0);
    await expect(fileCard(page, file!.id)).toBeVisible();
    await expect(fileCard(page, file!.id)).toContainText('sample.docx');
    await expect(fileCard(page, file!.id)).toContainText(/DOCX · [\d.]+ KB/);
    await expect(page.getByRole('link', { name: 'sample.docx 다운로드' })).toBeVisible();

    await expect(composerInput(page)).toHaveValue('');
    await expect(tray(page)).toHaveCount(0);
    await expect(page.getByTestId(`quick-chat-receipt-${message.id}`)).toHaveAttribute('data-state', 'sent');

    const rows = await dbAttachmentsByMessage(message.id);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.message_id).toBe(message.id);
      expect(row.expires_at).toBeNull();
      expect(row.linked_at).not.toBeNull();
      expect(row.uploader_user_id).toBe(user.userId);
    }
    expect(rows.map((row) => row.file_size)).toEqual([fixtureSize(fixtures.png), fixtureSize(fixtures.docx)]);
  });

  test('AC-02: 본문 없이 sample.png만 전송 → 201 · 말풍선 이미지만 · 대화 목록 「{이름}: 사진 1장」 · 알림 본문 「사진 1장」', async ({ page }) => {
    await gotoChat(page, requestNo);
    await expect(sendButton(page)).toBeDisabled();
    await attachInput(page).setInputFiles([fixtures.png]);
    await waitUploaded(page, 1);
    await expect(sendButton(page)).toBeEnabled();
    const message = await clickSendAndWait(page);
    expect(message.body).toBe('');
    expect(message.attachments).toHaveLength(1);

    const bubble = messageBubble(page, message.id);
    await expect(bubble).toBeVisible({ timeout: 10_000 });
    await expect(imageTile(page, message.attachments[0]!.id)).toBeVisible();
    // 본문 말풍선 없음 — 첨부 블록 외 텍스트는 이름·역할·영수증·시각뿐
    await expect(bubble.locator('[data-testid^="quick-chat-attachment-file-"]')).toHaveCount(0);
    const bubbleText = (await bubble.innerText()).replace(/\s+/g, ' ');
    expect(bubbleText).not.toContain('첨부합니다');

    const item = page.getByTestId(`quick-chat-list-item-${requestNo}`);
    await expect(item).toContainText(`${user.fullName}: 사진 1장`, { timeout: 15_000 });

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
    for (const row of rows) expect(row.body).toBe('사진 1장');
  });

  test('AC-03: 대화 영역 dragenter → 오버레이 「파일을 여기에 놓으세요」 · drop(sample.pdf) → 대기 줄 1 · 전송 → 카드 「PDF · {용량}」 · 카드 클릭 → lightbox PDF 뷰어', async ({
    page
  }) => {
    await gotoChat(page, requestNo);
    await expect(attachButton(page)).toBeVisible({ timeout: 20_000 });
    const pdfBytes = Array.from(fs.readFileSync(fixtures.pdf));
    const dt = await createFileDataTransfer(page, 'dropped.pdf', 'application/pdf', pdfBytes);
    const dropzone = page.getByTestId('quick-chat-dropzone');
    await expect(dropzone).toHaveAttribute('data-dragging', 'false');

    await page.getByTestId('quick-chat-messages').dispatchEvent('dragenter', { dataTransfer: dt });
    await expect(dropzone).toHaveAttribute('data-dragging', 'true');
    const overlay = page.getByTestId('quick-chat-drop-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(ATTACH_TEXT.dropHint);
    await expect(overlay).toHaveAttribute('role', 'status');

    await page.getByTestId('quick-chat-messages').dispatchEvent('drop', { dataTransfer: dt });
    await expect(overlay).toHaveCount(0);
    await expect(dropzone).toHaveAttribute('data-dragging', 'false');
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page).first()).toContainText('dropped.pdf');
    await waitUploaded(page, 1);

    const message = await clickSendAndWait(page);
    const pdf = message.attachments[0]!;
    expect(pdf.extension).toBe('pdf');
    const card = fileCard(page, pdf.id);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText(new RegExp(`PDF · ${pdfBytes.length} Bytes`));
    await expect(card).toContainText('dropped.pdf');

    await page.getByTestId(`quick-chat-attachment-open-${pdf.id}`).click();
    const dialog = lightbox(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText('dropped.pdf');
    await expect(dialog.getByText(/\d+ \/ \d+/).first(), 'PDF 뷰어 페이지 표시').toBeVisible({ timeout: 60_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('AC-04: big-11mb.zip / evil.exe / 31개 → toast 용량·형식·30개 · 대기 줄 미추가(31개는 앞 30개만) · 전송 요청 0', async ({ page }) => {
    await gotoChat(page, requestNo);
    await expect(attachButton(page)).toBeVisible({ timeout: 20_000 });
    const posts = countMessagePosts(page);

    await attachInput(page).setInputFiles([fixtures.big]);
    await expect(toast(page, ATTACH_TEXT.fileTooLarge)).toBeVisible({ timeout: 10_000 });
    await expect(tray(page)).toHaveCount(0);

    await attachInput(page).setInputFiles([fixtures.exe]);
    await expect(toast(page, ATTACH_TEXT.invalidType)).toBeVisible({ timeout: 10_000 });
    await expect(tray(page)).toHaveCount(0);

    await attachInput(page).setInputFiles(fixtures.many);
    await expect(toast(page, ATTACH_TEXT.tooMany)).toBeVisible({ timeout: 10_000 });
    await expect(chips(page)).toHaveCount(30);
    await expect(page.getByTestId('quick-chat-attachment-count')).toHaveText('30/30');
    await expect(attachButton(page), '30개 차면 클립 비활성').toBeDisabled();
    // 이미지 칩은 썸네일(`<img alt={파일명}>`)만 — 이름은 alt로 판정
    await expect(chips(page).first().getByRole('img', { name: 'many-01.png' })).toBeVisible();
    await expect(chips(page).nth(29).getByRole('img', { name: 'many-30.png' })).toBeVisible();
    await expect(tray(page).getByRole('img', { name: 'many-31.png' }), '31번째는 미추가').toHaveCount(0);
    await waitUploaded(page, 30, 60_000);
    await expect(uploadedChips(page)).toHaveCount(30);

    expect(posts(), '전송 요청 0').toBe(0);
    await expect(sendButton(page)).toBeEnabled();
    // 미전송 pending 30개는 cleanup(건 단위) 대상 — 전송하지 않고 떠난다
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
    await expect(tray(page)).toHaveCount(0);
    expect(posts()).toBe(0);
  });

  test('AC-10: 메시지 POST 500 → 「전송 실패 · 다시 보내기」 · route 복구 후 재시도 201 · storage 업로드 PUT 1회만(재사용)', async ({ page }) => {
    await gotoChat(page, requestNo);
    await expect(attachButton(page)).toBeVisible({ timeout: 20_000 });
    const puts = countStoragePuts(page);
    const messagesBefore = (await dbMessages(requestId)).length;

    await attachInput(page).setInputFiles([fixtures.png]);
    await waitUploaded(page, 1);
    expect(puts(), '업로드 PUT 1회').toBe(1);

    await page.route('**/api/quick-request/*/messages', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: '메시지를 보내지 못했습니다. 다시 시도해 주세요.' })
      });
    });
    await composerInput(page).fill('첨부 재시도');
    await sendButton(page).click();
    const failed = page.locator('[data-testid^="quick-chat-message-temp-"][data-state="failed"]');
    await expect(failed).toHaveCount(1, { timeout: 10_000 });
    await expect(failed).toContainText(ATTACH_TEXT.sendFailed);
    await expect(failed.locator('[data-testid^="quick-chat-attachments-temp-"]'), 'optimistic 첨부 블록').toHaveCount(1);
    await expect(tray(page), '전송 직후 tray는 비워짐').toHaveCount(0);
    expect((await dbMessages(requestId)).length, '500이라 미생성').toBe(messagesBefore);

    await page.unroute('**/api/quick-request/*/messages');
    const responsePromise = page.waitForResponse(
      (response) => response.url().split('?')[0]!.endsWith('/messages') && response.request().method() === 'POST'
    );
    await failed.getByRole('button', { name: CHAT_TEXT.retry }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const { data } = (await response.json()) as { data: { message: { id: number; attachments: { id: number }[] } } };
    await expect(messageBubble(page, data.message.id)).toBeVisible({ timeout: 10_000 });
    await expect(imageTile(page, data.message.attachments[0]!.id)).toBeVisible();
    await expect(failed).toHaveCount(0);
    expect(puts(), '재시도는 재업로드 없이 ids 재사용 — PUT 총 1회').toBe(1);
    expect((await dbAttachmentsByMessage(data.message.id)).length).toBe(1);
  });
});
