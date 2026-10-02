import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      message: '비밀번호 변경은 종료되었습니다. Google 계정에서 보안을 관리해 주세요.'
    },
    { status: 410 }
  );
}
