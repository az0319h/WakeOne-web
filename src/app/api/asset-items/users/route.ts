import { NextResponse } from 'next/server';
import { requireAssetLedgerSession } from '@/features/auth/api/session.server';
import {
  listAssetLedgerUsageLocations,
  listAssetLedgerUsers
} from '@/features/asset-ledger/api/service.server';

export async function GET() {
  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const [users, usageLocations] = await Promise.all([
      listAssetLedgerUsers(),
      listAssetLedgerUsageLocations()
    ]);
    return NextResponse.json({
      success: true,
      message: '실사용자 목록을 불러왔습니다.',
      users,
      usageLocations
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '실사용자 목록 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
