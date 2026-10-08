import { expect, type Locator, type Page } from '@playwright/test';
import {
  buildMinimalPngBuffer,
  buildSinglePagePdfBuffer,
  buildThreePagePdfBuffer
} from '../helpers/attachment-fixtures';
import {
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractAttachmentBufferViaApi
} from '../helpers/contracts';

export async function uploadContractPdfFixtureViaApi(
  request: import('@playwright/test').APIRequestContext,
  contractId: number,
  fileName: string,
  pageCount: 1 | 3 = 1
) {
  const buffer =
    pageCount === 3 ? buildThreePagePdfBuffer() : buildSinglePagePdfBuffer();
  const response = await uploadContractAttachmentBufferViaApi(
    request,
    contractId,
    fileName,
    buffer,
    'application/pdf'
  );
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.attachment as { id: number };
}

export async function uploadContractPngFixtureViaApi(
  request: import('@playwright/test').APIRequestContext,
  contractId: number,
  fileName: string
) {
  const buffer = buildMinimalPngBuffer();
  const response = await uploadContractAttachmentBufferViaApi(
    request,
    contractId,
    fileName,
    buffer,
    'image/png'
  );
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.attachment as { id: number };
}

export async function openContractDetailSheet(page: Page, documentNumber: string) {
  await page.goto(
    `/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`
  );

  const row = page.getByRole('row', { name: new RegExp(documentNumber) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: '계약서 작업 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: /상세 보기/ }).click();

  const sheet = page.getByRole('dialog', { name: '계약서 상세' });
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByRole('heading', { name: documentNumber })).toBeVisible({
    timeout: 30_000
  });
  return sheet;
}

export async function waitForAttachmentInSheet(sheet: Locator, fileName: string) {
  await expect(sheet.getByText(fileName, { exact: true })).toBeVisible({
    timeout: 15_000
  });
}

export function attachmentLightboxDialog(page: Page, fileName: string) {
  return page.getByRole('dialog', { name: fileName });
}

export async function openAttachmentLightboxFromSheet(
  page: Page,
  sheet: Locator,
  fileName: string
) {
  const pagesBefore = page.context().pages().length;
  await sheet.getByRole('button', { name: new RegExp(`${fileName}.*열기`) }).click();
  expect(page.context().pages().length).toBe(pagesBefore);

  const lightbox = attachmentLightboxDialog(page, fileName);
  await expect(lightbox).toBeVisible({ timeout: 30_000 });
  return lightbox;
}

export async function waitForPdfCanvas(lightbox: Locator) {
  await expect(lightbox.getByText(/\d+ \/ \d+/).first()).toBeVisible({
    timeout: 60_000
  });
}

export async function waitForPdfPageIndicator(lightbox: Locator, label: string) {
  await expect(lightbox.getByText(label)).toBeVisible({ timeout: 30_000 });
}

export async function waitForPdfThumbnailRail(lightbox: Locator) {
  await expect(
    lightbox.getByRole('tablist', { name: 'PDF 페이지 목록' })
  ).toBeVisible({ timeout: 30_000 });
}

export async function importContractWithPdf(
  request: import('@playwright/test').APIRequestContext,
  prefix: string,
  fileName: string,
  pageCount: 1 | 3 = 1
) {
  const documentNumber = uniqueDocumentNumber(prefix);
  const contract = await importContractViaApi(request, documentNumber);
  const attachment = await uploadContractPdfFixtureViaApi(
    request,
    contract.id,
    fileName,
    pageCount
  );
  return { contract, attachment, documentNumber };
}
