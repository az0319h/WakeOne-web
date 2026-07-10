import { NextRequest, NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
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
import type {
  ContractReminderRecipientGroup,
  ContractReminderRecipientResult,
  ContractReminderUnmatchedTarget
} from '@/features/contracts/api/types';
import { sendContractReminderEmail } from '@/lib/mail/send-contract-reminder-email';
import {
  contractTargetLabel,
  getReminderCronToken,
  isValidReminderCronToken,
  logContractAuthFailure,
  newContractRequestId,
  reminderCronActor
} from '../_utils';

const HTTP_PATH = '/api/contracts/reminders';

type ReminderActor = {
  actorUserId: string | null;
  actorEmail: string;
  actorDisplayName: string | null;
  triggerSource: 'admin' | 'cron';
};

function getIsoWeekRunKey(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function asBodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getRunKeyFromBody(body: unknown): string {
  const record = asBodyRecord(body);
  return typeof record.run_key === 'string' && record.run_key.trim()
    ? record.run_key.trim()
    : getIsoWeekRunKey();
}

function truncateErrorMessage(message: string): string {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function countUnmatchedContracts(targets: ContractReminderUnmatchedTarget[]): number {
  return targets.reduce((total, target) => total + target.contract_ids.length, 0);
}

function buildUnmatchedMetadata(unmatchedTargets: ContractReminderUnmatchedTarget[]) {
  if (unmatchedTargets.length === 0) {
    return {};
  }

  return {
    unmatched_count: countUnmatchedContracts(unmatchedTargets),
    unmatched_author_names: unmatchedTargets.map((target) => target.author_name)
  };
}

async function logReminderFailure(input: {
  requestId: string;
  actor: ReminderActor;
  status: number;
  message: string;
  errorCode: 'unauthenticated' | 'forbidden' | 'validation' | 'internal_error';
  unmatchedTargets?: ContractReminderUnmatchedTarget[];
}) {
  await recordActivityLog({
    requestId: input.requestId,
    actorUserId: input.actor.actorUserId,
    actorEmail: input.actor.actorEmail,
    actorDisplayName: input.actor.actorDisplayName,
    action: 'contract.reminder_failed',
    targetType: 'contract',
    targetUserId: null,
    targetLabel: contractTargetLabel({ id: 'reminders' }),
    httpMethod: 'POST',
    httpPath: HTTP_PATH,
    httpStatus: input.status,
    metadata: buildErrorMetadata(input.errorCode, input.message, buildUnmatchedMetadata(input.unmatchedTargets ?? []))
  });
}

async function logReminderRecipient(input: {
  requestId: string;
  actor: ReminderActor;
  group: ContractReminderRecipientGroup;
  result: ContractReminderRecipientResult;
}) {
  await recordActivityLog({
    requestId: input.requestId,
    actorUserId: input.actor.actorUserId,
    actorEmail: input.actor.actorEmail,
    actorDisplayName: input.actor.actorDisplayName,
    action: input.result.status === 'sent' ? 'contract.reminder_send' : 'contract.reminder_failed',
    targetType: 'contract',
    targetUserId: null,
    targetLabel: input.group.recipient_email,
    httpMethod: 'POST',
    httpPath: HTTP_PATH,
    httpStatus: 200,
    metadata:
      input.result.status === 'sent'
        ? {
            recipient_email: input.group.recipient_email,
            missing_document_numbers: input.group.document_numbers,
            status: 'sent'
          }
        : buildErrorMetadata('internal_error', input.result.error_message ?? '독촉 메일 발송에 실패했습니다.', {
            recipient_email: input.group.recipient_email,
            missing_document_numbers: input.group.document_numbers
          })
  });
}

async function logReminderRunSummary(input: {
  requestId: string;
  actor: ReminderActor;
  unmatchedTargets: ContractReminderUnmatchedTarget[];
  status: 'completed' | 'partial_failed' | 'failed';
}) {
  await recordActivityLog({
    requestId: input.requestId,
    actorUserId: input.actor.actorUserId,
    actorEmail: input.actor.actorEmail,
    actorDisplayName: input.actor.actorDisplayName,
    action: 'contract.reminder_send',
    targetType: 'contract',
    targetUserId: null,
    targetLabel: contractTargetLabel({ id: 'reminders' }),
    httpMethod: 'POST',
    httpPath: HTTP_PATH,
    httpStatus: 200,
    metadata: {
      status: input.status,
      ...buildUnmatchedMetadata(input.unmatchedTargets)
    }
  });
}

async function resolveReminderActor(request: NextRequest, requestId: string): Promise<ReminderActor | NextResponse> {
  const cronToken = getReminderCronToken(request);
  if (cronToken !== null) {
    if (!isValidReminderCronToken(cronToken)) {
      const response = NextResponse.json(
        { success: false, message: '유효한 계약 독촉 cron secret이 필요합니다.' },
        { status: 401 }
      );
      const actor = { ...reminderCronActor(), triggerSource: 'cron' as const };
      await logReminderFailure({
        requestId,
        actor,
        status: 401,
        message: '유효한 계약 독촉 cron secret이 필요합니다.',
        errorCode: 'unauthenticated'
      });
      return withRequestId(response, requestId);
    }

    return { ...reminderCronActor(), triggerSource: 'cron' as const };
  }

  const session = await requireAdminSession();
  if (!session.ok) {
    return logContractAuthFailure({
      requestId,
      action: 'contract.reminder_failed',
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: contractTargetLabel({ id: 'reminders' }),
      response: session.response
    });
  }

  return { ...actorFromProfile(session.profile), triggerSource: 'admin' as const };
}

export async function POST(request: NextRequest) {
  const requestId = newContractRequestId();
  const actorOrResponse = await resolveReminderActor(request, requestId);

  if (actorOrResponse instanceof NextResponse) {
    return actorOrResponse;
  }

  const actor = actorOrResponse;
  let body: unknown = {};

  try {
    const text = await request.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    const message = '요청 JSON을 해석할 수 없습니다.';
    await logReminderFailure({
      requestId,
      actor,
      status: 400,
      message,
      errorCode: 'validation'
    });
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  const runKey = getRunKeyFromBody(body);

  try {
    const existingRun = await getContractReminderRunByKey(runKey);
    if (existingRun) {
      await recordActivityLog({
        requestId,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        actorDisplayName: actor.actorDisplayName,
        action: 'contract.reminder_send',
        targetType: 'contract',
        targetUserId: null,
        targetLabel: contractTargetLabel({ id: 'reminders' }),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        httpStatus: 200,
        metadata: {
          status: 'duplicate_run',
          message: '이미 실행된 독촉 run입니다.',
          ...buildUnmatchedMetadata(existingRun.unmatched_targets)
        }
      });

      return withRequestId(
        NextResponse.json({
          success: true,
          message: '이미 실행된 계약서 독촉 run입니다.',
          run: existingRun,
          recipients: [],
          unmatched_targets: existingRun.unmatched_targets
        }),
        requestId
      );
    }

    const scan = await listContractReminderRecipientGroups();
    const { groups, unmatched_targets: unmatchedTargets } = scan;

    if (groups.length === 0 && unmatchedTargets.length === 0) {
      const message = '독촉 대상 계약서가 없습니다.';
      await logReminderFailure({
        requestId,
        actor,
        status: 400,
        message,
        errorCode: 'validation'
      });
      return withRequestId(
        NextResponse.json(
          { success: false, message, run: null, recipients: [], unmatched_targets: [] },
          { status: 400 }
        ),
        requestId
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

      await logReminderRecipient({ requestId, actor, group, result });
      recipients.push(result);
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

    if (groups.length === 0 || unmatchedTargets.length > 0) {
      await logReminderRunSummary({
        requestId,
        actor,
        unmatchedTargets,
        status: runStatus
      });
    }

    return withRequestId(
      NextResponse.json({
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
      }),
      requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 독촉 실행 중 오류가 발생했습니다.';
    await logReminderFailure({
      requestId,
      actor,
      status: 500,
      message,
      errorCode: 'internal_error'
    });
    return withRequestId(
      NextResponse.json(
        { success: false, message, run: null, recipients: [], unmatched_targets: [] },
        { status: 500 }
      ),
      requestId
    );
  }
}
