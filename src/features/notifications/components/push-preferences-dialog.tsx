'use client';

import { Suspense } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Switch } from '@/components/ui/switch';
import { notifySuccess } from '@/lib/notify';
import { updatePushPreferencesMutation } from '../api/push-mutations';
import { pushPreferencesQueryOptions } from '../api/push-queries';
import type { PushGroupKey } from '../lib/push-groups';

interface PushPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PushPreferencesList() {
  const { data } = useSuspenseQuery(pushPreferencesQueryOptions());
  const updateMutation = useMutation(updatePushPreferencesMutation);

  function handleToggle(key: PushGroupKey, enabled: boolean) {
    const current = new Set<PushGroupKey>(data.disabled_groups);
    if (enabled) current.delete(key);
    else current.add(key);

    updateMutation.mutate(
      { disabled_groups: Array.from(current) },
      {
        onSuccess: () => {
          notifySuccess('알림 설정을 저장했습니다.');
        }
      }
    );
  }

  return (
    <ul className='divide-y rounded-md border' data-testid='push-group-list'>
      {data.groups.map((group) => {
        const id = `push-group-${group.key}`;
        const checked = !data.disabled_groups.includes(group.key);
        return (
          <li key={group.key}>
            {/* 행 전체가 Label — 어디를 눌러도 스위치 토글 */}
            <Label
              htmlFor={id}
              className='grid min-h-11 cursor-pointer grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 leading-normal font-normal'
            >
              <span className='block min-w-0'>
                <span className='block text-sm leading-none font-medium'>{group.label}</span>
                <span className='text-muted-foreground mt-0.5 block text-xs'>
                  {group.description}
                </span>
              </span>
              <Switch
                id={id}
                data-testid={id}
                checked={checked}
                aria-label={`${group.label} 휴대폰 알림`}
                onCheckedChange={(next) => handleToggle(group.key, next)}
              />
            </Label>
          </li>
        );
      })}
    </ul>
  );
}

/** plan 91 — 그룹별 휴대폰 알림 ON/OFF. 끈 그룹은 푸시만 막고 인앱 알림은 유지된다. */
export function PushPreferencesDialog({ open, onOpenChange }: PushPreferencesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md' data-testid='push-preferences-dialog'>
        <DialogHeader>
          <DialogTitle>휴대폰 알림 설정</DialogTitle>
          <DialogDescription>
            끈 종류는 휴대폰 알림만 오지 않고, 앱 안 알림은 그대로 보여요.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[70vh] overflow-y-auto overscroll-contain'>
          <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
            <PushPreferencesList />
          </Suspense>
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
