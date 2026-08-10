import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  E2E_ATTACHMENT_MB,
  importContractViaApi,
  uniqueDocumentNumber,
  uploadContractAttachmentViaApi
} from '../helpers/contracts';

const TEN_MB = 10 * E2E_ATTACHMENT_MB;
const FIVE_MB = 5 * E2E_ATTACHMENT_MB;
const SIX_MB = 6 * E2E_ATTACHMENT_MB;

type ActivityLog = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: {
    document_number?: string;
    error_code?: string;
    message?: string;
  };
};

async function getActivityLogs(request: APIRequestContext, action: string) {
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
  expected: { requestId?: string; action: string; status?: number }
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
    return true;
  });
}

async function createEmptyContract(request: APIRequestContext) {
  const documentNumber = uniqueDocumentNumber('AC38');
  const contract = await importContractViaApi(request, documentNumber);
  return { contract, documentNumber };
}

test.describe('계약 첨부 용량 API', () => {
  test('AC-01 plan38: 10MB 이하 단일 파일 업로드는 201과 activity log를 반환한다', async ({
    request
  }) => {
    test.setTimeout(120_000);
    const { contract } = await createEmptyContract(request);

    const response = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      'ac01-10mb.bin',
      TEN_MB
    );

    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.attachment.file_name).toBe('ac01-10mb.bin');
    expect(body.contract.active_attachment_total_size).toBe(TEN_MB);

    const logs = await getActivityLogs(request, 'contract.attachment_upload');
    expect(hasLog(logs, { action: 'contract.attachment_upload', requestId })).toBe(
      true
    );
  });

  test('AC-02 plan38: 10MB 초과 단일 파일 업로드는 400과 per-file 오류를 반환한다', async ({
    request
  }) => {
    test.setTimeout(120_000);
    const { contract } = await createEmptyContract(request);

    const response = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      'ac02-oversized.bin',
      TEN_MB + 1
    );

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('파일당');
    expect(body.message).toContain('10MB');

    const detailResponse = await request.get(`/api/contracts/${contract.id}`);
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.contract.active_attachment_total_size).toBe(0);
    expect(
      detailBody.contract.attachments.filter(
        (item: { status: string }) => item.status === 'active'
      )
    ).toHaveLength(0);

    const logs = await getActivityLogs(request, 'contract.attachment_upload');
    expect(
      hasLog(logs, {
        action: 'contract.attachment_upload',
        requestId,
        status: 400
      })
    ).toBe(true);
  });

  test('AC-03 plan38: 문서 총량 45MB 상태에서 6MB 업로드는 400을 반환한다', async ({
    request
  }) => {
    test.setTimeout(300_000);
    const { contract } = await createEmptyContract(request);

    for (let index = 0; index < 9; index += 1) {
      const uploadResponse = await uploadContractAttachmentViaApi(
        request,
        contract.id,
        `ac03-seed-${index}.bin`,
        FIVE_MB
      );
      expect(uploadResponse.status()).toBe(201);
    }

    const response = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      'ac03-over-total.bin',
      SIX_MB
    );

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('50MB');

    const logs = await getActivityLogs(request, 'contract.attachment_upload');
    expect(
      hasLog(logs, {
        action: 'contract.attachment_upload',
        requestId,
        status: 400
      })
    ).toBe(true);
  });

  test('AC-04 plan38: 10MB 5개 순차 업로드 후 1B 파일은 400을 반환한다', async ({
    request
  }) => {
    test.setTimeout(600_000);
    const { contract } = await createEmptyContract(request);

    for (let index = 0; index < 5; index += 1) {
      const uploadResponse = await uploadContractAttachmentViaApi(
        request,
        contract.id,
        `ac04-10mb-${index}.bin`,
        TEN_MB
      );
      expect(uploadResponse.status()).toBe(201);
    }

    const detailBefore = await request.get(`/api/contracts/${contract.id}`);
    expect(detailBefore.status()).toBe(200);
    const detailBeforeBody = await detailBefore.json();
    expect(detailBeforeBody.contract.active_attachment_total_size).toBe(50 * E2E_ATTACHMENT_MB);

    const response = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      'ac04-one-byte.bin',
      1
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('50MB');
  });

  test('AC-08 plan38: 동일 파일명 재업로드는 400을 반환한다', async ({ request }) => {
    test.setTimeout(60_000);
    const { contract } = await createEmptyContract(request);
    const fileName = 'ac08-duplicate.bin';

    const first = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      fileName,
      1024
    );
    expect(first.status()).toBe(201);

    const second = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      fileName,
      1024
    );
    expect(second.status()).toBe(400);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('동일한 파일명');
  });

  test('AC-09 plan38: 용량 초과 400 요청은 activity log에 x-request-id와 400이 남는다', async ({
    request
  }) => {
    test.setTimeout(120_000);
    const { contract } = await createEmptyContract(request);

    const response = await uploadContractAttachmentViaApi(
      request,
      contract.id,
      'ac09-oversized.bin',
      TEN_MB + 1
    );

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const logs = await getActivityLogs(request, 'contract.attachment_upload');
    expect(
      hasLog(logs, {
        action: 'contract.attachment_upload',
        requestId,
        status: 400
      })
    ).toBe(true);
  });
});
