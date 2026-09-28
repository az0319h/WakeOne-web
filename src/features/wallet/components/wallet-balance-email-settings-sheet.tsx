'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { WalletBalanceEmailPreferences } from '../api/balance-email.types';
import { WALLET_BALANCE_EMAIL_DEFAULTS } from '../api/balance-email.types';
import { updateWalletBalanceEmailPreferencesMutation } from '../api/mutations';
import { walletBalanceEmailPreferencesQueryOptions } from '../api/queries';
import {
  DUPLICATE_BALANCE_EMAIL_SCHEDULE_MESSAGE,
  formatBalanceEmailScheduleDelivery,
  hasDuplicateBalanceEmailSchedule
} from '../utils/balance-email-schedule';

type WalletBalanceEmailSettingsFormState = {
  enabled: boolean;
  hour: number;
  minute: number;
  slot2_enabled: boolean;
  hour2: number;
  minute2: number;
  exclude_weekends: boolean;
};

interface WalletBalanceEmailSettingsSheetProps {
  targetUser: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function preferencesToFormState(
  preferences: WalletBalanceEmailPreferences
): WalletBalanceEmailSettingsFormState {
  return {
    enabled: preferences.enabled,
    hour: preferences.hour,
    minute: preferences.minute,
    slot2_enabled: preferences.slot2_enabled,
    hour2: preferences.hour2,
    minute2: preferences.minute2,
    exclude_weekends: preferences.exclude_weekends
  };
}

function formStatesEqual(
  left: WalletBalanceEmailSettingsFormState,
  right: WalletBalanceEmailSettingsFormState
) {
  return (
    left.enabled === right.enabled &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.slot2_enabled === right.slot2_enabled &&
    left.hour2 === right.hour2 &&
    left.minute2 === right.minute2 &&
    left.exclude_weekends === right.exclude_weekends
  );
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);

interface BalanceEmailTimeSelectsProps {
  hour: number;
  minute: number;
  disabled: boolean;
  hourId: string;
  minuteId: string;
  hourTestId: string;
  minuteTestId: string;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
}

function BalanceEmailTimeSelects({
  hour,
  minute,
  disabled,
  hourId,
  minuteId,
  hourTestId,
  minuteTestId,
  onHourChange,
  onMinuteChange
}: BalanceEmailTimeSelectsProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='w-full space-y-2'>
        <Label htmlFor={hourId}>시 (KST)</Label>
        <Select
          value={String(hour)}
          onValueChange={(value) => onHourChange(Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id={hourId} data-testid={hourTestId} className='w-full'>
            <SelectValue placeholder='시' />
          </SelectTrigger>
          <SelectContent>
            {HOUR_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {String(option).padStart(2, '0')}시
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='w-full space-y-2'>
        <Label htmlFor={minuteId}>분</Label>
        <Select
          value={String(minute)}
          onValueChange={(value) => onMinuteChange(Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id={minuteId} data-testid={minuteTestId} className='w-full'>
            <SelectValue placeholder='분' />
          </SelectTrigger>
          <SelectContent>
            {MINUTE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {String(option).padStart(2, '0')}분
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function WalletBalanceEmailSettingsForm({
  targetUser,
  onSaved
}: {
  targetUser: string;
  onSaved: () => void;
}) {
  const filters = targetUser === 'self' ? {} : { user: targetUser };
  const { data } = useSuspenseQuery(walletBalanceEmailPreferencesQueryOptions(filters));
  const serverState = useMemo(
    () => preferencesToFormState(data.preferences),
    [data.preferences]
  );

  const [formState, setFormState] = useState(serverState);

  useEffect(() => {
    setFormState(serverState);
  }, [serverState]);

  const saveMutation = useMutation({
    ...updateWalletBalanceEmailPreferencesMutation,
    onSuccess: (response) => {
      notifySuccess('알림 설정이 저장되었습니다.');
      setFormState(preferencesToFormState(response.preferences));
      onSaved();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '알림 설정 저장에 실패했습니다.');
    }
  });

  const isDirty = !formStatesEqual(formState, serverState);
  const slot2Options = {
    slot2Enabled: formState.slot2_enabled,
    hour2: formState.hour2,
    minute2: formState.minute2
  };

  function handleSave() {
    if (hasDuplicateBalanceEmailSchedule(formState)) {
      notifyError(DUPLICATE_BALANCE_EMAIL_SCHEDULE_MESSAGE);
      return;
    }

    void saveMutation.mutateAsync({
      ...(targetUser !== 'self' ? { user: targetUser } : {}),
      patch: formState
    });
  }

  function handleAddSlot2() {
    setFormState((current) => ({
      ...current,
      slot2_enabled: true,
      hour2: current.hour2 ?? WALLET_BALANCE_EMAIL_DEFAULTS.hour2,
      minute2: current.minute2 ?? WALLET_BALANCE_EMAIL_DEFAULTS.minute2
    }));
  }

  function handleRemoveSlot2() {
    setFormState((current) => ({
      ...current,
      slot2_enabled: false
    }));
  }

  return (
    <>
      <div
        className='min-h-0 flex-1 space-y-6 overflow-auto py-2 pr-1'
        data-testid='wallet-balance-email-settings-sheet-body'
      >
        <div className='flex items-center justify-between gap-4'>
          <div className='space-y-1'>
            <Label htmlFor='wallet-balance-email-enabled' className='text-sm font-medium'>
              이메일 알림
            </Label>
            <p className='text-muted-foreground text-xs'>
              {formState.enabled
                ? formatBalanceEmailScheduleDelivery(
                    formState.hour,
                    formState.minute,
                    formState.exclude_weekends,
                    slot2Options
                  )
                : '꺼져 있으면 발송되지 않습니다.'}
            </p>
          </div>
          <Switch
            id='wallet-balance-email-enabled'
            checked={formState.enabled}
            onCheckedChange={(enabled) => setFormState((current) => ({ ...current, enabled }))}
            data-testid='wallet-balance-email-enabled-switch'
          />
        </div>

        <div className='space-y-3'>
          {formState.slot2_enabled ? (
            <p className='text-sm font-medium'>알림 1</p>
          ) : null}
          <BalanceEmailTimeSelects
            hour={formState.hour}
            minute={formState.minute}
            disabled={!formState.enabled}
            hourId='wallet-balance-email-hour'
            minuteId='wallet-balance-email-minute'
            hourTestId='wallet-balance-email-hour'
            minuteTestId='wallet-balance-email-minute'
            onHourChange={(hour) => setFormState((current) => ({ ...current, hour }))}
            onMinuteChange={(minute) => setFormState((current) => ({ ...current, minute }))}
          />
        </div>

        {formState.enabled && formState.slot2_enabled ? (
          <div
            className='space-y-3 rounded-lg border p-4'
            data-testid='wallet-balance-email-slot2-row'
          >
            <div className='flex items-center justify-between gap-3'>
              <p className='text-sm font-medium'>알림 2</p>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={handleRemoveSlot2}
                aria-label='알림 2 삭제'
                data-testid='wallet-balance-email-remove-slot2'
              >
                <Icons.minus className='size-4' />
              </Button>
            </div>
            <BalanceEmailTimeSelects
              hour={formState.hour2}
              minute={formState.minute2}
              disabled={!formState.enabled}
              hourId='wallet-balance-email-hour2'
              minuteId='wallet-balance-email-minute2'
              hourTestId='wallet-balance-email-slot2-hour'
              minuteTestId='wallet-balance-email-slot2-minute'
              onHourChange={(hour2) => setFormState((current) => ({ ...current, hour2 }))}
              onMinuteChange={(minute2) => setFormState((current) => ({ ...current, minute2 }))}
            />
          </div>
        ) : null}

        {formState.enabled && !formState.slot2_enabled ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleAddSlot2}
            data-testid='wallet-balance-email-add-slot'
          >
            <Icons.add className='mr-1 size-4' />
            알림 추가
          </Button>
        ) : null}

        <div className='flex items-center justify-between gap-4'>
          <div className='space-y-1'>
            <Label htmlFor='wallet-balance-email-exclude-weekends' className='text-sm font-medium'>
              주말 제외
            </Label>
            <p className='text-muted-foreground text-xs'>토·일에는 발송하지 않습니다.</p>
          </div>
          <Switch
            id='wallet-balance-email-exclude-weekends'
            checked={formState.exclude_weekends}
            onCheckedChange={(exclude_weekends) =>
              setFormState((current) => ({ ...current, exclude_weekends }))
            }
            disabled={!formState.enabled}
            data-testid='wallet-balance-email-exclude-weekends-switch'
          />
        </div>
      </div>

      <SheetFooter className='border-t pt-4 sm:justify-end'>
        <Button
          type='button'
          variant='outline'
          onClick={onSaved}
          disabled={saveMutation.isPending}
        >
          취소
        </Button>
        <Button
          type='button'
          onClick={handleSave}
          disabled={!isDirty}
          isLoading={saveMutation.isPending}
          data-testid='wallet-balance-email-save'
        >
          저장
        </Button>
      </SheetFooter>
    </>
  );
}

export function WalletBalanceEmailSettingsSheet({
  targetUser,
  open,
  onOpenChange
}: WalletBalanceEmailSettingsSheetProps) {
  const isAdminTarget = targetUser !== 'self';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className='flex min-h-0 flex-col sm:max-w-3xl'
        data-testid='wallet-balance-email-settings-sheet'
      >
        <SheetHeader>
          <SheetTitle>잔액 확인 이메일 알림</SheetTitle>
          <SheetDescription>
            설정한 시각(KST)에 최신 식대 잔액을 이메일과 사이트 알림으로 받습니다.
            {isAdminTarget ? ' 관리자가 다른 사용자의 알림 설정을 수정 중입니다.' : null}
          </SheetDescription>
        </SheetHeader>

        {open ? (
          <WalletBalanceEmailSettingsForm
            key={targetUser}
            targetUser={targetUser}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
