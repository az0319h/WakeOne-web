import { expect, test } from '@playwright/test';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from '../helpers/contracts';

test.describe('계약 Import API', () => {
  test('AC-06: valid import creates contract and returns x-request-id', async ({ request }) => {
    const headers = importAuthHeaders();
    test.skip(!headers, 'CONTRACT_IMPORT_TOKEN is required in .env');

    const documentNumber = uniqueDocumentNumber('AC06');
    const response = await request.post('/api/contracts/import', {
      headers,
      data: buildImportPayload(documentNumber)
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['x-request-id']).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contract.document_number).toBe(documentNumber);
  });

  test('AC-06-1: duplicate import is idempotent', async ({ request }) => {
    const headers = importAuthHeaders();
    test.skip(!headers, 'CONTRACT_IMPORT_TOKEN is required in .env');

    const documentNumber = uniqueDocumentNumber('AC061');
    const payload = buildImportPayload(documentNumber);

    const first = await request.post('/api/contracts/import', { headers, data: payload });
    expect(first.status()).toBe(201);

    const second = await request.post('/api/contracts/import', { headers, data: payload });
    expect(second.status()).toBe(200);

    const body = await second.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('이미 import');
  });

  test('AC-06: import without token returns 401', async ({ request }) => {
    const response = await request.post('/api/contracts/import', {
      data: buildImportPayload(uniqueDocumentNumber('AC06-401'))
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['x-request-id']).toBeTruthy();
  });

  test('AC-06: invalid payload returns 400', async ({ request }) => {
    const headers = importAuthHeaders();
    test.skip(!headers, 'CONTRACT_IMPORT_TOKEN is required in .env');

    const response = await request.post('/api/contracts/import', {
      headers,
      data: { document_number: '' }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['x-request-id']).toBeTruthy();
  });
});

test.describe('계약 API RBAC', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-03: user session cannot list contracts', async ({ request }) => {
    const response = await request.get('/api/contracts');
    expect(response.status()).toBe(403);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('관리자');
  });
});

test.describe('계약 Import activity log', () => {
  test('AC-06: import_create appears in activity logs', async ({ request }) => {
    const headers = importAuthHeaders();
    test.skip(!headers, 'CONTRACT_IMPORT_TOKEN is required in .env');

    const documentNumber = uniqueDocumentNumber('AC06-LOG');
    const importResponse = await request.post('/api/contracts/import', {
      headers,
      data: buildImportPayload(documentNumber)
    });
    expect(importResponse.status()).toBe(201);
    const requestId = importResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const logsResponse = await request.get(
      '/api/activity-logs?action=contract.import_create&limit=20'
    );
    expect(logsResponse.status()).toBe(200);

    const logsBody = await logsResponse.json();
    expect(logsBody.success).toBe(true);

    const items = logsBody.data?.logs ?? [];
    const matched = items.some(
      (item: { request_id?: string; action?: string; metadata?: { document_number?: string } }) =>
        item.action === 'contract.import_create' &&
        (item.request_id === requestId || item.metadata?.document_number === documentNumber)
    );
    expect(matched).toBe(true);
  });
});
