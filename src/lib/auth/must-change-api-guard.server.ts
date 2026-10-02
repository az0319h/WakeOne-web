import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

export const MUST_CHANGE_API_JSON = {
  success: false,
  message: '초기 비밀번호 변경 흐름은 종료되었습니다.'
} as const;

export function isMustChangeAllowedApiPath(pathname: string, method: string): boolean {
  return Boolean(pathname && method);
}

export function getMustChangeApiBlockResponse(_request: NextRequest): NextResponse | null {
  return null;
}
