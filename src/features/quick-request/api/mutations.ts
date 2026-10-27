import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { quickRequestKeys } from './keys';
import {
  acceptQuickRequest,
  approveQuickRequest,
  cancelQuickRequest,
  createQuickRequest,
  createQuickRequestNote,
  deleteQuickRequestNote,
  dispatchQuickRequest,
  setQuickRequestFinalAmount,
  updateQuickRequest,
  updateQuickRequestNote
} from './service';
import type {
  QuickRequestCancelPayload,
  QuickRequestCreatePayload,
  QuickRequestDispatchPayload,
  QuickRequestNoteMutationPayload,
  QuickRequestPatchPayload
} from './types';

export { quickRequestKeys };

// plan 87 — 특이사항 칩 CUD · 캐시 갱신은 onSettled에서만

export const createQuickRequestNoteMutation = mutationOptions({
  mutationFn: (payload: QuickRequestNoteMutationPayload) => createQuickRequestNote(payload),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

export const updateQuickRequestNoteMutation = mutationOptions({
  mutationFn: (params: { id: number; payload: QuickRequestNoteMutationPayload }) =>
    updateQuickRequestNote(params),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

export const deleteQuickRequestNoteMutation = mutationOptions({
  mutationFn: (id: number) => deleteQuickRequestNote(id),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.all });
  }
});

// ---------------------------------------------------------------------------
// plan 89 — 퀵 업무 흐름 · 성공/실패(409 포함) 모두 목록·카드·상세를 다시 읽는다
// ---------------------------------------------------------------------------

function invalidateQuickRequestWorkflow() {
  const queryClient = getQueryClient();
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.summary() });
  void queryClient.invalidateQueries({ queryKey: quickRequestKeys.details() });
}

/** 등록 — 최근 주소는 서버가 기록하므로 recent-addresses도 갱신한다 (plan 89 D-12) */
export const createQuickRequestMutation = mutationOptions({
  mutationFn: (payload: QuickRequestCreatePayload) => createQuickRequest(payload),
  onSettled: () => {
    invalidateQuickRequestWorkflow();
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.recentAddresses() });
  }
});

export const updateQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload: QuickRequestPatchPayload }) =>
    updateQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const setQuickRequestFinalAmountMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; finalAmount: number }) =>
    setQuickRequestFinalAmount(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const acceptQuickRequestMutation = mutationOptions({
  mutationFn: (requestNo: string) => acceptQuickRequest(requestNo),
  onSettled: invalidateQuickRequestWorkflow
});

export const dispatchQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload: QuickRequestDispatchPayload }) =>
    dispatchQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});

export const approveQuickRequestMutation = mutationOptions({
  mutationFn: (requestNo: string) => approveQuickRequest(requestNo),
  onSettled: invalidateQuickRequestWorkflow
});

export const cancelQuickRequestMutation = mutationOptions({
  mutationFn: (params: { requestNo: string; payload?: QuickRequestCancelPayload }) =>
    cancelQuickRequest(params),
  onSettled: invalidateQuickRequestWorkflow
});
