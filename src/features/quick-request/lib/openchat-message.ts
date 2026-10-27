import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { formatPhoneDisplay } from '@/lib/phone';
import type { QuickOpenchatEvent } from '../schemas/quick-request-workflow';

/**
 * plan 89 — 오픈채팅 webhook `text` 템플릿 4종 (D-1 · D-17).
 * 출발·도착 담당자 연락처는 넣지 않는다(링크로만 확인). 기사 연락처·이름·예상금액은 넣는다.
 */

export type QuickRouteSummary = {
  from: string;
  to: string;
  stopoverCount: number;
};

/** 도로명주소 앞 두 토큰 (예: `서울 용산구 한강대로 1` → `서울 용산구`) */
export function formatRouteRegion(roadAddress: string | null | undefined): string {
  const tokens = (roadAddress ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '—';
  return tokens.slice(0, 2).join(' ');
}

export function buildQuickRouteSummary(
  origin: { roadAddress?: string } | null | undefined,
  destination: { roadAddress?: string } | null | undefined,
  stopovers: unknown
): QuickRouteSummary {
  return {
    from: formatRouteRegion(origin?.roadAddress),
    to: formatRouteRegion(destination?.roadAddress),
    stopoverCount: Array.isArray(stopovers) ? stopovers.length : 0
  };
}

/** `20,000원` */
export function formatQuickAmountWonText(amount: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`;
}

export type QuickOpenchatTextContext = {
  requestNo: string;
  link: string;
  requesterName: string;
  route: QuickRouteSummary;
  /** created — `{mode:'immediate'}` | `{mode:'scheduled', datetimeIso}` */
  originSchedule?: { mode: string; datetimeIso?: string } | null;
  /** cancelled — 취소한 사람 */
  actorName?: string;
  cancelReason?: string | null;
  dispatch?: {
    estimatedAmount: number;
    vehicleInfo: string;
    driverName: string;
    driverPhone: string;
  } | null;
};

function formatOriginScheduleText(
  schedule: QuickOpenchatTextContext['originSchedule']
): string {
  if (schedule?.mode === 'scheduled' && schedule.datetimeIso) {
    return formatAbsoluteDateTimeKo(schedule.datetimeIso);
  }
  return '즉시 요청';
}

export function buildQuickOpenchatText(
  event: QuickOpenchatEvent,
  ctx: QuickOpenchatTextContext
): string {
  const detailLine = `상세 확인: ${ctx.link}`;

  switch (event) {
    case 'created': {
      const stopover = ctx.route.stopoverCount > 0 ? ` (경유 ${ctx.route.stopoverCount})` : '';
      return [
        `❗ 퀵요청 - ${ctx.requestNo}`,
        `🚚${ctx.route.from}→${ctx.route.to}${stopover}`,
        `출발일시: ${formatOriginScheduleText(ctx.originSchedule)}`,
        '',
        `"${ctx.requesterName}"님이 퀵 요청을 하였습니다.`,
        '동방특송 담당자님 상세 내역을 확인하시고 접수 및 배차를 진행해주세요.',
        '',
        detailLine
      ].join('\n');
    }
    case 'accepted':
      return [
        `✅접수완료 및 배차중 - ${ctx.requestNo}`,
        '접수 후에는 요청 내용을 수정할 수 없습니다. 변경이 필요하면 동방특송 담당자에게 연락해 주세요.',
        detailLine
      ].join('\n');
    case 'dispatched': {
      const dispatch = ctx.dispatch;
      const phone = dispatch
        ? formatPhoneDisplay(dispatch.driverPhone) ?? dispatch.driverPhone
        : '—';
      return [
        `🚚배차등록 완료 - ${ctx.requestNo}`,
        `예상금액: ${dispatch ? formatQuickAmountWonText(dispatch.estimatedAmount) : '—'}(부가세 별도)`,
        `차량정보: ${dispatch?.vehicleInfo ?? '—'}`,
        `기사이름: ${dispatch?.driverName ?? '—'}`,
        `기사 연락처: ${phone}`,
        detailLine
      ].join('\n');
    }
    case 'cancelled': {
      const reason = ctx.cancelReason?.trim();
      return [
        `🚫퀵요청 취소 - ${ctx.requestNo}`,
        `"${ctx.actorName ?? ctx.requesterName}"님이 퀵 요청을 취소하였습니다.`,
        ...(reason ? [`사유: ${reason}`] : []),
        detailLine
      ].join('\n');
    }
  }
}
