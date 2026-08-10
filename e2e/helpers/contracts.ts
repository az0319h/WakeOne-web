export function uniqueDocumentNumber(prefix = 'E2E') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildImportPayload(
  documentNumber: string,
  overrides: Partial<{
    document_created_at: string;
    approved_at: string;
    author_name: string;
    author_email: string | null;
    contract_target: string;
    contract_summary: string;
    amount: number | null;
    source_message_id: string | null;
    source_document_url: string | null;
  }> = {}
) {
  return {
    document_number: documentNumber,
    document_created_at: '2026-07-01',
    approved_at: '2026-07-02T09:00:00+09:00',
    author_name: 'E2E 작성자',
    author_email: 'e2e@test.local',
    contract_target: 'E2E 계약대상',
    contract_summary: 'E2E 계약 내용 테스트',
    amount: 1_000_000,
    source_message_id: `msg-${documentNumber}`,
    ...overrides
  };
}

export function importAuthHeaders() {
  const token = process.env.CONTRACT_IMPORT_TOKEN;
  if (!token) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export const E2E_ATTACHMENT_MB = 1024 * 1024;

export function buildAttachmentUploadPayload(fileName: string, sizeBytes: number) {
  return {
    name: fileName,
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(sizeBytes, 0)
  };
}

export async function importContractViaApi(
  request: import('@playwright/test').APIRequestContext,
  documentNumber: string,
  approvedAt = '2026-07-02T09:00:00+09:00'
) {
  const headers = importAuthHeaders();
  if (!headers) {
    throw new Error('CONTRACT_IMPORT_TOKEN is required in .env');
  }

  const response = await request.post('/api/contracts/import', {
    headers,
    data: buildImportPayload(documentNumber, { approved_at: approvedAt })
  });

  if (response.status() !== 201) {
    throw new Error(`import failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  return body.contract as { id: number; document_number: string };
}

export async function uploadContractAttachmentViaApi(
  request: import('@playwright/test').APIRequestContext,
  contractId: number,
  fileName: string,
  sizeBytes: number
) {
  return request.post(`/api/contracts/${contractId}/attachments`, {
    multipart: {
      file: buildAttachmentUploadPayload(fileName, sizeBytes)
    }
  });
}
