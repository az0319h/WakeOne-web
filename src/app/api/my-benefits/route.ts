import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/features/auth/api/session.server";
import { getMyBenefits } from "@/features/benefits/api/service.server";

export async function GET(request: NextRequest) {
  const session = await requireUserSession();
  if (!session.ok) return session.response;

  const month = request.nextUrl.searchParams.get("month") ?? "";
  try {
    const data = await getMyBenefits(session.userId, month);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "내 복지비를 조회하지 못했습니다.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
