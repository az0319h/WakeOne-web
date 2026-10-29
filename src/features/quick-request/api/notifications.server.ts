import 'server-only';

import { insertNotifications, type NotificationInsertRow } from '@/features/notifications/api/insert.server';
import { formatQuickAmountWon } from '../lib/format-quick-amount';
import {
  buildChatNotificationTitle,
  buildQuickRequestUpdatedBody,
  clipChatNotificationBody
} from '../lib/quick-notification-copy';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
import { resolveChatRecipients } from '../lib/resolve-chat-recipients';
import {
  buildChatBodyWithAttachmentSummary,
  type QuickChatAttachmentKind
} from '../schemas/quick-request-attachment';
import {
  listChatAdminParticipantIds,
  listInactiveUserIds,
  type QuickRequestMessageRow
} from './messages.server';
import { listActiveParticipantUserIds } from './participants.server';
import {
  listActiveDongbangUserIds,
  listActiveLogisticsUserIds,
  listActiveQuickAdminUserIds,
  type QuickRequestRow
} from './workflow.server';

/**
 * plan 92 — 퀵 인앱 알림 단일 진입점 (D-2 유일 채널 · D-4 수신자 매트릭스 · D-5 짧은 문구).
 * - `quick_request.vendor_event` = 업무 담당·관리 측(동방특송·admin·구매물류팀) / `quick_request.requester_event` = 요청자
 * - 행위자 본인 제외 · active만 · 한 사람이 여러 자격이면 1건(요청자 자격 우선)
 * - 기사 연락처·출발/도착 담당자 연락처는 넣지 않는다(잠금화면 노출 방지). 제목 ≤ 30자 · 본문 ≤ 120자
 * - INSERT는 `insertNotifications(rows)` 1회(plan 91 푸시가 그대로 이어받는다). 실패 격리는 호출부 `safeNotify`
 * - metadata.quick_request_no → FE 「퀵 요청 보기」 `/dashboard/quick/{no}`
 *
 * plan 94 — Route는 알림을 `after()`(next/server) 안에서 부른다(D-2 · 응답 먼저). `updated` 이벤트 추가(D-11 · 요청자만 ·
 * type 재사용 · `metadata.quick_request_event='updated'`). 채팅 제목 `{이름} · {번호}`(D-13). 순수 문구는 `lib/quick-notification-copy.ts`.
 */

export type QuickRequestNotifyEvent =
  | 'created'
  | 'accepted'
  | 'dispatched'
  | 'final_amount_set'
  | 'updated'
  | 'approved'
  | 'cancelled';

const TITLE_MAX_LENGTH = 30;
const BODY_MAX_LENGTH = 120;

/** 줄바꿈 → 공백 1칸 · 초과 시 (max-1)자 + `…` */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function formatRouteText(row: QuickRequestRow): string {
  const route = buildQuickRouteSummary(row.origin, row.destination, row.stopovers);
  return `${route.from} → ${route.to}${route.stopoverCount > 0 ? ` (경유 ${route.stopoverCount})` : ''}`;
}

/** vendorBody null = 업무 측 수신 없음 (`updated`는 요청자만) */
type NotifyCopy = { title: string; vendorBody: string | null; requesterBody: string | null };

/** §문구표 (92 D-5 · 94 D-11) */
function buildCopy(
  row: QuickRequestRow,
  event: QuickRequestNotifyEvent,
  actorName: string,
  changedLabels: readonly string[]
): NotifyCopy {
  const no = row.request_no;
  const finalAmount = formatQuickAmountWon(row.final_amount);

  switch (event) {
    case 'created':
      return {
        title: `새 퀵 요청 ${no}`,
        vendorBody: `${row.requester_name} · ${formatRouteText(row)}`,
        requesterBody: null
      };
    case 'accepted':
      return {
        title: `퀵 ${no} 접수됨`,
        vendorBody: `${actorName}님이 접수했습니다.`,
        requesterBody: '동방특송이 접수해 배차를 진행하고 있습니다.'
      };
    case 'dispatched': {
      // 94 D-9 — 자동차등록번호 · 기사 이름 · 예상금액 (형식은 92 그대로 · 값만 번호판)
      const body = `${row.dispatch_vehicle_info ?? '—'} · 기사 ${row.driver_name ?? '—'} · 예상 ${formatQuickAmountWon(row.estimated_amount)}`;
      return { title: `퀵 ${no} 배차완료`, vendorBody: body, requesterBody: body };
    }
    case 'final_amount_set':
      return {
        title: `퀵 ${no} 최종금액 입력`,
        vendorBody: `최종금액 ${finalAmount} · ${actorName}님 입력`,
        requesterBody: `최종금액 ${finalAmount} · 확인 후 승인해 주세요.`
      };
    case 'updated':
      return {
        title: `퀵 ${no} 수정됨`,
        vendorBody: null,
        requesterBody: buildQuickRequestUpdatedBody(actorName, changedLabels)
      };
    case 'approved': {
      const body = `최종금액 ${finalAmount} · ${actorName}님이 승인했습니다.`;
      return { title: `퀵 ${no} 승인됨`, vendorBody: body, requesterBody: body };
    }
    case 'cancelled': {
      const reason = row.cancel_reason?.trim();
      const body = `${actorName}님이 취소했습니다.${reason ? ` 사유: ${reason}` : ''}`;
      return { title: `퀵 ${no} 취소됨`, vendorBody: body, requesterBody: body };
    }
  }
}

/** §수신자 매트릭스 (D-4) — vendor 후보. 동방특송은 모든 단계, admin·구매물류팀은 등록·취소만 */
async function listVendorCandidates(event: QuickRequestNotifyEvent): Promise<string[]> {
  const includeManagers = event === 'created' || event === 'cancelled';
  const [dongbang, admins, logistics] = await Promise.all([
    listActiveDongbangUserIds(),
    includeManagers ? listActiveQuickAdminUserIds() : Promise.resolve([]),
    includeManagers ? listActiveLogisticsUserIds() : Promise.resolve([])
  ]);
  return [...dongbang, ...admins, ...logistics];
}

function buildMetadata(
  kind: 'quick_request.vendor_event' | 'quick_request.requester_event',
  row: QuickRequestRow,
  event: QuickRequestNotifyEvent,
  actorUserId: string
) {
  return {
    kind,
    quick_request_no: row.request_no,
    quick_request_id: row.id,
    quick_request_event: event,
    actor_user_id: actorUserId
  };
}

export async function notifyQuickRequestEvent(input: {
  row: QuickRequestRow;
  event: QuickRequestNotifyEvent;
  actorUserId: string;
  actorName: string;
  /** `updated`만 — 변경 항목 한국어 라벨(`buildQuickRequestChangedLabels`) */
  changedLabels?: readonly string[];
}): Promise<void> {
  const { row, event, actorUserId, actorName } = input;
  const copy = buildCopy(row, event, actorName, input.changedLabels ?? []);
  const title = clip(copy.title, TITLE_MAX_LENGTH);
  const rows: NotificationInsertRow[] = [];

  // 1. 요청자 자격 행 먼저 (행위자 본인 제외)
  const requesterGetsOne = copy.requesterBody !== null && row.requester_user_id !== actorUserId;
  if (requesterGetsOne && copy.requesterBody !== null) {
    rows.push({
      recipient_user_id: row.requester_user_id,
      type: 'quick_request.requester_event',
      title,
      body: clip(copy.requesterBody, BODY_MAX_LENGTH),
      metadata: buildMetadata('quick_request.requester_event', row, event, actorUserId)
    });
  }

  // 2. vendor 후보 − 요청자 − 행위자 · 중복 제거 (vendorBody null이면 업무 측 수신 없음)
  if (copy.vendorBody !== null) {
    const excluded = new Set<string>([actorUserId, row.requester_user_id]);
    const vendorRecipients = [...new Set(await listVendorCandidates(event))].filter(
      (userId) => !excluded.has(userId)
    );
    const vendorBody = clip(copy.vendorBody, BODY_MAX_LENGTH);
    for (const recipientUserId of vendorRecipients) {
      rows.push({
        recipient_user_id: recipientUserId,
        type: 'quick_request.vendor_event',
        title,
        body: vendorBody,
        metadata: buildMetadata('quick_request.vendor_event', row, event, actorUserId)
      });
    }
  }

  if (rows.length === 0) return;
  await insertNotifications(rows);
}

/**
 * 알림 실패가 업무 응답을 바꾸지 않게 감싼다.
 * plan 94 D-2 — Route는 `after(() => safeNotify(...))`로 응답을 먼저 돌려준 뒤 실행한다(await 금지).
 */
export async function safeNotify(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[quick-request/notifications] ${label} failed:`, message);
  }
}

// ---------------------------------------------------------------------------
// plan 93 r3 — 채팅 메시지 알림 (`quick_request.chat_message`) · 94 D-13 제목
// ---------------------------------------------------------------------------

export { buildChatNotificationTitle, clipChatNotificationBody };

/**
 * 수신자 = 참여자(요청자 + active 동방 전원 + 그 건에 글 쓴 admin) − 보낸 사람 − 비활성, 중복 제거 (§알림 수신 규칙).
 * 접수 전/후·`accepted_by`·상태 분기 없음(승인·취소 건도 보낸다 · 94 D-12).
 * 응답 뒤(`after()`)에 돌기 때문에 수신자 수는 돌려주지 않는다(94 D-2 · 로그 `recipient_count` 제거).
 * plan 98 D-9 — 첨부가 있으면 본문에 `(사진 2장·파일 1개)` 요약을 붙인다. 본문이 없으면 요약만. 파일명은 넣지 않는다.
 */
export async function notifyQuickRequestChatMessage(input: {
  row: QuickRequestRow;
  message: QuickRequestMessageRow;
  senderUserId: string;
  senderName: string;
  /** 첨부 kind 목록 (없으면 `[]`) */
  attachmentKinds?: readonly QuickChatAttachmentKind[];
}): Promise<void> {
  const { row, message, senderUserId, senderName } = input;
  const [activeDongbangIds, adminParticipantIds, participantIds] = await Promise.all([
    listActiveDongbangUserIds(),
    listChatAdminParticipantIds(row.id),
    // plan 101 D-6 ③ — 활성(미제외) 초대 참여자. 제외된 사람은 목록에 없으므로 그 뒤 메시지 알림 없음
    listActiveParticipantUserIds(row.id)
  ]);
  // 동방 목록은 이미 active만. 요청자·admin 참여자·초대 참여자의 활성 여부만 추가 확인
  const inactiveIds = await listInactiveUserIds([row.requester_user_id, ...adminParticipantIds, ...participantIds]);

  const recipients = resolveChatRecipients({
    requesterId: row.requester_user_id,
    activeDongbangIds,
    adminParticipantIds,
    participantIds,
    senderId: senderUserId,
    inactiveIds
  });
  if (recipients.length === 0) return;

  const title = buildChatNotificationTitle(row.request_no, senderName);
  const body = buildChatBodyWithAttachmentSummary(clipChatNotificationBody(message.body), input.attachmentKinds ?? []);
  const metadata = {
    kind: 'quick_request.chat_message' as const,
    quick_request_no: row.request_no,
    quick_request_id: row.id,
    quick_request_event: 'chat_message',
    quick_request_message_id: Number(message.id),
    actor_user_id: senderUserId
  };

  await insertNotifications(
    recipients.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: 'quick_request.chat_message',
      title,
      body,
      metadata
    }))
  );
}

// ---------------------------------------------------------------------------
// plan 101 D-6 ①② — 참여자 초대·제외 알림 (type `quick_request.requester_event` 재사용 · 당사자 1건)
// ---------------------------------------------------------------------------

export type QuickRequestParticipantNotifyEvent = 'participant_invited' | 'participant_removed';

/**
 * 초대: 제목 `퀵 {no} 대화 초대` · 본문 `{초대한 사람}님이 대화에 초대했습니다. {경로}` · 클릭 → 「퀵 대화」(FE `notification-helpers`가 event로 분기).
 * 제외: 제목 `퀵 {no} 대화에서 제외됨` · 본문 `{행위자}님이 대화에서 제외했습니다.` 본인 나가기는 호출하지 않는다(Route 분기).
 * 요청 상태 알림(접수·배차 등)은 참여자에게 보내지 않는다(D-6 ④ · `notifyQuickRequestEvent` 수신자 매트릭스에 참여자 없음).
 */
export async function notifyQuickRequestParticipantEvent(input: {
  row: QuickRequestRow;
  event: QuickRequestParticipantNotifyEvent;
  recipientUserId: string;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  const { row, event, recipientUserId, actorUserId, actorName } = input;
  if (recipientUserId === actorUserId) return;

  const title =
    event === 'participant_invited' ? `퀵 ${row.request_no} 대화 초대` : `퀵 ${row.request_no} 대화에서 제외됨`;
  const body =
    event === 'participant_invited'
      ? `${actorName}님이 대화에 초대했습니다. ${formatRouteText(row)}`
      : `${actorName}님이 대화에서 제외했습니다.`;

  await insertNotifications({
    recipient_user_id: recipientUserId,
    type: 'quick_request.requester_event',
    title: clip(title, TITLE_MAX_LENGTH),
    body: clip(body, BODY_MAX_LENGTH),
    metadata: {
      kind: 'quick_request.requester_event',
      quick_request_no: row.request_no,
      quick_request_id: row.id,
      quick_request_event: event,
      actor_user_id: actorUserId
    }
  });
}
