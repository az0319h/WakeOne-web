import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  AFFILIATIONS,
  type Affiliation
} from '@/features/users/constants/organization';
import { getOrgChartResponse } from '@/features/org-chart/api/service.server';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const affiliationRaw = request.nextUrl.searchParams.get('affiliation');
  const parsed = AFFILIATIONS.includes(affiliationRaw as Affiliation);

  if (!affiliationRaw || !parsed) {
    return NextResponse.json(
      { success: false, message: '소속(affiliation) 파라미터가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const affiliation = affiliationRaw as Affiliation;

  try {
    const response = await getOrgChartResponse(affiliation);
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '조직도를 불러오지 못했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
