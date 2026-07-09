import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';

type ContractDocument = {
  id: number;
  document_number: string;
  approved_at: string | null;
};

function expectImportHeaders() {
  const headers = importAuthHeaders();
  expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();
  return headers!;
}

async function importContract(
  request: APIRequestContext,
  documentNumber: string,
  approvedAt = '2026-07-02T09:00:00+09:00'
) {
  const response = await request.post('/api/contracts/import', {
    headers: expectImportHeaders(),
    data: buildImportPayload(documentNumber, { approved_at: approvedAt })
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.contract.document_number).toBe(documentNumber);
  return body.contract as ContractDocument;
}

async function updateApprovedAt(
  request: APIRequestContext,
  contractId: number,
  approvedAt: string | null
) {
  const response = await request.patch(`/api/contracts/${contractId}`, {
    data: { approved_at: approvedAt }
  });
  expect(response.status()).toBe(200);
}

test.describe('계약서 목록', () => {
  test('AC-03: approved_at 날짜 범위 필터는 포함 행만 API로 반환하고 URL 상태를 유지한다', async ({
    page,
    request
  }) => {
    const prefix = uniqueDocumentNumber('AC03');
    const insideDocumentNumber = `${prefix}-IN`;
    const outsideDocumentNumber = `${prefix}-OUT`;

    await importContract(
      request,
      insideDocumentNumber,
      '2026-07-05T09:00:00+09:00'
    );
    await importContract(
      request,
      outsideDocumentNumber,
      '2026-07-09T09:00:00+09:00'
    );

    const response = await request.get(
      `/api/contracts?search=${encodeURIComponent(prefix)}&from=2026-07-05&to=2026-07-05&limit=10`
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    const documentNumbers = body.items.map(
      (item: ContractDocument) => item.document_number
    );
    expect(documentNumbers).toContain(insideDocumentNumber);
    expect(documentNumbers).not.toContain(outsideDocumentNumber);

    await page.goto(
      `/dashboard/contracts?search=${encodeURIComponent(insideDocumentNumber)}&from=2026-07-05&to=2026-07-05`
    );

    await expect(page).toHaveURL(/from=2026-07-05/);
    await expect(page).toHaveURL(/to=2026-07-05/);
    await expect(
      page.getByRole('button', { name: /문서승인일 .*2026/ })
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: new RegExp(insideDocumentNumber) })
    ).toBeVisible();
  });

  test('AC-03B: 종료일 당일 approved_at도 날짜 범위에 포함된다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC03B');
    await importContract(request, documentNumber, '2026-07-09T16:34:00+09:00');

    const response = await request.get(
      `/api/contracts?search=${encodeURIComponent(documentNumber)}&from=2026-07-07&to=2026-07-09&limit=10`
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    const documentNumbers = body.items.map(
      (item: ContractDocument) => item.document_number
    );
    expect(documentNumbers).toContain(documentNumber);
  });

  test('AC-04: 기본 목록은 approved_at desc 정렬과 null 표시를 유지한다', async ({
    page,
    request
  }) => {
    const prefix = uniqueDocumentNumber('AC04');
    const oldDocumentNumber = `${prefix}-OLD`;
    const recentDocumentNumber = `${prefix}-RECENT`;
    const nullDocumentNumber = `${prefix}-NULL`;

    await importContract(
      request,
      oldDocumentNumber,
      '2026-07-01T09:00:00+09:00'
    );
    await importContract(
      request,
      recentDocumentNumber,
      '2026-07-03T09:00:00+09:00'
    );
    const nullContract = await importContract(
      request,
      nullDocumentNumber,
      '2026-07-02T09:00:00+09:00'
    );
    await updateApprovedAt(request, nullContract.id, null);

    const response = await request.get(
      `/api/contracts?search=${encodeURIComponent(prefix)}&limit=10`
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    const items = body.items as ContractDocument[];
    const documentNumbers = items.map((item) => item.document_number);

    expect(documentNumbers).toContain(recentDocumentNumber);
    expect(documentNumbers).toContain(oldDocumentNumber);
    expect(documentNumbers).toContain(nullDocumentNumber);
    expect(documentNumbers.indexOf(recentDocumentNumber)).toBeLessThan(
      documentNumbers.indexOf(oldDocumentNumber)
    );
    expect(
      items.find((item) => item.document_number === nullDocumentNumber)
        ?.approved_at
    ).toBeNull();

    await page.goto(
      `/dashboard/contracts?search=${encodeURIComponent(nullDocumentNumber)}`
    );
    const nullRow = page.getByRole('row', {
      name: new RegExp(nullDocumentNumber)
    });
    await expect(nullRow).toBeVisible();
    await expect(nullRow).toContainText('-');
  });

  test('AC-05: 상세 Sheet에 문서승인일이 표시된다', async ({
    page,
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC05');
    await importContract(
      request,
      documentNumber,
      '2026-07-06T09:00:00+09:00'
    );

    await page.goto(
      `/dashboard/contracts?search=${encodeURIComponent(documentNumber)}`
    );
    const row = page.getByRole('row', { name: new RegExp(documentNumber) });
    await expect(row).toBeVisible();
    await row
      .getByRole('button', { name: '계약서 작업 메뉴 열기' })
      .click();
    await page.getByRole('menuitem', { name: /상세 보기/ }).click();

    const detailDialog = page.getByRole('dialog', { name: '계약서 상세' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText('문서승인일');
    await expect(detailDialog).toContainText('2026. 7. 6.');
    await expect(
      detailDialog.getByRole('heading', { name: documentNumber })
    ).toBeVisible();
  });

  test('AC-04: admin can view contracts page with approved_at filters and table', async ({ page }) => {
    await page.goto('/dashboard/contracts');

    await expect(page.getByRole('heading', { name: '계약서 관리' })).toBeVisible();
    await expect(page.getByRole('button', { name: '문서승인일 전체' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '문서번호' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '문서승인일' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '문서 생성일' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: '작성자' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '계약대상' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '계약 내용' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '금액' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '첨부파일 상태' })).toBeVisible();
  });
});
