import { NextRequest, NextResponse } from 'next/server';
import { withRequestId } from '@/features/activity-logs/api/log.server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import {
  createContractReminderRun,
  finishContractReminderRun,
  getContractReminderRunByKey,
  listContractReminderRecipientGroups,
  recordContractReminderRecipient
} from '@/features/contracts/api/service.server';
import type { ContractReminderRecipientResult } from '@/features/contracts/api/types';
import { sendContractReminderEmail } from '@/lib/mail/send-contract-reminder-email';
import {
  getReminderCronToken,
  isValidReminderCronToken,
  newContractRequestId
} from '../_utils';

type ReminderActor = {
  actorUserId: string | null;
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

async function resolveReminderActor(request: NextRequest, requestId: string): Promise<ReminderActor | NextResponse> {
  const cronToken = getReminderCronToken(request);
  if (cronToken !== null) {
    if (!isValidReminderCronToken(cronToken)) {
      return withRequestId(
        NextResponse.json(
          { success: false, message: '유효한 계약 독촉 cron secret이 필요합니다.' },
          { status: 401 }
        ),
        requestId
      );
    }

    return { actorUserId: null, triggerSource: 'cron' };
  }

  const session = await requireAdminSession();
  if (!session.ok) {
    return withRequestId(session.response, requestId);
  }

  return { actorUserId: session.profile.user_id, triggerSource: 'admin' };
}

export async function GET(request: NextRequest) {
  return POST(request);
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
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  const runKey = getRunKeyFromBody(body);

  try {
    const existingRun = await getContractReminderRunByKey(runKey);
    if (existingRun) {
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
    return withRequestId(
      NextResponse.json(
        { success: false, message, run: null, recipients: [], unmatched_targets: [] },
        { status: 500 }
      ),
      requestId
    );
  }
}
