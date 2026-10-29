import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  buildMaskedAiMessages,
  generateQuickChatAiSuggestions,
  incrementQuickChatAiUsage,
  isChatAiSuggestEnabled,
  loadQuickChatAiContext,
  QuickChatAiSuggestError,
  type QuickChatAiContext,
  type QuickChatAiSuggestOutcome,
  type QuickChatAiUsageResult
} from '@/features/quick-request/api/ai-suggest.server';
import { resolveChatAuthorRole } from '@/features/quick-request/api/messages.server';
import type { QuickRequestAiSuggestData } from '@/features/quick-request/api/types';
import type { AiMaskedMessage } from '@/features/quick-request/lib/ai-mask';
import {
  QUICK_CHAT_AI_DAILY_LIMIT,
  QUICK_CHAT_AI_MESSAGES,
  QUICK_CHAT_MESSAGES,
  quickChatAiSuggestBodySchema,
  type QuickChatAiErrorReason
} from '@/features/quick-request/schemas/quick-request-chat';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickLogMetadata,
  readJsonBody
} from '../../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.chat_ai_suggest' as const;

function aiErrorBody(message: string, reason: QuickChatAiErrorReason) {
  return { success: false as const, message, reason };
}

/**
 * plan 100 — 퀵 대화 AI 답장 추천 (Claude Haiku · 4개 · 규칙 칩 fallback).
 * 순서(plan Route 표): OFF 503 → 권한 401/403/404 → body 400 → 마지막 메시지가 아니거나 내 메시지 409
 *   → 컨텍스트·마스킹(500) → 일일 카운터(Anthropic 호출 **직전** +1 · 한도 429 `{reason:'limit'}`) → 호출(502) → 200.
 * 모든 return은 logger.respond → activity log `quick_request.chat_ai_suggest` + `x-request-id`.
 * metadata = `quick_request_no`·`source`·`message_count`·`latency_ms`·`input_tokens`·`output_tokens`·`error_code`만 (본문·추천 문장 금지).
 *
 * return 매트릭스: 401/403/500(session) · 503(OFF) · 404(형식·미존재·조회 불가) · 500(조회) · 403(구매물류팀)
 *   · 400(JSON) · 400(zod) · 500(컨텍스트 조회) · 409(메시지 없음·마지막 아님·내 메시지) · 500(마스킹 사전 조회)
 *   · 500(카운터 RPC) · 429(한도) · 502(SDK·timeout·mock fail) · 200(ai | rules)
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/messages/suggest`;
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

  // D-1 — env 2종 중 하나라도 없으면 꺼짐 (FE는 aiSuggest.enabled=false라 호출하지 않는다)
  if (!isChatAiSuggestEnabled()) {
    return logger.respond(aiErrorBody(QUICK_CHAT_AI_MESSAGES.disabled, 'disabled'), 503, {
      metadata: buildErrorMetadata('ai_disabled', QUICK_CHAT_AI_MESSAGES.disabled, { source: 'rules' })
    });
  }

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo, isParticipant } = loaded;

  // 쓰기 역할(요청자·동방·admin·참여자)만. 구매물류팀 403 (93 C-7)
  const viewerRole = resolveChatAuthorRole(profile, row, isParticipant);
  if (!viewerRole) {
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.logisticsReadOnly, 'failed'), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', QUICK_CHAT_MESSAGES.logisticsReadOnly))
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.invalidBody, 'failed'), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickChatAiSuggestBodySchema.safeParse(json.body);
  if (!parsed.success) {
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.invalidBody, 'failed'), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', QUICK_CHAT_MESSAGES.invalidBody))
    });
  }
  const { lastMessageId } = parsed.data;

  let context: QuickChatAiContext;
  try {
    context = await loadQuickChatAiContext(row.id);
  } catch (error) {
    console.error('[quick-request/messages/suggest] context load failed:', error);
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.internalError, 'failed'), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error'))
    });
  }

  // 9-2 — 그 건의 현재 마지막 메시지이고 남이 보낸 것이어야 한다 (연속 수신 중 늦게 온 이전 id도 409로 정리)
  const last = context.lastMessage;
  if (!last || last.id !== lastMessageId || last.authorUserId === profile.user_id) {
    return logger.respond(aiErrorBody(QUICK_CHAT_AI_MESSAGES.noNewMessage, 'stale'), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('conflict', QUICK_CHAT_AI_MESSAGES.noNewMessage, { source: 'rules' })
      )
    });
  }

  let maskedMessages: AiMaskedMessage[];
  try {
    maskedMessages = await buildMaskedAiMessages({ row, viewerUserId: profile.user_id, rows: context.rows });
  } catch (error) {
    console.error('[quick-request/messages/suggest] mask dictionary failed:', error);
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.internalError, 'failed'), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error'))
    });
  }

  // root 결정 — Anthropic 호출 직전에 +1 (AI까지 간 호출을 센다 · 성공·실패 무관 · 원자적 한도 보장)
  let usage: QuickChatAiUsageResult;
  try {
    usage = await incrementQuickChatAiUsage(profile.user_id, QUICK_CHAT_AI_DAILY_LIMIT);
  } catch (error) {
    console.error('[quick-request/messages/suggest] usage increment failed:', error);
    return logger.respond(aiErrorBody(QUICK_CHAT_MESSAGES.internalError, 'failed'), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error'))
    });
  }

  if (!usage.ok) {
    return logger.respond(aiErrorBody(QUICK_CHAT_AI_MESSAGES.limit, 'limit'), 429, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('limit_exceeded', QUICK_CHAT_AI_MESSAGES.limit, {
          source: 'rules',
          count: QUICK_CHAT_AI_DAILY_LIMIT
        })
      )
    });
  }

  let outcome: QuickChatAiSuggestOutcome;
  try {
    outcome = await generateQuickChatAiSuggestions({
      row,
      viewerRole,
      messages: maskedMessages,
      signal: request.signal
    });
  } catch (error) {
    const errorCode = error instanceof QuickChatAiSuggestError ? error.errorCode : 'ai_upstream_error';
    const latencyMs = error instanceof QuickChatAiSuggestError ? error.latencyMs : undefined;
    // 원문 오류(프롬프트 일부가 섞일 수 있음)는 metadata에 넣지 않는다 — 서버 콘솔에 코드만
    console.error('[quick-request/messages/suggest] ai call failed:', errorCode);
    return logger.respond(aiErrorBody(QUICK_CHAT_AI_MESSAGES.failed, 'failed'), 502, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata(errorCode, QUICK_CHAT_AI_MESSAGES.failed, {
          source: 'rules',
          message_count: maskedMessages.length,
          ...(latencyMs !== undefined ? { latency_ms: latencyMs } : {}),
          count: usage.count
        })
      )
    });
  }

  const data: QuickRequestAiSuggestData = {
    suggestions: outcome.suggestions,
    source: outcome.source,
    lastMessageId,
    usage: { count: usage.count, limit: QUICK_CHAT_AI_DAILY_LIMIT },
    ...(outcome.debugPrompt !== undefined ? { debugPrompt: outcome.debugPrompt } : {})
  };

  return logger.respond({ success: true, data }, 200, {
    targetLabel: requestNo,
    metadata: quickLogMetadata(requestNo, {
      source: outcome.source,
      message_count: outcome.messageCount,
      latency_ms: outcome.latencyMs,
      input_tokens: outcome.inputTokens,
      output_tokens: outcome.outputTokens,
      count: usage.count,
      ...(outcome.errorCode ? { error_code: outcome.errorCode } : {})
    })
  });
}
