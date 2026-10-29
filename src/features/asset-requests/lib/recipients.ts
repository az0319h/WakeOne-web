/**
 * plan 103 §알림 — 구독·비품 요청 알림 수신자 계산 (순수 함수 · `node --test`).
 *
 * | 이벤트 | 받는 사람 (행위자 본인 제외 · 중복 제거) |
 * |--------|------------------------------------------|
 * | created · updated · canceled | active 권한자 전원 |
 * | status_changed | 요청자 |
 * | assigned | 새 담당자 |
 * | comment_created | 요청자 + (담당자 있으면 담당자만, 없으면 권한자 전원) |
 *
 * 동방특송 수신 차단은 `insertNotifications` 가드(plan 95)가 최종 방어선이다. 권한자 목록은 호출부가 active·비동방으로 넘긴다.
 */

export const ASSET_REQUEST_NOTIFICATION_EVENTS = [
  'created',
  'updated',
  'canceled',
  'status_changed',
  'assigned',
  'comment_created'
] as const;

export type AssetRequestNotificationEvent = (typeof ASSET_REQUEST_NOTIFICATION_EVENTS)[number];

export type AssetRequestRecipientInput = {
  event: AssetRequestNotificationEvent;
  /** 행위자(요청자·권한자·댓글 작성자) — 항상 제외 */
  actorId: string;
  requesterId: string;
  /** 현재 담당자(댓글 이벤트에서 사용) · assigned 이벤트에서는 「새 담당자」 */
  assigneeId: string | null;
  /** active 권한자 id 목록 */
  managerIds: readonly string[];
};

function uniqueExcluding(ids: readonly (string | null | undefined)[], excludeId: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!id || id === excludeId || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function resolveAssetRequestRecipients(input: AssetRequestRecipientInput): string[] {
  switch (input.event) {
    case 'created':
    case 'updated':
    case 'canceled':
      return uniqueExcluding(input.managerIds, input.actorId);
    case 'status_changed':
      return uniqueExcluding([input.requesterId], input.actorId);
    case 'assigned':
      return uniqueExcluding([input.assigneeId], input.actorId);
    case 'comment_created':
      return uniqueExcluding(
        [input.requesterId, ...(input.assigneeId ? [input.assigneeId] : input.managerIds)],
        input.actorId
      );
    default:
      return [];
  }
}
