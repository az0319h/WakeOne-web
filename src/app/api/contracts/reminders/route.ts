import { NextRequest, NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog,
  recordActivityLog,
  withRequestId
} from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import {
  createContractReminderRun,
  finishContractReminderRun,
  getContractReminderRunByKey,
  listContractReminderRecipientGroups,
  recordContractReminderRecipient
} from '@/features/contracts/api/service.server';
import type { ContractReminderRecipientGroup, ContractReminderRecipientResult } from '@/features/contracts/api/types';
import {
  insertContractReminderAdminNotifications,
  insertContractReminderRecipientNotification
} from '@/features/notifications/api/fan-out.server';
import { sendContractReminderEmail } from '@/lib/mail/send-contract-reminder-email';
import {
  getReminderCronToken,
  isValidReminderCronToken,
  logContractAuthFailure,
  newContractRequestId,
  reminderCronActor
} from '../_utils';

const HTTP_PATH = '/api/contracts/reminders';
const HTTP_METHOD = 'POST';

type ReminderActor = {
  actorUserId: string | null;
  actorEmail: string;
  actorDisplayName: string | null;
  triggerSource: 'admin' | 'cron';
};

function getDateRunKey(date = new Date()): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function asBodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getRunKeyFromBody(body: unknown): string {
  const record = asBodyRecord(body);
  return typeof record.run_key === 'string' && record.run_key.trim()
    ? record.run_key.trim()
    : getDateRunKey();
}

function truncateErrorMessage(message: string): string {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function runTargetLabel(runKey: string): string {
  return `run:${runKey}`;
}

async function resolveReminderActor(
  request: NextRequest,
  requestId: string,
  runKey: string
): Promise<ReminderActor | NextResponse> {
  const cronToken = getReminderCronToken(request);

  if (cronToken !== null) {
    if (!isValidReminderCronToken(cronToken)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...reminderCronActor(),
          action: 'contract.reminder_failed',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: runTargetLabel(runKey),
          httpMethod: HTTP_METHOD,
          httpPath: HTTP_PATH,
          metadata: buildErrorMetadata('unauthenticated', '유효한 계약 독촉 cron secret이 필요합니다.')
        },
        { success: false, message: '유효한 계약 독촉 cron secret이 필요합니다.' },
        401
      );
    }

    return { ...reminderCronActor(), triggerSource: 'cron' };
  }

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.reminder_failed',
      httpMethod: HTTP_METHOD,
      httpPath: HTTP_PATH,
      targetLabel: runTargetLabel(runKey),
      response: session.response
    });
  }

  return { ...actorFromProfile(session.profile), triggerSource: 'admin' };
}

async function recordRecipientActivityLog(input: {
  requestId: string;
  actor: ReminderActor;
  group: ContractReminderRecipientGroup;
  result: ContractReminderRecipientResult;
  httpStatus: number;
}): Promise<void> {
  const metadata = {
    recipient_email: input.group.recipient_email,
    missing_document_numbers: input.group.document_numbers,
    ...(input.result.status === 'failed' && input.result.error_message
      ? buildErrorMetadata('internal_error', input.result.error_message)
      : {})
  };

  await recordActivityLog({
    requestId: input.requestId,
    actorUserId: input.actor.actorUserId,
    actorEmail: input.actor.actorEmail,
    actorDisplayName: input.actor.actorDisplayName,
    action: input.result.status === 'sent' ? 'contract.reminder_send' : 'contract.reminder_failed',
    targetType: 'contract',
    targetUserId: input.group.recipient_user_id,
    targetLabel: input.group.recipient_email,
    httpMethod: HTTP_METHOD,
    httpPath: HTTP_PATH,
    httpStatus: input.httpStatus,
    metadata
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const requestId = newContractRequestId();
  let body: unknown = {};

  try {
    const text = await request.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    const message = '요청 JSON을 해석할 수 없습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        actorUserId: null,
        actorEmail: 'anonymous',
        actorDisplayName: null,
        action: 'contract.reminder_failed',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: runTargetLabel(getDateRunKey()),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', message)
      },
      { success: false, message },
      400
    );
  }

  const runKey = getRunKeyFromBody(body);
  const actorOrResponse = await resolveReminderActor(request, requestId, runKey);

  if (actorOrResponse instanceof NextResponse) {
    return actorOrResponse;
  }

  const actor = actorOrResponse;

  try {
    const existingRun = await getContractReminderRunByKey(runKey);
    if (existingRun) {
      return jsonWithActivityLog(
        requestId,
        {
          actorUserId: actor.actorUserId,
          actorEmail: actor.actorEmail,
          actorDisplayName: actor.actorDisplayName,
          action: 'contract.reminder_send',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: runTargetLabel(runKey),
          httpMethod: HTTP_METHOD,
          httpPath: HTTP_PATH,
          metadata: { duplicate_run: true }
        },
        {
          success: true,
          message: '이미 실행된 계약서 독촉 run입니다.',
          run: existingRun,
          recipients: [],
          unmatched_targets: existingRun.unmatched_targets
        },
        200
      );
    }

    const scan = await listContractReminderRecipientGroups();
    const { groups, unmatched_targets: unmatchedTargets } = scan;

    if (groups.length === 0 && unmatchedTargets.length === 0) {
      const message = '독촉 대상 계약서가 없습니다.';
      return jsonWithActivityLog(
        requestId,
        {
          actorUserId: actor.actorUserId,
          actorEmail: actor.actorEmail,
          actorDisplayName: actor.actorDisplayName,
          action: 'contract.reminder_failed',
          targetType: 'contract',
          targetUserId: null,
          targetLabel: runTargetLabel(runKey),
          httpMethod: HTTP_METHOD,
          httpPath: HTTP_PATH,
          metadata: buildErrorMetadata('validation', message, { unmatched_count: 0 })
        },
        { success: false, message, run: null, recipients: [], unmatched_targets: [] },
        400
      );
    }

    const run = await createContractReminderRun({
      requestId,
      runKey,
      triggerSource: actor.triggerSource,
      actorUserId: actor.actorUserId,
      targetCount: groups.length
    });

    const recipients: ContractReminderRecipientResult[] = [];

    for (const group of groups) {
      let result: ContractReminderRecipientResult;

      try {
        await sendContractReminderEmail({ group });
        result = {
          recipient_email: group.recipient_email,
          author_name: group.author_name,
          document_numbers: group.document_numbers,
          status: 'sent',
          error_message: null
        };
      } catch (error) {
        result = {
          recipient_email: group.recipient_email,
          author_name: group.author_name,
          document_numbers: group.document_numbers,
          status: 'failed',
          error_message: truncateErrorMessage(
            error instanceof Error ? error.message : '독촉 메일 발송에 실패했습니다.'
          )
        };
      }

      try {
        await recordContractReminderRecipient({
          runId: run.id,
          group,
          status: result.status,
          errorMessage: result.error_message
        });
      } catch (error) {
        result = {
          ...result,
          status: 'failed',
          error_message: truncateErrorMessage(
            error instanceof Error ? error.message : '독촉 발송 결과 저장에 실패했습니다.'
          )
        };
      }

      recipients.push(result);

      await recordRecipientActivityLog({
        requestId,
        actor,
        group,
        result,
        httpStatus: 200
      });
    }

    const sentCount = recipients.filter((recipient) => recipient.status === 'sent').length;
    const failedCount = recipients.length - sentCount;
    const runStatus =
      groups.length === 0
        ? 'completed'
        : failedCount === 0
          ? 'completed'
          : sentCount > 0
            ? 'partial_failed'
            : 'failed';

    const finishedRun = await finishContractReminderRun({
      runId: run.id,
      status: runStatus,
      sentCount,
      failedCount,
      unmatchedTargets
    });

    const responseBody = {
      success: failedCount === 0,
      message:
        groups.length === 0
          ? '미매칭 계약서만 확인되어 독촉 run을 기록했습니다.'
          : failedCount === 0
            ? '계약서 첨부 누락 독촉 메일을 발송했습니다.'
            : '계약서 첨부 누락 독촉 메일 일부 발송에 실패했습니다.',
      run: finishedRun,
      recipients,
      unmatched_targets: unmatchedTargets
    };

    try {
      await insertContractReminderAdminNotifications({
        runId: finishedRun.id,
        runKey,
        triggerSource: actor.triggerSource,
        sentCount,
        failedCount,
        unmatchedCount: unmatchedTargets.length,
        groupsLength: groups.length,
        runStatus
      });

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]!;
        const result = recipients[index]!;

        if (result.status !== 'sent') {
          continue;
        }

        await insertContractReminderRecipientNotification({
          recipientUserId: group.recipient_user_id,
          runId: finishedRun.id,
          authorName: group.author_name,
          documentNumbers: group.document_numbers
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[contract-reminder] notification fan-out failed:', message);
    }

    return withRequestId(NextResponse.json(responseBody), requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 독촉 실행 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        actorDisplayName: actor.actorDisplayName,
        action: 'contract.reminder_failed',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: runTargetLabel(runKey),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message, run: null, recipients: [], unmatched_targets: [] },
      500
    );
  }
}
