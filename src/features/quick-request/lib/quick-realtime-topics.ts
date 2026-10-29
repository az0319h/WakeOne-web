/**
 * plan 94 D-3 — private Broadcast topic 이름 (SQL 93 `private.quick_realtime_broadcast()` · `realtime.messages` 정책과 1:1).
 * 서버(page·layout)에서 권한을 판정해 topic 문자열만 클라이언트에 넘긴다 — 클라이언트는 권한 함수를 import하지 않는다.
 */

export const QUICK_REQUESTS_ALL_TOPIC = 'quick-requests:all';

/** 건별 (상세 · 대화 · 「입력 중…」) — `private.can_view_quick_request` */
export function quickRequestTopic(requestId: string): string {
  return `quick-request:${requestId}`;
}

/** 요청자 본인 (viewer-all이 아닌 사용자의 대시보드·배지) — `topic = 'quick-user:' || auth.uid()` */
export function quickUserTopic(userId: string): string {
  return `quick-user:${userId}`;
}

/** 대시보드·「퀵 대화」 목록·사이드바 배지 — scope `all`(admin·동방·구매물류)은 전체, 그 밖은 본인 topic */
export function resolveQuickScopeTopic(params: { scope: 'own' | 'all'; userId: string }): string {
  return params.scope === 'all' ? QUICK_REQUESTS_ALL_TOPIC : quickUserTopic(params.userId);
}
