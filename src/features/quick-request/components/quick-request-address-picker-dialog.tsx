'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { quickRequestRecentAddressesQueryOptions } from '../api/queries';
import type { QuickRequestRecentAddress } from '../api/types';
import { QuickRequestDaumPostcodeEmbed } from './quick-request-daum-postcode-embed';
import { QuickRequestQueryBoundary } from './quick-request-query-boundary';

const DESCRIPTION_ID = 'quick-request-address-picker-description';

type QuickRequestRecentAddressListProps = {
  onSelect: (address: QuickRequestRecentAddress) => void;
};

function QuickRequestRecentAddressList({ onSelect }: QuickRequestRecentAddressListProps) {
  const { data: addresses } = useSuspenseQuery(quickRequestRecentAddressesQueryOptions());

  if (addresses.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-12 text-center'>
        <span className='flex size-12 items-center justify-center rounded-full bg-muted'>
          <Icons.clock className='size-6 text-muted-foreground' aria-hidden />
        </span>
        <p className='text-sm font-medium text-foreground'>최근 이용 내역이 없습니다.</p>
        <p className='text-xs text-muted-foreground'>
          퀵 요청을 등록하면 주소가 여기에 저장됩니다.
        </p>
      </div>
    );
  }

  return (
    <ul aria-label='최근 이용 주소' className='divide-y overflow-hidden rounded-lg border bg-card'>
      {addresses.map((address, index) => (
        <li key={`${address.roadAddress}-${address.detailAddress}`}>
          <Button
            type='button'
            variant='ghost'
            data-testid={`quick-request-recent-address-${index}`}
            className='h-auto min-h-11 w-full flex-col items-start gap-0.5 rounded-none px-3 py-3 text-left font-normal whitespace-normal'
            onClick={() => onSelect(address)}
          >
            <span className='w-full text-sm font-medium wrap-break-word text-foreground'>
              {address.roadAddress}
            </span>
            <span className='line-clamp-2 w-full text-sm wrap-break-word text-foreground'>
              {address.detailAddress}
            </span>
            <span className='w-full truncate text-xs text-muted-foreground'>
              {address.contactName} ·{' '}
              {formatPhoneDisplay(address.contactPhone) ?? address.contactPhone}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

type QuickRequestAddressPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoadSelect: (roadAddress: string) => void;
  onRecentSelect: (address: QuickRequestRecentAddress) => void;
  /** 닫힌 뒤 포커스를 보낼 요소 (상세 주소 입력) */
  getReturnFocusElement?: () => HTMLElement | null;
};

/** 주소 검색 Dialog — lg 미만 전체화면 · lg↑ 가운데 (plan 87 D3) */
export function QuickRequestAddressPickerDialog({
  open,
  onOpenChange,
  onRoadSelect,
  onRecentSelect,
  getReturnFocusElement
}: QuickRequestAddressPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid='quick-request-address-picker'
          aria-describedby={DESCRIPTION_ID}
          onCloseAutoFocus={(event) => {
            const target = getReturnFocusElement?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 shadow-lg outline-none',
            'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(44rem,calc(100dvh-4rem))] lg:max-w-xl',
            'lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg lg:border',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        >
          <header className='flex shrink-0 items-start gap-3 border-b px-4 py-3 lg:px-6 lg:py-4'>
            <div className='min-w-0 flex-1 space-y-1'>
              <DialogTitle className='text-base font-semibold'>주소 검색</DialogTitle>
              <DialogDescription id={DESCRIPTION_ID} className='text-sm text-muted-foreground'>
                도로명·건물명·지번으로 검색하거나 최근 이용 내역에서 선택하세요.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-11 shrink-0'
                aria-label='닫기'
              >
                <Icons.close className='size-5' aria-hidden />
              </Button>
            </DialogClose>
          </header>

          <Tabs defaultValue='search' className='flex min-h-0 flex-1 flex-col gap-0'>
            <TabsList className='mx-4 mt-3 grid h-auto w-auto grid-cols-2 lg:mx-6'>
              <TabsTrigger value='search' className='min-h-11'>
                주소 검색
              </TabsTrigger>
              <TabsTrigger value='recent' className='min-h-11'>
                최근 이용 내역
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value='search'
              forceMount
              className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 data-[state=inactive]:hidden lg:px-6'
            >
              <QuickRequestDaumPostcodeEmbed onComplete={onRoadSelect} />
            </TabsContent>
            <TabsContent
              value='recent'
              className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-6'
            >
              <QuickRequestQueryBoundary errorMessage='최근 이용 내역을 불러오지 못했습니다.'>
                <QuickRequestRecentAddressList onSelect={onRecentSelect} />
              </QuickRequestQueryBoundary>
            </TabsContent>
          </Tabs>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
