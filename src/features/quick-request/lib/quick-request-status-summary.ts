import type { QuickRequestDetail, QuickRequestPermissions } from '../api/types';

/**
 * plan 106 D-15 · designer §6.3 — 상세 「지금 상태 한 문장」 (AC-43).
 * 판정은 `detail.permissions`만 쓴다(역할 문자열 비교 금지).
 * 이 파일은 path alias(`@/…`)·런타임 import 없이 순수 계산만 한다 — `node --test`에서 바로 불러 쓰기 위함.
 */
export const QUICK_STATUS_SUMMARY_TEXT = {
  requestedViewer: '동방특송이 요청을 확인하고 있습니다.',
  requestedOperator: '새 요청입니다. 확인 후 접수해 주세요.',
  dispatchingViewer: '동방특송이 배차하고 있습니다.',
  dispatchingOperator: '배차가 끝나면 배차완료를 입력해 주세요.',
  dispatchedNoFinalViewer: '배차가 완료되었습니다. 최종금액이 입력되면 승인할 수 있습니다.',
  dispatchedNoFinalOperator: '운송이 끝나면 최종금액을 입력해 주세요.',
  dispatchedFinalViewer: '최종금액을 확인하고 승인해 주세요.',
  dispatchedFinalOperator: '요청자의 승인을 기다리고 있습니다.',
  approved: '승인이 끝난 요청입니다.',
  cancelled: '취소된 요청입니다.'
} as const;

export type QuickStatusSummaryInput = Pick<QuickRequestDetail, 'status' | 'finalAmount'> & {
  permissions: Pick<
    QuickRequestPermissions,
    'canAccept' | 'canDispatch' | 'canSetFinal' | 'canApprove'
  >;
};

/**
 * 문구표(plan D-15) — 왼쪽 열(요청자·초대 참여자·구매물류팀) / 오른쪽 열(처리 권한: 동방특송·admin).
 * - `dispatched` · 최종금액 있음: 승인 권한이 있으면 왼쪽(admin이 요청자 본인인 건 포함), 아니면 최종금액 권한으로 판정.
 */
export function resolveQuickStatusSummary(detail: QuickStatusSummaryInput): string {
  const { status, finalAmount, permissions } = detail;
  const text = QUICK_STATUS_SUMMARY_TEXT;

  switch (status) {
    case 'requested':
      return permissions.canAccept ? text.requestedOperator : text.requestedViewer;
    case 'dispatching':
      return permissions.canDispatch ? text.dispatchingOperator : text.dispatchingViewer;
    case 'dispatched':
      if (finalAmount == null) {
        return permissions.canSetFinal ? text.dispatchedNoFinalOperator : text.dispatchedNoFinalViewer;
      }
      if (permissions.canApprove) return text.dispatchedFinalViewer;
      return permissions.canSetFinal ? text.dispatchedFinalOperator : text.dispatchedFinalViewer;
    case 'approved':
      return text.approved;
    case 'cancelled':
      return text.cancelled;
    default:
      return '';
  }
}
