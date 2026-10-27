import type {
  QuickOpenchatEvent,
  QuickOpenchatStatus,
  QuickRequestStatus
} from '../schemas/quick-request-workflow';

/**
 * plan 89 — 퀵 상태 라벨·카드 설명·Badge 톤 (designer K1).
 * Badge 색만 Tailwind 팔레트 `/10` + `dark:` 예외를 이 파일 한 곳에 둔다.
 * 그 밖의 색은 시맨틱 토큰만 쓴다.
 */

export const QUICK_REQUEST_STATUS_LABELS: Record<QuickRequestStatus, string> = {
  requested: '신규요청',
  dispatching: '접수 및 배차중',
  dispatched: '배차완료 및 결과',
  approved: '승인',
  cancelled: '취소'
};

/** 대시보드 카드 4종 (취소는 별도 작은 버튼) */
export const QUICK_REQUEST_CARD_STATUSES = [
  'requested',
  'dispatching',
  'dispatched',
  'approved'
] as const satisfies readonly QuickRequestStatus[];

export const QUICK_REQUEST_CARD_DESCRIPTIONS: Record<
  (typeof QUICK_REQUEST_CARD_STATUSES)[number],
  string
> = {
  requested: '접수를 기다리는 요청',
  dispatching: '동방특송이 배차를 진행 중',
  dispatched: '기사 배정 완료 · 금액 확인',
  approved: '최종금액 승인 완료'
};

/** Stepper 단계 순서 (취소 제외) */
export const QUICK_REQUEST_STEP_ORDER = QUICK_REQUEST_CARD_STATUSES;

/** K1 — 신규=blue · 접수=amber · 배차완료=violet · 승인=green · 취소=muted */
export const QUICK_REQUEST_STATUS_TONE_CLASS: Record<QuickRequestStatus, string> = {
  requested: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400',
  dispatching: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  dispatched: 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400',
  approved: 'bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:text-green-400',
  cancelled: 'bg-muted text-muted-foreground hover:bg-muted'
};

/** 카드·필터 상태 점 (Badge와 같은 팔레트) */
export const QUICK_REQUEST_STATUS_DOT_CLASS: Record<QuickRequestStatus, string> = {
  requested: 'bg-blue-500',
  dispatching: 'bg-amber-500',
  dispatched: 'bg-violet-500',
  approved: 'bg-green-500',
  cancelled: 'bg-muted-foreground'
};

export const QUICK_OPENCHAT_EVENT_LABELS: Record<QuickOpenchatEvent, string> = {
  created: '등록',
  accepted: '접수',
  dispatched: '배차완료',
  cancelled: '취소'
};

export const QUICK_OPENCHAT_STATUS_LABELS: Record<QuickOpenchatStatus, string> = {
  sent: '발송됨',
  failed: '실패',
  not_configured: '미설정'
};

/** 오픈채팅 발송 상태 Badge 톤 (발송됨 = K1 초록 예외) */
export const QUICK_OPENCHAT_STATUS_TONE_CLASS: Record<QuickOpenchatStatus, string> = {
  sent: 'bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:text-green-400',
  failed: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
  not_configured: 'bg-muted text-muted-foreground hover:bg-muted'
};

export function getQuickRequestStatusLabel(status: QuickRequestStatus): string {
  return QUICK_REQUEST_STATUS_LABELS[status];
}
