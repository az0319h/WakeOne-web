import { NextResponse } from 'next/server';
import { requireSession } from './session.server';
import type { AuthProfile } from './types';

export type AdminSessionResult =
  | { ok: true; userId: string; profile: AuthProfile }
  | { ok: false; response: NextResponse };

export async function requireAdminSession(): Promise<AdminSessionResult> {
  const session = await requireSession();

  if (!session.ok) {
    return session;
  }

  if (session.profile.system_role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    };
  }

  return { ok: true, userId: session.userId, profile: session.profile };
}
