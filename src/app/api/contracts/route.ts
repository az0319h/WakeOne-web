import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { listContracts } from '@/features/contracts/api/service.server';
import type { ContractFilters } from '@/features/contracts/api/types';

function getSingleSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
  const values = searchParams.getAll(key).map((value) => value.trim()).filter(Boolean);
  return values.at(-1);
}

function getAttachmentStatus(searchParams: URLSearchParams): ContractFilters['attachment_status'] {
  const value = getSingleSearchParam(searchParams, 'attachment_status');
  if (
    value === 'missing' ||
    value === 'has_attachment' ||
    value === 'no_attachment_required' ||
    value === 'soft_deleted'
  ) {
    return value;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const result = await listContracts({
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 10),
      from: getSingleSearchParam(searchParams, 'from'),
      to: getSingleSearchParam(searchParams, 'to'),
      search: getSingleSearchParam(searchParams, 'search'),
      attachment_status: getAttachmentStatus(searchParams),
      sort: getSingleSearchParam(searchParams, 'sort')
    });

    return NextResponse.json({
      success: true,
      message: '계약서 목록을 불러왔습니다.',
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '계약서 목록 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
