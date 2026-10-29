import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { DONGBANG_FORBIDDEN_JSON } from '@/config/dongbang-routes';
import {
  actorFromProfile,
  ANONYMOUS_ACTOR,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type {
  ActivityAction,
  ActivityLogErrorCode,
  ActivityLogMetadata,
  ActivityTargetType
} from '@/features/activity-logs/api/types';
import { isAssetManager } from '@/features/auth/api/asset-access.server';
import { isDongbang } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import type { AuthProfile } from '@/features/auth/api/types';
import { isAssetLedgerError } from '@/features/asset-ledger/api/errors';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import type { AssetViewer } from '@/features/asset-requests/api/service.server';

/**
 * plan 103 — 구독·비품·요청 Route 공용.
 * - CUD Route: `AssetRouteLog` 하나로 **모든 return 분기**를 `jsonWithActivityLog`로 보낸다(plan 08 · x-request-id).
 *   metadata는 allowlist 키만(금액·카드·주계정·관리 메모·요청 본문·댓글 본문·반려 사유 원문 금지).
 * - 동방특송: proxy allowlist가 1차로 403 · Route도 같은 문구로 한 번 더 막는다.
 */

export type AssetSession =
  | { ok: true; userId: string; profile: AuthProfile; viewer: AssetViewer }
  | { ok: false; response: NextResponse };

export function toAssetViewer(profile: AuthProfile): AssetViewer {
  return {
    user_id: profile.user_id,
    full_name: profile.full_name,
    affiliation: profile.affiliation,
    rank: profile.rank,
    isManager: isAssetManager(profile)
  };
}

/** 로그인(active) + 비동방 */
export async function requireAssetSession(): Promise<AssetSession> {
  const session = await requireSession();
  if (!session.ok) return session;
  if (isDongbang(session.profile)) {
    return { ok: false, response: NextResponse.json(DONGBANG_FORBIDDEN_JSON, { status: 403 }) };
  }
  return {
    ok: true,
    userId: session.userId,
    profile: session.profile,
    viewer: toAssetViewer(session.profile)
  };
}

export function assetJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function assetReadError(status: number, message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

export function forbiddenResponse(): NextResponse {
  return assetReadError(403, ASSET_MESSAGES.forbidden);
}

export function parsePositiveId(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function readJsonObject(request: NextRequest | Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorCodeForStatus(status: number): ActivityLogErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'internal_error';
  return 'validation';
}

export function truncateForLog(value: string | null | undefined, max = 80): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

export class AssetRouteLog {
  readonly requestId = createRequestId();
  private actor: { actorUserId: string | null; actorEmail: string; actorDisplayName: string | null } = {
    ...ANONYMOUS_ACTOR
  };
  private targetLabel: string;
  private targetUserId: string | null = null;
  private baseMetadata: ActivityLogMetadata = {};

  constructor(
    private readonly opts: {
      action: ActivityAction;
      targetType: ActivityTargetType;
      method: string;
      path: string;
      targetLabel: string;
    }
  ) {
    this.targetLabel = opts.targetLabel;
  }

  setActor(profile: AuthProfile) {
    this.actor = actorFromProfile(profile);
  }

  setTarget(label: string, targetUserId: string | null = null) {
    this.targetLabel = label;
    this.targetUserId = targetUserId;
  }

  setMetadata(metadata: ActivityLogMetadata) {
    this.baseMetadata = { ...this.baseMetadata, ...metadata };
  }

  private logInput(metadata: ActivityLogMetadata) {
    return {
      ...this.actor,
      action: this.opts.action,
      targetType: this.opts.targetType,
      targetUserId: this.targetUserId,
      targetLabel: this.targetLabel,
      httpMethod: this.opts.method,
      httpPath: this.opts.path,
      metadata
    };
  }

  /** requireAssetSession 실패(401·403·500) — 응답 그대로 기록 + x-request-id */
  async authFailure(response: NextResponse): Promise<NextResponse> {
    const status = response.status;
    this.actor = await resolveLoggingActor(status);
    return finishWithActivityLog(
      this.requestId,
      this.logInput({ ...this.baseMetadata, ...buildErrorMetadata(errorCodeForStatus(status)) }),
      response
    );
  }

  async success(body: Record<string, unknown>, status: number, metadata?: ActivityLogMetadata) {
    return jsonWithActivityLog(
      this.requestId,
      this.logInput({ ...this.baseMetadata, ...metadata }),
      { success: true, ...body },
      status
    );
  }

  /** 실패 응답 — message는 고정 문구만(입력값·본문·메모를 넣지 않는다) */
  async fail(status: number, message: string, options: { field?: string | null; metadata?: ActivityLogMetadata } = {}) {
    return jsonWithActivityLog(
      this.requestId,
      this.logInput({
        ...this.baseMetadata,
        ...options.metadata,
        ...buildErrorMetadata(errorCodeForStatus(status), message)
      }),
      { success: false, message, ...(options.field ? { field: options.field } : {}) },
      status
    );
  }

  /** AssetLedgerError → 같은 status · 그 외 → 500 */
  async fromError(error: unknown, fallbackMessage = '처리 중 오류가 발생했습니다.') {
    if (isAssetLedgerError(error)) {
      return this.fail(error.status, error.message, { field: error.field });
    }
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    console.error(`[asset-ledger] ${this.opts.action} failed:`, message);
    return this.fail(500, fallbackMessage);
  }
}

export function subscriptionTargetLabel(input: { id?: number | string | null; name?: string | null }): string {
  return `subscription:${input.id ?? 'unknown'}:${truncateForLog(input.name) ?? 'unknown'}`;
}

export function equipmentTargetLabel(input: { id?: number | string | null; assetNo?: string | null }): string {
  return `equipment:${input.id ?? 'unknown'}:${input.assetNo ?? 'unknown'}`;
}

/** 요청 라벨에는 자유 입력(모델·시리얼·구독명 스냅샷)을 넣지 않는다 — 종류·대상 id만 */
export function assetRequestTargetLabel(input: {
  id?: number | string | null;
  targetType?: string | null;
  targetId?: number | string | null;
}): string {
  return `asset-request:${input.id ?? 'unknown'}:${input.targetType ?? 'unknown'}:${input.targetId ?? 'unknown'}`;
}

export function assetCommentTargetLabel(input: {
  requestId?: number | string | null;
  commentId?: number | string | null;
}): string {
  return `asset-request-comment:${input.requestId ?? 'unknown'}:${input.commentId ?? 'unknown'}`;
}
