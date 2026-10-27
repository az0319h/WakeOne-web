'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PushPreferencesResponse } from '../api/push-types';
import {
  findThisDevice,
  getCurrentPushSubscription,
  getNotificationPermission,
  hashEndpoint,
  isIosDevice,
  isPushSupported,
  isStandaloneDisplay,
  type PushDeviceStatus
} from '../lib/push-client';

type LocalPushState = {
  ready: boolean;
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  endpointHash: string | null;
  isIos: boolean;
  isStandalone: boolean;
};

const INITIAL_STATE: LocalPushState = {
  ready: false,
  supported: false,
  permission: 'unsupported',
  endpointHash: null,
  isIos: false,
  isStandalone: false
};

export type PushDeviceStatusResult = LocalPushState & {
  status: PushDeviceStatus;
  /** 브라우저 구독 + 서버 기기 목록 일치 시 그 기기 */
  thisDeviceId: number | null;
  refresh: () => Promise<void>;
};

/**
 * plan 91 §상태 모델 — 5종 판정. 모든 브라우저 API 접근은 mount 이후(useEffect) → 하이드레이션 안전.
 * `preferences`가 없으면(배너 loading 등) 서버 의존 판정(`not_configured`·`on`)은 건너뛴다.
 */
export function usePushDeviceStatus(
  preferences: PushPreferencesResponse | undefined
): PushDeviceStatusResult {
  const [local, setLocal] = useState<LocalPushState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    const supported = isPushSupported();
    const permission = getNotificationPermission();
    let endpointHash: string | null = null;

    if (supported && permission === 'granted') {
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        try {
          endpointHash = await hashEndpoint(subscription.endpoint);
        } catch {
          endpointHash = null;
        }
      }
    }

    setLocal({
      ready: true,
      supported,
      permission,
      endpointHash,
      isIos: isIosDevice(),
      isStandalone: isStandaloneDisplay()
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  let status: PushDeviceStatus = 'loading';
  let thisDeviceId: number | null = null;

  if (local.ready) {
    const thisDevice = preferences ? findThisDevice(preferences.devices, local.endpointHash) : undefined;
    thisDeviceId = thisDevice?.id ?? null;

    if (!local.supported) status = 'unsupported';
    else if (preferences && !preferences.configured) status = 'not_configured';
    else if (local.permission === 'denied') status = 'denied';
    else if (thisDevice) status = 'on';
    else status = 'off';
  }

  return { ...local, status, thisDeviceId, refresh };
}
