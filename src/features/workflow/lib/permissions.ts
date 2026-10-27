/**
 * 문서 단위 권한 플래그 (PERMISSIONS.md §2·§3). 상세 API가 계산해 내려주고 화면은 그대로 쓴다.
 * 최종 판정은 RPC가 다시 한다(이 함수는 표시용 + Route 선검사용).
 */
export type WorkflowDocumentStatus = 'IN_PROGRESS' | 'DONE' | 'DECLINED' | 'CANCELED';
export type WorkflowEditPolicy = 'AUTHOR_AND_APPROVER' | 'AUTHOR_ONLY';

export type WorkflowPermissions = {
  can_approve: boolean;
  can_edit: boolean;
  can_change_line: boolean;
  can_cancel: boolean;
  can_duplicate: boolean;
};

export function computeWorkflowPermissions(input: {
  viewerId: string;
  writerId: string;
  status: WorkflowDocumentStatus;
  currentStep: number;
  editPolicy: WorkflowEditPolicy;
  approvalStepEditEnabled: boolean;
  actors: { user_id: string; step: number; status: 'WAITING' | 'APPROVED' | 'DECLINED' }[];
}): WorkflowPermissions {
  const inProgress = input.status === 'IN_PROGRESS';
  const isWriter = input.viewerId === input.writerId;
  const isActor = input.actors.some((actor) => actor.user_id === input.viewerId);
  const isCurrentWaiting = input.actors.some(
    (actor) =>
      actor.user_id === input.viewerId &&
      actor.step === input.currentStep &&
      actor.status === 'WAITING'
  );

  return {
    can_approve: inProgress && isCurrentWaiting,
    can_edit: inProgress && (isWriter || (input.editPolicy === 'AUTHOR_AND_APPROVER' && isActor)),
    can_change_line: inProgress && isWriter && input.approvalStepEditEnabled,
    can_cancel: inProgress && isWriter,
    can_duplicate: isWriter
  };
}
