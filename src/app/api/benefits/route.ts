import { NextRequest, NextResponse } from "next/server";
import { requireBenefitsAdminSession } from '@/features/auth/api/session.server';
import { isAffiliation, listBenefitsAdmin } from "@/features/benefits/api/service.server";

export async function GET(request: NextRequest) {
  const session = await requireBenefitsAdminSession();
  if (!session.ok) return session.response;

  const month = request.nextUrl.searchParams.get("month") ?? "";
  const affiliationValue = request.nextUrl.searchParams.get("affiliation");
  const team = request.nextUrl.searchParams.get("team")?.trim() || undefined;
  const name = request.nextUrl.searchParams.get("name")?.trim() || undefined;

  if (affiliationValue && !isAffiliation(affiliationValue)) {
    return NextResponse.json(
      { success: false, message: "소속 필터가 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const affiliation = isAffiliation(affiliationValue) ? affiliationValue : undefined;

  try {
    const data = await listBenefitsAdmin({
      month,
      affiliation,
      team,
      name,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "복지비를 조회하지 못했습니다.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
