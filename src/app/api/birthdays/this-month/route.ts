import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getBirthdayCelebrantsServer } from '@/features/birthday-celebrants/api/service.server';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const data = await getBirthdayCelebrantsServer();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: '생일자 목록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
