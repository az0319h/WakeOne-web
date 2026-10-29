'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifySuccess } from '@/lib/notify';
import { getQueryClient } from '@/lib/query-client';
import {
  autoResumePushMutation,
  detachPushChannelMutation,
  enablePushOnThisDeviceMutation
} from '../api/push-mutations';
import { pushPreferencesQueryOptions } from '../api/push-queries';
import { isSubscriptionInDevices, readPushDeviceSnapshot } from '../lib/push-client';
import {
  clearResumeMarker,
  hashPushOwner,
  notifyPushDeviceChanged,
  readResumeMarker,
  releaseResumeLock,
  subscribePushDeviceChanged,
  subscribeResumeMarkerRemoved,
  tryAcquireResumeLock
} from '../lib/push-resume';
import { decideDeviceSync, type DeviceSyncInput } from '../lib/push-resume-decision';
import { PushResumeBanner } from './push-resume-banner';
import { PUSH_RESUME_SUCCESS_TEXT } from './push-status-texts';

/** 통로가 내 서버 기기인지 — GET preferences(최신) · 실패하면 null(이번 진입은 건너뛰고 다음 진입에 다시 판정) */
async function checkSubscriptionIsMine(subscription: PushSubscription): Promise<boolean | null> {
  try {
    const preferences = await getQueryClient().fetchQuery({
      ...pushPreferencesQueryOptions(),
      staleTime: 0
    });
    return await isSubscriptionInDevices(subscription, preferences.devices);
  } catch {
    return null;
  }
}

interface PushResumeSyncProps {
  userId: string;
}

/**
 * plan 105 — 대시보드 진입 시 1회 「이 기기 휴대폰 알림」 동기화 (dashboard layout · `IosInstallBanner` 다음).
 * - 표시 owner = 나 → 자동 복구(`requestPermission` 없이 · POST `source:'auto_resume'`) → 토스트 1회 / 실패 → 안내 줄
 * - 표시 없음 · 통로가 내 기기 목록에 없음 → detach(이전 사람 연결 끊기 · 주인 없는 통로 정리)
 * 결정은 전부 `decideDeviceSync`(순수 모듈) — 여기서는 실행만 한다. 판정 중에는 아무것도 렌더하지 않는다(null).
 */
export function PushResumeSync({ userId }: PushResumeSyncProps) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const startedForRef = useRef<string | null>(null);

  const { mutateAsync: resumeAsync } = useMutation(autoResumePushMutation);
  const { mutateAsync: detachAsync } = useMutation(detachPushChannelMutation);
  const enableMutation = useMutation(enablePushOnThisDeviceMutation);

  useEffect(() => {
    // dev StrictMode 이중 실행·리렌더에도 진입당 1회만
    if (startedForRef.current === userId) return;
    startedForRef.current = userId;

    void (async () => {
      const [snapshot, myOwnerHash] = await Promise.all([
        readPushDeviceSnapshot(),
        hashPushOwner(userId)
      ]);
      if (!myOwnerHash) return;

      const subscription = snapshot.subscription;
      const input: DeviceSyncInput = {
        pushSupported: snapshot.pushSupported,
        vapidKeyPresent: snapshot.vapidKeyPresent,
        permission: snapshot.permission,
        hasSubscription: subscription !== null,
        marker: readResumeMarker(),
        myOwnerHash
      };
      let decision = decideDeviceSync(input);

      if (decision.type === 'noop') return;
      if (decision.type === 'clear_marker') {
        clearResumeMarker();
        return;
      }
      if (decision.type === 'show_banner') {
        setBannerVisible(true);
        return;
      }

      // resume · check_ownership · detach — 서버 호출이 있으므로 다른 탭과 15초 잠금으로 1회만
      if (!tryAcquireResumeLock()) return;
      try {
        if (decision.type === 'check_ownership') {
          if (!subscription) return;
          const subscriptionIsMine = await checkSubscriptionIsMine(subscription);
          if (subscriptionIsMine === null) return;
          decision = decideDeviceSync({ ...input, subscriptionIsMine });
        }

        if (decision.type === 'detach') {
          if (!subscription) return;
          const outcome = await detachAsync(subscription);
          if (outcome.refreshDevices) notifyPushDeviceChanged();
          return;
        }

        if (decision.type === 'resume') {
          const outcome = await resumeAsync(decision.marker);
          if (outcome.toastSuccess) notifySuccess(PUSH_RESUME_SUCCESS_TEXT);
          if (outcome.refreshDevices) notifyPushDeviceChanged();
          if (outcome.showBanner) setBannerVisible(true);
        }
      } catch {
        /* mutationFn은 던지지 않는다 — 예외 상황은 조용히 끝내고 다음 진입에 다시 판정 */
      } finally {
        releaseResumeLock();
      }
    })();
  }, [userId, resumeAsync, detachAsync]);

  // 다른 탭의 자동 복구 성공 · 같은 탭 프로필 스위치 ON → 표시가 사라지면 안내 줄도 숨긴다
  useEffect(() => {
    if (!bannerVisible) return;
    const hideIfMarkerGone = () => {
      if (!readResumeMarker()) setBannerVisible(false);
    };
    const offDeviceChanged = subscribePushDeviceChanged(hideIfMarkerGone);
    const offMarkerRemoved = subscribeResumeMarkerRemoved(() => setBannerVisible(false));
    return () => {
      offDeviceChanged();
      offMarkerRemoved();
    };
  }, [bannerVisible]);

  if (!bannerVisible) return null;

  function handleEnable() {
    // 사용자 제스처 안에서 바로 시작 — 권한 요청 + 구독 + POST `source:'manual'`.
    // 표시 삭제·기기 변경 이벤트·pushKeys invalidate는 push-mutations가 맡고, 실패 토스트는 mutation 기본 onError.
    enableMutation.mutate(undefined, {
      onSuccess: () => {
        notifySuccess(PUSH_RESUME_SUCCESS_TEXT);
        setBannerVisible(false);
      }
    });
  }

  function handleDismiss() {
    clearResumeMarker();
    setBannerVisible(false);
  }

  return (
    <PushResumeBanner
      isPending={enableMutation.isPending}
      onEnable={handleEnable}
      onDismiss={handleDismiss}
    />
  );
}
