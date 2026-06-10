import { NextRequest, NextResponse } from 'next/server';
import { requireAssetLedgerSession } from '@/features/auth/api/session.server';
import { suggestAssetNumber } from '@/features/asset-ledger/api/service.server';
import { assetSuggestNumberSchema } from '@/features/asset-ledger/api/validators';

export async function GET(request: NextRequest) {
  const session = await requireAssetLedgerSession();
  if (!session.ok) {
    return session.response;
  }

  const parsed = assetSuggestNumberSchema.safeParse({
    asset_name: request.nextUrl.searchParams.get('asset_name')
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '자산명 입력값이 올바르지 않습니다.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  try {
    const result = await suggestAssetNumber(parsed.data.asset_name);
    return NextResponse.json({
      success: true,
      message: result.suggested ? '추천 자산번호를 생성했습니다.' : '추천 가능한 접두를 찾지 못했습니다.',
      suggested: result.suggested,
      prefix: result.prefix
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '자산번호 추천 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
