import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction } from '@/features/activity-logs/api/types';

export type ContractAction = Extract<ActivityAction, `contract.${string}`>;

export function newContractRequestId() {
  return createRequestId();
}

export function parseContractId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function contractTargetLabel(input: {
  id?: number | string | null;
  documentNumber?: string | null;
  fileName?: string | null;
}): string {
  const id = input.id ?? 'unknown';
  const documentNumber = input.documentNumber?.trim() || 'unknown';
  const fileName = input.fileName?.trim();
  return fileName ? `contract:${id}:${documentNumber}:${fileName}` : `contract:${id}:${documentNumber}`;
}

export async function logContractAuthFailure(input: {
  requestId: string;
  action: ContractAction;
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  response: NextResponse;
}): Promise<NextResponse> {
  const status = input.response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    input.requestId,
    {
      ...actor,
      action: input.action,
      targetType: 'contract',
      targetUserId: null,
      targetLabel: input.targetLabel,
      httpMethod: input.httpMethod,
      httpPath: input.httpPath,
      metadata: buildErrorMetadata(
        status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
      )
    },
    input.response
  );
}

export function getImportToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-contract-import-token')?.trim() || null;
}

export function isValidImportToken(token: string | null): boolean {
  const expected = process.env.CONTRACT_IMPORT_TOKEN;
  return Boolean(expected && token && token === expected);
}

export function serviceActor() {
  return {
    actorUserId: null,
    actorEmail: 'openclaw',
    actorDisplayName: 'OpenClaw'
  };
}

export function getReminderCronToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-contract-reminder-token')?.trim() || null;
}

export function getReminderCronSecret(): string | undefined {
  return process.env.CRON_SECRET ?? process.env.CONTRACT_REMINDER_CRON_SECRET;
}

export function isValidReminderCronToken(token: string | null): boolean {
  const expected = getReminderCronSecret();
  return Boolean(expected && token && token === expected);
}

export function reminderCronActor() {
  return {
    actorUserId: null,
    actorEmail: 'contract-reminder-cron',
    actorDisplayName: 'Contract Reminder Cron'
  };
}

export type AttachmentContentDispositionType = 'attachment' | 'inline';

const INLINE_OPENABLE_CONTENT_TYPES = new Map([
  ['apng', 'image/apng'],
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif'],
  ['ico', 'image/x-icon'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['pdf', 'application/pdf'],
  ['png', 'image/png'],
  ['webp', 'image/webp']
]);

function getFileExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? '';
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex > -1 ? baseName.slice(dotIndex + 1).toLowerCase() : '';
}

export function isInlineOpenableAttachment(contentType: string | null, fileName: string): boolean {
  const normalizedContentType = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalizedContentType === 'application/pdf') {
    return true;
  }

  if (normalizedContentType?.startsWith('image/') && normalizedContentType !== 'image/svg+xml') {
    return true;
  }

  return INLINE_OPENABLE_CONTENT_TYPES.has(getFileExtension(fileName));
}

export function attachmentResponseContentType(contentType: string | null, fileName: string): string {
  return contentType ?? INLINE_OPENABLE_CONTENT_TYPES.get(getFileExtension(fileName)) ?? 'application/octet-stream';
}

export function attachmentContentDisposition(
  fileName: string,
  disposition: AttachmentContentDispositionType = 'attachment'
): string {
  const fallback = fileName.replaceAll(/[^\w.-]/g, '_') || 'contract-attachment';
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
