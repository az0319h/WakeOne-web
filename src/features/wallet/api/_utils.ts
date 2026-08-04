import { createRequestId } from '@/features/activity-logs/api/log.server';

export function newWalletRequestId(): string {
  return createRequestId();
}

export function getWalletSyncToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-wallet-sync-token')?.trim() || null;
}

export function isValidWalletSyncToken(token: string | null): boolean {
  const expected = process.env.WALLET_SYNC_TOKEN;
  return Boolean(expected && token && token === expected);
}

export function walletSyncActor() {
  return {
    actorUserId: null,
    actorEmail: 'kbcard',
    actorDisplayName: 'KB Card Sync'
  };
}

export function walletSyncTargetLabel(matched: number, total: number): string {
  return `wallet:sync:${matched}/${total}`;
}
