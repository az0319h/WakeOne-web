import { NextResponse } from 'next/server';
import { canManageQuickRequestParticipants } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import { listQuickRequestParticipantCandidates } from '@/features/quick-request/api/participants.server';
import { getQuickRequestByNo, resolveQuickRequestAccess } from '@/features/quick-request/api/workflow.server';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import {
  QUICK_CHAT_CANDIDATE_QUERY_MAX_LENGTH,
  QUICK_CHAT_PARTICIPANT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-participant';
import { parseQuickRequestNoParam, quickErrorBody } from '../../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

/**
 * plan 101 D-2(r1) — 초대 후보 검색 `?q=` (Read · activity log Out).
 * 권한 = 요청자 본인·admin (동방·구매물류·참여자 403 「참여자를 추가할 권한이 없습니다.」 · AC-08).
 * 서버 제외: pending/inactive · 동방(`applyDongbangScope`) · admin · 요청자 · 본인 · 활성 참여 중. 이름·이메일 부분 일치 ≤ 20 · `q` 빈 값은 `[]`.
 * 응답은 이름·이메일·소속 라벨만(연락처 없음). 조회 불가·미존재는 같은 404.
 */
export async function GET(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
  }

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, QUICK_CHAT_CANDIDATE_QUERY_MAX_LENGTH);

  try {
    const row = await getQuickRequestByNo(requestNo);
    const access = row ? await resolveQuickRequestAccess(session.profile, row) : null;
    if (!row || !access?.canView) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    if (!canManageQuickRequestParticipants(session.profile, row)) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.forbidden), { status: 403 });
    }

    const candidates = await listQuickRequestParticipantCandidates({ row, actorUserId: session.profile.user_id, q });
    return NextResponse.json({ success: true, data: { candidates } });
  } catch (error) {
    console.error('[quick-request/participants/candidates] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
