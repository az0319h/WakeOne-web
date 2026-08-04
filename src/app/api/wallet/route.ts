import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getWalletSummaryServer } from '@/features/wallet/api/service.server';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const isAdmin = session.profile.system_role === 'admin';
  const requestedUser = request.nextUrl.searchParams.get('user');

  const data = await getWalletSummaryServer(session.userId, isAdmin, requestedUser);

  return NextResponse.json({ success: true, data });
}
