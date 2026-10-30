import { expect, test } from '@playwright/test';
import { REALTIME_TIMEOUT_MS, SUBSCRIBE_SETTLE_MS, expectNoHorizontalScroll, gotoChat, messageBubble, messagesLog, waitForSubscribed } from '../quick-chat/helpers';
import { VIEWPORT_MOBILE, createAs, pageAs, uniqueTag } from '../quick-workflow/helpers';
import {
  MIME,
  attachmentsBlock,
  downloadLink,
  ensureFixtures,
  expectSignedDownloadLocation,
  fileCard,
  fileFromFixture,
  imageTile,
  lightbox,
  sendWithAttachmentsAs,
  type FixturePaths
} from './98-helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 98 §B 보기·다운로드 — docs/plans/98_quick-chat-attachments-plan.md
 * AC-12 (2 context · 동방 수신 · lightbox · 302) · AC-16 (5장 격자 +1 · carousel 5) · AC-17 (375 카드 3개)
 */
test.describe('plan 98 B. 수신 · 이미지 격자 · 파일 카드(375)', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let fixtures: FixturePaths;
  let requestNo = '';

  test.beforeAll(async () => {
    fixtures = ensureFixtures();
    requestNo = (await createAs('user', uniqueTag('E2E98VIEW'))).requestNo;
  });

  test('AC-12: 동방 「퀵 대화」 수신 — 5초 안에 왼쪽 말풍선 썸네일·카드 · 썸네일 클릭 → lightbox dialog · 다운로드 → 302 Location 서명 URL(download=)', async ({
    browser
  }) => {
    const vendor = await pageAs(browser, 'dongbang');
    try {
      await gotoChat(vendor.page, requestNo);
      await waitForSubscribed(vendor.page);
      await vendor.page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      const message = await sendWithAttachmentsAs('user', requestNo, '첨부합니다', [
        fileFromFixture(fixtures.png, MIME.png),
        fileFromFixture(fixtures.docx, MIME.docx)
      ]);
      const [image, file] = message.attachments;
      const bubble = messageBubble(vendor.page, message.id);
      await expect(bubble).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(bubble).toHaveAttribute('data-mine', 'false');
      await expect(imageTile(vendor.page, image!.id)).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
      await expect(fileCard(vendor.page, file!.id)).toBeVisible();
      // 왼쪽 정렬: 말풍선 왼쪽 끝이 로그 가운데보다 왼쪽
      const logBox = await messagesLog(vendor.page).boundingBox();
      const blockBox = await attachmentsBlock(vendor.page, message.id).boundingBox();
      expect(blockBox!.x).toBeLessThan(logBox!.x + logBox!.width / 2);
      await expect(imageTile(vendor.page, image!.id).getByRole('img', { name: 'sample.png' })).toBeVisible({ timeout: 15_000 });

      await imageTile(vendor.page, image!.id).click();
      const dialog = lightbox(vendor.page);
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toContainText('sample.png');
      await expect(dialog.getByRole('img').first()).toBeVisible({ timeout: 30_000 });
      await vendor.page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);

      const link = downloadLink(vendor.page, file!.id);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('aria-label', 'sample.docx 다운로드');
      const href = await link.getAttribute('href');
      expect(href).toBe(`/api/quick-request/${requestNo}/messages/attachments/${file!.id}/download`);
      const response = await vendor.context.request.get(href!, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expectSignedDownloadLocation(response.headers()['location']);
      expect(decodeURIComponent(response.headers()['location']!)).toContain('download=sample.docx');
    } finally {
      await vendor.context.close();
    }
  });

  test('AC-16: 이미지 5장 메시지 — 격자 4장 + 「+1」 · 클릭 → lightbox carousel 5장', async ({ page }) => {
    const message = await sendWithAttachmentsAs(
      'user',
      requestNo,
      '',
      fixtures.images.map((file, index) => fileFromFixture(file, MIME.png, `img-${index + 1}.png`))
    );
    await gotoChat(page, requestNo);
    const block = attachmentsBlock(page, message.id);
    await expect(block).toBeVisible({ timeout: 20_000 });
    const tiles = block.locator('[data-testid^="quick-chat-attachment-image-"]');
    await expect(tiles).toHaveCount(4);
    const more = page.getByTestId(`quick-chat-attachment-more-${message.id}`);
    await expect(more).toHaveText('+1');
    await expect(tiles.nth(3)).toHaveAttribute('aria-label', '사진 1장 더 보기');
    await expect(imageTile(page, message.attachments[4]!.id), '5번째는 격자에 없음').toHaveCount(0);

    await tiles.nth(3).click();
    const dialog = lightbox(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('group')).toHaveCount(5);
    await expect(dialog).toContainText('img-4.png');
    await expect(dialog.getByRole('button', { name: 'Next slide' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next slide' }).click();
    await expect(dialog).toContainText('img-5.png');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('AC-17: 375 · 파일 카드 3개 — 카드 폭 = 말풍선 폭 · 다운로드 ≥ 44px · 가로 스크롤 없음 · 이름 2줄 truncate', async ({ browser }) => {
    const longName = `견적서_2026_10_성수_판교_최종본_v3_${'아주긴파일이름'.repeat(6)}.docx`;
    const message = await sendWithAttachmentsAs('dongbang', requestNo, '', [
      fileFromFixture(fixtures.docx, MIME.docx, longName),
      fileFromFixture(fixtures.pdf, MIME.pdf, '거래명세서.pdf'),
      fileFromFixture(fixtures.zip, MIME.zip, '사진모음.zip')
    ]);
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoChat(page, requestNo);
      const block = attachmentsBlock(page, message.id);
      await expect(block).toBeVisible({ timeout: 20_000 });
      await block.scrollIntoViewIfNeeded();
      await expectNoHorizontalScroll(page);
      const log = messagesLog(page);
      const overflow = await log.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(overflow, 'quick-chat-messages 가로 넘침').toBeLessThanOrEqual(0);

      const blockBox = await block.boundingBox();
      for (const attachment of message.attachments) {
        const card = fileCard(page, attachment.id);
        await expect(card).toBeVisible();
        const cardBox = await card.boundingBox();
        expect(Math.abs(cardBox!.width - blockBox!.width), `카드 ${attachment.fileName} 폭 = 말풍선 폭`).toBeLessThanOrEqual(1);
        const button = downloadLink(page, attachment.id);
        const buttonBox = await button.boundingBox();
        expect(buttonBox!.height, '다운로드 높이').toBeGreaterThanOrEqual(44);
        expect(buttonBox!.width, '다운로드 너비').toBeGreaterThanOrEqual(44);
        await expect(card).toContainText(`${attachment.extension.toUpperCase()} · `);
      }

      const longCard = fileCard(page, message.attachments[0]!.id);
      const name = longCard.getByText(longName, { exact: true });
      const metrics = await name.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          clamp: style.getPropertyValue('-webkit-line-clamp'),
          lineHeight: Number.parseFloat(style.lineHeight),
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight
        };
      });
      expect(metrics.clamp, 'line-clamp-2').toBe('2');
      expect(metrics.clientHeight, '2줄 이하').toBeLessThanOrEqual(metrics.lineHeight * 2 + 2);
      expect(metrics.scrollHeight, '잘림(2줄 초과분)').toBeGreaterThan(metrics.clientHeight);
    } finally {
      await context.close();
    }
  });
});
