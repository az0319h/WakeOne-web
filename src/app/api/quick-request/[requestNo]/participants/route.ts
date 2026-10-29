import { after, NextResponse } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canManageQuickRequestParticipants } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import { resolveChatAuthorName } from '@/features/quick-request/api/messages.server';
import {
  notifyQuickRequestParticipantEvent,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import {
  buildQuickRequestParticipantsData,
  inviteQuickRequestParticipant
} from '@/features/quick-request/api/participants.server';
import { getQuickRequestByNo, resolveQuickRequestAccess } from '@/features/quick-request/api/workflow.server';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import {
  parseQuickChatParticipantUserId,
  QUICK_CHAT_PARTICIPANT_MESSAGES,
  quickChatInviteBodySchema
} from '@/features/quick-request/schemas/quick-request-participant';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  parseQuickRequestNoParam,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody
} from '../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.participant_add' as const;

/**
 * plan 101 — Read: 참여자 목록(요청자 → 동방 → 글 쓴 admin → 초대 참여자) + 이벤트(시각순). activity log Out.
 * 조회 권한(요청자·viewer-all·활성 참여자) 없음·미존재는 같은 404. `GET …/messages`에도 같은 shape가 동봉되므로 FE 1차는 쓰지 않는다.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
  }

  try {
    const row = await getQuickRequestByNo(requestNo);
    const access = row ? await resolveQuickRequestAccess(session.profile, row) : null;
    if (!row || !access?.canView) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    const data = await buildQuickRequestParticipantsData(row);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/participants] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}

/**
 * plan 101 D-1·D-2(r1)·D-3 — 초대 `{ userId }`. 권한 = 요청자 본인·admin(동방·구매물류·참여자 403).
 * 후보 검증은 서버에서(D-2 r1): admin·동방·pending/inactive·요청자·본인 → 400 「초대할 수 없는 사용자입니다.」 · 사용자 없음 404
 * · 활성 참여 중 409 「이미 참여 중입니다.」 · 제외된 행은 같은 행 복구(removed_at null · invited_at 갱신).
 * 알림(D-6 ①)은 201을 돌려준 뒤 `after()`에서 1건(초대받은 사람).
 *
 * return 매트릭스(모두 logger.respond → activity log + x-request-id · action `quick_request.participant_add`):
 *   401/403/500(session) · 404(형식·미존재·조회 불가) · 500(조회) · 403(권한) · 400(JSON) · 400(zod) · 404(userId 형식) · 404(사용자 없음)
 *   · 400(후보 아님) · 409(이미 참여) · 500(저장) · 201
 * metadata: quick_request_no · participant_user_id · error_code (이름·이메일은 남기지 않는다)
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/participants`;
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: rawRequestNo,
      httpMethod: 'POST',
      httpPath,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: ACTION,
    httpMethod: 'POST',
    httpPath,
    profile,
    defaultTargetLabel: rawRequestNo
  });

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo } = loaded;

  if (!canManageQuickRequestParticipants(profile, row)) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.forbidden), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', QUICK_CHAT_PARTICIPANT_MESSAGES.forbidden))
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickChatInviteBodySchema.safeParse(json.body);
  if (!parsed.success) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody))
    });
  }

  // uuid 형식이 아니면 「사용자를 찾을 수 없습니다.」 404 (AC-07 `zzz`)
  const userId = parseQuickChatParticipantUserId(parsed.data.userId);
  if (!userId) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.userNotFound), 404, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('not_found', undefined, { attempted_target: parsed.data.userId.slice(0, 100) })
      )
    });
  }
  const metadataBase = { participant_user_id: userId };

  let result;
  try {
    result = await inviteQuickRequestParticipant({ row, actorUserId: profile.user_id, userId });
  } catch (error) {
    console.error('[quick-request/participants] invite failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.inviteFailed), 500, {
      targetLabel: requestNo,
      targetUserId: userId,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error', undefined, metadataBase))
    });
  }

  if (!result.ok) {
    if (result.reason === 'user_not_found') {
      return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.userNotFound), 404, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, metadataBase))
      });
    }
    if (result.reason === 'already_participant') {
      return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.alreadyParticipant), 409, {
        targetLabel: requestNo,
        targetUserId: userId,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('conflict', QUICK_CHAT_PARTICIPANT_MESSAGES.alreadyParticipant, metadataBase)
        )
      });
    }
    // not_invitable — admin·동방·pending·요청자·본인 (D-2 r1 · AC-06 ② · AC-07)
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.notInvitable), 400, {
      targetLabel: requestNo,
      targetUserId: userId,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('validation', QUICK_CHAT_PARTICIPANT_MESSAGES.notInvitable, metadataBase)
      )
    });
  }

  const actorName = resolveChatAuthorName(profile);
  after(() =>
    safeNotify('participant_invited', () =>
      notifyQuickRequestParticipantEvent({
        row,
        event: 'participant_invited',
        recipientUserId: userId,
        actorUserId: profile.user_id,
        actorName
      })
    )
  );

  return logger.respond({ success: true, data: { participant: result.participant } }, 201, {
    targetLabel: requestNo,
    targetUserId: userId,
    metadata: quickLogMetadata(requestNo, { ...metadataBase, created: !result.recovered })
  });
}
