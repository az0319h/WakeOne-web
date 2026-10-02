import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: '비밀번호 재설정은 종료되었습니다. Google 로그인을 사용해 주세요.'
    },
    { status: 410 }
  );
}
