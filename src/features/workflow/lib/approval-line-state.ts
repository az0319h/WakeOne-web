/**
 * 결재선 편집기 화면 상태 — 작성 폼 · 결재선 변경 · 기본 결재선 설정이 공유한다.
 * API payload(`steps: string[][]`, `referrers`)로 바꾸는 함수도 여기 둔다.
 */
import type { WorkflowNotificationSetting } from './approval-line-rules';
import type {
  WorkflowDefaultLine,
  WorkflowDocumentDetail,
  WorkflowMember,
  WorkflowStepStatus
} from '../api/types';

export type WorkflowLineActor = {
  member: WorkflowMember;
  /** 이미 승인함 (변경 모드에서 제거 불가) */
  approved?: boolean;
};

export type WorkflowLineStep = {
  actors: WorkflowLineActor[];
  /** 변경 모드: APPROVED 단계는 잠금 */
  status?: WorkflowStepStatus;
};

export type WorkflowLineReferrer = {
  member: WorkflowMember;
  notification_setting: WorkflowNotificationSetting;
};

export type WorkflowLineValue = {
  steps: WorkflowLineStep[];
  referrers: WorkflowLineReferrer[];
};

export const EMPTY_WORKFLOW_LINE: WorkflowLineValue = { steps: [], referrers: [] };

export function lineToPayload(line: WorkflowLineValue): {
  steps: string[][];
  referrers: { user_id: string; notification_setting: WorkflowNotificationSetting }[];
} {
  return {
    steps: line.steps.map((step) => step.actors.map((actor) => actor.member.user_id)),
    referrers: line.referrers.map((referrer) => ({
      user_id: referrer.member.user_id,
      notification_setting: referrer.notification_setting
    }))
  };
}

/** 비교용 서명 (dirty 판정) */
export function lineSignature(line: WorkflowLineValue): string {
  return JSON.stringify(lineToPayload(line));
}

/** 양식 기본 결재선 → 편집 상태. excludeUserId(작성자)는 승인 단계에서 뺀다(빈 단계는 남김) */
export function lineFromDefault(
  defaultLine: WorkflowDefaultLine,
  options: { excludeUserId?: string | null } = {}
): WorkflowLineValue {
  return {
    steps: [...defaultLine.steps]
      .sort((a, b) => a.step - b.step)
      .map((step) => ({
        actors: step.actors
          .filter((member) => member.user_id !== options.excludeUserId)
          .map((member) => ({ member }))
      })),
    referrers: defaultLine.referrers.map((referrer) => ({
      member: referrer.member,
      notification_setting: referrer.notification_setting
    }))
  };
}

/** 문서 결재선 → 편집 상태 (withStatus=true면 변경 모드 잠금 정보 포함) */
export function lineFromDocument(
  document: Pick<WorkflowDocumentDetail, 'steps' | 'referrers'>,
  options: { withStatus?: boolean } = {}
): WorkflowLineValue {
  return {
    steps: [...document.steps]
      .sort((a, b) => a.step - b.step)
      .map((step) => ({
        status: options.withStatus ? step.status : undefined,
        actors: step.actors.map((actor) => ({
          member: actor,
          approved: options.withStatus ? actor.status === 'APPROVED' : undefined
        }))
      })),
    referrers: document.referrers.map((referrer) => ({
      member: referrer,
      notification_setting: referrer.notification_setting
    }))
  };
}

/** 임시저장 payload(id) → 편집 상태 (구성원 목록으로 표시 정보 채움, 모르는 id는 버림) */
export function lineFromIds(
  input: {
    steps: string[][];
    referrers: { user_id: string; notification_setting: WorkflowNotificationSetting }[];
  },
  members: Map<string, WorkflowMember>
): WorkflowLineValue {
  return {
    steps: input.steps.map((ids) => ({
      actors: ids.flatMap((id) => {
        const member = members.get(id);
        return member ? [{ member }] : [];
      })
    })),
    referrers: input.referrers.flatMap((referrer) => {
      const member = members.get(referrer.user_id);
      return member ? [{ member, notification_setting: referrer.notification_setting }] : [];
    })
  };
}
