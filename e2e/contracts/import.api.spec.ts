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

type ActivityLog = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: {
    document_number?: string;
    changed_fields?: string[];
    error_code?: string;
    message?: string;
  };
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
): Promise<{ contract: ContractDocument; requestId: string }> {
  const response = await request.post('/api/contracts/import', {
    headers: expectImportHeaders(),
    data: buildImportPayload(documentNumber, { approved_at: approvedAt })
  });

  expect(response.status()).toBe(201);
  const requestId = response.headers()['x-request-id'];
  expect(requestId).toBeTruthy();

  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.contract.document_number).toBe(documentNumber);
  expect(body.contract.approved_at).toBeTruthy();

  return { contract: body.contract, requestId };
}

async function getActivityLogs(
  request: APIRequestContext,
  action: string
) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50`
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  return (body.data?.logs ?? []) as ActivityLog[];
}

function hasLog(
  logs: ActivityLog[],
  expected: {
    requestId?: string;
    documentNumber?: string;
    action: string;
    status?: number;
    changedField?: string;
    errorCode?: string;
  }
) {
  return logs.some((item) => {
    if (item.action !== expected.action) {
      return false;
    }
    if (expected.status && item.http_status !== expected.status) {
      return false;
    }
    if (expected.requestId && item.request_id !== expected.requestId) {
      return false;
    }
    if (
      expected.documentNumber &&
      item.metadata?.document_number !== expected.documentNumber
    ) {
      return false;
    }
    if (
      expected.changedField &&
      !item.metadata?.changed_fields?.includes(expected.changedField)
    ) {
      return false;
    }
    if (expected.errorCode && item.metadata?.error_code !== expected.errorCode) {
      return false;
    }
    return true;
  });
}

test.describe('계약 Import API', () => {
  test('AC-01: approved_at 포함 import는 계약을 만든다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC01');
    const approvedAt = '2026-07-02T09:00:00+09:00';
    const response = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: buildImportPayload(documentNumber, { approved_at: approvedAt })
    });

    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contract.document_number).toBe(documentNumber);
    expect(body.contract.approved_at).toBeTruthy();

    const detailResponse = await request.get(`/api/contracts/${body.contract.id}`);
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.contract.approved_at).toBeTruthy();

    const logs = await getActivityLogs(request, 'contract.import_create');
    expect(hasLog(logs, { action: 'contract.import_create', requestId })).toBe(false);
  });

  test('AC-01: 동일 document_number import는 idempotent 200을 반환한다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC01D');
    const payload = buildImportPayload(documentNumber);

    const first = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: payload
    });
    expect(first.status()).toBe(201);

    const second = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: payload
    });
    expect(second.status()).toBe(200);
    const requestId = second.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await second.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('이미 import');

    const logs = await getActivityLogs(request, 'contract.import_duplicate');
    expect(hasLog(logs, { action: 'contract.import_duplicate', requestId })).toBe(false);
  });

  test('AC-01B: approved_at null 기존 행 duplicate import는 backfill한다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC01B');
    const approvedAt = '2026-07-08T16:34:00+09:00';
    const { contract } = await importContract(request, documentNumber, approvedAt);

    const nullResponse = await request.patch(`/api/contracts/${contract.id}`, {
      data: { approved_at: null }
    });
    expect(nullResponse.status()).toBe(200);

    const backfillResponse = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: buildImportPayload(documentNumber, { approved_at: approvedAt })
    });
    expect(backfillResponse.status()).toBe(200);
    const requestId = backfillResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await backfillResponse.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('문서승인일');
    expect(body.contract.approved_at).toBeTruthy();

    const detailResponse = await request.get(`/api/contracts/${contract.id}`);
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.contract.approved_at).toBeTruthy();

    const logs = await getActivityLogs(request, 'contract.import_backfill');
    expect(hasLog(logs, { action: 'contract.import_backfill', requestId })).toBe(false);
  });

  test('AC-02: approved_at 누락 import는 400을 반환한다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC02');
    const { approved_at: _approvedAt, ...payload } =
      buildImportPayload(documentNumber);

    const response = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: payload
    });

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);

    const listResponse = await request.get(
      `/api/contracts?search=${encodeURIComponent(documentNumber)}`
    );
    expect(listResponse.status()).toBe(200);
    const listBody = await listResponse.json();
    expect(
      listBody.items.some(
        (item: ContractDocument) => item.document_number === documentNumber
      )
    ).toBe(false);

    const logs = await getActivityLogs(request, 'contract.import_failed');
    expect(hasLog(logs, { action: 'contract.import_failed', requestId })).toBe(false);
  });

  test('AC-06: null approved_at 계약 update는 changed_fields에 approved_at을 남긴다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC06');
    const { contract } = await importContract(request, documentNumber);

    const nullResponse = await request.patch(`/api/contracts/${contract.id}`, {
      data: { approved_at: null }
    });
    expect(nullResponse.status()).toBe(200);
    expect(nullResponse.headers()['x-request-id']).toBeTruthy();

    const nextApprovedAt = '2026-07-07T00:00:00+09:00';
    const updateResponse = await request.patch(`/api/contracts/${contract.id}`, {
      data: { approved_at: nextApprovedAt }
    });
    expect(updateResponse.status()).toBe(200);
    const requestId = updateResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await updateResponse.json();
    expect(body.contract.approved_at).toBeTruthy();

    const logs = await getActivityLogs(request, 'contract.update');
    expect(
      hasLog(logs, {
        action: 'contract.update',
        status: 200,
        requestId,
        documentNumber,
        changedField: 'approved_at'
      })
    ).toBe(true);
  });

  test('AC-07: 기존 승인일 변경 update는 changed_fields에 approved_at을 남긴다', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC07');
    const { contract } = await importContract(
      request,
      documentNumber,
      '2026-07-03T09:00:00+09:00'
    );

    const response = await request.patch(`/api/contracts/${contract.id}`, {
      data: { approved_at: '2026-07-08T00:00:00+09:00' }
    });
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.contract.approved_at).toBeTruthy();

    const logs = await getActivityLogs(request, 'contract.update');
    expect(
      hasLog(logs, {
        action: 'contract.update',
        status: 200,
        requestId,
        documentNumber,
        changedField: 'approved_at'
      })
    ).toBe(true);
  });
});

test.describe('계약 API RBAC', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-08: user session cannot update contracts and failure keeps activity log policy', async ({ request }) => {
    const response = await request.patch('/api/contracts/1', {
      data: { approved_at: '2026-07-08T00:00:00+09:00' }
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['x-request-id']).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('관리자');
  });
});
