import { NextRequest, NextResponse } from 'next/server';
import { requireUserSession } from '@/features/auth/api/session.server';
import { listMyContracts } from '@/features/contracts/api/service.server';
import type { ContractFilters } from '@/features/contracts/api/types';
import { getSingleSearchParam } from './_utils';

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
  const session = await requireUserSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const result = await listMyContracts(session.profile.full_name ?? '', {
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
      message: '내 계약서 목록을 불러왔습니다.',
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '내 계약서 목록 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
