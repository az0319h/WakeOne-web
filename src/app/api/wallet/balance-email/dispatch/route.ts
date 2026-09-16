import { NextRequest, NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  jsonWithActivityLog,
  recordActivityLog,
  withRequestId
} from '@/features/activity-logs/api/log.server';
import { insertWalletBalanceEmailNotification } from '@/features/notifications/api/fan-out.server';
import { shouldSendToEmail } from '@/features/wallet/api/balance-email-mail.server';
import type { WalletBalanceEmailDueUser } from '@/features/wallet/api/balance-email.types';
import {
  buildWalletBalanceEmailRunKey,
  createWalletBalanceEmailRun,
  finishWalletBalanceEmailRun,
  getKstDateParts,
  getWalletBalanceEmailRunByKey,
  isKstWeekend,
  listDueWalletBalanceEmailUsers,
  listWalletBalanceEmailRecipientsByRunId,
  recordWalletBalanceEmailRecipient
} from '@/features/wallet/api/balance-email.service.server';
import { sendWalletBalanceEmail } from '@/lib/mail/send-wallet-balance-email';
import {
  getAppBaseUrl,
  getWalletBalanceEmailCronToken,
  isValidWalletBalanceEmailCronToken,
  newWalletBalanceEmailRequestId,
  truncateErrorMessage,
  walletBalanceEmailCronActor
} from '../_utils';

const HTTP_PATH = '/api/wallet/balance-email/dispatch';
const HTTP_METHOD = 'POST';

type DispatchActor = ReturnType<typeof walletBalanceEmailCronActor>;

function runTargetLabel(runKey: string): string {
  return `run:${runKey}`;
}

async function resolveDispatchActor(
  request: NextRequest,
  requestId: string,
  runKey: string
): Promise<DispatchActor | NextResponse> {
  const cronToken = getWalletBalanceEmailCronToken(request);

  if (cronToken === null) {
    return jsonWithActivityLog(
      requestId,
      {
        ...walletBalanceEmailCronActor(),
        action: 'wallet.balance_email_dispatch',
        targetType: 'wallet',
        targetUserId: null,
        targetLabel: runTargetLabel(runKey),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('unauthenticated', 'Cron secret이 필요합니다.')
      },
      { success: false, message: 'Cron secret이 필요합니다.' },
      401
    );
  }

  if (!isValidWalletBalanceEmailCronToken(cronToken)) {
    return jsonWithActivityLog(
      requestId,
      {
        ...walletBalanceEmailCronActor(),
        action: 'wallet.balance_email_dispatch',
        targetType: 'wallet',
        targetUserId: null,
        targetLabel: runTargetLabel(runKey),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('unauthenticated', '유효한 wallet balance email cron secret이 필요합니다.')
      },
      { success: false, message: '유효한 wallet balance email cron secret이 필요합니다.' },
      401
    );
  }

  return walletBalanceEmailCronActor();
}

type DispatchRunCounts = {
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
};

function resolveRunStatus(counts: DispatchRunCounts, dueUserCount: number) {
  const actionableCount = counts.sentCount + counts.failedCount + counts.blockedCount;

  if (dueUserCount === 0) {
    return 'completed' as const;
  }

  if (actionableCount === 0) {
    return 'completed' as const;
  }

  if (counts.failedCount === 0) {
    return 'completed' as const;
  }

  return counts.sentCount > 0 ? ('partial_failed' as const) : ('failed' as const);
}

async function processWalletBalanceEmailDueUsers(input: {
  requestId: string;
  actor: DispatchActor;
  runId: number;
  dueUsers: WalletBalanceEmailDueUser[];
  kstWeekday: number;
  walletUrl: string;
  settingsUrl: string;
}): Promise<DispatchRunCounts> {
  const counts: DispatchRunCounts = {
    sentCount: 0,
    failedCount: 0,
    blockedCount: 0,
    skippedCount: 0
  };

  for (const user of input.dueUsers) {
    if (user.exclude_weekends && isKstWeekend(input.kstWeekday)) {
      counts.skippedCount += 1;
      await recordWalletBalanceEmailRecipient({
        runId: input.runId,
        userId: user.user_id,
        recipientEmail: user.email,
        status: 'skipped',
        errorMessage: 'skipped_weekend'
      });
      continue;
    }

    const sendDecision = shouldSendToEmail(user.email);
    if (sendDecision === 'blocked') {
      counts.blockedCount += 1;
      await recordWalletBalanceEmailRecipient({
        runId: input.runId,
        userId: user.user_id,
        recipientEmail: user.email,
        status: 'blocked',
        errorMessage: 'allowlist_blocked'
      });
      await recordRecipientOutcomeLog({
        requestId: input.requestId,
        actor: input.actor,
        user,
        action: 'wallet.balance_email_blocked',
        runId: input.runId,
        recipientStatus: 'blocked'
      });
      continue;
    }

    try {
      await sendWalletBalanceEmail({
        to: user.email,
        monthlyLimit: user.monthly_limit,
        monthlyRemaining: user.monthly_remaining,
        syncedAt: user.synced_at,
        walletUrl: input.walletUrl,
        settingsUrl: input.settingsUrl
      });

      let notificationId: number | null = null;
      try {
        notificationId = await insertWalletBalanceEmailNotification({
          recipientUserId: user.user_id,
          runId: input.runId
        });
      } catch (notificationError) {
        const message =
          notificationError instanceof Error
            ? notificationError.message
            : '인앱 알림 생성에 실패했습니다.';
        console.error('[wallet-balance-email] notification fan-out failed:', message);
      }

      counts.sentCount += 1;
      await recordWalletBalanceEmailRecipient({
        runId: input.runId,
        userId: user.user_id,
        recipientEmail: user.email,
        status: 'sent',
        notificationId
      });
      await recordRecipientOutcomeLog({
        requestId: input.requestId,
        actor: input.actor,
        user,
        action: 'wallet.balance_email_send',
        runId: input.runId,
        recipientStatus: sendDecision === 'dry_run' ? 'sent_dry_run' : 'sent'
      });
    } catch (error) {
      const message = truncateErrorMessage(
        error instanceof Error ? error.message : '식대 잔액 이메일 발송에 실패했습니다.'
      );
      counts.failedCount += 1;
      await recordWalletBalanceEmailRecipient({
        runId: input.runId,
        userId: user.user_id,
        recipientEmail: user.email,
        status: 'failed',
        errorMessage: message
      });
      await recordRecipientOutcomeLog({
        requestId: input.requestId,
        actor: input.actor,
        user,
        action: 'wallet.balance_email_failed',
        runId: input.runId,
        recipientStatus: 'failed',
        errorMessage: message
      });
    }
  }

  return counts;
}

async function recordRecipientOutcomeLog(input: {
  requestId: string;
  actor: DispatchActor;
  user: WalletBalanceEmailDueUser;
  action: 'wallet.balance_email_send' | 'wallet.balance_email_failed' | 'wallet.balance_email_blocked';
  runId: number;
  recipientStatus: string;
  errorMessage?: string;
}): Promise<void> {
  await recordActivityLog({
    requestId: input.requestId,
    actorUserId: input.actor.actorUserId,
    actorEmail: input.actor.actorEmail,
    actorDisplayName: input.actor.actorDisplayName,
    action: input.action,
    targetType: 'wallet',
    targetUserId: input.user.user_id,
    targetLabel: input.user.email,
    httpMethod: HTTP_METHOD,
    httpPath: HTTP_PATH,
    httpStatus: 200,
    metadata: {
      recipient_email: input.user.email,
      run_id: input.runId,
      recipient_status: input.recipientStatus,
      ...(input.errorMessage
        ? buildErrorMetadata('internal_error', input.errorMessage)
        : {})
    }
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const requestId = newWalletBalanceEmailRequestId();
  const kstParts = getKstDateParts();
  const runKey = buildWalletBalanceEmailRunKey(kstParts);

  const actorOrResponse = await resolveDispatchActor(request, requestId, runKey);
  if (actorOrResponse instanceof NextResponse) {
    return actorOrResponse;
  }

  const actor = actorOrResponse;

  try {
    const baseUrl = getAppBaseUrl();
    const walletUrl = `${baseUrl}/dashboard/wallet`;
    const settingsUrl = `${baseUrl}/dashboard/wallet#wallet-balance-email-settings`;
    const dueUsers = await listDueWalletBalanceEmailUsers(kstParts.hour, kstParts.minute);

    if (dueUsers.length === 0) {
      return withRequestId(
        NextResponse.json({
          success: true,
          message: '발송 대상 사용자가 없습니다.',
          run: null,
          recipients: []
        }),
        requestId
      );
    }

    const existingRun = await getWalletBalanceEmailRunByKey(runKey);

    if (existingRun) {
      const existingRecipients = await listWalletBalanceEmailRecipientsByRunId(existingRun.id);
      const processedUserIds = new Set(existingRecipients.map((recipient) => recipient.user_id));
      const pendingUsers = dueUsers.filter((user) => !processedUserIds.has(user.user_id));

      if (pendingUsers.length === 0) {
        return withRequestId(
          NextResponse.json({
            success: true,
            message: '이미 실행된 식대 잔액 이메일 run입니다.',
            run: existingRun,
            recipients: []
          }),
          requestId
        );
      }

      const pendingCounts = await processWalletBalanceEmailDueUsers({
        requestId,
        actor,
        runId: existingRun.id,
        dueUsers: pendingUsers,
        kstWeekday: kstParts.weekday,
        walletUrl,
        settingsUrl
      });

      const totalCounts: DispatchRunCounts = {
        sentCount: existingRun.sent_count + pendingCounts.sentCount,
        failedCount: existingRun.failed_count + pendingCounts.failedCount,
        blockedCount: existingRun.blocked_count + pendingCounts.blockedCount,
        skippedCount: existingRun.skipped_count + pendingCounts.skippedCount
      };
      const runStatus = resolveRunStatus(totalCounts, dueUsers.length);
      const finishedRun = await finishWalletBalanceEmailRun({
        runId: existingRun.id,
        status: runStatus,
        sentCount: totalCounts.sentCount,
        failedCount: totalCounts.failedCount,
        blockedCount: totalCounts.blockedCount,
        skippedCount: totalCounts.skippedCount
      });

      await recordActivityLog({
        requestId,
        ...actor,
        action: 'wallet.balance_email_dispatch',
        targetType: 'wallet',
        targetUserId: null,
        targetLabel: runTargetLabel(runKey),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        httpStatus: 200,
        metadata: {
          catch_up_run: true,
          run_id: finishedRun.id,
          pending_count: pendingUsers.length,
          due_count: dueUsers.length,
          sent_count: totalCounts.sentCount,
          failed_count: totalCounts.failedCount,
          blocked_count: totalCounts.blockedCount,
          skipped_count: totalCounts.skippedCount,
          status: runStatus
        }
      });

      const allRecipients = await listWalletBalanceEmailRecipientsByRunId(finishedRun.id);
      const pendingUserIds = new Set(pendingUsers.map((user) => user.user_id));

      return withRequestId(
        NextResponse.json({
          success: pendingCounts.failedCount === 0,
          message:
            pendingCounts.failedCount === 0
              ? '식대 잔액 안내 이메일 dispatch를 완료했습니다.'
              : '식대 잔액 안내 이메일 일부 발송에 실패했습니다.',
          run: finishedRun,
          recipients: allRecipients.filter((recipient) => pendingUserIds.has(recipient.user_id))
        }),
        requestId
      );
    }

    const run = await createWalletBalanceEmailRun({
      requestId,
      runKey,
      triggerSource: 'cron',
      dueCount: dueUsers.length
    });

    const counts = await processWalletBalanceEmailDueUsers({
      requestId,
      actor,
      runId: run.id,
      dueUsers,
      kstWeekday: kstParts.weekday,
      walletUrl,
      settingsUrl
    });

    const runStatus = resolveRunStatus(counts, dueUsers.length);
    const finishedRun = await finishWalletBalanceEmailRun({
      runId: run.id,
      status: runStatus,
      sentCount: counts.sentCount,
      failedCount: counts.failedCount,
      blockedCount: counts.blockedCount,
      skippedCount: counts.skippedCount
    });

    await recordActivityLog({
      requestId,
      ...actor,
      action: 'wallet.balance_email_dispatch',
      targetType: 'wallet',
      targetUserId: null,
      targetLabel: runTargetLabel(runKey),
      httpMethod: HTTP_METHOD,
      httpPath: HTTP_PATH,
      httpStatus: 200,
      metadata: {
        run_id: finishedRun.id,
        due_count: dueUsers.length,
        sent_count: counts.sentCount,
        failed_count: counts.failedCount,
        blocked_count: counts.blockedCount,
        skipped_count: counts.skippedCount,
        status: runStatus
      }
    });

    return withRequestId(
      NextResponse.json({
        success: counts.failedCount === 0,
        message:
          counts.failedCount === 0
            ? '식대 잔액 안내 이메일 dispatch를 완료했습니다.'
            : '식대 잔액 안내 이메일 일부 발송에 실패했습니다.',
        run: finishedRun,
        recipients: await listWalletBalanceEmailRecipientsByRunId(finishedRun.id)
      }),
      requestId
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '식대 잔액 이메일 dispatch 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'wallet.balance_email_dispatch',
        targetType: 'wallet',
        targetUserId: null,
        targetLabel: runTargetLabel(runKey),
        httpMethod: HTTP_METHOD,
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message, run: null, recipients: [] },
      500
    );
  }
}
