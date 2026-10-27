import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { quickRequestKeys } from './keys';
import {
  createQuickRequestNote,
  deleteQuickRequestNote,
  notifyQuickRequest,
  recordQuickRequestRecentAddresses,
  updateQuickRequestNote
} from './service';
import type {
  QuickRequestLocation,
  QuickRequestNoteMutationPayload,
  QuickRequestNotifyPayload
} from './types';

export { quickRequestKeys };

export const notifyQuickRequestMutation = mutationOptions({
  mutationFn: (payload: QuickRequestNotifyPayload) => notifyQuickRequest(payload),
  onSettled: () => {
    // 501 placeholder — 목록 캐시 없음
  }
});

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

// plan 87 — 최근 주소 기록 (확인 시 notify와 병렬)

export const recordQuickRequestRecentAddressesMutation = mutationOptions({
  mutationFn: (locations: QuickRequestLocation[]) => recordQuickRequestRecentAddresses(locations),
  onSettled: () => {
    void getQueryClient().invalidateQueries({ queryKey: quickRequestKeys.recentAddresses() });
  }
});
