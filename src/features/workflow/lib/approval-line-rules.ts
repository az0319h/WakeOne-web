/**
 * 결재선 구조 검증 — 클라이언트(결재선 편집기)와 서버 Route 공용. 비활성 사용자 검사는 서버 RPC가 한다.
 * 순서는 RPC `private.wf_validate_line`과 같다.
 */
import { WORKFLOW_MESSAGES } from './required-rules';

export const WORKFLOW_NOTIFICATION_SETTINGS = ['START_AND_END', 'END', 'NONE'] as const;
export type WorkflowNotificationSetting = (typeof WORKFLOW_NOTIFICATION_SETTINGS)[number];

export const WORKFLOW_NOTIFICATION_SETTING_LABELS: Record<WorkflowNotificationSetting, string> = {
  START_AND_END: '승인 요청, 완료 시 알림',
  END: '승인 완료 시 알림',
  NONE: '알림 없음'
};

export const WORKFLOW_MAX_STEPS = 20;

/** 단계 배열 — `steps[0]` = 1단계 승인자 user_id 목록 */
export type WorkflowApprovalStepsInput = string[][];

export type WorkflowReferrerInput = {
  user_id: string;
  notification_setting: WorkflowNotificationSetting;
};

export type WorkflowApprovalLineInput = {
  steps: WorkflowApprovalStepsInput;
  referrers: WorkflowReferrerInput[];
};

export function isWorkflowNotificationSetting(value: unknown): value is WorkflowNotificationSetting {
  return (
    typeof value === 'string' &&
    (WORKFLOW_NOTIFICATION_SETTINGS as readonly string[]).includes(value)
  );
}

/** 오류 문구 1개(없으면 null) */
export function validateApprovalLine(
  line: WorkflowApprovalLineInput,
  options: { writerId?: string | null; allowEmpty?: boolean } = {}
): string | null {
  if (line.steps.length > WORKFLOW_MAX_STEPS) {
    return WORKFLOW_MESSAGES.tooManySteps;
  }
  if (line.steps.some((step) => step.length === 0)) {
    return WORKFLOW_MESSAGES.emptyStep;
  }
  if (!options.allowEmpty && line.steps.length === 0) {
    return WORKFLOW_MESSAGES.approverRequired;
  }
  const approverIds = line.steps.flat();
  if (options.writerId && approverIds.includes(options.writerId)) {
    return WORKFLOW_MESSAGES.writerAsApprover;
  }
  if (new Set(approverIds).size !== approverIds.length) {
    return WORKFLOW_MESSAGES.duplicateApprover;
  }
  const referrerIds = line.referrers.map((referrer) => referrer.user_id);
  if (new Set(referrerIds).size !== referrerIds.length) {
    return WORKFLOW_MESSAGES.duplicateReferrer;
  }
  return null;
}
