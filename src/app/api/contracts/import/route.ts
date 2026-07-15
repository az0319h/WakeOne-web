import { NextRequest, NextResponse } from 'next/server';
import { withRequestId } from '@/features/activity-logs/api/log.server';
import {
  importContractDocument,
  recordContractImportEvent
} from '@/features/contracts/api/service.server';
import { contractImportSchema, normalizeDocumentNumber } from '@/features/contracts/api/validators';
import { getImportToken, isValidImportToken, newContractRequestId } from '../_utils';

function asPayloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getImportValidationErrorCode(body: unknown, field: string): 'missing_approved_at' | 'validation' {
  const payloadRecord = asPayloadRecord(body);
  return field === 'approved_at' && !payloadRecord?.approved_at ? 'missing_approved_at' : 'validation';
}

async function tryRecordImportFailure(input: {
  requestId: string;
  body: unknown;
  documentNumber?: string | null;
  sourceMessageId?: string | null;
  errorCode: string;
  message: string;
}) {
  try {
    await recordContractImportEvent({
      requestId: input.requestId,
      status: 'failed',
      documentNumber: input.documentNumber ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      errorCode: input.errorCode,
      errorMessage: input.message,
      receivedPayload: asPayloadRecord(input.body)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[contracts/import] failed to record import event:', message);
  }
}

export async function POST(request: NextRequest) {
  const requestId = newContractRequestId();

  if (!isValidImportToken(getImportToken(request))) {
    const message = '유효한 계약 import token이 필요합니다.';
    return withRequestId(NextResponse.json({ success: false, message }, { status: 401 }), requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const message = '요청 JSON을 해석할 수 없습니다.';
    await tryRecordImportFailure({ requestId, body: null, errorCode: 'validation', message });
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  const parsed = contractImportSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue?.message ?? '입력값이 올바르지 않습니다.';
    const errorCode = getImportValidationErrorCode(body, String(firstIssue?.path[0] ?? ''));
    const payloadRecord = asPayloadRecord(body);
    await tryRecordImportFailure({
      requestId,
      body,
      documentNumber: typeof payloadRecord?.document_number === 'string' ? payloadRecord.document_number : null,
      sourceMessageId: typeof payloadRecord?.source_message_id === 'string' ? payloadRecord.source_message_id : null,
      errorCode,
      message
    });
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  const payload = {
    ...parsed.data,
    document_number: normalizeDocumentNumber(parsed.data.document_number)
  };

  try {
    const result = await importContractDocument(payload, requestId);
    const status = result.status === 'created' ? 201 : 200;
    const message =
      result.status === 'created'
        ? '계약서가 import되었습니다.'
        : result.status === 'backfill'
          ? '기존 계약서의 문서승인일이 보완되었습니다.'
          : '이미 import된 계약서입니다.';

    return withRequestId(
      NextResponse.json({ success: true, message, contract: result.contract }, { status }),
      requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 import 중 오류가 발생했습니다.';
    await tryRecordImportFailure({
      requestId,
      body,
      documentNumber: payload.document_number,
      sourceMessageId: payload.source_message_id ?? null,
      errorCode: 'internal_error',
      message
    });
    return withRequestId(NextResponse.json({ success: false, message }, { status: 500 }), requestId);
  }
}
