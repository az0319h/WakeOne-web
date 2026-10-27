import 'server-only';

import { insertNotifications } from '@/features/notifications/api/insert.server';
import { buildQuickRouteSummary, formatQuickAmountWonText } from '../lib/openchat-message';
import { listActiveDongbangUserIds, type QuickRequestRow } from './workflow.server';

/**
 * plan 89 D-16 — 퀵 인앱 알림 (webhook 보조 채널). 행위자 본인에게는 보내지 않는다.
 * metadata.quick_request_no → FE 「퀵 요청 보기」 `/dashboard/quick/{no}`.
 * 실패해도 업무 응답을 바꾸지 않도록 호출부에서 catch한다.
 */

type VendorEvent = 'created' | 'cancelled';
type RequesterEvent = 'accepted' | 'dispatched' | 'final_amount_set' | 'approved' | 'cancelled';

function baseMetadata(
  kind: 'quick_request.vendor_event' | 'quick_request.requester_event',
  row: QuickRequestRow,
  event: string,
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

/** 등록·취소 → active 동방특송 전원 */
export async function insertQuickRequestVendorNotifications(input: {
  row: QuickRequestRow;
  event: VendorEvent;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  const recipients = (await listActiveDongbangUserIds()).filter(
    (userId) => userId !== input.actorUserId
  );
  if (recipients.length === 0) return;

  const route = buildQuickRouteSummary(input.row.origin, input.row.destination, input.row.stopovers);
  const routeText = `${route.from} → ${route.to}${route.stopoverCount > 0 ? ` (경유 ${route.stopoverCount})` : ''}`;

  const copy =
    input.event === 'created'
      ? {
          title: '새 퀵 요청이 등록되었습니다',
          body: `${input.row.request_no} · ${input.row.requester_name} · ${routeText}`
        }
      : {
          title: '퀵 요청이 취소되었습니다',
          body: `${input.row.request_no} · ${input.actorName}님이 취소했습니다.`
        };

  await insertNotifications(
    recipients.map((recipientUserId) => ({
      recipient_user_id: recipientUserId,
      type: 'quick_request.vendor_event' as const,
      title: copy.title,
      body: copy.body,
      metadata: baseMetadata('quick_request.vendor_event', input.row, input.event, input.actorUserId)
    }))
  );
}

/** 접수·배차완료·최종금액 입력·(대리)승인·동방/admin 취소 → 요청자 */
export async function insertQuickRequestRequesterNotification(input: {
  row: QuickRequestRow;
  event: RequesterEvent;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  const { row } = input;
  if (row.requester_user_id === input.actorUserId) return;

  let copy: { title: string; body: string };
  switch (input.event) {
    case 'accepted':
      copy = {
        title: '퀵 요청이 접수되었습니다',
        body: `${row.request_no} · 동방특송이 배차를 진행하고 있습니다.`
      };
      break;
    case 'dispatched':
      copy = {
        title: '퀵 배차가 완료되었습니다',
        body: `${row.request_no} · ${row.dispatch_vehicle_info ?? '차량 배정'} · 기사 ${row.driver_name ?? ''}`.trim()
      };
      break;
    case 'final_amount_set':
      copy = {
        title: '최종금액이 입력되었습니다. 확인 후 승인해 주세요.',
        body:
          row.final_amount != null
            ? `${row.request_no} · 최종금액 ${formatQuickAmountWonText(row.final_amount)}`
            : row.request_no
      };
      break;
    case 'approved':
      copy = {
        title: '퀵 요청이 승인되었습니다',
        body: `${row.request_no} · ${input.actorName}님이 승인했습니다.`
      };
      break;
    case 'cancelled':
      copy = {
        title: '퀵 요청이 취소되었습니다',
        body: row.cancel_reason
          ? `${row.request_no} · ${input.actorName}님이 취소했습니다. 사유: ${row.cancel_reason}`
          : `${row.request_no} · ${input.actorName}님이 취소했습니다.`
      };
      break;
  }

  await insertNotifications({
    recipient_user_id: row.requester_user_id,
    type: 'quick_request.requester_event',
    title: copy.title,
    body: copy.body,
    metadata: baseMetadata('quick_request.requester_event', row, input.event, input.actorUserId)
  });
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
