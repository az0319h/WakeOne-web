import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  E2E_ATTACHMENT_MB,
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractAttachmentViaApi
} from '../helpers/contracts';

const FIVE_MB = 5 * E2E_ATTACHMENT_MB;
const SIX_MB = 6 * E2E_ATTACHMENT_MB;
const ELEVEN_MB = 11 * E2E_ATTACHMENT_MB;

async function openContractEditSheet(page: Page, documentNumber: string) {
  await page.goto(
    `/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`
  );

  const row = page.getByRole('row', { name: new RegExp(documentNumber) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '계약서 작업 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: '수정' }).click();

  const sheet = page.getByRole('dialog', { name: '계약서 수정' });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function selectAttachmentFile(
  sheet: Locator,
  page: Page,
  fileName: string,
  sizeBytes: number
) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: '파일 선택' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: fileName,
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(sizeBytes, 0)
  });
}

test.describe('계약 첨부 용량 UI', () => {
  test('AC-05 plan38: 계약 수정 Sheet에 10MB·50MB 안내 문구가 표시된다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC05');
    await importContractViaApi(request, documentNumber);

    const sheet = await openContractEditSheet(page, documentNumber);
    await expect(sheet).toContainText('파일당 10MB');
    await expect(sheet).toContainText('계약 문서당 활성 첨부 총량 50MB');
  });

  test('AC-06 plan38: 11MB 파일 선택 시 업로드 전 차단되고 선택 목록에 추가되지 않는다', async ({
    page,
    request
  }) => {
    test.setTimeout(120_000);
    const documentNumber = uniqueDocumentNumber('AC06');
    await importContractViaApi(request, documentNumber);

    const sheet = await openContractEditSheet(page, documentNumber);
    await selectAttachmentFile(sheet, page, 'ac06-11mb.bin', ELEVEN_MB);

    await expect(
      page.getByRole('region', { name: /Notifications/i })
    ).toContainText('10MB');
    await expect(sheet).not.toContainText('저장 대기 첨부파일');
    await expect(sheet).not.toContainText('1개 선택됨');
    await expect(sheet).not.toContainText('ac06-11mb.bin');
  });

  test('AC-07 plan38: 활성 첨부 45MB 상태에서 6MB 선택 시 총량 초과로 차단된다', async ({
    page,
    request
  }) => {
    test.setTimeout(300_000);
    const documentNumber = uniqueDocumentNumber('AC07');
    const contract = await importContractViaApi(request, documentNumber);

    for (let index = 0; index < 9; index += 1) {
      const uploadResponse = await uploadContractAttachmentViaApi(
        request,
        contract.id,
        `ac07-seed-${index}.bin`,
        FIVE_MB
      );
      expect(uploadResponse.status()).toBe(201);
    }

    const sheet = await openContractEditSheet(page, documentNumber);
    await selectAttachmentFile(sheet, page, 'ac07-6mb.bin', SIX_MB);

    await expect(
      page.getByRole('region', { name: /Notifications/i })
    ).toContainText('50MB');
    await expect(sheet).not.toContainText('저장 대기 첨부파일');
    await expect(sheet).not.toContainText('1개 선택됨');
    await expect(sheet).not.toContainText('ac07-6mb.bin');
  });
});
