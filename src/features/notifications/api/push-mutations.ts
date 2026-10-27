import { mutationOptions } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { getQueryClient } from '@/lib/query-client';
import {
  disablePushOnThisDevice,
  PushPermissionDeniedError,
  subscribeThisDevice
} from '../lib/push-client';
import { pushKeys } from './push-queries';
import { deletePushSubscription, sendPushTest, updatePushPreferences } from './push-service';
import type { PushPreferencesResponse, UpdatePushPreferencesPayload } from './push-types';

function invalidatePush() {
  getQueryClient().invalidateQueries({ queryKey: pushKeys.all });
}

/** Switch ON — permission → subscribe → POST subscriptions (push-client) */
export const enablePushOnThisDeviceMutation = mutationOptions({
  mutationFn: () => subscribeThisDevice(),
  onError: (error) => {
    if (error instanceof PushPermissionDeniedError) {
      notifyError('알림이 차단되어 있어요. 브라우저 설정에서 WakeOne 알림을 허용해 주세요.');
      return;
    }
    notifyError(error instanceof Error ? error.message : '휴대폰 알림을 켤 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});

/** Switch OFF — DELETE {endpoint} → subscription.unsubscribe() */
export const disablePushOnThisDeviceMutation = mutationOptions({
  mutationFn: () => disablePushOnThisDevice(),
  onError: (error) => {
    notifyError(error instanceof Error ? error.message : '휴대폰 알림을 끌 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});

/** 다른 기기 「해제」 — DELETE {id} */
export const removePushDeviceMutation = mutationOptions({
  mutationFn: (id: number) => deletePushSubscription({ id }),
  onError: (error) => {
    notifyError(error instanceof Error ? error.message : '기기를 해제할 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});

type PreferencesMutationContext = {
  previous: PushPreferencesResponse | undefined;
};

/** PUT preferences — 낙관적 토글 · 실패 롤백 */
export const updatePushPreferencesMutation = mutationOptions({
  mutationFn: (payload: UpdatePushPreferencesPayload) => updatePushPreferences(payload),
  onMutate: async (payload) => {
    const queryClient = getQueryClient();
    await queryClient.cancelQueries({ queryKey: pushKeys.preferences() });
    const previous = queryClient.getQueryData<PushPreferencesResponse>(pushKeys.preferences());
    if (previous) {
      queryClient.setQueryData<PushPreferencesResponse>(pushKeys.preferences(), {
        ...previous,
        disabled_groups: payload.disabled_groups
      });
    }
    return { previous } satisfies PreferencesMutationContext;
  },
  onError: (error, _payload, context) => {
    if (context?.previous) {
      getQueryClient().setQueryData(pushKeys.preferences(), context.previous);
    }
    notifyError(error instanceof Error ? error.message : '알림 설정을 저장할 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});

/** POST test — 성공 시 last_used_at 갱신·410 기기 정리가 반영되므로 invalidate */
export const sendPushTestMutation = mutationOptions({
  mutationFn: () => sendPushTest(),
  onError: (error) => {
    notifyError(error instanceof Error ? error.message : '테스트 알림을 보낼 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});
