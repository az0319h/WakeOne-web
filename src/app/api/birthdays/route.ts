import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getBirthdayCelebrantsServer } from '@/features/birthday-celebrants/api/service.server';

/**
 * plan 102 — overview 생일 휠 목록 (회사 전체 · 조회 전용 · activity log 해당 없음).
 * 로그인 사용자 전원 동일 목록. 동방특송은 proxy allowlist 미등록으로 403(plan 95).
 * 옛 31일 창 조회 Route(`/api/birthdays/` 하위 경로)는 삭제했다(alias 없음 → 404).
 */
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
