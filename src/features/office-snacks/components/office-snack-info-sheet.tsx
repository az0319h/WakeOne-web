'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { OfficeSnackSession } from '../api/types';
import { formatKoreanDateTime } from './office-snack-utils';

interface OfficeSnackInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: OfficeSnackSession;
}

export function OfficeSnackInfoSheet({ open, onOpenChange, session }: OfficeSnackInfoSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>회차 정보</SheetTitle>
          <SheetDescription>등록/투표 운영 일정을 확인할 수 있습니다.</SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-4 overflow-auto py-2 text-sm'>
          <section className='space-y-1'>
            <p className='text-muted-foreground'>회차 이름</p>
            <p className='font-medium'>{session.title}</p>
          </section>

          <section className='space-y-1'>
            <p className='text-muted-foreground'>설명</p>
            <p>{session.description?.trim() || '설명이 등록되지 않았습니다.'}</p>
          </section>

          <section className='space-y-1'>
            <p className='text-muted-foreground'>등록 기간</p>
            <p>
              {formatKoreanDateTime(session.registration_start_at)} ~{' '}
              {formatKoreanDateTime(session.registration_end_at)}
            </p>
          </section>

          <section className='space-y-1'>
            <p className='text-muted-foreground'>투표 기간</p>
            <p>
              {formatKoreanDateTime(session.voting_start_at)} ~{' '}
              {formatKoreanDateTime(session.voting_end_at)}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
