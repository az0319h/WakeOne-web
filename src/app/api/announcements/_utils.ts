import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction } from '@/features/activity-logs/api/types';

export type AnnouncementAction = Extract<ActivityAction, `announcement.${string}`>;

export function newAnnouncementRequestId() {
  return createRequestId();
}

export function parseAnnouncementId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseAttachmentId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function announcementTargetLabel(input: {
  id?: number | string | null;
  title?: string | null;
  fileName?: string | null;
}): string {
  const id = input.id ?? 'unknown';
  const title = input.title?.trim() || 'unknown';
  const fileName = input.fileName?.trim();
  return fileName ? `announcement:${id}:${title}:${fileName}` : `announcement:${id}:${title}`;
}

export async function logAnnouncementAuthFailure(input: {
  requestId: string;
  action: AnnouncementAction;
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
      targetType: 'announcement',
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

export function isValidationErrorMessage(message: string): boolean {
  return (
    message.includes('제목') ||
    message.includes('본문') ||
    message.includes('고정 공지') ||
    message.includes('파일당') ||
    message.includes('총량') ||
    message.includes('파일명') ||
    message.includes('동일한 파일명')
  );
}
