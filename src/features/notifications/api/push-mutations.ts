import { mutationOptions } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { getQueryClient } from '@/lib/query-client';
import {
  detachPushChannelOnThisDevice,
  disablePushOnThisDevice,
  PushPermissionDeniedError,
  resumePushOnThisDevice,
  subscribeThisDevice
} from '../lib/push-client';
import { clearResumeMarker, notifyPushDeviceChanged } from '../lib/push-resume';
import type { PushResumeMarker } from '../lib/push-resume-decision';
import { pushKeys } from './push-queries';
import { deletePushSubscription, sendPushTest, updatePushPreferences } from './push-service';
import type { PushPreferencesResponse, UpdatePushPreferencesPayload } from './push-types';

function invalidatePush() {
  getQueryClient().invalidateQueries({ queryKey: pushKeys.all });
}

/**
 * Switch ON(프로필) · 안내 줄 「다시 켜기」 — permission → subscribe → POST subscriptions `source:'manual'` (push-client).
 * plan 105 — 성공 시 기기 표시 삭제(누가 켜든 「마지막으로 켠 사람」 규칙) + 기기 변경 이벤트.
 * 컴포넌트 `onSuccess` 덮어쓰기와 무관하도록 mutationFn 안에서 처리한다.
 */
export const enablePushOnThisDeviceMutation = mutationOptions({
  mutationFn: async () => {
    const result = await subscribeThisDevice();
    clearResumeMarker();
    notifyPushDeviceChanged();
    return result;
  },
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

/**
 * Switch OFF · 「이 기기」 해제 — DELETE {endpoint, source:'manual'} → subscription.unsubscribe().
 * plan 105 — 성공 시 기기 표시 삭제 + 기기 변경 이벤트.
 */
export const disablePushOnThisDeviceMutation = mutationOptions({
  mutationFn: async () => {
    const result = await disablePushOnThisDevice();
    clearResumeMarker();
    notifyPushDeviceChanged();
    return result;
  },
  onError: (error) => {
    notifyError(error instanceof Error ? error.message : '휴대폰 알림을 끌 수 없어요.');
  },
  onSettled: () => {
    invalidatePush();
  }
});

/**
 * plan 105 — 대시보드 진입 자동 복구(`PushResumeSync`). 사용자 액션이 아니라 조용히 끝난다(오류 토스트 없음).
 * mutationFn은 던지지 않고 `ResumeOutcome`(토스트·안내 줄·기기 갱신 여부)을 돌려준다. 표시 삭제는 push-client가 적용한다.
 */
export const autoResumePushMutation = mutationOptions({
  mutationFn: (marker: PushResumeMarker) => resumePushOnThisDevice(marker),
  onSettled: () => {
    invalidatePush();
  }
});

/**
 * plan 105 — 표시 없는 통로가 내 기기 목록에 없을 때 이전 사용자 연결 해제(`POST …/subscriptions/detach`).
 * mutationFn은 던지지 않고 `DetachOutcome`을 돌려준다(표시 기록·통로 정리는 push-client가 적용).
 */
export const detachPushChannelMutation = mutationOptions({
  mutationFn: (subscription: PushSubscription) => detachPushChannelOnThisDevice(subscription),
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
