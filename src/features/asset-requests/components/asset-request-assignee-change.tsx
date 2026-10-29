'use client';

import { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AssetLedgerErrorAlert,
  AssetLedgerQueryBoundary
} from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { nameInitials } from '@/features/asset-ledger/lib/ui-labels';
import { assigneeOptionsQueryOptions } from '@/features/subscriptions/api/queries';
import { notifyError, notifySuccess } from '@/lib/notify';
import { changeAssetRequestAssigneeMutation } from '../api/mutations';

type ManagerOptionsProps = {
  currentAssigneeId: string | null;
  onSelect: (userId: string) => void;
};

/** 후보 = `assignee-options`의 `managers`(active 권한자 · 동방 제외 · AC-29) */
function ManagerOptions({ currentAssigneeId, onSelect }: ManagerOptionsProps) {
  const { data } = useSuspenseQuery(assigneeOptionsQueryOptions());
  return (
    <>
      <CommandEmpty>찾는 사람이 없어요.</CommandEmpty>
      <CommandGroup>
        {data.managers.map((manager) => (
          <CommandItem
            key={manager.user_id}
            value={`${manager.full_name} ${manager.team_label ?? ''} ${manager.user_id}`}
            data-testid={`asset-request-assignee-option-${manager.user_id}`}
            onSelect={() => onSelect(manager.user_id)}
            className='min-h-11 gap-2'
          >
            <Avatar className='size-6'>
              <AvatarFallback className='text-[10px]'>{nameInitials(manager.full_name)}</AvatarFallback>
            </Avatar>
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className='truncate text-sm' translate='no'>
                {manager.full_name}
              </span>
              {manager.team_label ? (
                <span className='truncate text-xs text-muted-foreground'>{manager.team_label}</span>
              ) : null}
            </span>
            {manager.user_id === currentAssigneeId ? (
              <Icons.check aria-label='현재 담당자' className='size-4 shrink-0' />
            ) : null}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

type AssetRequestAssigneeChangeProps = {
  requestId: number;
  currentAssigneeId: string | null;
};

/** 「담당자 변경」 (권한자 · 처리중) — 현재 담당자를 다시 고르면 아무것도 하지 않는다 */
export function AssetRequestAssigneeChange({ requestId, currentAssigneeId }: AssetRequestAssigneeChangeProps) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    ...changeAssetRequestAssigneeMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '담당자를 바꿨어요.');
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '담당자를 바꾸지 못했어요.');
    }
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-9 md:h-8'
          data-testid='asset-request-assignee-change'
          isLoading={mutation.isPending}
        >
          담당자 변경
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 max-w-[calc(100vw-2rem)] p-0'>
        <Command>
          <CommandInput placeholder='이름 검색' />
          <CommandList className='max-h-72'>
            <AssetLedgerQueryBoundary
              errorMessage='담당자 후보를 불러오지 못했어요.'
              loadingFallback={<PageLoadingSpinner variant='compact' />}
              renderError={(_error, retry) => (
                <div className='p-2'>
                  <AssetLedgerErrorAlert message='담당자 후보를 불러오지 못했어요.' onRetry={retry} />
                </div>
              )}
            >
              <ManagerOptions
                currentAssigneeId={currentAssigneeId}
                onSelect={(userId) => {
                  setOpen(false);
                  if (userId === currentAssigneeId) return;
                  mutation.mutate({ id: requestId, assigneeUserId: userId });
                }}
              />
            </AssetLedgerQueryBoundary>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
