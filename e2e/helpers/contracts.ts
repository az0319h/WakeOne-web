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
