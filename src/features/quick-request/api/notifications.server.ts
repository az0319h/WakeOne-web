import 'server-only';

import { insertNotifications, type NotificationInsertRow } from '@/features/notifications/api/insert.server';
import { formatQuickAmountWon } from '../lib/format-quick-amount';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
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
 */

export type QuickRequestNotifyEvent =
  | 'created'
  | 'accepted'
  | 'dispatched'
  | 'final_amount_set'
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

type NotifyCopy = { title: string; vendorBody: string; requesterBody: string | null };

/** §문구표 (D-5) */
function buildCopy(row: QuickRequestRow, event: QuickRequestNotifyEvent, actorName: string): NotifyCopy {
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
      const body = `${row.dispatch_vehicle_info ?? '—'} · 기사 ${row.driver_name ?? '—'} · 예상 ${formatQuickAmountWon(row.estimated_amount)}`;
      return { title: `퀵 ${no} 배차완료`, vendorBody: body, requesterBody: body };
    }
    case 'final_amount_set':
      return {
        title: `퀵 ${no} 최종금액 입력`,
        vendorBody: `최종금액 ${finalAmount} · ${actorName}님 입력`,
        requesterBody: `최종금액 ${finalAmount} · 확인 후 승인해 주세요.`
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
}): Promise<void> {
  const { row, event, actorUserId, actorName } = input;
  const copy = buildCopy(row, event, actorName);
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

  // 2. vendor 후보 − 요청자 − 행위자 · 중복 제거
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

  if (rows.length === 0) return;
  await insertNotifications(rows);
}

/** 알림 실패가 업무 응답을 바꾸지 않게 감싼다 */
export async function safeNotify(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[quick-request/notifications] ${label} failed:`, message);
  }
}
