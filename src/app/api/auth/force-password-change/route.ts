import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      message: '초기 비밀번호 변경 흐름은 종료되었습니다. Google 로그인을 사용해 주세요.'
    },
    { status: 410 }
  );
}
