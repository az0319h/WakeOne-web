import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/features/auth/api/session.server";
import {
  getMyBenefits,
  resolveBenefitsTargetUserId,
} from "@/features/benefits/api/service.server";
import { resolveBenefitsViewMonth } from "@/features/benefits/lib/benefits-view-month";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const isAdmin = session.profile.system_role === "admin";
  const requestedUser = isAdmin ? (request.nextUrl.searchParams.get("user") ?? "self") : null;
  const targetUserId = resolveBenefitsTargetUserId(
    session.userId,
    isAdmin,
    requestedUser,
  );

  const month = resolveBenefitsViewMonth(request.nextUrl.searchParams.get("month"));
  try {
    const data = await getMyBenefits(targetUserId, month);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "내 복지비를 조회하지 못했습니다.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
