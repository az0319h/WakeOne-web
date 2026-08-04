import { NextRequest, NextResponse } from 'next/server';
import { recordActivityLog, withRequestId } from '@/features/activity-logs/api/log.server';
import {
  getWalletSyncToken,
  isValidWalletSyncToken,
  newWalletRequestId,
  walletSyncActor,
  walletSyncTargetLabel
} from '@/features/wallet/api/_utils';
import { syncWalletLimits } from '@/features/wallet/api/service.server';
import { walletSyncSchema } from '@/features/wallet/api/validators';

const HTTP_PATH = '/api/wallet/sync';

export async function POST(request: NextRequest) {
  const requestId = newWalletRequestId();

  if (!isValidWalletSyncToken(getWalletSyncToken(request))) {
    const message = '유효한 지갑 sync token이 필요합니다.';
    return withRequestId(NextResponse.json({ success: false, message }, { status: 401 }), requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const message = '요청 JSON을 해석할 수 없습니다.';
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  const parsed = walletSyncSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
    return withRequestId(NextResponse.json({ success: false, message }, { status: 400 }), requestId);
  }

  try {
    const result = await syncWalletLimits(parsed.data, requestId);
    const total = parsed.data.items.length;
    const message =
      result.unmatched.length > 0
        ? `한도 ${result.matched}건 반영, ${result.unmatched.length}건은 사용자 매칭 실패`
        : `한도 ${result.matched}건이 반영되었습니다.`;

    await recordActivityLog({
      requestId,
      ...walletSyncActor(),
      action: 'wallet.sync_create',
      targetType: 'wallet',
      targetUserId: null,
      targetLabel: walletSyncTargetLabel(result.matched, total),
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      httpStatus: 200,
      metadata: {
        status: 'success',
        count: result.matched,
        unmatched_count: result.unmatched.length,
        unmatched_author_names: result.unmatched
      }
    });

    return withRequestId(
      NextResponse.json({ success: true, message, ...result }, { status: 200 }),
      requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '지갑 동기화 중 오류가 발생했습니다.';

    await recordActivityLog({
      requestId,
      ...walletSyncActor(),
      action: 'wallet.sync_failed',
      targetType: 'wallet',
      targetUserId: null,
      targetLabel: walletSyncTargetLabel(0, parsed.data.items.length),
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      httpStatus: 500,
      metadata: {
        error_code: 'internal_error',
        message
      }
    });

    return withRequestId(NextResponse.json({ success: false, message }, { status: 500 }), requestId);
  }
}
