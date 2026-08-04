import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { WALLET_SYNCS_PAGE_SIZE } from '@/features/wallet/api/keys';
import { listWalletSyncs } from '@/features/wallet/api/service.server';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const isAdmin = session.profile.system_role === 'admin';
    const limit = Number(searchParams.get('limit') ?? WALLET_SYNCS_PAGE_SIZE);
    const cursor = searchParams.get('cursor') ?? undefined;
    const user = isAdmin ? (searchParams.get('user') ?? 'self') : undefined;

    const data = await listWalletSyncs(session.userId, isAdmin, { limit, cursor, user });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
