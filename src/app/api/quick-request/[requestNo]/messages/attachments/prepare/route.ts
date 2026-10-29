import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  prepareQuickChatAttachments,
  QuickChatAttachmentError
} from '@/features/quick-request/api/attachments.server';
import { resolveChatAuthorRole } from '@/features/quick-request/api/messages.server';
import {
  QUICK_CHAT_ATTACHMENT_MESSAGES,
  quickChatAttachmentsPrepareSchema
} from '@/features/quick-request/schemas/quick-request-attachment';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody
} from '../../../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.message_attachment_prepare' as const;
const KNOWN_MESSAGES = new Set<string>([QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany]);

/**
 * plan 98 D-4 ① — 첨부 업로드 준비: `{ files: [{ name, size, mime }] }`(1~30) → 확장자 allowlist·MIME·10MB 검사 →
 * pending 행 insert(`message_id null` · `expires_at +24h`) → 파일별 signed upload URL. 권한 = 채팅 쓰기 권한(구매물류팀 403).
 * 응답 순서 = 요청 `files` 순서. 로그 metadata `{quick_request_no, attachment_count, total_bytes, error_code}` — 파일명·storage_path 금지.
 *
 * return 매트릭스: 401/403(session) · 404(형식·미존재·조회 불가) · 500(조회) · 403(logistics) · 400(JSON) · 400(zod: 형식·30개 초과)
 *   · 400(확장자·MIME·크기) · 500(insert·signed URL) · 201
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/messages/attachments/prepare`;
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
  const { row, requestNo, isParticipant } = loaded;

  // 쓰기 권한 = 메시지 POST와 동일 (요청자 본인 · 동방 · admin). 구매물류팀은 보기·다운로드만 (D-10)
  // plan 101 — 초대 참여자도 첨부 가능 (쓰기 역할 participant)
  if (!resolveChatAuthorRole(profile, row, isParticipant)) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.logisticsReadOnly), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', QUICK_CHAT_MESSAGES.logisticsReadOnly))
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.invalidBody), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickChatAttachmentsPrepareSchema.safeParse(json.body);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((item) => KNOWN_MESSAGES.has(item.message));
    const message = issue ? issue.message : QUICK_CHAT_MESSAGES.invalidBody;
    const rawFiles = (json.body as { files?: unknown } | null)?.files;
    return logger.respond(quickErrorBody(message), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('validation', message, {
          attachment_count: Array.isArray(rawFiles) ? rawFiles.length : undefined
        })
      )
    });
  }

  const files = parsed.data.files;
  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  try {
    const attachments = await prepareQuickChatAttachments({
      requestId: row.id,
      uploaderUserId: profile.user_id,
      files
    });

    return logger.respond(
      { success: true, data: { attachments } },
      201,
      {
        targetLabel: requestNo,
        metadata: quickLogMetadata(requestNo, { attachment_count: attachments.length, total_bytes: totalBytes })
      }
    );
  } catch (error) {
    if (error instanceof QuickChatAttachmentError) {
      return logger.respond(quickErrorBody(error.message), error.status, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata(error.errorCode, error.message, {
            attachment_count: files.length,
            total_bytes: totalBytes
          })
        )
      });
    }
    console.error('[quick-request/messages/attachments/prepare] failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.prepareFailed), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('internal_error', undefined, { attachment_count: files.length, total_bytes: totalBytes })
      )
    });
  }
}
