import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { hasMustChangeInitialPasswordCookieFromRequest } from '@/lib/auth/must-change-cookie';

export const MUST_CHANGE_API_JSON = {
  success: false,
  message: '초기 비밀번호를 변경해야 합니다.'
} as const;

export function isMustChangeAllowedApiPath(pathname: string, method: string): boolean {
  if (pathname === '/api/auth/sign-in' && method === 'POST') {
    return true;
  }

  if (pathname === '/api/auth/force-password-change' && method === 'PATCH') {
    return true;
  }

  return false;
}

export function getMustChangeApiBlockResponse(request: NextRequest): NextResponse | null {
  if (
    !hasMustChangeInitialPasswordCookieFromRequest(request) ||
    isMustChangeAllowedApiPath(request.nextUrl.pathname, request.method)
  ) {
    return null;
  }

  return NextResponse.json(MUST_CHANGE_API_JSON, { status: 403 });
}
