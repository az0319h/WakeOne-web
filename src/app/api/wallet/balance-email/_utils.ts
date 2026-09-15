import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction } from '@/features/activity-logs/api/types';

export type WalletBalanceEmailAction = Extract<ActivityAction, `wallet.balance_email${string}`>;

export function newWalletBalanceEmailRequestId() {
  return createRequestId();
}

export function getWalletBalanceEmailCronToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-wallet-balance-email-token')?.trim() || null;
}

export function getWalletBalanceEmailCronSecret(): string | undefined {
  return process.env.WALLET_BALANCE_EMAIL_CRON_SECRET ?? process.env.CRON_SECRET;
}

export function isValidWalletBalanceEmailCronToken(token: string | null): boolean {
  const expected = getWalletBalanceEmailCronSecret();
  return Boolean(expected && token && token === expected);
}

export function walletBalanceEmailCronActor() {
  return {
    actorUserId: null,
    actorEmail: 'wallet-balance-email-cron',
    actorDisplayName: 'Wallet Balance Email Cron'
  };
}

export async function logWalletBalanceEmailAuthFailure(input: {
  requestId: string;
  action: WalletBalanceEmailAction;
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
      targetType: 'wallet',
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

export function truncateErrorMessage(message: string): string {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}
