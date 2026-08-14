import { NextRequest, NextResponse } from 'next/server';
import { requireUserSession } from '@/features/auth/api/session.server';
import { getMyContractById } from '@/features/contracts/api/service.server';
import { parseContractId } from '../_utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireUserSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseContractId(id);
  if (!parsedId) {
    return NextResponse.json({ success: false, message: '계약서 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const access = await getMyContractById(parsedId, session.profile.full_name ?? '');
    if (!access.ok) {
      if (access.reason === 'not_found') {
        return NextResponse.json({ success: false, message: '계약서를 찾을 수 없습니다.' }, { status: 404 });
      }

      return NextResponse.json(
        { success: false, message: '본인 작성 계약서만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '내 계약서 상세를 불러왔습니다.',
      contract: access.contract
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '내 계약서 상세 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
