import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import {
  createBulkDownloadZipResponse,
  parseBulkDownloadDateRange
} from '@/features/contracts/api/bulk-download.server';

function getDateParam(searchParams: URLSearchParams, key: 'from' | 'to'): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = request.nextUrl;
  const parsed = parseBulkDownloadDateRange(
    getDateParam(searchParams, 'from'),
    getDateParam(searchParams, 'to')
  );

  if ('error' in parsed) {
    return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
  }

  try {
    return await createBulkDownloadZipResponse(parsed.from, parsed.to);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '첨부 ZIP 다운로드 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
