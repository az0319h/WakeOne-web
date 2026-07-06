export function uniqueDocumentNumber(prefix = 'E2E') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildImportPayload(documentNumber: string) {
  return {
    document_number: documentNumber,
    document_created_at: '2026-07-01',
    author_name: 'E2E 작성자',
    author_email: 'e2e@test.local',
    contract_target: 'E2E 계약대상',
    contract_summary: 'E2E 계약 내용 테스트',
    amount: 1_000_000,
    source_message_id: `msg-${documentNumber}`
  };
}

export function importAuthHeaders() {
  const token = process.env.CONTRACT_IMPORT_TOKEN;
  if (!token) {
    return null;
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}
