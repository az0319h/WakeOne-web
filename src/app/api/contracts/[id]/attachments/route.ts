import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        '이 엔드포인트는 더 이상 지원되지 않습니다. /attachments/prepare 및 /attachments/complete를 사용하세요.'
    },
    { status: 410 }
  );
}
