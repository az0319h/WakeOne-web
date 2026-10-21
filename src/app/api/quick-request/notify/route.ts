import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { quickRequestNotifyBodySchema } from '@/features/quick-request/schemas/quick-request-notify';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const session = await requireSession();

  if (!session.ok) {
    return NextResponse.json(
      { success: false, message: '인증이 필요합니다.' },
      { status: 401, headers: { 'x-request-id': requestId } }
    );
  }

  if (session.profile.status !== 'active') {
    return NextResponse.json(
      { success: false, message: '활성화된 계정만 접근할 수 있습니다.' },
      { status: 403, headers: { 'x-request-id': requestId } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    );
  }

  const parsed = quickRequestNotifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: '필수 항목을 확인해 주세요.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    );
  }

  // Phase 2: proxy to user-provided Kakao / open-chat API
  return NextResponse.json(
    {
      success: false,
      message: '카톡 API 연동 후 자동 전송됩니다.'
    },
    { status: 501, headers: { 'x-request-id': requestId } }
  );
}
