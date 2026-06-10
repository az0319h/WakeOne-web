import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';

type AssetAction = 'asset.create' | 'asset.update' | 'asset.delete';

type AssetAuthFailureInput = {
  requestId: string;
  action: AssetAction;
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  targetUserId?: string | null;
  response: NextResponse;
};

export async function logAssetAuthFailure(input: AssetAuthFailureInput): Promise<NextResponse> {
  const status = input.response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    input.requestId,
    {
      ...actor,
      action: input.action,
      targetType: 'asset',
      targetUserId: input.targetUserId ?? null,
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

export function newAssetRequestId() {
  return createRequestId();
}

export function assetTargetLabel(input: {
  id?: number | string;
  assetNumber?: string | null;
  assetName?: string | null;
}): string {
  const id = input.id ?? 'unknown';
  const number = input.assetNumber?.trim() || 'unknown';
  const name = input.assetName?.trim() || 'unknown';
  return `asset:${id}:${number}:${name}`;
}
