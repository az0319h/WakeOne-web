/**
 * plan 93 r3 — 채팅 알림 수신자 (순수 함수 · 집합 연산만).
 *
 * 참여자 P = 요청자 R ∪ active 동방특송 전원 D ∪ 그 건에 글을 쓴 admin A*
 * 수신자 = P − 보낸 사람 S − 비활성 사용자, 중복 제거. 접수 전/후·`accepted_by`·상태 분기 없음.
 * 조회(요청자·동방 목록·admin 참여자·비활성)는 Route/server 모듈이 하고, 이 함수는 계산만 한다(단위 테스트 대상).
 */
export type ResolveChatRecipientsInput = {
  requesterId: string;
  activeDongbangIds: readonly string[];
  adminParticipantIds: readonly string[];
  senderId: string;
  /** 참여자 중 `status<>'active'`인 사용자 (요청자·admin 참여자 포함 가능) */
  inactiveIds: readonly string[];
};

export function resolveChatRecipients(input: ResolveChatRecipientsInput): string[] {
  const excluded = new Set<string>([input.senderId, ...input.inactiveIds]);
  const recipients: string[] = [];
  const seen = new Set<string>();

  for (const userId of [input.requesterId, ...input.activeDongbangIds, ...input.adminParticipantIds]) {
    if (!userId || seen.has(userId) || excluded.has(userId)) continue;
    seen.add(userId);
    recipients.push(userId);
  }

  return recipients;
}
