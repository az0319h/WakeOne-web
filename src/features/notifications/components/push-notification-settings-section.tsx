'use client';

import { Suspense, useEffect, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Switch } from '@/components/ui/switch';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifySuccess } from '@/lib/notify';
import {
  disablePushOnThisDeviceMutation,
  enablePushOnThisDeviceMutation,
  removePushDeviceMutation,
  sendPushTestMutation
} from '../api/push-mutations';
import { pushPreferencesQueryOptions } from '../api/push-queries';
import type { PushDevice } from '../api/push-types';
import { usePushDeviceStatus } from '../hooks/use-push-device-status';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  subscribeInstallPrompt,
  summarizeUserAgent,
  type PushDeviceStatus
} from '../lib/push-client';
import { IosInstallGuideDialog } from './ios-install-guide-dialog';
import { PushPreferencesDialog } from './push-preferences-dialog';
import {
  PUSH_STATUS_DENIED_TEXT,
  PUSH_STATUS_LOADING_TEXT,
  PUSH_STATUS_NOT_CONFIGURED_TEXT,
  PUSH_STATUS_OFF_TEXT,
  PUSH_STATUS_ON_TEXT,
  PUSH_STATUS_UNSUPPORTED_IOS_HINT,
  PUSH_STATUS_UNSUPPORTED_TEXT
} from './push-status-texts';

const TOGGLE_DISABLED_STATUSES: ReadonlySet<PushDeviceStatus> = new Set([
  'loading',
  'unsupported',
  'not_configured',
  'denied'
]);

function useInstallPromptAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(getDeferredInstallPrompt() !== null);
    return subscribeInstallPrompt(() => setAvailable(getDeferredInstallPrompt() !== null));
  }, []);

  return available;
}

function statusMessage(status: PushDeviceStatus): string {
  switch (status) {
    case 'unsupported':
      return PUSH_STATUS_UNSUPPORTED_TEXT;
    case 'not_configured':
      return PUSH_STATUS_NOT_CONFIGURED_TEXT;
    case 'denied':
      return PUSH_STATUS_DENIED_TEXT;
    case 'on':
      return PUSH_STATUS_ON_TEXT;
    case 'off':
      return PUSH_STATUS_OFF_TEXT;
    default:
      return PUSH_STATUS_LOADING_TEXT;
  }
}

function isWarningStatus(status: PushDeviceStatus) {
  return status === 'denied' || status === 'not_configured' || status === 'unsupported';
}

interface DeviceRowProps {
  device: PushDevice;
  isThisDevice: boolean;
  isPending: boolean;
  onRemove: (device: PushDevice, isThisDevice: boolean) => void;
}

function DeviceRow({ device, isThisDevice, isPending, onRemove }: DeviceRowProps) {
  return (
    <li
      className='flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm'
      data-testid={`push-device-${device.id}`}
    >
      <Icons.smartphone className='text-muted-foreground size-4 shrink-0' aria-hidden />
      <span className='font-medium'>{summarizeUserAgent(device.user_agent)}</span>
      {isThisDevice ? <Badge variant='secondary'>이 기기</Badge> : null}
      <span className='text-muted-foreground text-xs'>
        마지막 발송{' '}
        {device.last_used_at ? (
          <time dateTime={device.last_used_at} className='font-mono whitespace-nowrap'>
            {formatAbsoluteDateTimeKo(device.last_used_at)}
          </time>
        ) : (
          '—'
        )}
      </span>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='ml-auto'
        disabled={isPending}
        onClick={() => onRemove(device, isThisDevice)}
      >
        해제
      </Button>
    </li>
  );
}

function PushSettingsBody() {
  const { data } = useSuspenseQuery(pushPreferencesQueryOptions());
  const { status, thisDeviceId, isIos, isStandalone, refresh } = usePushDeviceStatus(data);
  const installPromptAvailable = useInstallPromptAvailable();

  const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const enableMutation = useMutation(enablePushOnThisDeviceMutation);
  const disableMutation = useMutation(disablePushOnThisDeviceMutation);
  const removeDeviceMutation = useMutation(removePushDeviceMutation);
  const testMutation = useMutation(sendPushTestMutation);

  const isToggling = enableMutation.isPending || disableMutation.isPending;
  const checked = optimisticChecked ?? status === 'on';
  const toggleDisabled = TOGGLE_DISABLED_STATUSES.has(status) || isToggling;

  function handleToggle(next: boolean) {
    setOptimisticChecked(next);
    const callbacks = {
      onSuccess: () => {
        notifySuccess(next ? '휴대폰 알림을 켰어요.' : '이 기기의 휴대폰 알림을 꺼요.');
      },
      onSettled: () => {
        setOptimisticChecked(null);
        void refresh();
      }
    };
    if (next) enableMutation.mutate(undefined, callbacks);
    else disableMutation.mutate(undefined, callbacks);
  }

  function handleRemoveDevice(device: PushDevice, isThisDevice: boolean) {
    if (isThisDevice) {
      handleToggle(false);
      return;
    }
    removeDeviceMutation.mutate(device.id, {
      onSuccess: () => {
        notifySuccess('기기를 해제했어요.');
      }
    });
  }

  async function handleInstallClick() {
    if (isIos) {
      setGuideOpen(true);
      return;
    }
    const prompt = getDeferredInstallPrompt();
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* 사용자가 닫음 */
    } finally {
      clearDeferredInstallPrompt();
    }
  }

  function handleTestSend() {
    testMutation.mutate(undefined, {
      onSuccess: () => {
        notifySuccess('테스트 알림을 보냈어요.');
      }
    });
  }

  const showInstallButton = !isStandalone && status !== 'loading' && (installPromptAvailable || isIos);
  const StatusIcon = isWarningStatus(status) ? Icons.alertCircle : Icons.info;

  return (
    <div className='space-y-4'>
      <Alert data-testid='push-status' data-status={status} aria-live='polite'>
        <StatusIcon aria-hidden />
        <AlertDescription>
          <p>{statusMessage(status)}</p>
          {status === 'unsupported' && isIos ? (
            <p className='flex flex-wrap items-center gap-x-2'>
              <span>{PUSH_STATUS_UNSUPPORTED_IOS_HINT}</span>
              <button
                type='button'
                className='text-foreground font-medium underline underline-offset-4'
                onClick={() => setGuideOpen(true)}
              >
                방법 보기
              </button>
            </p>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className='flex items-center justify-between gap-4 rounded-md border px-3 py-3'>
        <Label htmlFor='push-toggle' className='cursor-pointer'>
          이 기기에서 휴대폰 알림 받기
        </Label>
        <Switch
          id='push-toggle'
          data-testid='push-toggle'
          checked={checked}
          disabled={toggleDisabled}
          onCheckedChange={handleToggle}
        />
      </div>

      <div className='flex flex-wrap gap-2'>
        {showInstallButton ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            data-testid='push-install-open'
            onClick={handleInstallClick}
          >
            <Icons.download className='size-4' />
            홈 화면에 추가
          </Button>
        ) : null}
        {status === 'on' ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            data-testid='push-test-send'
            isLoading={testMutation.isPending}
            onClick={handleTestSend}
          >
            <Icons.send className='size-4' />
            테스트 알림 보내기
          </Button>
        ) : null}
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid='push-section-preferences-open'
          onClick={() => setPreferencesOpen(true)}
        >
          <Icons.settings className='size-4' />
          알림 종류 설정
        </Button>
      </div>

      <div className='space-y-2'>
        <h3 className='text-sm font-medium' data-testid='push-device-count'>
          등록된 기기 {data.device_count}대
        </h3>
        {data.devices.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            아직 등록된 기기가 없어요. 위 스위치를 켜면 이 기기가 등록돼요.
          </p>
        ) : (
          <ul className='divide-y rounded-md border' data-testid='push-device-list'>
            {data.devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                isThisDevice={device.id === thisDeviceId}
                isPending={removeDeviceMutation.isPending || isToggling}
                onRemove={handleRemoveDevice}
              />
            ))}
          </ul>
        )}
      </div>

      <IosInstallGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
      <PushPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </div>
  );
}

/** plan 91 — 프로필 「휴대폰 알림」 섹션 (user·admin 공용). 헤더는 Suspense 밖. */
export function PushNotificationSettingsSection() {
  return (
    <section id='push' className='scroll-mt-20 space-y-4' data-testid='push-settings-section'>
      <div>
        <h2 className='text-lg font-semibold tracking-tight'>휴대폰 알림</h2>
        <p className='text-muted-foreground text-sm'>
          사이트를 열지 않아도 휴대폰 상단에 알림을 받습니다.
        </p>
      </div>
      <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
        <PushSettingsBody />
      </Suspense>
    </section>
  );
}
